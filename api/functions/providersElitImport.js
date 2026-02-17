// File: /api/functions/providersElitImport.js
// Importa productos de ELIT a Azure Table Storage.
// Requiere admin.
//
// Modos:
// - JSON: /api/providersElitImport?source=json&max=1000&offset=0&limit=100&all=1
// - CSV:  /api/providersElitImport?source=csv&max=5000&skip=0
//
// Nota: soporta compatibilidad con esquemas viejos, pero este import escribe el esquema recomendado:
// Products: PartitionKey = providerId ("elit"), RowKey = sku

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

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function requireAdmin(request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("Missing APP_PASSWORD env");

  const headerPass =
    request.headers.get("x-app-password") ||
    request.headers.get("x-admin-pass") ||
    request.headers.get("x-tovaltech-admin") ||
    null;

  const auth = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  const got = headerPass || bearer;
  if (!got || String(got).trim() !== String(expected).trim()) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

async function ensureProvidersSeed() {
  const providersClient = getProvidersClient();
  // Seed ELIT provider if missing
  try {
    await providersClient.createTable();
  } catch {}

  try {
    await providersClient.upsertEntity(
      {
        PartitionKey: "provider",
        RowKey: "elit",
        id: "elit",
        name: "ELIT",
        api: true,
        currency: "USD",
        fx: null,
        ivaIncluded: false,
        updatedAt: new Date().toISOString(),
      },
      "Merge"
    );
  } catch {
    // ignore
  }
}

function getElitCreds() {
  const uid = process.env.ELIT_USER_ID;
  const tok = process.env.ELIT_TOKEN;
  if (!uid || !tok) throw new Error("Missing ELIT_USER_ID / ELIT_TOKEN env");
  return { uid, tok };
}

async function fetchElitJson({ limit, offset }) {
  const { uid, tok } = getElitCreds();
  const url = `https://clientes.elit.com.ar/v1/api/productos?user_id=${encodeURIComponent(uid)}&token=${encodeURIComponent(tok)}&limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);

  if (!res.ok) throw new Error(`ELIT JSON fetch failed: ${res.status}`);
  const data = await res.json();

  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return items;
}

async function fetchElitCsvText() {
  const { uid, tok } = getElitCreds();
  const url = `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${encodeURIComponent(uid)}&token=${encodeURIComponent(tok)}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  const res = await fetch(url, { signal: ctrl.signal });
  clearTimeout(t);

  if (!res.ok) throw new Error(`ELIT CSV fetch failed: ${res.status}`);
  return await res.text();
}

// Simple CSV parse (line-based). Asume que ELIT no trae newlines dentro de campos.
function parseCsvToObjects(csv) {
  const lines = String(csv || "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  // Split CSV honoring quotes
  const splitCsvLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') {
          const nx = line[i + 1];
          if (nx === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else {
          cur += c;
        }
        continue;
      }

      if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  };

  const header = splitCsvLine(lines[0]).map((h) => String(h || "").trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idIx = idx("id");
  const nameIx = idx("nombre");
  const brandIx = idx("marca");
  const priceIx = idx("precio");
  const currencyIx = idx("moneda");
  const ivaIx = idx("iva");
  const imgIx = idx("imagen");
  const thumbIx = idx("miniatura");
  const stockIx = idx("stock");

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);

    const sku = idIx >= 0 ? String(cols[idIx] || "").trim() : "";
    if (!sku) continue;

    out.push({
      sku,
      name: nameIx >= 0 ? String(cols[nameIx] || "").trim() : null,
      brand: brandIx >= 0 ? String(cols[brandIx] || "").trim() : null,
      price: toNumber(priceIx >= 0 ? cols[priceIx] : null),
      currency: normalizeCurrency(currencyIx >= 0 ? cols[currencyIx] : null),
      ivaRate: toNumber(ivaIx >= 0 ? cols[ivaIx] : null),
      imageUrl: imgIx >= 0 ? String(cols[imgIx] || "").trim() : null,
      thumbUrl: thumbIx >= 0 ? String(cols[thumbIx] || "").trim() : null,
      stock: toNumber(stockIx >= 0 ? cols[stockIx] : null),
    });
  }

  return out;
}

async function upsertMany(productsClient, entities, errors) {
  if (!entities.length) return;

  // Table transactions: máx 100 entidades y misma PartitionKey
  const BATCH = 100;
  for (let i = 0; i < entities.length; i += BATCH) {
    const batch = entities.slice(i, i + BATCH);

    try {
      await productsClient.submitTransaction(batch.map((e) => ["upsert", e, "Merge"]));
    } catch (err) {
      // Fallback individual para no perder todo el lote
      for (const e of batch) {
        try {
          await productsClient.upsertEntity(e, "Merge");
        } catch (e2) {
          errors.push({ sku: e.RowKey, error: String(e2?.message || e2) });
        }
      }
    }
  }
}

app.http("providersElitImport", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      requireAdmin(request);

      const source = (request.query.get("source") || "json").trim().toLowerCase();
      const productsClient = getProductsClient();

      // Ensure products table exists
      try {
        await productsClient.createTable();
      } catch {}

      await ensureProvidersSeed();

      const errors = [];
      const startedAt = new Date().toISOString();

      if (source === "csv") {
        const max = clamp(toNumber(request.query.get("max")) ?? 5000, 1, 50000);
        const skip = clamp(toNumber(request.query.get("skip")) ?? 0, 0, 10000000);

        const csvText = await fetchElitCsvText();
        const rows = parseCsvToObjects(csvText);

        const slice = rows.slice(skip, skip + max);

        const entities = slice.map((r) => ({
          PartitionKey: "elit",
          RowKey: String(r.sku),

          providerId: "elit",
          sku: String(r.sku),
          name: r.name,
          brand: r.brand,
          price: r.price,
          currency: r.currency,
          ivaRate: r.ivaRate,
          imageUrl: r.imageUrl || null,
          thumbUrl: r.thumbUrl || null,
          stock: r.stock,
          updatedAt: new Date().toISOString(),
        }));

        await upsertMany(productsClient, entities, errors);

        return {
          status: 200,
          jsonBody: {
            ok: true,
            provider: "elit",
            source: "csv",
            imported: entities.length - errors.length,
            attempted: entities.length,
            errors,
            startedAt,
            finishedAt: new Date().toISOString(),
            nextSkip: skip + entities.length,
            hint: "Si querés traer más, llamá de nuevo con skip=nextSkip y/o subí max.",
          },
        };
      }

      // source === json
      const max = clamp(toNumber(request.query.get("max")) ?? 1000, 1, 50000);
      const pageSize = clamp(toNumber(request.query.get("limit")) ?? 100, 1, 500);
      let offset = clamp(toNumber(request.query.get("offset")) ?? 0, 0, 10000000);

      const all = String(request.query.get("all") || "").trim() === "1" || String(request.query.get("all") || "").toLowerCase() === "true";
      const maxPages = clamp(toNumber(request.query.get("pages")) ?? (all ? 999999 : 1), 1, 999999);

      let imported = 0;
      let attempted = 0;
      let pages = 0;

      while (imported < max && pages < maxPages) {
        pages++;

        const remaining = max - imported;
        const thisLimit = Math.min(pageSize, remaining);

        const items = await fetchElitJson({ limit: thisLimit, offset });
        if (!items.length) break;

        const entities = items
          .map((p) => {
            const sku = p?.id ?? p?.sku ?? p?.codigo_producto ?? null;
            if (!sku) return null;

            return {
              PartitionKey: "elit",
              RowKey: String(sku),

              providerId: "elit",
              sku: String(sku),
              name: p?.nombre ?? p?.name ?? null,
              brand: p?.marca ?? p?.brand ?? null,
              price: toNumber(p?.precio ?? p?.price),
              currency: normalizeCurrency(p?.moneda ?? p?.currency),
              ivaRate: toNumber(p?.iva ?? p?.ivaRate),
              imageUrl: p?.imagen ?? p?.imageUrl ?? p?.image ?? null,
              thumbUrl: p?.miniatura ?? p?.thumbUrl ?? p?.thumbnail ?? null,
              stock: toNumber(p?.stock),
              updatedAt: new Date().toISOString(),
            };
          })
          .filter(Boolean);

        attempted += entities.length;
        await upsertMany(productsClient, entities, errors);

        imported += (entities.length - errors.length);

        // avanzar offset: si ELIT devuelve menos que pedimos, asumimos fin.
        offset += items.length;
        if (items.length < thisLimit) break;
      }

      return {
        status: 200,
        jsonBody: {
          ok: true,
          provider: "elit",
          source: "json",
          imported,
          attempted,
          errors,
          startedAt,
          finishedAt: new Date().toISOString(),
          pages,
          nextOffset: offset,
          used: {
            max,
            pageSize,
            all,
            maxPages,
          },
          hint: all
            ? "Si querés seguir trayendo, llamá de nuevo con offset=nextOffset (o usá source=csv para bulk)."
            : "Para traer más de una página, usá all=1 o pages=N, o llamá varias veces con offset.",
        },
      };
    } catch (err) {
      const status = err?.status || 500;
      context.error(err);
      return {
        status,
        jsonBody: {
          ok: false,
          error: String(err?.message || err),
          debug: {
            hasAppPassword: !!process.env.APP_PASSWORD,
            hasElitUserId: !!process.env.ELIT_USER_ID,
            hasElitToken: !!process.env.ELIT_TOKEN,
          },
        },
      };
    }
  },
});
