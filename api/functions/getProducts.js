// File: /api/functions/getProducts.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

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

      // IMPORTANTE:
      // Azure Tables no permite $top > 1000 (da InvalidInput).
      // Por eso NO mandamos top=limit; paginamos y cortamos manualmente.
      const clauses = ["PartitionKey eq 'product'"];
      if (provider && provider !== "all") {
        clauses.push(`providerId eq '${escapeODataString(provider)}'`);
      }
      const filter = clauses.join(" and ");

      const items = [];
      const iter = client.listEntities({ queryOptions: { filter } });

      for await (const e of iter) {
        const sku = e.sku ?? e.codigo_producto ?? e.RowKey ?? e.rowKey ?? null;
        const name = e.name ?? e.nombre ?? null;
        const brand = e.brand ?? e.marca ?? null;

        if (q) {
          const hay =
            (sku && String(sku).toLowerCase().includes(q)) ||
            (name && String(name).toLowerCase().includes(q)) ||
            (brand && String(brand).toLowerCase().includes(q));
          if (!hay) continue;
        }

        items.push({
          sku: sku ? String(sku) : null,
          providerId: e.providerId ?? provider ?? null,
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
