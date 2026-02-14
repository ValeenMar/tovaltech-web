// File: /api/functions/getProducts.js
// CommonJS (require) para ser compatible con /api/index.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function escapeODataString(s) {
  return String(s).replace(/'/g, "''");
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

app.http("getProducts", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const client = getClient();
      const url = new URL(request.url);

      const provider = (url.searchParams.get("provider") || "").trim();
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();

      const rawLimit = Number(url.searchParams.get("limit") || 500);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(5000, Math.floor(rawLimit)))
        : 500;

      const filter = provider ? `PartitionKey eq '${escapeODataString(provider)}'` : undefined;

      const items = [];
      const pageSize = 1000;

      const listOpts = filter ? { queryOptions: { filter } } : {};
      const pager = client.listEntities(listOpts).byPage({ maxPageSize: pageSize });

      outer: for await (const page of pager) {
        for (const e of page) {
          const row = {
            sku: e.sku || e.rowKey,
            providerId: e.providerId || e.partitionKey,
            name: e.name || "",
            brand: e.brand || "",
            price: toNumber(e.price),
            currency: e.currency || "USD",
            image: e.image || e.imageUrl || null,
          };

          if (q) {
            const hay =
              String(row.sku).toLowerCase().includes(q) ||
              String(row.name).toLowerCase().includes(q) ||
              String(row.brand).toLowerCase().includes(q);
            if (!hay) continue;
          }

          items.push(row);
          if (items.length >= limit) break outer;
        }
      }

      return { status: 200, jsonBody: { ok: true, items } };
    } catch (err) {
      context?.error?.(err);
      return { status: 500, jsonBody: { ok: false, error: err?.message || "Error" } };
    }
  },
});
