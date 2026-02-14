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
  if (s === "1") return "USD";
  if (s === "2") return "ARS";
  if (/^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
  return "ARS";
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
      const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get("limit") || 500)));

      const items = [];
      const filter = provider ? `PartitionKey eq '${provider.replace(/'/g, "''")}'` : undefined;

      const iter = client.listEntities({
        queryOptions: { filter, top: limit },
      });

      for await (const e of iter) {
        const row = {
          sku: e.sku || e.rowKey,
          providerId: e.providerId || e.partitionKey,
          name: e.name || "",
          brand: e.brand || "",
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency || "ARS"),
          // opcional (si en el futuro lo guardamos):
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

      return { status: 200, jsonBody: { ok: true, items } };
    } catch (err) {
      context?.error?.(err);
      return { status: 500, jsonBody: { ok: false, error: err?.message || "Error" } };
    }
  },
});
