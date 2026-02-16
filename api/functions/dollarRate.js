// File: /api/functions/dollarRate.js
// Obtener cotización del dólar del Banco Nación
const { app } = require("@azure/functions");

async function fetchBNARate() {
  try {
    // API del Banco Nación Argentina
    const url = "https://www.bna.com.ar/Cotizador/MonedasHistorico";
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    
    if (!res.ok) {
      throw new Error(`BNA API error: ${res.status}`);
    }
    
    const html = await res.text();
    
    // Buscar "Dolar U.S.A" y extraer valor de venta
    const match = html.match(/Dolar U\.S\.A.*?<td[^>]*>([0-9,]+)<\/td>.*?<td[^>]*>([0-9,]+)<\/td>/s);
    
    if (match) {
      const compra = parseFloat(match[1].replace(',', '.'));
      const venta = parseFloat(match[2].replace(',', '.'));
      
      return {
        compra,
        venta,
        fecha: new Date().toISOString(),
        fuente: "BNA"
      };
    }
    
    throw new Error("No se pudo parsear cotización del BNA");
    
  } catch (err) {
    // Fallback: usar API alternativa
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
      const data = await res.json();
      
      return {
        compra: data.compra,
        venta: data.venta,
        fecha: new Date().toISOString(),
        fuente: "DolarAPI"
      };
    } catch {
      // Fallback manual
      return {
        compra: 1150,
        venta: 1200,
        fecha: new Date().toISOString(),
        fuente: "Manual (fallback)"
      };
    }
  }
}

app.http("dollarRate", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dollar-rate",
  handler: async (request, context) => {
    try {
      const rate = await fetchBNARate();
      
      context.log(`Dólar BNA - Venta: ${rate.venta}`);
      
      return {
        status: 200,
        headers: { 
          "content-type": "application/json",
          "cache-control": "public, max-age=300" // Cache 5 min
        },
        body: JSON.stringify({
          ok: true,
          ...rate
        })
      };
      
    } catch (err) {
      context.error("Dollar rate error:", err);
      
      // Siempre devolver algo, aunque sea fallback
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: true,
          compra: 1150,
          venta: 1200,
          fecha: new Date().toISOString(),
          fuente: "Fallback",
          error: String(err.message)
        })
      };
    }
  }
});
