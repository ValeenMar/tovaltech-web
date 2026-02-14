// File: /api/functions/providersElitImport.js
// Importador de productos desde ELIT -> Azure Table Storage (Products)
// Usage:
//   /api/providersElitImport?debug=1&limit=10
//   /api/providersElitImport?pages=5&limit=100&offset=1
//   /api/providersElitImport?all=1&limit=100&offset=1
//
// Nota: usa CommonJS (require) para ser compatible con /api/index.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getTableClient(envName, fallbackName) {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env[envName] || fallbackName;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function getProductsClient() {
  return getTableClient("PRODUCTS_TABLE_NAME", "Products");
}

function getProvidersClient() {
  return getTableClient("PROVIDERS_TABLE_NAME", "Providers");
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

function normalizeCurrency(v) {
  const s = String(v ?? "").trim();
  if (!s) return "ARS";

  // ELIT a veces devuelve códigos numéricos.
  // Ajustá este mapa si descubrís otros valores.
  if (s === "1") return "USD";
  if (s === "2") return "ARS";

  // Ya viene como ISO (ej: "ARS", "USD")
  if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();

  // fallback seguro
  return "ARS";
}

function pickSku(item) {
  return (
    item.sku ||
    item.codigo ||
    item.Codigo ||
    item.id ||
    item.Id ||
    item.ID ||
    item.cod ||
    item.COD ||
    ""
  );
}

function pickBrand(item) {
  return (
    item.marca ||
    item.brand ||
    item.Marca ||
    item.Brand ||
    item.fabricante ||
    item.Fabricante ||
    ""
  );
}

function pickName(item) {
  return (
    item.nombre ||
    item.name ||
    item.descripcion ||
    item.Descripcion ||
    item["Descripción"] ||
    item.titulo ||
    item.title ||
    ""
  );
}

function pickCurrency(item) {
  // ELIT es local => por defecto ARS, pero normalizamos por si viene como número.
  return normalizeCurrency(item.moneda || item.currency || item.Currency || "ARS");
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
  // Posibles nombres comunes. Ajustá cuando veas el "debug keys".
  const candidates = [
    // arrays
    Array.isArray(item?.miniaturas) ? item.miniaturas[0] : null,
    Array.isArray(item?.imagenes) ? item.imagenes[0] : null,
    Array.isArray(item?.images) ? item.images[0] : null,
    // strings
    item?.imagen,
    item?.imagen_url,
    item?.imagenUrl,
    item?.url_imagen,
    item?.urlImagen,
    item?.foto,
    item?.foto_url,
    item?.image,
    item?.imageUrl,
    item?.thumbnail,
    item?.thumbnailUrl,
    item?.img,
    item?.imgUrl,
  ];

  const first = candidates.find((v) => typeof v === "string" && v.trim());
  if (first) return String(first).trim();

  // Fallback: buscar cualquier string que parezca URL de imagen.
  if (item && typeof item === "object") {
    for (const v of Object.values(item)) {
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (!s) continue;
      if (!/^https?:\/\//i.test(s)) continue;
      if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(s)) return s;
    }
  }

  return null;
}

async function elitFetchProducts({ limit = 100, offset = 1 } = {}) {
  const ELIT_USER_ID = process.env.ELIT_USER_ID;
  const ELIT_TOKEN = process.env.ELIT_TOKEN;

  if (!ELIT_USER_ID || !ELIT_TOKEN) {
    throw new Error("Missing ELIT_USER_ID / ELIT_TOKEN");
  }

  // El endpoint exacto depende de ELIT. Esta estructura es la que venías usando.
  const api = "https://api.elit.com.ar/api/articulos/listado";
  const url = new URL(api);
  url.searchParams.set("usuario", ELIT_USER_ID);
  url.searchParams.set("token", ELIT_TOKEN);
  url.searchParams.set("cantidad", String(limit));
  url.searchParams.set("desde", String(offset));

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`ELIT HTTP ${res.status}`);
  if (!data) throw new Error("ELIT: no JSON");
  return data;
}

app.http("providersElitImport", {
  methods: ["POST", "GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const url = new URL(request.url);

      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 100)));
      const debug = String(url.searchParams.get("debug") || "") === "1";
      const pagesParam = url.searchParams.get("pages");
      const all = String(url.searchParams.get("all") || "") === "1";
      const pages = pagesParam ? Math.max(1, Math.min(400, Number(pagesParam))) : 1;
      const offsetStart = Math.max(1, Number(url.searchParams.get("offset") || 1));

      const providerId = "elit";
      const productsClient = getProductsClient();
      const providersClient = getProvidersClient();

      // Asegurar provider en tabla Providers
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

          await productsClient.upsertEntity(entity, "Merge");
          saved += 1;
        }
      }

      seen += firstList.length;
      await saveList(firstList);

      if (all && total) {
        // límites de seguridad (evitar timeouts)
        const maxPagesCap = 400;
        const maxItemsCap = 50000;

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
          note: "Si necesitas imágenes: corre /api/providersElitImport?debug=1 y verifica qué campo trae la URL. Luego re-importa con all=1.",
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
