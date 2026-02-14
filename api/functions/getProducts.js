// File: /api/functions/getProducts.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

// ---- ELIT CSV enrichment (images + IVA) ----
let _elitCsvCache = { at: 0, map: null, error: null };

function _getElitCsvUrl() {
  const uid = process.env.ELIT_USER_ID;
  const tok = process.env.ELIT_TOKEN;
  if (!uid || !tok) return null;
  return `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${encodeURIComponent(
    uid
  )}&token=${encodeURIComponent(tok)}`;
}

// Minimal CSV parser (comma-separated, supports quotes)
function _parseCsv(text) {
  const out = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // Strip BOM
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

  // last field
  if (field.length || row.length) {
    row.push(field);
    out.push(row);
  }

  return out;
}

async function _getElitCsvMap(context) {
  const url = _getElitCsvUrl();
  if (!url) return null;

  const now = Date.now();
  const ttlMs = 15 * 60 * 1000;

  if (_elitCsvCache.map && now - _elitCsvCache.at < ttlMs) return _elitCsvCache.map;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);

    if (!res.ok) throw new Error(`ELIT CSV fetch failed: ${res.status}`);

    const text = await res.text();
    const rows = _parseCsv(text);
    if (!rows.length) throw new Error("ELIT CSV empty");

    const header = rows[0].map((h) => String(h || "").trim());
    const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    const idIx = idx("id");
    const imgIx = idx("imagen");
    const thumbIx = idx("miniatura");
    const ivaIx = idx("iva");

    const map = new Map();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const sku = idIx >= 0 ? String(row[idIx] || "").trim() : "";
      if (!sku) continue;

      const imageUrl = imgIx >= 0 ? String(row[imgIx] || "").trim() : "";
      const thumbUrl = thumbIx >= 0 ? String(row[thumbIx] || "").trim() : "";

      let ivaRate = null;
      if (ivaIx >= 0) {
        const raw = String(row[ivaIx] || "").trim().replace(",", ".");
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) ivaRate = n; // percent (e.g., 10.5)
      }

      map.set(sku, { imageUrl: imageUrl || null, thumbUrl: thumbUrl || null, ivaRate });
    }

    _elitCsvCache = { at: now, map, error: null };
    return map;
  } catch (err) {
    _elitCsvCache = { at: now, map: null, error: String(err?.message || err) };
    context?.log?.(`ELIT CSV enrichment disabled: ${_elitCsvCache.error}`);
    return null;
  }
}
// ---- end ELIT CSV enrichment ----

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s0 = String(v).trim();
  if (!s0) return null;

  // soporta: "2167.68", "2,167.68", "2167,68", "2.167,68"
  let s = s0.replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // si el último separador es coma -> decimal coma, sino decimal punto
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

  // ELIT suele usar "2" = USD, "1" = ARS
  if (s === "2" || s.toLowerCase() === "usd") return "USD";
  if (s === "1" || s.toLowerCase() === "ars") return "ARS";
  return s.toUpperCase();
}

function escapeODataString(v) {
  // OData usa comillas simples, se escapan duplicándolas.
  return String(v).replace(/'/g, "''");
}

app.http("getProducts", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const client = getClient();

      const provider = (request.query.get("provider") || "").trim().toLowerCase();
      const qRaw = (request.query.get("q") || "").trim();
      const q = qRaw.toLowerCase();

      let limit = toNumber(request.query.get("limit"));
      if (!limit || limit < 1) limit = 100;
      if (limit > 20000) limit = 20000;

      // IMPORTANTE (tu esquema real):
      // Products Table usa PartitionKey = providerId ("elit", "intermaco", ...)
      // y RowKey = SKU/ID.
      let filter = "";
      if (provider && provider !== "all") {
        filter = `PartitionKey eq '${escapeODataString(provider)}'`;
      }

      const items = [];
      const iter = filter
        ? client.listEntities({ queryOptions: { filter } })
        : client.listEntities();

      for await (const e of iter) {
        const sku = e.rowKey ?? e.RowKey ?? e.sku ?? e.id ?? e.codigo_producto ?? null;
        const name = e.name ?? e.nombre ?? e.nombre_producto ?? null;
        const brand = e.brand ?? e.marca ?? null;

        if (q) {
          const hay =
            (sku && String(sku).toLowerCase().includes(q)) ||
            (name && String(name).toLowerCase().includes(q)) ||
            (brand && String(brand).toLowerCase().includes(q));
          if (!hay) continue;
        }

        const providerId = e.partitionKey ?? e.PartitionKey ?? provider ?? null;

        items.push({
          sku: sku ? String(sku) : null,
          providerId: providerId ? String(providerId).toLowerCase() : null,
          name,
          brand,
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency ?? e.moneda),
          ivaRate: toNumber(e.ivaRate ?? e.iva),
          imageUrl: e.imageUrl ?? e.image ?? null,
          thumbUrl: e.thumbUrl ?? e.thumbnail ?? e.miniatura ?? null,
          stock: toNumber(e.stock),
          updatedAt: e.updatedAt ?? e.timestamp ?? null,
        });

        if (items.length >= limit) break;
      }

      // ELIT CSV enrichment: agrega imagen/miniatura + IVA cuando falte
      const needElit = items.some(
        (p) => p.providerId === "elit" && (!p.thumbUrl || !p.imageUrl || p.ivaRate == null)
      );
      if (needElit) {
        const map = await _getElitCsvMap(context);
        if (map) {
          for (const p of items) {
            if (p.providerId !== "elit") continue;
            const extra = map.get(String(p.sku || "").trim());
            if (!extra) continue;
            if (!p.imageUrl && extra.imageUrl) p.imageUrl = extra.imageUrl;
            if (!p.thumbUrl && extra.thumbUrl) p.thumbUrl = extra.thumbUrl;
            if ((p.ivaRate == null || p.ivaRate === 0) && extra.ivaRate) p.ivaRate = extra.ivaRate;
          }
        }
      }

      // orden estable
      items.sort((a, b) => (a?.name || "").localeCompare(b?.name || ""));

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: true, items }),
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
