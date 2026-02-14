// File: /api/functions/getProviders.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getProvidersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PROVIDERS_TABLE_NAME || "Providers";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

function toBool(v) {
  if (v === true || v === false) return v;
  if (v === 1 || v === 0) return !!v;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return false;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // Soporta formatos tipo:
  //  - 1.23
  //  - 1,23
  //  - 1 234,56
  //  - 1.234,56
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

app.http("getProviders", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const client = getProvidersClient();

      const items = [];
      const iter = client.listEntities({ queryOptions: { top: 1000 } });

      for await (const e of iter) {
        const id = String(e.rowKey ?? e.RowKey ?? "").trim();            // RowKey = providerId
        const partition = String(e.partitionKey ?? e.PartitionKey ?? ""); // PartitionKey = provider
        if (!id) continue;

        items.push({
          id,
          partitionKey: partition,
          name: String(e.name ?? id),
          api: toBool(e.api ?? true),
          currency: String(e.currency ?? "USD"),
          fx: toNumber(e.fx),
          ivaIncluded: toBool(e.ivaIncluded ?? false),
          notes: e.notes ? String(e.notes) : ""
        });
      }

      // opcional: quedarnos con PK provider (por prolijidad)
      const filtered = items.filter(p => !p.partitionKey || p.partitionKey === "provider");

      filtered.sort((a, b) => a.id.localeCompare(b.id));
      return { status: 200, jsonBody: { ok: true, items: filtered } };
    } catch (err) {
      context.error(err);
      return {
        status: 500,
        jsonBody: {
          ok: false,
          error: err?.message || "Server error",
        },
      };
    }
  },
});
