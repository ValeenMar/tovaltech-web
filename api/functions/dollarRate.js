// File: /api/functions/dollarRate.js
// Dólar USD/ARS: solo desde DolarAPI. El front ya no permite editar el FX.
const { app } = require("@azure/functions");

// Docs Argentina:
// - GET https://dolarapi.com/v1/dolares/oficial  (schema compra/venta/casa/nombre/moneda/fechaActualizacion)
// - GET https://dolarapi.com/v1/dolares          (lista de casas)
// - GET https://dolarapi.com/v1/ambito/dolares/oficial (fuente Ámbito)
const DOLARAPI_OFICIAL_URL =
  process.env.DOLARAPI_OFICIAL_URL || "https://dolarapi.com/v1/dolares/oficial";
const DOLARAPI_DOLARES_URL =
  process.env.DOLARAPI_DOLARES_URL || "https://dolarapi.com/v1/dolares";
const DOLARAPI_AMBITO_OFICIAL_URL =
  process.env.DOLARAPI_AMBITO_OFICIAL_URL || "https://dolarapi.com/v1/ambito/dolares/oficial";

let LAST_OK = null;

function toNum(v) {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchWithTimeout(url, { timeoutMs = 6000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function normalizeRate(data, { fuente = "DolarAPI" } = {}) {
  const compra = toNum(data?.compra);
  const venta = toNum(data?.venta);
  if (!compra || !venta) return null;

  return {
    ok: true,
    compra,
    venta,
    casa: data.casa || "oficial",
    nombre: data.nombre || "Dólar Oficial",
    moneda: data.moneda || "USD",
    fechaActualizacion: data.fechaActualizacion || new Date().toISOString(),
    fuente,
  };
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url, {
    timeoutMs: 6000,
    headers: { "user-agent": "tovaltech-web/1.0" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`${url} -> invalid JSON`);
  return data;
}

async function fetchDollarOficialFromDolarApi() {
  // 1) Oficial (primario)
  try {
    const data = await fetchJson(DOLARAPI_OFICIAL_URL);
    const r = normalizeRate(data, { fuente: "DolarAPI" });
    if (r) return r;
  } catch (_) {}

  // 2) Lista de dólares (backup)
  try {
    const data = await fetchJson(DOLARAPI_DOLARES_URL);
    if (Array.isArray(data)) {
      const found =
        data.find((x) => String(x?.casa || "").toLowerCase() === "oficial") ||
        data.find((x) => String(x?.nombre || "").toLowerCase().includes("oficial"));
      const r = normalizeRate(found, { fuente: "DolarAPI" });
      if (r) return r;
    }
  } catch (_) {}

  // 3) Ámbito (último backup)
  try {
    const data = await fetchJson(DOLARAPI_AMBITO_OFICIAL_URL);
    const r = normalizeRate(data, { fuente: "DolarAPI (Ámbito)" });
    if (r) return r;
  } catch (_) {}

  throw new Error("No se pudo obtener FX desde DolarAPI");
}

app.http("dollarRate", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dollar-rate",
  handler: async (_request, context) => {
    try {
      const rate = await fetchDollarOficialFromDolarApi();
      LAST_OK = { ...rate };

      context.log(
        `FX USD/ARS (${rate.nombre}) venta=${rate.venta} fecha=${rate.fechaActualizacion}`
      );

      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          // Cache del lado del CDN/navegador por 5 min.
          "cache-control": "public, max-age=300",
        },
        body: JSON.stringify(rate),
      };
    } catch (err) {
      context.error("Dollar rate error:", err);

      // Si ya hubo un OK en esta instancia, devolvemos ese valor (stale=true)
      if (LAST_OK && LAST_OK.venta) {
        const stale = {
          ...LAST_OK,
          stale: true,
          ok: true,
          error: String(err?.message || err),
        };
        return {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
          body: JSON.stringify(stale),
        };
      }

      // Último fallback: respuesta válida pero sin FX.
      const fallback = {
        ok: false,
        compra: 0,
        venta: 0,
        casa: "oficial",
        nombre: "Dólar Oficial",
        moneda: "USD",
        fechaActualizacion: new Date().toISOString(),
        fuente: "Fallback",
        error: String(err?.message || err),
      };

      return {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
        body: JSON.stringify(fallback),
      };
    }
  },
});
