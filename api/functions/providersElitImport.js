// File: /api/functions/providersElitImport.js
// CommonJS (require) para ser compatible con /api/index.js
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

  // Soporta formatos tipo:
  //  - 2167.68
  //  - 2.167,68
  //  - 2 167,68
  //  - 2,167.68
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickBrand(item) {
  return item.marca || item.brand || item.Marca || item.Brand || item.fabricante || "";
}

function pickSku(item) {
  return item.sku || item.codigo || item.code || item.Codigo || item.Código || item.SKU || "";
}

function pickName(item) {
  return (
    item.nombre ||
    item.name ||
    item.descripcion ||
    item.Descripcion ||
    item.Descripción ||
    item.titulo ||
    item.title ||
    ""
  );
}

function pickCurrency(item) {
  // ELIT es local => por defecto ARS
  return item.moneda || item.currency || item.Currency || "ARS";
}

function pickPrice(item) {
  const raw =
    item.precio ??
    item.price ??
    item.Precio ??
    item.Price ??
    item.precio_lista ??
    item.precioLista ??
    item.precioFinal ??
    item.pvp ??
    item.PVP;

  return toNumber(raw);
}

function pickImageUrl(item) {
  // Intento de detectar imágenes si ELIT las provee.
  // (No siempre vienen; queda en null si no hay.)
  const img =
    (Array.isArray(item?.miniaturas) && item.miniaturas[0]) ||
    (Array.isArray(item?.imagenes) && item.imagenes[0]) ||
    item?.image ||
    item?.imageUrl ||
    null;

  return img ? String(img) : null;
}

async function elitFetchProducts({ limit = 100, offset = 1 } = {}) {
  const ELIT_USER_ID = process.env.ELIT_USER_ID;
  const ELIT_TOKEN = process.env.ELIT_TOKEN;

  if (!ELIT_USER_ID || !ELIT_TOKEN) {
    throw new Error("Missing ELIT_USER_ID / ELIT_TOKEN");
  }

  const url = `https://clientes.elit.com.ar/v1/api/productos?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: Number(ELIT_USER_ID), token: ELIT_TOKEN }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || `ELIT API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json ?? text;
    throw err;
  }

  return json;
}

app.http("providersElitImport", {
  methods: ["POST", "GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const url = new URL(request.url);

      const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 100)));
      const debug = String(url.searchParams.get("debug") || "") === "1";
      const pagesParam = url.searchParams.get("pages");
      const all = String(url.searchParams.get("all") || "") === "1";
      const pages = pagesParam ? Math.max(1, Math.min(200, Number(pagesParam))) : 1;
      const offsetStart = Math.max(1, Number(url.searchParams.get("offset") || 1));

      const providerId = "elit";
      const client = getProductsClient();
      const providersClient = getProvidersClient();

      // Garantizar provider en tabla Providers
      try {
        await providersClient.upsertEntity(
          {
            partitionKey: "provider",
            rowKey: providerId,
            id: providerId,
            name: "ELIT",
            api: true,
            currency: "ARS",
            fx: null,
            ivaIncluded: false,
            notes: "",
          },
          "Merge"
        );
      } catch {
        // no bloquear import
      }

      if (debug) {
        const resp = await elitFetchProducts({ limit: Math.min(limit, 10), offset: offsetStart });
        const list = Array.isArray(resp?.resultado) ? resp.resultado : [];
        const keys = list[0] ? Object.keys(list[0]) : [];
        const sample = list.slice(0, 5);
        return {
          status: 200,
          jsonBody: {
            ok: true,
            debug: true,
            keys,
            sample: {
              codigo: resp?.codigo ?? null,
              paginador: resp?.paginador ?? null,
              resultado: sample,
            },
          },
        };
      }

      let seen = 0;
      let saved = 0;

      const first = await elitFetchProducts({ limit, offset: offsetStart });
      const firstList = Array.isArray(first?.resultado) ? first.resultado : [];
      const total = Number(first?.paginador?.total ?? 0) || null;

      async function saveList(list) {
        for (const item of list) {
          const sku = pickSku(item);
          if (!sku) continue;

          const entity = {
            partitionKey: providerId,
            rowKey: String(sku),
            sku: String(sku),
            providerId,
            name: String(pickName(item) || ""),
            brand: String(pickBrand(item) || ""),
            price: pickPrice(item) ?? null,
            currency: String(pickCurrency(item) || "ARS"),
            imageUrl: pickImageUrl(item),
          };

          await client.upsertEntity(entity);
          saved += 1;
        }
      }

      seen += firstList.length;
      await saveList(firstList);

      if (all && total) {
        const maxPagesCap = 200;
        const maxItemsCap = 20000;
        let offset = offsetStart + limit;

        while (offsetStart + seen < total && seen < maxItemsCap) {
          const resp = await elitFetchProducts({ limit, offset });
          const list = Array.isArray(resp?.resultado) ? resp.resultado : [];
          if (list.length === 0) break;

          seen += list.length;
          await saveList(list);
          offset += limit;

          const pagesDone = Math.ceil(seen / limit);
          if (pagesDone >= maxPagesCap) break;
        }
      } else {
        let offset = offsetStart + limit;
        for (let i = 2; i <= pages; i++) {
          const resp = await elitFetchProducts({ limit, offset });
          const list = Array.isArray(resp?.resultado) ? resp.resultado : [];
          if (list.length === 0) break;

          seen += list.length;
          await saveList(list);
          offset += limit;
        }
      }

      return {
        status: 200,
        jsonBody: {
          ok: true,
          provider: providerId,
          total,
          seen,
          saved,
        },
      };
    } catch (err) {
      context?.error?.(err);
      return {
        status: 500,
        jsonBody: {
          ok: false,
          error: err?.message || "Import failed",
        },
      };
    }
  },
});
