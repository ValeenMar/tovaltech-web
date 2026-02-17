// File: /api/functions/getProducts.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

// ---- ELIT CSV enrichment (images + IVA) ----
let _elitCsvCache = { at: 0, map: null, error: null };

function _getElitCsvUrl() {
  const uid = process.env.ELIT_USER_ID;
  const tok = process.env.ELIT_TOKEN;
  if (!uid || !tok) return null;
  return `https://clientes.elit.com.ar/v1/api/productos/csv?user_id=${encodeURIComponent(uid)}&token=${encodeURIComponent(tok)}`;
}

// Minimal CSV parser (comma-separated, supports quotes + newlines inside quotes)
function _parseCsv(text) {
  const out = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  // Strip BOM
  if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1);

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

function toTime(v) {
  if (!v) return 0;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function normalizeSort(v) {
  const s = String(v || "").trim().toLowerCase();
  switch (s) {
    case "name-desc":
    case "price-asc":
    case "price-desc":
    case "newest":
      return s;
    default:
      return "name-asc";
  }
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
      const brandFilter = (request.query.get("brand") || "").trim().toLowerCase();
      const categoryFilter = (request.query.get("category") || "").trim().toLowerCase();
      const inStockOnly = String(request.query.get("inStock") || "").trim() === "1";
      const sort = normalizeSort(request.query.get("sort"));

      // 🚀 Paginación
      const page = Math.max(1, toNumber(request.query.get("page")) || 1);
      const pageSize = Math.max(1, Math.min(200, toNumber(request.query.get("pageSize")) || 60));

      // Limit total para prevenir carga infinita
      let limit = toNumber(request.query.get("limit"));
      if (!limit || limit < 1) limit = 10000; // Aumentado para paginación
      if (limit > 20000) limit = 20000;

      // Soportamos 2 esquemas posibles (por compatibilidad):
      // A) PartitionKey = providerId ("elit", "intermaco", ...), RowKey = SKU
      // B) PartitionKey = "product" y providerId guardado como propiedad
      // Para filtrar sin saber cuál está en uso, buscamos por PK o por propiedad providerId.
      let filter = "";
      if (provider && provider !== "all") {
        const p = escapeODataString(provider);
        filter = `(PartitionKey eq '${p}' or providerId eq '${p}')`;
      }

      const iter = filter
        ? client.listEntities({ queryOptions: { filter } })
        : client.listEntities();

      const byKey = new Map(); // dedupe: providerId::sku

      for await (const e of iter) {
        const rowKey = e.rowKey ?? e.RowKey ?? e.sku ?? e.id ?? e.codigo_producto ?? null;
        const sku = rowKey ? String(rowKey).trim() : "";
        if (!sku) continue;

        const pkRaw = String(e.partitionKey ?? e.PartitionKey ?? "").trim().toLowerCase();
        const propProvider = e.providerId ?? e.proveedorId ?? e.provider ?? null;

        // Si PK parece ser un providerId, lo usamos. Si no (p.ej. "product"), usamos propiedad providerId.
        const providerId =
          (pkRaw && pkRaw !== "product" && pkRaw !== "products" && pkRaw !== "p")
            ? pkRaw
            : (propProvider ? String(propProvider).trim().toLowerCase() : (provider || null));

        if (provider && provider !== "all" && providerId && providerId !== provider) continue;

        const name = e.name ?? e.nombre ?? e.nombre_producto ?? null;
        const brand = e.brand ?? e.marca ?? null;
        const category = e.category ?? e.categoria ?? null;

        if (q) {
          const hay =
            (sku && sku.toLowerCase().includes(q)) ||
            (name && String(name).toLowerCase().includes(q)) ||
            (brand && String(brand).toLowerCase().includes(q));
          if (!hay) continue;
        }

        if (brandFilter) {
          const brandValue = String(brand || "").trim().toLowerCase();
          if (brandValue !== brandFilter) continue;
        }

        if (categoryFilter) {
          const categoryValue = String(category || "").trim().toLowerCase();
          if (categoryValue !== categoryFilter) continue;
        }

        const item = {
          sku,
          providerId: providerId ? String(providerId).toLowerCase() : null,
          name,
          brand,
          category,
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency ?? e.moneda),
          ivaRate: toNumber(e.ivaRate ?? e.iva),
          imageUrl: e.imageUrl ?? e.image ?? null,
          thumbUrl: e.thumbUrl ?? e.thumbnail ?? e.miniatura ?? null,
          stock: toNumber(e.stock),
          updatedAt: e.updatedAt ?? e.updatedAtIso ?? e.timestamp ?? null,
        };

        if (inStockOnly && (!item.stock || item.stock <= 0)) continue;

        const key = `${item.providerId || "_"}::${item.sku}`;
        const prev = byKey.get(key);
        if (!prev || toTime(item.updatedAt) >= toTime(prev.updatedAt)) {
          byKey.set(key, item);
        }

        if (byKey.size >= limit) break;
      }

      const items = Array.from(byKey.values());

      // ELIT CSV enrichment: agrega imagen/miniatura + IVA cuando falte
      const needElit = items.some(
        (p) => p.providerId === "elit" && (!p.thumbUrl || !p.imageUrl || p.ivaRate == null)
      );

      if (needElit) {
        const map = await _getElitCsvMap(context);
        if (map) {
          for (const p of items) {
            if (p.providerId !== "elit") continue;
            const extra = map.get(p.sku);
            if (!extra) continue;
            if (!p.imageUrl && extra.imageUrl) p.imageUrl = extra.imageUrl;
            if (!p.thumbUrl && extra.thumbUrl) p.thumbUrl = extra.thumbUrl;
            if ((p.ivaRate == null || p.ivaRate === 0) && extra.ivaRate) p.ivaRate = extra.ivaRate;
          }
        }
      }

      items.sort((a, b) => {
        if (sort === "name-desc") {
          const an = String(a.name ?? "").toLowerCase();
          const bn = String(b.name ?? "").toLowerCase();
          if (an < bn) return 1;
          if (an > bn) return -1;
          return String(b.sku ?? "").localeCompare(String(a.sku ?? ""));
        }

        if (sort === "price-asc") {
          const ap = Number.isFinite(a.price) ? a.price : Number.MAX_SAFE_INTEGER;
          const bp = Number.isFinite(b.price) ? b.price : Number.MAX_SAFE_INTEGER;
          if (ap !== bp) return ap - bp;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        }

        if (sort === "price-desc") {
          const ap = Number.isFinite(a.price) ? a.price : Number.MIN_SAFE_INTEGER;
          const bp = Number.isFinite(b.price) ? b.price : Number.MIN_SAFE_INTEGER;
          if (ap !== bp) return bp - ap;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        }

        if (sort === "newest") {
          const ta = toTime(a.updatedAt);
          const tb = toTime(b.updatedAt);
          if (ta !== tb) return tb - ta;
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        }

        const an = String(a.name ?? "").toLowerCase();
        const bn = String(b.name ?? "").toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        const asku = String(a.sku ?? "");
        const bsku = String(b.sku ?? "");
        return asku.localeCompare(bsku);
      });

      // 🚀 Aplicar paginación
      const totalCount = items.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedItems = items.slice(startIndex, endIndex);

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          items: paginatedItems,
          // Metadatos de paginación
          pagination: {
            page,
            pageSize,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
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
