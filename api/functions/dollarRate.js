// File: /api/functions/dollarRate.js
// GET /api/dollar-rate
// Fuente única: https://dolarapi.com/v1/dolares/oficial

const { app } = require("@azure/functions");

const DOLARAPI_URL = "https://dolarapi.com/v1/dolares/oficial";
const TTL_MS = 5 * 60 * 1000; // 5 min

let cache = null; // { payload, fetchedAt }

function toNumber(v) {
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function fetchOficial() {
  const res = await fetch(DOLARAPI_URL, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  if (!res.ok) throw new Error(`DolarAPI HTTP ${res.status}`);

  const data = await res.json();
  const compra = toNumber(data?.compra);
  const venta = toNumber(data?.venta);

  if (!venta || venta <= 0) throw new Error("DolarAPI: 'venta' inválida");

  return {
    compra: compra ?? null,
    venta,
    casa: data?.casa ?? null,
    nombre: data?.nombre ?? null,
    moneda: data?.moneda ?? "USD",
    fechaActualizacion: data?.fechaActualizacion ?? null,
  };
}

app.http("dollarRate", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dollar-rate",
  handler: async (_request, context) => {
    try {
      if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
          jsonBody: { ok: true, fuente: DOLARAPI_URL, cached: true, ...cache.payload },
        };
      }

      const payload = await fetchOficial();
      cache = { payload, fetchedAt: Date.now() };

      context.log(`DolarAPI oficial venta: ${payload.venta}`);

      return {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=300",
        },
        jsonBody: { ok: true, fuente: DOLARAPI_URL, cached: false, ...payload },
      };
    } catch (err) {
      context.error("DollarRate error:", err);

      // Si hubo una cotización previa (sigue siendo API), devolvemos esa aunque esté vieja
      if (cache?.payload?.venta) {
        return {
          status: 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
          jsonBody: {
            ok: true,
            fuente: DOLARAPI_URL,
            cached: true,
            stale: true,
            error: String(err?.message || err),
            ...cache.payload,
          },
        };
      }

      return {
        status: 502,
        headers: { "content-type": "application/json" },
        jsonBody: { ok: false, fuente: DOLARAPI_URL, error: String(err?.message || err) },
      };
    }
  },
});
