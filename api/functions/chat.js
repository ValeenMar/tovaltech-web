// File: /api/functions/chat.js
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../lib/auth");

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.CHAT_TABLE_NAME || "chatlog";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
}

app.http("chat", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    try {
      const admin = requireAdmin(request);
      if (!admin) {
        return { status: 403, jsonBody: { ok: false, error: "Forbidden" } };
      }

      const client = getClient();

      if (request.method === "GET") {
        const items = [];
        const iter = client.listEntities({
          queryOptions: { filter: "PartitionKey eq 'chat'", top: 50 }
        });

        for await (const e of iter) {
          items.push({
            message: e.message,
            createdAt: e.createdAt || e.timestamp || null,
            rowKey: e.rowKey
          });
        }

        items.sort((a, b) => String(b.rowKey).localeCompare(String(a.rowKey)));
        return { status: 200, jsonBody: { ok: true, items } };
      }

      const body = await request.json().catch(() => ({}));
      const message = String(body.message ?? "").trim();
      if (!message) return { status: 400, jsonBody: { ok: false, error: "Missing message" } };

      const now = new Date();
      await client.createEntity({
        partitionKey: "chat",
        rowKey: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
        message,
        createdAt: now.toISOString()
      });

      return { status: 200, jsonBody: { ok: true, reply: `Guardado: ${message}` } };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { ok: false, error: "Server error" } };
    }
  }
});
