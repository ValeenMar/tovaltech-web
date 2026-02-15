// File: /api/functions/providersNewBytesImport.js
// Import de productos desde New Bytes API
// Documentación: https://developers.nb.com.ar

const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");

function getProductsClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Products");
}

function getProvidersClient() {
  const conn = process.env.STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error("Missing STORAGE_CONNECTION_STRING");
  return TableClient.fromConnectionString(conn, "Providers");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch productos desde New Bytes API
 */
async function fetchNewBytesProducts(token) {
  const url = `https://api.nb.com.ar/v1/prices`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`New Bytes API fail: ${res.status} - ${text}`);
  }

  const data = await res.json();
  
  // Devuelve array directo
  return Array.isArray(data) ? data : [];
}

app.http("providersNewBytesImport", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "providers/newbytes/import",
  handler: async (request, context) => {
    try {
      const productsClient = getProductsClient();
      const providersClient = getProvidersClient();

      const dry = request.query.get("dry") === "1";
      let maxTotal = Math.floor(toNumber(request.query.get("max")) || 0);
      if (!maxTotal || maxTotal < 1) maxTotal = 5000;
      if (maxTotal > 10000) maxTotal = 10000;

      // Obtener token de env
      const token = process.env.NEWBYTES_TOKEN || "";
      
      if (!token) {
        return {
          status: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ 
            ok: false, 
            error: "Falta configurar NEWBYTES_TOKEN en Azure" 
          }),
        };
      }

      // Upsert provider New Bytes
      if (!dry) {
        await providersClient.upsertEntity(
          {
            partitionKey: "provider",
            rowKey: "newbytes",
            id: "newbytes",
            name: "New Bytes",
            api: true,
            currency: "USD", // New Bytes trabaja en USD
            fx: 0,
            ivaIncluded: false,
            notes: "Importado desde New Bytes API",
            updatedAt: new Date().toISOString(),
          },
          "Merge"
        );
      }

      context.log("🔄 Fetching productos from New Bytes...");
      
      const items = await fetchNewBytesProducts(token);
      
      context.log(`📦 Recibidos ${items.length} items`);

      let imported = 0;
      const errors = [];

      for (const it of items) {
        if (imported >= maxTotal) break;

        // SKU viene en el campo "sku" o "id"
        let sku = String(it.sku || it.id || "").trim();
        
        if (!sku) {
          errors.push({ id: it.id, error: "Missing SKU" });
          continue;
        }

        // Sanitizar SKU (remover caracteres problemáticos)
        sku = sku.replace(/[\\/#?]/g, "-");
        if (!sku || sku === "-") {
          errors.push({ id: it.id, error: "Invalid SKU after sanitization" });
          continue;
        }

        const entity = {
          partitionKey: "newbytes", // Usar providerId como PK
          rowKey: sku,
          sku,
          providerId: "newbytes",
          
          // Campos de New Bytes
          name: it.name || it.sku || sku,
          price: toNumber(it.value || it.price || it.finalPrice),
          currency: "USD",
          ivaRate: toNumber(it.iva),
          
          // Campos opcionales
          currencyQuote: toNumber(it.currencyQuote), // Cotización USD/ARS
          
          updatedAt: new Date().toISOString(),
        };

        if (!dry) {
          try {
            await productsClient.upsertEntity(entity, "Merge");
            imported++;
          } catch (e) {
            errors.push({ sku, error: String(e?.message || e) });
          }
        } else {
          imported++;
        }
      }

      context.log(`✅ Import completo: ${imported} productos`);

      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          provider: "newbytes",
          imported,
          total: items.length,
          maxRequested: maxTotal,
          errors: errors.slice(0, 10), // Solo primeros 10 errores
          errorsCount: errors.length,
        }),
      };
    } catch (err) {
      context.error("❌ Error en import New Bytes:", err);
      return {
        status: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: String(err?.message || err) 
        }),
      };
    }
  },
});