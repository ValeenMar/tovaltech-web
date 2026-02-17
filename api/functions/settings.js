/**
 * /api/settings — GET y POST para configuración global (margen, etc.)
 * GET: público (para que el frontend cargue el margen)
 * POST: solo admin (para guardar)
 */
const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../lib/auth");

const SETTINGS_TABLE = "Settings";
const SETTINGS_PK = "config";
const SETTINGS_RK = "global";

const DEFAULTS = { marginPct: 15 };

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, SETTINGS_TABLE);
}

async function readSettings() {
  const client = getClient();
  try {
    await client.createTable();
  } catch {
    /* ya existe */
  }
  try {
    const entity = await client.getEntity(SETTINGS_PK, SETTINGS_RK);
    return {
      marginPct:
        typeof entity.marginPct === "number" ? entity.marginPct : DEFAULTS.marginPct,
    };
  } catch (err) {
    if (err.statusCode === 404) return { ...DEFAULTS };
    throw err;
  }
}

app.http("settings", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    // ---------- GET ----------
    if (request.method === "GET") {
      try {
        const settings = await readSettings();
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          jsonBody: { ok: true, ...settings },
        };
      } catch (err) {
        context.error("Error leyendo settings:", err);
        return {
          status: 200,
          jsonBody: { ok: true, ...DEFAULTS },
        };
      }
    }

    // ---------- POST (solo admin) ----------
    const user = requireAdmin(request);
    if (!user) {
      return { status: 401, jsonBody: { ok: false, error: "No autorizado" } };
    }

    try {
      const body = await request.json();
      const marginPct = parseFloat(body.marginPct);

      if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct > 500) {
        return {
          status: 400,
          jsonBody: { ok: false, error: "marginPct inválido (debe ser 0-500)" },
        };
      }

      const client = getClient();
      try {
        await client.createTable();
      } catch {
        /* ya existe */
      }

      await client.upsertEntity(
        {
          partitionKey: SETTINGS_PK,
          rowKey: SETTINGS_RK,
          marginPct,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email || user.sub || "admin",
        },
        "Replace"
      );

      context.log(`✅ Margen global actualizado: ${marginPct}% por ${user.email}`);
      return {
        status: 200,
        jsonBody: { ok: true, marginPct },
      };
    } catch (err) {
      context.error("Error guardando settings:", err);
      return {
        status: 500,
        jsonBody: { ok: false, error: String(err?.message || err) },
      };
    }
  },
});