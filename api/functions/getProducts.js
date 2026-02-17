// File: /api/functions/getProducts.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

// ---- ELIT CSV enrichment (images + IVA) ----
let _elitCsvCache = { at: 0, map: null, error: null };
const _queryItemsCache = new Map();
const QUERY_CACHE_TTL_MS = 2 * 60 * 1000;
const QUERY_CACHE_MAX_ENTRIES = 24;

// ---- Clasificación derivada (categoría/subcategoría) ----
// Si el producto no trae category en la tabla, lo inferimos por name/brand/sku.
// Mantener en sync con /src/utils/dataHelpers.js (classifyProduct).
function classifyProductFromText({ name, brand, sku }) {
  const text = `${name || ""} ${brand || ""} ${sku || ""}`.toLowerCase();

  const has = (re) => re.test(text);

  // Monitores
  if (has(/\bmonitor\b|\bdisplay\b|\bpantalla\b|\blcd\b|\bled\b|\bips\b|\bqhd\b|\bfhd\b|\b4k\b/)) {
    return { cat: "Monitores", sub: "Monitores" };
  }

  // Periféricos
  if (has(/\bteclad(o|os)\b|\bkeyboard\b/)) return { cat: "Periféricos", sub: "Teclados" };
  if (has(/\bmouse\b|\brat[oó]n\b/)) return { cat: "Periféricos", sub: "Mouse" };
  if (has(/\bheadset\b|\bauricular/)) return { cat: "Periféricos", sub: "Audio" };

  // Componentes PC
  if (has(/\brtx\b|\bgtx\b|\bradeon\b|\bgpu\b/)) return { cat: "Componentes PC", sub: "Placas de video" };
  if (has(/\bryzen\b|\bintel\b.*\bcore\b|\bcpu\b/)) return { cat: "Componentes PC", sub: "Procesadores" };
  if (has(/\bmother\b|\bmainboard\b/)) return { cat: "Componentes PC", sub: "Motherboards" };
  if (has(/\bddr[345]\b|\bram\b|\bmemoria\b/)) return { cat: "Componentes PC", sub: "RAM" };
  if (has(/\bnvme\b|\bm\.2\b|\bssd\b/)) return { cat: "Componentes PC", sub: "SSD" };
  if (has(/\bhdd\b|\bhard drive\b/)) return { cat: "Componentes PC", sub: "HDD" };
  if (has(/\bpsu\b|\bfuente\b|\bpower supply\b/)) return { cat: "Componentes PC", sub: "Fuentes" };
  if (has(/\bgabinete\b|\bcase\b/)) return { cat: "Componentes PC", sub: "Gabinetes" };
  if (has(/\bcooler\b|\bfan\b/)) return { cat: "Componentes PC", sub: "Refrigeración" };

  // Almacenamiento externo
  if (has(/\bpendrive\b|\busb\s?drive\b|\bexternal\b/)) return { cat: "Almacenamiento", sub: "Externos" };

  // Redes
  if (has(/\brouter\b|\bswitch\b|\bwi-?fi\b|\bethernet\b/)) return { cat: "Networking", sub: "Redes" };

  // Notebooks
  if (has(/\bnotebook\b|\blaptop\b|\bport[aá]til\b/)) return { cat: "Notebooks", sub: "Portátiles" };

  return { cat: "Otros", sub: "Otros" };
}

function _getQueryCacheKey(params) {
  return [
    params.provider || "all",
    params.q || "",
    params.brandFilter || "",
    params.categoryFilter || "",
    params.subcategoryFilter || "",
    params.inStockOnly ? "1" : "0",
    String(params.limit || 10000),
  ].join("|");
}

function _readQueryCache(key) {
  const entry = _queryItemsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > QUERY_CACHE_TTL_MS) {
    _queryItemsCache.delete(key);
    return null;
  }
  return Array.isArray(entry.items) ? entry.items : null;
}

function _writeQueryCache(key, items) {
  _queryItemsCache.set(key, { at: Date.now(), items });
  if (_queryItemsCache.size <= QUERY_CACHE_MAX_ENTRIES) return;

  const oldest = [..._queryItemsCache.entries()]
    .sort((a, b) => a[1].at - b[1].at)
    .slice(0, _queryItemsCache.size - QUERY_CACHE_MAX_ENTRIES);
  oldest.forEach(([k]) => _queryItemsCache.delete(k));
}

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeCurrency(v) {
  const s = String(v || "").trim().toUpperCase();
  if (s === "USD" || s === "ARS") return s;
  if (s.includes("DOL")) return "USD";
  if (s.includes("PES")) return "ARS";
  return s || null;
}

function escapeODataString(s) {
  return String(s || "").replace(/'/g, "''");
}

function normalizeSort(s) {
  const v = String(s || "").trim();
  const allowed = new Set(["name-asc", "name-desc", "price-asc", "price-desc", "brand-asc", "brand-desc"]);
  return allowed.has(v) ? v : "name-asc";
}

// ---- ELIT CSV: cache básico ----
async function getElitCsvMap() {
  const now = Date.now();
  if (_elitCsvCache.map && now - _elitCsvCache.at < 10 * 60 * 1000) return _elitCsvCache.map;

  _elitCsvCache = { at: now, map: null, error: null };

  const url = process.env.ELIT_CSV_URL;
  if (!url) {
    _elitCsvCache.error = "Missing ELIT_CSV_URL";
    return null;
  }

  try {
    const res = await fetch(url, { headers: { "user-agent": "tovaltech" } });
    if (!res.ok) throw new Error(`ELIT CSV fetch failed: ${res.status}`);
    const text = await res.text();

    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("ELIT CSV empty");

    const header = lines[0].split(";").map(h => h.trim().toLowerCase());
    const idxSku = header.indexOf("codigo_producto");
    const idxImg = header.indexOf("imagen");
    const idxIva = header.indexOf("iva");

    const map = new Map();

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(";");
      const sku = idxSku >= 0 ? (cols[idxSku] || "").trim() : "";
      if (!sku) continue;

      const img = idxImg >= 0 ? (cols[idxImg] || "").trim() : "";
      const ivaRaw = idxIva >= 0 ? (cols[idxIva] || "").trim() : "";
      const ivaRate = ivaRaw ? Number(String(ivaRaw).replace(",", ".")) : null;

      map.set(sku, { image: img || null, ivaRate: Number.isFinite(ivaRate) ? ivaRate : null });
    }

    _elitCsvCache.map = map;
    return map;
  } catch (e) {
    _elitCsvCache.error = String(e?.message || e);
    return null;
  }
}

function applySort(items, sort) {
  const s = normalizeSort(sort);

  const byText = (a, b, key) => {
    const av = String(a[key] || "").toLowerCase();
    const bv = String(b[key] || "").toLowerCase();
    return av.localeCompare(bv);
  };

  const byNum = (a, b, key) => {
    const av = Number(a[key] || 0);
    const bv = Number(b[key] || 0);
    return av - bv;
  };

  const sorted = [...items];

  switch (s) {
    case "name-desc":
      sorted.sort((a, b) => byText(b, a, "name"));
      break;
    case "price-asc":
      sorted.sort((a, b) => byNum(a, b, "price"));
      break;
    case "price-desc":
      sorted.sort((a, b) => byNum(b, a, "price"));
      break;
    case "brand-asc":
      sorted.sort((a, b) => byText(a, b, "brand"));
      break;
    case "brand-desc":
      sorted.sort((a, b) => byText(b, a, "brand"));
      break;
    case "name-asc":
    default:
      sorted.sort((a, b) => byText(a, b, "name"));
      break;
  }

  return sorted;
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
      const subcategoryFilter = (request.query.get("subcategory") || request.query.get("sub") || "").trim().toLowerCase();
      const inStockOnly = String(request.query.get("inStock") || "").trim() === "1";
      const sort = normalizeSort(request.query.get("sort"));
      const forceRefresh = String(request.query.get("refresh") || "") === "1";

      // 🚀 Paginación
      const page = Math.max(1, toNumber(request.query.get("page")) || 1);
      const pageSize = Math.max(1, Math.min(200, toNumber(request.query.get("pageSize")) || 60));

      // Limit total para prevenir carga infinita
      let limit = toNumber(request.query.get("limit"));
      if (!limit || limit < 1) limit = 10000; // Aumentado para paginación
      if (limit > 20000) limit = 20000;

      const cacheKey = _getQueryCacheKey({ provider, q, brandFilter, categoryFilter, subcategoryFilter, inStockOnly, limit });

      if (!forceRefresh) {
        const cached = _readQueryCache(cacheKey);
        if (cached) {
          const totalCount = cached.length;
          const totalPages = Math.ceil(totalCount / pageSize);
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;
          const paginatedItems = cached.slice(startIndex, endIndex);

          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "Cache-Control": "public, max-age=60",
            },
            body: JSON.stringify({
              ok: true,
              items: paginatedItems,
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
        }
      }

      // CSV map (solo si hace falta)
      const elitMap = await getElitCsvMap();

      // Traemos entities
      // Filtramos por PK o por propiedad providerId.
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

        const providerId =
          (pkRaw && pkRaw !== "product" && pkRaw !== "products" && pkRaw !== "p")
            ? pkRaw
            : (propProvider ? String(propProvider).trim().toLowerCase() : (provider || null));

        if (provider && provider !== "all" && providerId && providerId !== provider) continue;

        const name = e.name ?? e.nombre ?? e.nombre_producto ?? null;
        const brand = e.brand ?? e.marca ?? null;
        const category = e.category ?? e.categoria ?? null;

        const derived = classifyProductFromText({ name, brand, sku });
        const effectiveCategory = category ? String(category) : derived.cat;
        const effectiveSubcategory = derived.sub;

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
          const categoryValue = String(effectiveCategory || "").trim().toLowerCase();
          if (categoryValue !== categoryFilter) continue;
        }

        if (subcategoryFilter) {
          const subValue = String(effectiveSubcategory || "").trim().toLowerCase();
          if (subValue !== subcategoryFilter) continue;
        }

        const item = {
          sku,
          providerId: providerId ? String(providerId).toLowerCase() : null,
          name,
          brand,
          category: effectiveCategory,
          subcategory: effectiveSubcategory,
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency ?? e.moneda),
          ivaRate: toNumber(e.ivaRate ?? e.iva ?? e.iva_porcentaje),
          stock: toNumber(e.stock ?? e.cantidad ?? e.quantity),
          imageUrl: e.imageUrl ?? e.imagen ?? e.image ?? null,
          updatedAt: e.updatedAt ?? e.updated_at ?? e.updateAt ?? e.timestamp ?? null,
        };

        // Enriquecimiento ELIT (imagen + iva)
        if (elitMap && item.providerId === "elit") {
          const extra = elitMap.get(item.sku);
          if (extra) {
            if (extra.image && !item.imageUrl) item.imageUrl = extra.image;
            if (extra.ivaRate !== null && item.ivaRate === null) item.ivaRate = extra.ivaRate;
          }
        }

        // Stock-only
        if (inStockOnly) {
          const st = Number(item.stock || 0);
          if (!Number.isFinite(st) || st <= 0) continue;
        }

        const key = `${item.providerId || "unknown"}::${item.sku}`;
        if (!byKey.has(key)) byKey.set(key, item);

        if (byKey.size >= limit) break;
      }

      let items = [...byKey.values()];
      items = applySort(items, sort);

      // Cachear resultados full (sin paginar)
      _writeQueryCache(cacheKey, items);

      // Paginación
      const totalCount = items.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedItems = items.slice(startIndex, endIndex);

      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
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
