// File: /api/functions/providersNewBytesImport.js
// Import de productos desde New Bytes API

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
  let s = String(v).trim();
  if (!s) return null;

  s = s.replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
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
  const s = String(v).trim().toUpperCase();
  if (!s) return null;
  if (s === "USD" || s === "DOLAR" || s === "U$S") return "USD";
  if (s === "ARS" || s === "PESOS" || s === "$") return "ARS";
  return s;
}

/**
 * Fetch productos desde New Bytes API
 */
async function fetchNewBytesProducts() {
  const token = process.env.NEWBYTES_TOKEN || "";
  
  if (!token) {
    throw new Error("Falta variable NEWBYTES_TOKEN en Azure");
  }

  // 🔧 AJUSTAR ESTA URL según la documentación de New Bytes
  const url = `https://api.nb.com.ar/v1/productos`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // 🔧 AJUSTAR según cómo autentican
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`New Bytes API fail: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  
  // 🔧 AJUSTAR según la estructura de respuesta
  // Opciones comunes:
  // - data.items
  // - data.products
  // - data (si es array directo)
  return Array.isArray(data) ? data : data.items || data.products || [];
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

      // Upsert provider New Bytes
      if (!dry) {
        await providersClient.upsertEntity(
          {
            partitionKey: "provider",
            rowKey: "newbytes",
            id: "newbytes",
            name: "New Bytes",
            api: true,
            currency: "ARS", // 🔧 Ajustar según la moneda
            fx: 0,
            ivaIncluded: false, // 🔧 Ajustar según si incluye IVA
            notes: "Importado desde New Bytes API",
            updatedAt: new Date().toISOString(),
          },
          "Merge"
        );
      }

      context.log("🔄 Fetching productos from New Bytes...");
      
      const items = await fetchNewBytesProducts();
      
      context.log(`📦 Recibidos ${items.length} items`);

      let imported = 0;
      const errors = [];

      for (const it of items) {
        if (imported >= maxTotal) break;

        // 🔧 AJUSTAR nombres de campos según la API de New Bytes
        // Campos comunes: codigo, sku, code, productCode, etc.
        let sku = String(
          it.codigo || 
          it.sku || 
          it.code || 
          it.productCode || 
          it.id || 
          ""
        ).trim();
        
        if (!sku) continue;

        // Sanitizar SKU (remover caracteres problemáticos)
        sku = sku.replace(/[\\/#?]/g, "-");
        if (!sku || sku === "-") continue;

        const entity = {
          partitionKey: "newbytes", // Usar providerId como PK
          rowKey: sku,
          sku,
          providerId: "newbytes",
          
          // 🔧 MAPEAR campos según la API
          name: it.nombre || it.descripcion || it.name || it.description || null,
          brand: it.marca || it.brand || null,
          price: toNumber(it.precio || it.price || it.precioLista),
          currency: normalizeCurrency(it.moneda || it.currency) || "ARS",
          
          // Campos opcionales (mapear si existen)
          imageUrl: it.imagen || it.image || it.imageUrl || null,
          category: it.categoria || it.category || it.rubro || null,
          stock: toNumber(it.stock || it.cantidad),
          
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
          errors,
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