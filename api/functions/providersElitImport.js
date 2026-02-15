// File: /api/functions/providersElitImport.js
// CORREGIDO: partitionKey/rowKey en minúsculas + paginado automático
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
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s === "2" || s.toLowerCase() === "usd") return "USD";
  if (s === "1" || s.toLowerCase() === "ars") return "ARS";
  return s.toUpperCase();
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
  const lines = text.split(/\r?\n/).filter((l) => l && l.trim().length);
  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] ?? "";
    }
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

async function pruneRowsOutsideCsv(productsClient, skuSet, dry, context) {
  const toDelete = [];
  const iter = productsClient.listEntities({
    queryOptions: { filter: "(PartitionKey eq 'elit' or providerId eq 'elit')" },
  });

  for await (const e of iter) {
    const sku = String(e.rowKey ?? e.RowKey ?? e.sku ?? "").trim();
    if (!sku) continue;
    if (skuSet.has(sku)) continue;

    const partitionKey = String(e.partitionKey ?? e.PartitionKey ?? "").trim();
    const rowKey = String(e.rowKey ?? e.RowKey ?? "").trim();
    if (!partitionKey || !rowKey) continue;

    toDelete.push({ partitionKey, rowKey, sku });
  }

  for (const e of toDelete) {
    if (!dry) {
      await productsClient.deleteEntity(e.partitionKey, e.rowKey);
    }
  }

  context.log(`🧹 ELIT prune: ${toDelete.length} filas fuera del CSV`);
  return toDelete.length;
}

async function pruneDuplicateNames(productsClient, dry, context) {
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

    const row = {
      partitionKey,
      rowKey,
      sku: String(e.sku ?? rowKey).trim(),
      name,
      brand,
      imageUrl: e.imageUrl ?? e.image ?? null,
      thumbUrl: e.thumbUrl ?? e.thumbnail ?? e.miniatura ?? null,
      ivaRate: toNumber(e.ivaRate ?? e.iva),
      price: toNumber(e.price),
      updatedAt: String(e.updatedAt ?? e.timestamp ?? ""),
    };

    const arr = groups.get(key) || [];
    arr.push(row);
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
    if (!dry) {
      await productsClient.deleteEntity(e.partitionKey, e.rowKey);
    }
  }

  context.log(`🧽 ELIT dedupe nombre: ${toDelete.length} filas duplicadas`);
  return toDelete.length;
}

async function fetchElitCsvRaw() {
  const userId = process.env.ELIT_USER_ID || "";
  const token = process.env.ELIT_TOKEN || "";

  if (!userId || !token) {
    throw new Error("Faltan variables ELIT_USER_ID / ELIT_TOKEN");
  }

  // Nuevo endpoint de CSV (v1 API)
  const url = `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${userId}&token=${token}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { 
      "accept": "text/csv"
    },
  });

  if (!res.ok) {
    throw new Error(`ELIT CSV fail: ${res.status} ${res.statusText}`);
  }

  return await res.text();
}

async function fetchElitJson({ limit = 500, offset = 0 }) {
  const userId = process.env.ELIT_USER_ID || "";
  const token = process.env.ELIT_TOKEN || "";

  if (!userId || !token) {
    throw new Error("Faltan variables ELIT_USER_ID / ELIT_TOKEN");
  }

  const url = `https://www.elit.com.ar/api_test.php`;
  const body = new URLSearchParams({
    tipo: "3",
    formato: "json",
    limit: String(limit),
    offset: String(offset),
    user_id: userId,
    token,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`ELIT JSON fail: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

const handleProvidersElitImport = async (request, context) => {
    try {
      const productsClient = getProductsClient();
      const providersClient = getProvidersClient();

      const source = (request.query.get("source") || "csv").toLowerCase();
      const dry = request.query.get("dry") === "1";

      // Upsert provider ELIT (CORREGIDO: partitionKey/rowKey en minúsculas)
      if (!dry) {
        await providersClient.upsertEntity(
          {
            partitionKey: "provider",
            rowKey: "elit",
            id: "elit",
            name: "ELIT",
            api: true,
            currency: "USD",
            fx: 0,
            ivaIncluded: false,
            notes: "Importado desde ELIT",
            updatedAt: new Date().toISOString(),
          },
          "Merge"
        );
      }

      let imported = 0;
      const errors = [];

      if (source === "csv") {
        // CSV import con paginado manual
        const skip = Math.max(0, Math.floor(toNumber(request.query.get("skip")) || 0));
        let max = Math.floor(toNumber(request.query.get("max")) || 0);
        if (!max || max < 1) max = 5000;
        if (max > 20000) max = 20000;

        const csvText = await fetchElitCsvRaw();
        const rows = parseCsvToObjects(csvText);

        const fullCsvSkuSet = new Set();
        for (const r of rows) {
          let sku = String(r.codigo_producto || r.codigo || r.sku || "").trim();
          if (!sku) continue;
          sku = sku.replace(/[\\/#?]/g, "-");
          if (!sku || sku === "-") continue;
          fullCsvSkuSet.add(sku);
        }

        for (let i = skip; i < rows.length && imported < max; i++) {
          const r = rows[i];

          // Limpiar SKU de caracteres problemáticos
          let sku = String(r.codigo_producto || r.codigo || r.sku || "").trim();
          if (!sku) continue;

          // Remover caracteres no válidos para Azure Table Storage
          // Azure Table Storage no permite: / \ # ?
          sku = sku.replace(/[\\/#?]/g, "-");
          
          // Si el SKU queda vacío después de limpiar, skip
          if (!sku || sku === "-") continue;

          // CORREGIDO: partitionKey = "elit" (providerId), rowKey = sku
          const entity = {
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
          };

          if (!dry) {
            try {
              await productsClient.upsertEntity(entity, "Merge");
              imported++;
            } catch (e) {
              errors.push({ sku, error: String(e?.message || e) });
            }
          } else {
            imported++;
          }
        }

        const pruneOutsideCsv = (request.query.get("prune") || "1") === "1";
        const dedupeByName = (request.query.get("dedupeByName") || "1") === "1";
        const forcePrune = request.query.get("forcePrune") === "1";

        const importedWindowEnd = Math.min(rows.length, skip + max);
        const isFullCsvWindow = skip === 0 && importedWindowEnd >= rows.length;

        let prunedOutsideCsv = 0;
        let pruneSkippedReason = null;

        if (pruneOutsideCsv) {
          if (isFullCsvWindow || forcePrune) {
            prunedOutsideCsv = await pruneRowsOutsideCsv(productsClient, fullCsvSkuSet, dry, context);
          } else {
            pruneSkippedReason =
              "prune omitido: import parcial (usa skip=0 y max>=totalCsvRows o forcePrune=1)";
            context.log(`⚠️ ${pruneSkippedReason}`);
          }
        }

        const dedupeByNameRemoved = dedupeByName
          ? await pruneDuplicateNames(productsClient, dry, context)
          : 0;

        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            source: "csv",
            imported,
            skip,
            max,
            totalCsvRows: rows.length,
            nextSkip: skip + imported,
            errors,
            dedupeByNameRemoved,
            prunedOutsideCsv,
            pruneSkippedReason,
            isFullCsvWindow,
          }),
        };
      }


      // JSON con PAGINADO AUTOMÁTICO
      const all = request.query.get("all") === "1";
      let maxTotal = Math.floor(toNumber(request.query.get("max")) || 0);
      if (!maxTotal || maxTotal < 1) maxTotal = 1000;
      if (maxTotal > 10000) maxTotal = 10000;

      const batchSize = 500; // ELIT devuelve máximo 500 por petición
      let currentOffset = 0;
      let totalImported = 0;

      if (all) {
        // Modo ALL: iterar hasta traer todo (max 1000)
        context.log(`🔄 Modo ALL activado - intentando traer hasta ${maxTotal} productos`);

        while (totalImported < maxTotal) {
          context.log(`📥 Fetching offset ${currentOffset}, batch ${batchSize}`);

          const items = await fetchElitJson({ limit: batchSize, offset: currentOffset });

          if (!items || items.length === 0) {
            context.log("✅ No hay más items - terminando");
            break;
          }

          context.log(`📦 Recibidos ${items.length} items`);

          for (const it of items) {
            if (totalImported >= maxTotal) break;

            // Limpiar SKU de caracteres problemáticos
            let sku = String(it.codigo_producto || it.codigo || it.sku || "").trim();
            if (!sku) continue;
            
            // Remover caracteres no válidos para Azure Table Storage
            sku = sku.replace(/[\\/#?]/g, "-");
            if (!sku || sku === "-") continue;

            // CORREGIDO: partitionKey = "elit", rowKey = sku
            const entity = {
              partitionKey: "elit",
              rowKey: sku,
              sku,
              providerId: "elit",
              name: it.nombre || it.descripcion || null,
              brand: it.marca || null,
              price: toNumber(it.precio ?? it.price),
              currency: normalizeCurrency(it.moneda ?? it.currency) || "USD",
              updatedAt: new Date().toISOString(),
            };

            if (!dry) {
              try {
                await productsClient.upsertEntity(entity, "Merge");
                totalImported++;
              } catch (e) {
                errors.push({ sku, error: String(e?.message || e) });
              }
            } else {
              totalImported++;
            }
          }

          currentOffset += items.length;

          // Si recibimos menos de batchSize, ya no hay más
          if (items.length < batchSize) {
            context.log("✅ Última página alcanzada");
            break;
          }
        }

        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            source: "json",
            mode: "all",
            imported: totalImported,
            maxRequested: maxTotal,
            finalOffset: currentOffset,
            errors,
          }),
        };
      } else {
        // Modo SINGLE PAGE (comportamiento original)
        const limit = Math.max(1, Math.min(5000, Math.floor(toNumber(request.query.get("limit")) || 500)));
        const offset = Math.max(0, Math.floor(toNumber(request.query.get("offset")) || 0));

        const items = await fetchElitJson({ limit, offset });

        for (const it of items) {
          // Limpiar SKU de caracteres problemáticos
          let sku = String(it.codigo_producto || it.codigo || it.sku || "").trim();
          if (!sku) continue;
          
          // Remover caracteres no válidos para Azure Table Storage
          sku = sku.replace(/[\\/#?]/g, "-");
          if (!sku || sku === "-") continue;

          // CORREGIDO: partitionKey = "elit", rowKey = sku
          const entity = {
            partitionKey: "elit",
            rowKey: sku,
            sku,
            providerId: "elit",
            name: it.nombre || it.descripcion || null,
            brand: it.marca || null,
            price: toNumber(it.precio ?? it.price),
            currency: normalizeCurrency(it.moneda ?? it.currency) || "USD",
            updatedAt: new Date().toISOString(),
          };

          if (!dry) {
            try {
              await productsClient.upsertEntity(entity, "Merge");
              imported++;
            } catch (e) {
              errors.push({ sku, error: String(e?.message || e) });
            }
          } else {
            imported++;
          }
        }

        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            source: "json",
            mode: "single",
            imported,
            limit,
            offset,
            received: Array.isArray(items) ? items.length : 0,
            nextOffset: offset + (Array.isArray(items) ? items.length : 0),
            errors,
          }),
        };
      }
    } catch (err) {
      context.error(err);
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
      };
    }
};

app.http("providersElitImport", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "providers/elit/import",
  handler: handleProvidersElitImport,
});

app.http("providersElitImportLegacy", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "providersElitImport",
  handler: handleProvidersElitImport,
});
