// File: /api/functions/providersElitImport.js
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
  // CSV con comas + soporte de comillas dobles.
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
    const cols = parseCsvLine(lines[i]);
    if (!cols.length) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = cols[c] ?? "";
    rows.push(obj);
  }

  return rows;
}

async function requireAdmin(request) {
  const appPass = process.env.APP_PASSWORD;
  if (!appPass) return true; // si no hay password configurada, no bloqueamos

  const headerPass = request.headers.get("x-app-password");
  const qpPass = request.query.get("password");
  let bodyPass = null;

  try {
    const body = await request.json();
    bodyPass = body?.password ?? null;
  } catch (_) {
    // ignore
  }

  const provided = headerPass || qpPass || bodyPass;
  return provided === appPass;
}

function getElitCreds() {
  const userId = process.env.ELIT_USER_ID;
  const token = process.env.ELIT_TOKEN;
  if (!userId) throw new Error("Missing ELIT_USER_ID");
  if (!token) throw new Error("Missing ELIT_TOKEN");
  return { userId, token };
}

async function fetchElitJson({ limit, offset }) {
  const { userId, token } = getElitCreds();
  const url =
    `https://clientes.elit.com.ar/v1/api/productos` +
    `?user_id=${encodeURIComponent(userId)}` +
    `&token=${encodeURIComponent(token)}` +
    `&limit=${encodeURIComponent(limit)}` +
    `&offset=${encodeURIComponent(offset)}`;

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`ELIT JSON HTTP ${res.status}: ${text.slice(0, 200)}`);

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`ELIT JSON parse error: ${String(e?.message || e)} | body: ${text.slice(0, 200)}`);
  }

  // el formato exacto puede variar
  const items = json?.items || json?.productos || json?.data || [];
  if (!Array.isArray(items)) return [];
  return items;
}

async function fetchElitCsvRaw() {
  const { userId, token } = getElitCreds();
  const url =
    `https://clientes.elit.com.ar/v1/api/productos/csv` +
    `?user_id=${encodeURIComponent(userId)}` +
    `&token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`ELIT CSV HTTP ${res.status}: ${text.slice(0, 200)}`);

  return text;
}

app.http("providersElitImport", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const okAdmin = await requireAdmin(request);
      if (!okAdmin) {
        return {
          status: 401,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: false, error: "Unauthorized" }),
        };
      }

      const source = (request.query.get("source") || "json").toLowerCase(); // "json" | "csv"
      const dry = (request.query.get("dry") || "").toLowerCase() === "1";

      const productsClient = getProductsClient();
      const providersClient = getProvidersClient();

      // upsert provider
      if (!dry) {
        await providersClient.upsertEntity(
          {
            PartitionKey: "provider",
            RowKey: "elit",
            id: "elit",
            name: "ELIT",
            api: true,
            currency: "USD",
            // fx lo dejamos como esté (si ya existe) o 0
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
        // CSV trae imágenes + IVA
        const skip = Math.max(0, Math.floor(toNumber(request.query.get("skip")) || 0));
        let max = Math.floor(toNumber(request.query.get("max")) || 0);
        if (!max || max < 1) max = 5000; // safety
        if (max > 20000) max = 20000;

        const csvText = await fetchElitCsvRaw();
        const rows = parseCsvToObjects(csvText);

        for (let i = skip; i < rows.length && imported < max; i++) {
          const r = rows[i];

          // nombres de columnas reales (según el CSV que compartiste)
          const sku = String(r.codigo_producto || r.codigo || r.sku || "").trim();
          if (!sku) continue;

          const entity = {
            PartitionKey: "product",
            RowKey: sku,
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
          }),
        };
      }

      // JSON (sin imágenes)
      const limit = Math.max(1, Math.min(5000, Math.floor(toNumber(request.query.get("limit")) || 500)));
      const offset = Math.max(0, Math.floor(toNumber(request.query.get("offset")) || 0));

      const items = await fetchElitJson({ limit, offset });

      for (const it of items) {
        const sku = String(it.codigo_producto || it.codigo || it.sku || "").trim();
        if (!sku) continue;

        const entity = {
          PartitionKey: "product",
          RowKey: sku,
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
          imported,
          limit,
          offset,
          received: Array.isArray(items) ? items.length : 0,
          nextOffset: offset + (Array.isArray(items) ? items.length : 0),
          errors,
        }),
      };
    } catch (err) {
      context.error(err);
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: String(err?.message || err) }),
      };
    }
  },
});
