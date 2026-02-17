const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { requireAdmin } = require("../lib/auth");

function getClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  const tableName = process.env.PRODUCTS_TABLE_NAME || "Products";
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, tableName);
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
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
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
  if (s === "2" || s.toLowerCase() === "usd") return "USD";
  if (s === "1" || s.toLowerCase() === "ars") return "ARS";
  return s.toUpperCase();
}

app.http("product", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request) => {
    const sku = String(request.query.get("sku") || "").trim();
    if (!sku) {
      return { status: 400, jsonBody: { ok: false, error: "sku requerido" } };
    }

    try {
      const client = getClient();
      const iter = client.listEntities({ queryOptions: { filter: `RowKey eq '${sku.replace(/'/g, "''")}'` } });

      let picked = null;
      for await (const e of iter) {
        const pkRaw = String(e.partitionKey ?? e.PartitionKey ?? "").trim().toLowerCase();
        const providerId =
          (pkRaw && pkRaw !== "product" && pkRaw !== "products" && pkRaw !== "p")
            ? pkRaw
            : String(e.providerId ?? e.proveedorId ?? e.provider ?? "").trim().toLowerCase() || null;

        const item = {
          sku,
          providerId,
          name: e.name ?? e.nombre ?? e.nombre_producto ?? null,
          brand: e.brand ?? e.marca ?? null,
          category: e.category ?? e.categoria ?? null,
          price: toNumber(e.price),
          currency: normalizeCurrency(e.currency ?? e.moneda),
          ivaRate: toNumber(e.ivaRate ?? e.iva),
          imageUrl: e.imageUrl ?? e.image ?? null,
          thumbUrl: e.thumbUrl ?? e.thumbnail ?? e.miniatura ?? null,
          stock: toNumber(e.stock),
          updatedAt: e.updatedAt ?? e.updatedAtIso ?? e.timestamp ?? null,
        };

        if (!picked || String(item.updatedAt || "") > String(picked.updatedAt || "")) {
          picked = item;
        }
      }

      if (!picked) {
        return { status: 404, jsonBody: { ok: false, error: "Producto no encontrado" } };
      }

      return {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60",
          "content-type": "application/json",
        },
        jsonBody: { ok: true, item: picked },
      };
    } catch (err) {
      return { status: 500, jsonBody: { ok: false, error: String(err?.message || err) } };
    }
  },
});

// ---- PATCH: editar campos de un producto (solo admin) ----
app.http("productUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "productUpdate",
  handler: async (request, context) => {
    const user = requireAdmin(request);
    if (!user) {
      return { status: 401, jsonBody: { ok: false, error: "No autorizado" } };
    }

    const sku = String(request.query.get("sku") || "").trim();
    if (!sku) {
      return { status: 400, jsonBody: { ok: false, error: "sku requerido" } };
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { ok: false, error: "JSON inválido" } };
    }

    // Campos que el admin puede editar
    const ALLOWED = ["name", "brand", "category", "price", "currency", "ivaRate", "stock", "imageUrl", "marginOverride", "description"];
    const updates = {};
    for (const field of ALLOWED) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // marginOverride: null = usar global, número = override
    if ("marginOverride" in updates) {
      const mo = parseFloat(updates.marginOverride);
      updates.marginOverride = Number.isFinite(mo) && mo >= 0 ? mo : null;
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, jsonBody: { ok: false, error: "Sin campos para actualizar" } };
    }

    try {
      const client = getClient();
      const iter = client.listEntities({
        queryOptions: { filter: `RowKey eq '${sku.replace(/'/g, "''")}'` },
      });

      let entityPK = null;
      for await (const e of iter) {
        entityPK = e.partitionKey;
        break;
      }

      if (!entityPK) {
        return { status: 404, jsonBody: { ok: false, error: "Producto no encontrado" } };
      }

      await client.upsertEntity(
        {
          partitionKey: entityPK,
          rowKey: sku,
          ...updates,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email || "admin",
        },
        "Merge"
      );

      context.log(`✅ Producto actualizado: ${sku} por ${user.email}`);
      return {
        status: 200,
        jsonBody: { ok: true, sku, updated: Object.keys(updates) },
      };
    } catch (err) {
      context.error("Error actualizando producto:", err);
      return { status: 500, jsonBody: { ok: false, error: String(err?.message || err) } };
    }
  },
});