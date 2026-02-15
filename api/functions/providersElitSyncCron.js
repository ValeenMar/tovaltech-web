const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getProductsClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function getProvidersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PROVIDERS_TABLE_NAME || "Providers";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "2" || s === "usd") return "USD";
  if (s === "1" || s === "ars") return "ARS";
  return String(v || "USD").toUpperCase();
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsvToObjects(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l && l.trim().length);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = vals[j] ?? "";
    rows.push(obj);
  }
  return rows;
}

function normalizeKey(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreEntityQuality(p) {
  let score = 0;
  if (p.imageUrl) score += 3;
  if (p.thumbUrl) score += 2;
  if (p.ivaRate != null && p.ivaRate !== 0) score += 2;
  if (p.price != null && p.price > 0) score += 1;
  return score;
}

async function fetchElitCsvRaw() {
  const userId = process.env.ELIT_USER_ID || "";
  const token = process.env.ELIT_TOKEN || "";
  if (!userId || !token) throw new Error("Faltan variables ELIT_USER_ID / ELIT_TOKEN");

  const url = `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${userId}&token=${token}`;
  const res = await fetch(url, { method: "GET", headers: { accept: "text/csv" } });
  if (!res.ok) throw new Error(`ELIT CSV fail: ${res.status} ${res.statusText}`);
  return await res.text();
}

async function pruneRowsOutsideCsv(productsClient, skuSet) {
  const toDelete = [];
  const iter = productsClient.listEntities({
    queryOptions: { filter: "(PartitionKey eq 'elit' or providerId eq 'elit')" },
  });

  for await (const e of iter) {
    const sku = String(e.rowKey ?? e.RowKey ?? e.sku ?? "").trim();
    if (!sku || skuSet.has(sku)) continue;
    const partitionKey = String(e.partitionKey ?? e.PartitionKey ?? "").trim();
    const rowKey = String(e.rowKey ?? e.RowKey ?? "").trim();
    if (!partitionKey || !rowKey) continue;
    toDelete.push({ partitionKey, rowKey });
  }

  for (const e of toDelete) {
    await productsClient.deleteEntity(e.partitionKey, e.rowKey);
  }

  return toDelete.length;
}

async function pruneDuplicateNames(productsClient) {
  const groups = new Map();
  const iter = productsClient.listEntities({
    queryOptions: { filter: "(PartitionKey eq 'elit' or providerId eq 'elit')" },
  });

  for await (const e of iter) {
    const partitionKey = String(e.partitionKey ?? e.PartitionKey ?? "").trim();
    const rowKey = String(e.rowKey ?? e.RowKey ?? "").trim();
    if (!partitionKey || !rowKey) continue;
    const name = String(e.name ?? e.nombre ?? "").trim();
    const brand = String(e.brand ?? e.marca ?? "").trim();
    const key = `${normalizeKey(brand)}|${normalizeKey(name)}`;
    if (!name || key === "|") continue;

    const arr = groups.get(key) || [];
    arr.push({
      partitionKey,
      rowKey,
      sku: String(e.sku ?? rowKey).trim(),
      imageUrl: e.imageUrl ?? e.image ?? null,
      thumbUrl: e.thumbUrl ?? e.thumbnail ?? e.miniatura ?? null,
      ivaRate: toNumber(e.ivaRate ?? e.iva),
      price: toNumber(e.price),
      updatedAt: String(e.updatedAt ?? e.timestamp ?? ""),
    });
    groups.set(key, arr);
  }

  const toDelete = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => {
      const diff = scoreEntityQuality(b) - scoreEntityQuality(a);
      if (diff !== 0) return diff;
      const at = Date.parse(a.updatedAt || "") || 0;
      const bt = Date.parse(b.updatedAt || "") || 0;
      if (bt !== at) return bt - at;
      return String(a.sku).localeCompare(String(b.sku));
    });
    toDelete.push(...rows.slice(1));
  }

  for (const e of toDelete) {
    await productsClient.deleteEntity(e.partitionKey, e.rowKey);
  }

  return toDelete.length;
}

app.timer("providersElitSyncCron", {
  schedule: process.env.ELIT_CRON || "0 0 */6 * * *",
  handler: async (_, context) => {
    const productsClient = getProductsClient();
    const providersClient = getProvidersClient();

    await providersClient.upsertEntity(
      {
        partitionKey: "provider",
        rowKey: "elit",
        id: "elit",
        name: "ELIT",
        api: true,
        currency: "USD",
        notes: "Importado desde ELIT (cron csv)",
        updatedAt: new Date().toISOString(),
      },
      "Merge"
    );

    const rows = parseCsvToObjects(await fetchElitCsvRaw());
    const skuSet = new Set();
    let imported = 0;

    for (const r of rows) {
      let sku = String(r.codigo_producto || r.codigo || r.sku || "").trim();
      if (!sku) continue;
      sku = sku.replace(/[\\/#?]/g, "-");
      if (!sku || sku === "-") continue;
      skuSet.add(sku);

      await productsClient.upsertEntity(
        {
          partitionKey: "elit",
          rowKey: sku,
          sku,
          providerId: "elit",
          name: (r.nombre || r.descripcion || "").trim(),
          brand: (r.marca || "").trim(),
          price: toNumber(r.precio),
          currency: normalizeCurrency(r.moneda) || "USD",
          ivaRate: toNumber(r.iva),
          ivaIncluded: String(r.iva_incluido || "").trim(),
          imageUrl: (r.imagen || "").trim() || null,
          thumbUrl: (r.miniatura || "").trim() || null,
          category: (r.rubro || "").trim() || null,
          subcategory: (r.sub_rubro || "").trim() || null,
          model: (r.modelo || "").trim() || null,
          partNumber: (r.part_number || "").trim() || null,
          updatedAt: new Date().toISOString(),
        },
        "Merge"
      );
      imported++;
    }

    const prunedOutsideCsv = await pruneRowsOutsideCsv(productsClient, skuSet);
    const dedupeByNameRemoved = await pruneDuplicateNames(productsClient);

    context.log(
      `ELIT cron sync ok: imported=${imported}, totalCsvRows=${rows.length}, prune=${prunedOutsideCsv}, dedupeByName=${dedupeByNameRemoved}`
    );
  },
});
