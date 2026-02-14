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

  const s0 = String(v).trim();
  if (!s0) return null;

  let s = s0.replace(/\s+/g, "");
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

// CSV parser (supports quotes + newlines inside quotes)
function parseCsv(text) {
  const out = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (!text) return out;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    out.push(row);
  }

  return out;
}

function csvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const header = rows[0].map((h) => String(h || "").trim());
  const out = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = row[c] ?? "";
    out.push(obj);
  }

  return out;
}

async function requireAdmin(request) {
  const appPass = process.env.APP_PASSWORD;
  if (!appPass) return true;

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

  const items = json?.items || json?.productos || json?.data || [];
  return Array.isArray(items) ? items : [];
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

async function upsertBatch(productsClient, entities) {
  if (!entities.length) return;

  // Azure Tables: max 100 acciones por batch y MISMO PartitionKey.
  const CHUNK = 100;

  for (let i = 0; i < entities.length; i += CHUNK) {
    const slice = entities.slice(i, i + CHUNK);
    const actions = slice.map((entity) => ({
      actionType: "upsert",
      entity,
      updateMode: "Merge",
    }));
    await productsClient.submitTransaction(actions);
  }
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

      const source = (request.query.get("source") || "csv").toLowerCase(); // "csv" | "json"
      const dry = (request.query.get("dry") || "").toLowerCase() === "1";

      const max = Math.max(1, Math.min(20000, Math.floor(toNumber(request.query.get("max")) || 1000)));
      const skip = Math.max(0, Math.floor(toNumber(request.query.get("skip")) || 0));

      const productsClient = getProductsClient();
      const providersClient = getProvidersClient();

      // upsert provider (NO pisar fx)
      if (!dry) {
        await providersClient.upsertEntity(
          {
            PartitionKey: "provider",
            RowKey: "elit",
            id: "elit",
            name: "ELIT",
            api: true,
            currency: "USD",
            ivaIncluded: false,
            notes: "Importado desde ELIT",
            updatedAt: new Date().toISOString(),
          },
          "Merge"
        );
      }

      let imported = 0;
      const errors = [];

      // Guardamos productos con PartitionKey = "elit" (para filtrar y batchear rápido)
      const PK = "elit";

      if (source === "csv") {
        const csvText = await fetchElitCsvRaw();
        const rows = csvToObjects(csvText);

        const batch = [];

        for (let i = skip; i < rows.length && imported < max; i++) {
          const r = rows[i];

          const sku = String(r.codigo_producto || r.codigo || r.id || r.sku || "").trim();
          if (!sku) continue;

          const entity = {
            PartitionKey: PK,
            RowKey: sku,

            sku,
            providerId: "elit",
            name: String(r.nombre || r.descripcion || "").trim() || null,
            brand: String(r.marca || "").trim() || null,

            price: toNumber(r.precio),
            currency: normalizeCurrency(r.moneda) || "USD",

            ivaRate: toNumber(r.iva),
            ivaIncluded: String(r.iva_incluido || "").trim() || null,

            imageUrl: String(r.imagen || "").trim() || null,
            thumbUrl: String(r.miniatura || "").trim() || null,

            category: String(r.rubro || "").trim() || null,
            subcategory: String(r.sub_rubro || "").trim() || null,
            model: String(r.modelo || "").trim() || null,
            partNumber: String(r.part_number || "").trim() || null,

            updatedAt: new Date().toISOString(),
          };

          if (!dry) {
            batch.push(entity);
            if (batch.length >= 100) {
              try {
                await upsertBatch(productsClient, batch.splice(0, batch.length));
              } catch (e) {
                errors.push({ sku, error: String(e?.message || e) });
              }
            }
          }

          imported++;
        }

        if (!dry && batch.length) {
          try {
            await upsertBatch(productsClient, batch);
          } catch (e) {
            errors.push({ error: String(e?.message || e) });
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
            partitionKey: PK,
            errors,
          }),
        };
      }

      // JSON: soporta "all=1" para paginar hasta max
      const all = (request.query.get("all") || "") === "1";
      const pageLimit = Math.max(1, Math.min(5000, Math.floor(toNumber(request.query.get("limit")) || 500)));
      let offset = Math.max(0, Math.floor(toNumber(request.query.get("offset")) || 0));

      const batch = [];

      const importOne = async (it) => {
        const sku = String(it.codigo_producto || it.codigo || it.id || it.sku || "").trim();
        if (!sku) return;

        const entity = {
          PartitionKey: PK,
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
          batch.push(entity);
          if (batch.length >= 100) {
            await upsertBatch(productsClient, batch.splice(0, batch.length));
          }
        }

        imported++;
      };

      if (!all) {
        const items = await fetchElitJson({ limit: Math.min(pageLimit, max), offset });

        for (const it of items) {
          if (imported >= max) break;
          try {
            await importOne(it);
          } catch (e) {
            errors.push({ error: String(e?.message || e) });
          }
        }

        if (!dry && batch.length) {
          try {
            await upsertBatch(productsClient, batch);
          } catch (e) {
            errors.push({ error: String(e?.message || e) });
          }
        }

        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ok: true,
            source: "json",
            imported,
            limit: pageLimit,
            offset,
            received: Array.isArray(items) ? items.length : 0,
            nextOffset: offset + (Array.isArray(items) ? items.length : 0),
            partitionKey: PK,
            errors,
          }),
        };
      }

      // all=1
      while (imported < max) {
        const items = await fetchElitJson({ limit: pageLimit, offset });
        if (!items.length) break;

        for (const it of items) {
          if (imported >= max) break;
          try {
            await importOne(it);
          } catch (e) {
            errors.push({ error: String(e?.message || e) });
          }
        }

        offset += items.length;

        if (items.length < pageLimit) break;
      }

      if (!dry && batch.length) {
        try {
          await upsertBatch(productsClient, batch);
        } catch (e) {
          errors.push({ error: String(e?.message || e) });
        }
      }

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          source: "json",
          all: true,
          imported,
          limit: pageLimit,
          nextOffset: offset,
          max,
          partitionKey: PK,
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
