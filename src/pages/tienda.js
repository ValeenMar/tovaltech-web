// File: /src/pages/tienda.js
// Tienda pública: muestra productos con precio final (IVA + margen) y conversión a ARS.

import { products as mockProducts } from "../data/products.js";
import { providers as mockProviders } from "../data/providers.js";

let cachedProviders = null;
let dataSource = "MOCK";
let lastApiError = null;

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function formatMoney(amount, currency = "USD") {
  const n = typeof amount === "number" ? amount : toNumber(amount);
  if (n === null) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(currency, currency);
}

function formatPct(p) {
  const n = toNumber(p);
  if (n === null) return "";
  return (String(n).includes(".") ? n.toFixed(1) : String(n)).replace(".", ",") + "%";
}

function getFxUsdArs() {
  const v = toNumber(localStorage.getItem("tt_fx_usd_ars"));
  return v && v > 0 ? v : null;
}

function setFxUsdArs(v) {
  const n = toNumber(v);
  if (!n || n <= 0) {
    localStorage.removeItem("tt_fx_usd_ars");
    return null;
  }
  localStorage.setItem("tt_fx_usd_ars", String(n));
  return n;
}

function getMarginPct() {
  const v = toNumber(localStorage.getItem("tt_margin_pct"));
  return v === null ? 15 : v; // default 15%
}

function setMarginPct(v) {
  const n = toNumber(v);
  if (n === null || n < 0) {
    localStorage.removeItem("tt_margin_pct");
    return null;
  }
  localStorage.setItem("tt_margin_pct", String(n));
  return n;
}

async function loadProvidersFromApi() {
  const res = await fetch("/api/getProviders", { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");

  const items = Array.isArray(data) ? data : data.items || [];
  if (!Array.isArray(items)) throw new Error("Invalid items");

  return items.map((p) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? p.id ?? ""),
    api: !!p.api,
    currency: String(p.currency ?? "USD"),
    fx: toNumber(p.fx),
    ivaIncluded: String(p.ivaIncluded ?? "").toLowerCase() === "true",
  }));
}

async function loadProductsFromApi({ providerId = "", q = "" } = {}) {
  lastApiError = null;

  const params = new URLSearchParams();
  if (providerId) params.set("provider", providerId);
  if (q) params.set("q", q);
  params.set("limit", "5000");

  const res = await fetch(`/api/getProducts?${params.toString()}`, { method: "GET" });
  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.ok === false) {
    const errMsg = data?.error || `HTTP ${res.status}`;
    lastApiError = errMsg;
    throw new Error(errMsg);
  }

  const items = Array.isArray(data) ? data : data.items || [];
  if (!Array.isArray(items)) throw new Error("Invalid items");

  return items.map((p) => ({
    sku: String(p.sku ?? ""),
    providerId: String(p.providerId ?? ""),
    name: String(p.name ?? ""),
    brand: p.brand ? String(p.brand) : "",
    price: toNumber(p.price),
    currency: String(p.currency ?? "USD"),
    ivaRate: toNumber(p.ivaRate ?? p.iva),
    imageUrl: p.imageUrl || p.image || null,
    thumbUrl: p.thumbUrl || p.thumbnail || null,
  }));
}

function getProviderName(providerId) {
  const p = cachedProviders?.find((x) => x.id === providerId);
  return p?.name || providerId;
}

function computeFinalPrice({ price, ivaRate, marginPct }) {
  const base = price;
  if (base === null) return { totalUsd: null, ivaRateUsed: ivaRate };

  const iva = ivaRate !== null && ivaRate !== undefined ? ivaRate : null;
  const withIva = iva !== null ? base * (1 + iva / 100) : base;

  const m = marginPct !== null && marginPct !== undefined ? marginPct : 0;
  const withMargin = withIva * (1 + m / 100);

  return { totalUsd: withMargin, ivaRateUsed: iva };
}

function enhanceRows(rows) {
  const fxUsdArs = getFxUsdArs();
  const marginPct = getMarginPct();

  return rows.map((r) => {
    // default: ELIT suele tener IVA 10.5% (si no viene)
    const ivaRate = r.ivaRate !== null && r.ivaRate !== undefined ? r.ivaRate : r.providerId === "elit" ? 10.5 : null;

    const { totalUsd, ivaRateUsed } = computeFinalPrice({
      price: r.price,
      ivaRate,
      marginPct,
    });

    let arsTotal = null;
    if (totalUsd !== null) {
      if (String(r.currency).toUpperCase() === "ARS") arsTotal = totalUsd;
      else if (String(r.currency).toUpperCase() === "USD" && fxUsdArs) arsTotal = totalUsd * fxUsdArs;
    }

    return {
      ...r,
      providerName: getProviderName(r.providerId),
      ivaRate: ivaRateUsed,
      totalWithIvaAndMargin: totalUsd,
      arsTotal,
      fxUsdArs,
      marginPct,
    };
  });
}

function renderProductCard(p, idx) {
  // Importante: si ELIT te da miniaturas de mala calidad, preferimos imageUrl.
  const img = p.imageUrl || p.thumbUrl || null;

  const priceUsd = p.totalWithIvaAndMargin !== null ? formatMoney(p.totalWithIvaAndMargin, p.currency) : "-";
  const priceArs = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : "-";

  return `
    <div class="tiendaCard" data-tt="product-card" data-idx="${idx}">
      <div class="tiendaCardMedia">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" decoding="async" />` : `<div class="tiendaCardPh">${esc((p.brand || p.providerName || "P")[0] || "P")}</div>`}
      </div>

      <div class="tiendaCardBody">
        <h3 class="tiendaCardTitle">${esc(p.name)}</h3>

        <div class="tiendaCardMeta">
          <span class="chip">${esc(p.providerName)}</span>
          ${p.brand ? `<span class="chip">${esc(p.brand)}</span>` : ""}
        </div>

        <div class="tiendaCardPrice">
          <div class="tiendaPrecioFinal">${priceArs}</div>
          <div class="tiendaPrecioDetalle">
            Base ${formatMoney(p.price, p.currency)}
            ${p.ivaRate !== null ? ` • IVA ${formatPct(p.ivaRate)}` : ""}
            ${p.marginPct !== null ? ` • Margen ${formatPct(p.marginPct)}` : ""}
          </div>
        </div>

        <button class="btn btnPrimary tiendaCardBtn">Ver detalle</button>
      </div>
    </div>
  `;
}

function renderModalBody(p) {
  const img = p.imageUrl || p.thumbUrl || null;

  const baseMoney = formatMoney(p.price, p.currency);
  const totalMoney = p.totalWithIvaAndMargin !== null ? formatMoney(p.totalWithIvaAndMargin, p.currency) : "-";
  const arsMoney = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : "-";

  const fxLine = String(p.currency).toUpperCase() === "USD" ? (p.fxUsdArs ? `FX USD→ARS: ${p.fxUsdArs}` : "FX USD→ARS: (configurá arriba)") : "";

  const ivaMoney =
    p.totalWithIvaAndMargin !== null && p.price !== null && p.ivaRate !== null
      ? formatMoney(p.price * (1 + p.ivaRate / 100), p.currency)
      : "-";

  const withIvaNoMargin = p.price !== null && p.ivaRate !== null ? p.price * (1 + p.ivaRate / 100) : null;
  const marginMoney = withIvaNoMargin !== null && p.marginPct !== null ? formatMoney(withIvaNoMargin * (1 + p.marginPct / 100), p.currency) : "-";

  return `
    <div class="tiendaModalGrid">
      <div class="tiendaModalImg">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" />` : `<div class="tiendaModalPh">${esc((p.brand || p.providerName || "P")[0] || "P")}</div>`}
      </div>

      <div class="tiendaModalInfo">
        <div>
          <div class="tiendaModalTitle">${esc(p.name)}</div>
          <div class="tiendaModalMeta">
            <span class="chip">${esc(p.providerName)}</span>
            ${p.brand ? `<span class="chip">${esc(p.brand)}</span>` : ""}
            ${p.sku ? `<span class="chip">${esc(p.sku)}</span>` : ""}
          </div>
        </div>

        <div class="tiendaModalDesglose">
          <h4>Desglose de precio</h4>

          <div class="tiendaModalRow"><span>Precio base</span><b>${baseMoney}</b></div>
          ${p.ivaRate !== null ? `<div class="tiendaModalRow"><span>Con IVA (${formatPct(p.ivaRate)})</span><b>${ivaMoney}</b></div>` : ""}
          <div class="tiendaModalRow"><span>Con margen (${formatPct(p.marginPct)})</span><b>${marginMoney}</b></div>

          <div class="tiendaModalTotal">
            <span>Total (${p.currency})</span>
            <b>${totalMoney}</b>
          </div>

          <div class="tiendaModalRow"><span>Total en ARS</span><b>${arsMoney}</b></div>
          ${fxLine ? `<div class="tiendaModalNote">${esc(fxLine)}</div>` : ""}
        </div>

        <div class="tiendaModalActions">
          <button class="btn">Solicitar</button>
          <button class="btn btnPrimary" data-tt="modal-close">Cerrar</button>
        </div>

        <div class="tiendaModalNote">
          Nota: el precio en ARS es estimado según el FX configurado.
        </div>
      </div>
    </div>
  `;
}

export function TiendaPage() {
  return `
  <section class="page tiendaPage">
    <h1>Tienda</h1>
    <div class="muted" id="tiendaSource">Datos: ${dataSource}</div>
    <div id="tiendaErr" class="errorText" style="display:none; margin-top:10px;"></div>

    <div class="tiendaFilters">
      <input id="q" class="input" placeholder="Buscar por nombre / marca" />
      <div class="tiendaConfig">
        <label>
          <span>FX USD→ARS</span>
          <input id="fxUsdArs" class="input small" placeholder="ej: 1200" inputmode="decimal" />
        </label>
        <label>
          <span>Margen %</span>
          <input id="marginPct" class="input small" placeholder="ej: 15" inputmode="decimal" />
        </label>
      </div>
    </div>

    <div class="pill" id="countPill">0 items • ${dataSource}</div>

    <div id="grid" class="tiendaGrid"></div>

    <div id="tiendaModal" class="ttModal hidden" role="dialog" aria-modal="true" aria-label="Detalle de producto">
      <div class="ttModalBackdrop" data-tt="modal-close"></div>
      <div class="ttModalPanel">
        <button class="ttModalClose" data-tt="modal-close" aria-label="Cerrar">✕</button>
        <div id="tiendaModalBody"></div>
      </div>
    </div>
  </section>
  `;
}

export function wireTienda(rootOrQuery, maybeQuery = "") {
  let root = document;
  let initialQ = "";

  if (rootOrQuery && typeof rootOrQuery.querySelector === "function") {
    root = rootOrQuery;
    initialQ = typeof maybeQuery === "string" ? maybeQuery : "";
  } else {
    root = document;
    initialQ = typeof rootOrQuery === "string" ? rootOrQuery : "";
  }

  const grid = root.querySelector("#grid");
  const qInput = root.querySelector("#q");
  if (qInput && initialQ) qInput.value = initialQ;

  const countPill = root.querySelector("#countPill");
  const fxInput = root.querySelector("#fxUsdArs");
  const marginInput = root.querySelector("#marginPct");
  const tiendaSource = root.querySelector("#tiendaSource");
  const errBox = root.querySelector("#tiendaErr");

  const modal = root.querySelector("#tiendaModal");
  const modalBody = root.querySelector("#tiendaModalBody");

  let baseRows = [];
  let viewRows = [];

  // init config
  const fxInit = getFxUsdArs();
  if (fxInit) fxInput.value = String(fxInit);

  const marginInit = getMarginPct();
  if (marginInit !== null) marginInput.value = String(marginInit);

  fxInput.addEventListener("input", () => {
    setFxUsdArs(fxInput.value);
    draw();
  });

  marginInput.addEventListener("input", () => {
    setMarginPct(marginInput.value);
    draw();
  });

  function openModal(p) {
    modalBody.innerHTML = renderModalBody(p);
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", (ev) => {
    const close = ev.target.closest("[data-tt='modal-close']");
    if (close) closeModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  grid.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-tt='product-card']");
    if (!el) return;
    const idx = Number(el.dataset.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= viewRows.length) return;
    openModal(viewRows[idx]);
  });

  function setSourceUi() {
    if (tiendaSource) tiendaSource.textContent = `Datos: ${dataSource}`;
    if (countPill) countPill.textContent = `${viewRows.length} items • ${dataSource}`;
  }

  function draw() {
    const q = (qInput.value || "").trim().toLowerCase();

    let rows = baseRows;

    if (q) {
      rows = rows.filter((r) => {
        return (
          (r.name && String(r.name).toLowerCase().includes(q)) ||
          (r.brand && String(r.brand).toLowerCase().includes(q)) ||
          (r.sku && String(r.sku).toLowerCase().includes(q))
        );
      });
    }

    const enhanced = enhanceRows(rows);
    viewRows = enhanced;

    setSourceUi();

    grid.innerHTML = viewRows.map((p, i) => renderProductCard(p, i)).join("");

    if (!viewRows.length) {
      grid.innerHTML = `<div class="emptyState">No hay productos para mostrar</div>`;
    }
  }

  qInput.addEventListener("input", () => {
    draw();
  });

  async function bootstrap() {
    if (errBox) {
      errBox.style.display = "none";
      errBox.textContent = "";
    }

    try {
      cachedProviders = await loadProvidersFromApi();
      const products = await loadProductsFromApi();
      dataSource = "API";
      baseRows = products;
    } catch (err) {
      dataSource = "MOCK";
      cachedProviders = mockProviders;
      baseRows = mockProducts;

      const hint = lastApiError ? `API error: ${lastApiError}` : "API no disponible";
      if (errBox) {
        errBox.style.display = "block";
        errBox.textContent = `${hint}. Si querés ver el diagnóstico real: /api/health y /api/getProducts?limit=5`;
      }

      console.error("Tienda bootstrap error:", err);
    }

    draw();
  }

  bootstrap();
}
