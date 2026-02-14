// File: /api/functions/getProducts.js
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

function normalizeCurrency(v) {
  // ELIT te está devolviendo "2" en algunos registros -> lo mapeo a USD.
  if (v === null || v === undefined || v === "") return "USD";
  if (v === 2 || v === "2") return "USD";
  if (v === 1 || v === "1") return "ARS";
  return String(v);
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
        ? Math.max(1, Math.min(20000, Math.floor(rawLimit))) // límite lógico
        : 500;

      const filter = provider
        ? `PartitionKey eq '${escapeODataString(provider)}'`
        : undefined;

      const listOpts = filter ? { queryOptions: { filter } } : {};
      const iter = client.listEntities(listOpts); // <-- sin top, sin byPage

      const items = [];
      for await (const e of iter) {
        const row = {
          sku: e.sku || e.rowKey,
          providerId: e.providerId || e.partitionKey,
          name: e.name || "",
          brand: e.brand || "",
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency),
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
        if (items.length >= limit) break;
      }

      return {
        status: 200,
        jsonBody: { ok: true, items, returned: items.length },
      };
    } catch (err) {
      context?.error?.(err);
      return {
        status: 500,
        jsonBody: { ok: false, error: err?.message || "Error" },
      };
    }
  },
});
