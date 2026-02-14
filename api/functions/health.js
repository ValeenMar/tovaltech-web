// File: /api/functions/health.js
// Endpoint simple para diagnosticar si el API está vivo y si puede leer Table Storage.
// GET /api/health

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getClient(tableName) {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

async function canListOne(tableName) {
  const client = getClient(tableName);
  const iter = client.listEntities({ queryOptions: { top: 1 } });
  // consumimos 1 (si hay) para validar auth y existencia de tabla
  for await (const _ of iter) {
    break;
  }
  return true;
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (_request, context) => {
    const env = {
      hasStorageConn: !!process.env.STORAGE_CONNECTION_STRING,
      hasAppPassword: !!process.env.APP_PASSWORD,
      hasElitUserId: !!process.env.ELIT_USER_ID,
      hasElitToken: !!process.env.ELIT_TOKEN,
      chatTable: process.env.CHAT_TABLE_NAME || "chatlog",
      productsTable: process.env.PRODUCTS_TABLE_NAME || "Products",
      providersTable: process.env.PROVIDERS_TABLE_NAME || "Providers",
    };

    const tables = {};
    const errors = {};

    const toCheck = [
      { key: "chat", name: env.chatTable },
      { key: "products", name: env.productsTable },
      { key: "providers", name: env.providersTable },
    ];

    for (const t of toCheck) {
      try {
        await canListOne(t.name);
        tables[t.key] = true;
      } catch (err) {
        tables[t.key] = false;
        errors[t.key] = err?.message || "error";
        context?.error?.(err);
      }
    }

    const ok = Object.values(tables).every(Boolean);
    return {
      status: ok ? 200 : 500,
      jsonBody: {
        ok,
        env,
        tables,
        errors,
        now: new Date().toISOString(),
      },
    };
  },
});
