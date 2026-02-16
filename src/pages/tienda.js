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

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function norm(s) {
  return String(s ?? "").toLowerCase();
}

function formatMoney(amount, currency = "USD") {
  const n = typeof amount === "number" ? amount : toNumber(amount);
  if (n === null) return "-";
  const cur = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: cur === "ARS" ? 0 : 2,
    }).format(n);
  } catch (_) {
    return `${cur} ${n.toFixed(cur === "ARS" ? 0 : 2)}`;
  }
}

function formatPct(n) {
  const v = typeof n === "number" ? n : toNumber(n);
  if (v === null) return "-";
  return `${v.toFixed(1)}%`;
}

function getFxUsdArs() {
  const v = localStorage.getItem("toval_fx_usd_ars");
  const n = toNumber(v);
  return n && n > 0 ? n : null;
}

function setFxUsdArs(v) {
  const n = toNumber(v);
  if (!n) localStorage.removeItem("toval_fx_usd_ars");
  else localStorage.setItem("toval_fx_usd_ars", String(n));
}

function getMarginPct() {
  const v = localStorage.getItem("toval_margin_pct");
  const n = toNumber(v);
  return n !== null && n >= 0 ? n : 15;
}

function setMarginPct(v) {
  const n = toNumber(v);
  if (n === null) localStorage.removeItem("toval_margin_pct");
  else localStorage.setItem("toval_margin_pct", String(n));
}

async function loadProvidersFromApi() {
  const res = await fetch("/api/getProviders", { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");
  const items = Array.isArray(data) ? data : (data.items || []);
  if (!Array.isArray(items)) throw new Error("Invalid items");

  return items.map((p) => ({
    id: String(p.id ?? p.RowKey ?? ""),
    name: String(p.name ?? p.displayName ?? p.RowKey ?? ""),
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
    stock: toNumber(p.stock),
    imageUrl: p.imageUrl || p.image || null,
    thumbUrl: p.thumbUrl || p.thumbnail || null,
  }));
}

function getProviderName(providerId) {
  const p = cachedProviders?.find((x) => x.id === providerId);
  return p?.name || providerId;
}

/**
 * Taxonomía (heurística): sin tocar providers todavía.
 */
function classifyProduct(r) {
  const t = `${r.name || ""} ${r.brand || ""} ${r.sku || ""}`.toLowerCase();
  const has = (re) => re.test(t);

  if (has(/\bmonitor\b|\bdisplay\b|\bpantalla\b|\blcd\b|\bled\b|\bips\b|\bqhd\b|\bfhd\b|\buhd\b|\b4k\b|\b144hz\b|\b165hz\b|\b240hz\b/)) {
    return { cat: "Monitores", sub: "Monitores" };
  }

  if (has(/\bteclad(o|os)\b|\bkeyboard\b|\bkeycap\b|\bswitch\b/)) return { cat: "Periféricos", sub: "Teclados" };
  if (has(/\bmouse\b|\bmice\b|\brat[oó]n\b|\bdpi\b|\bsensor\b/)) return { cat: "Periféricos", sub: "Mouse" };
  if (has(/\bheadset\b|\bauricular(es)?\b|\bparlante(s)?\b|\bspeaker\b|\bmicro\b|\bmicrofono\b|\baudio\b/)) return { cat: "Periféricos", sub: "Audio" };
  if (has(/\bwebcam\b|\bc[áa]mara\b|\bcamera\b/)) return { cat: "Periféricos", sub: "Cámaras" };

  if (has(/\brtx\b|\bgtx\b|\bradeon\b|\bgeforce\b|\bgpu\b|\bgraphics\b/)) return { cat: "Componentes PC", sub: "Placas de video" };
  if (has(/\bryzen\b|\bintel\b.*\bcore\b|\bi[3579]-\d{3,5}\b|\bprocessor\b|\bcpu\b/)) return { cat: "Componentes PC", sub: "Procesadores" };
  if (has(/\bmother\b|\bmainboard\b|\bplaca madre\b|\bchipset\b|\bb\d{3}\b|\bx\d{3}\b|\bz\d{3}\b|\bh\d{3}\b/)) return { cat: "Componentes PC", sub: "Motherboards" };
  if (has(/\bddr[345]\b|\bram\b|\bmemoria\b/)) return { cat: "Componentes PC", sub: "Memorias RAM" };
  if (has(/\bnvme\b|\bm\.2\b|\bssd\b/)) return { cat: "Componentes PC", sub: "SSD / NVMe" };
  if (has(/\bhdd\b|\bhard drive\b|\bdisco\b.*\brigido\b/)) return { cat: "Componentes PC", sub: "HDD" };
  if (has(/\bpsu\b|\bfuente\b|\bpower supply\b|\b80\+\b|\bwatt\b/)) return { cat: "Componentes PC", sub: "Fuentes" };
  if (has(/\bgabinete\b|\bcase\b|\bchassis\b|\bmid tower\b|\bfull tower\b/)) return { cat: "Componentes PC", sub: "Gabinetes" };
  if (has(/\bcooler\b|\bfan\b|\bwater\s?cool\b|\baio\b|\bradiator\b|\bpasta t[ée]rmica\b|\bthermal\b/)) return { cat: "Componentes PC", sub: "Refrigeración" };

  if (has(/\brouter\b|\bswitch\b|\baccess point\b|\bwi-?fi\b|\bwifi\b|\bethernet\b|\blan\b|\bred\b/)) return { cat: "Redes", sub: "Networking" };

  if (has(/\bnotebook\b|\blaptop\b|\bport[aá]til\b|\bultrabook\b|\ball[- ]in[- ]one\b|\baio\b/)) return { cat: "Computadoras", sub: "Notebooks / PCs" };

  if (has(/\bimpresora\b|\bprinter\b|\btoner\b|\bcartucho\b|\bink\b/)) return { cat: "Impresión", sub: "Impresión" };

  return { cat: "Otros", sub: "Otros" };
}

function buildTaxonomy(rows) {
  const subsByCat = new Map();
  for (const r of rows) {
    const cat = r.cat || "Otros";
    const sub = r.sub || "Otros";
    if (!subsByCat.has(cat)) subsByCat.set(cat, new Set());
    subsByCat.get(cat).add(sub);
  }

  const cats = Array.from(subsByCat.keys()).sort((a, b) => a.localeCompare(b, "es"));
  const subsObj = {};
  for (const c of cats) subsObj[c] = Array.from(subsByCat.get(c)).sort((a, b) => a.localeCompare(b, "es"));
  return { cats, subsByCat: subsObj };
}

function computeFinalPrice({ price, ivaRate, marginPct }) {
  const base = typeof price === "number" ? price : toNumber(price);
  const iva = typeof ivaRate === "number" ? ivaRate : toNumber(ivaRate);
  const margin = typeof marginPct === "number" ? marginPct : toNumber(marginPct);

  if (base === null) return { totalUsd: null, ivaRateUsed: iva };

  const ivaUsed = iva !== null ? iva : null;
  const marginUsed = margin !== null ? margin : 0;

  // IVA: base*(1+iva/100)
  const withIva = ivaUsed !== null ? base * (1 + ivaUsed / 100) : base;

  // Margen: withIva*(1+margin/100)
  const total = withIva * (1 + marginUsed / 100);

  return { totalUsd: total, ivaRateUsed: ivaUsed };
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

  // Precio base original
  const basePrice = p.price !== null ? formatMoney(p.price, p.currency) : null;
  
  // Precio final (con IVA + margen)
  const priceUsd = p.totalWithIvaAndMargin !== null ? formatMoney(p.totalWithIvaAndMargin, p.currency) : null;
  
  // Precio en ARS
  const arsMoney = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : null;

  const catChip = p.cat ? `<span class="pChip">${esc(p.cat)}</span>` : "";

  // Mostrar precio: priorizar precio final, si no hay mostrar base, si no hay mostrar mensaje
  let priceDisplay = '';
  if (priceUsd) {
    priceDisplay = `<div class="pPriceBase">${esc(priceUsd)}</div>`;
  } else if (basePrice) {
    priceDisplay = `<div class="pPriceBase">${esc(basePrice)}</div>`;
  } else {
    priceDisplay = `<div class="pPriceBase muted">Sin precio</div>`;
  }
  
  // Precio ARS (solo si hay FX configurado)
  const arsDisplay = arsMoney ? `<div class="pPriceIva">${esc(arsMoney)}</div>` : '';

  return `
    <div class="pCard" data-tt="product-card" data-idx="${idx}" style="cursor:pointer;">
      <div class="pMedia">
        ${img ? `<img class="pImg" src="${esc(img)}" alt="${esc(p.name || p.sku)}" loading="lazy" onerror="this.remove()" />` : `<div class="pPh">Sin imagen</div>`}
      </div>
      <div class="pBody">
        <div class="pTitle" title="${esc(p.name || p.sku)}">${esc(p.name || p.sku || "Producto")}</div>
        <div class="pMeta">
          <span class="pChip">${esc(p.providerName || p.providerId || "-")}</span>
          ${catChip}
          <span class="pChip">${esc(p.brand || "-")}</span>
          <span class="pChip mono">${esc(p.sku || "-")}</span>
        </div>

        <div class="pPricing">
          ${priceDisplay}
          ${arsDisplay}
        </div>
      </div>
    </div>
  `;
}

function renderModalBody(p) {
  const img = p.imageUrl || p.thumbUrl || null;

  const baseMoney = formatMoney(p.price, p.currency);
  const totalMoney = p.totalWithIvaAndMargin !== null ? formatMoney(p.totalWithIvaAndMargin, p.currency) : "-";
  const arsMoney = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : "-";

  const fxLine = p.fxUsdArs ? `FX USD→ARS: ${p.fxUsdArs}` : "";
  const marginLine = `Margen: ${formatPct(p.marginPct)}`;
  const ivaLine = p.ivaRate !== null ? `IVA: ${formatPct(p.ivaRate)}` : "IVA: -";
  const catLine = p.cat ? `<div class="row small"><span>${esc(p.cat)}${p.sub && p.sub !== p.cat ? " • " + esc(p.sub) : ""}</span></div>` : "";

  return `
    <div class="ttModalBody">
      <div class="ttModalTop">
        <div class="ttModalImg">
          ${img ? `<img src="${esc(img)}" alt="${esc(p.name || p.sku)}" loading="lazy" />` : `<div class="ttModalImgPh">Sin imagen</div>`}
        </div>

        <div class="ttModalInfo">
          <div class="ttModalTitle">${esc(p.name || "Producto")}</div>
          <div class="row"><span class="muted">SKU</span><b class="mono">${esc(p.sku || "-")}</b></div>
          <div class="row"><span class="muted">Marca</span><b>${esc(p.brand || "-")}</b></div>
          <div class="row"><span class="muted">Proveedor</span><b>${esc(p.providerName || p.providerId || "-")}</b></div>
          ${catLine}
        </div>
      </div>

      <div class="ttModalPrices">
        <div class="ttModalPrice">
          <div class="muted">Base</div>
          <div class="big"><b>${esc(baseMoney)}</b></div>
        </div>

        <div class="ttModalPrice">
          <div class="muted">Final (IVA + margen)</div>
          <div class="big"><b>${esc(totalMoney)}</b></div>
          <div class="row small"><span>${esc(ivaLine)} • ${esc(marginLine)}</span></div>
        </div>

        <div class="ttModalPrice">
          <div class="muted">ARS (estimado)</div>
          <div class="big"><b>${esc(arsMoney)}</b></div>
          ${fxLine ? `<div class="row small"><span>${esc(fxLine)}</span></div>` : ""}
        </div>

        <div class="ttModalHint">El precio en ARS es estimado según el FX que configures (no es un valor oficial).</div>
      </div>
    </div>
  `;
}

function computeComparableFinal({ r, fxUsdArs, mode = "USD" }) {
  // Para tienda filtramos por precio FINAL (IVA + margen) en la moneda elegida.
  const cur = String(r.currency || "USD").toUpperCase();
  const base = r.totalWithIvaAndMargin;

  if (base === null || base === undefined) return null;

  if (mode === "USD") {
    if (cur === "USD") return base;
    if (cur === "ARS" && fxUsdArs) return base / fxUsdArs;
    return null;
  }

  // ARS
  if (cur === "ARS") return base;
  if (cur === "USD" && fxUsdArs) return base * fxUsdArs;
  return null;
}

function renderPager({ totalItems, page, pageSize, root }) {
  const pagerInfo = root.querySelector("#pagerInfo");
  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");
  const pagerNums = root.querySelector("#pagerNums");
  
  // Paginador inferior
  const pagerInfoBottom = root.querySelector("#pagerInfoBottom");
  const prevBtnBottom = root.querySelector("#prevPageBottom");
  const nextBtnBottom = root.querySelector("#nextPageBottom");
  const pagerNumsBottom = root.querySelector("#pagerNumsBottom");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p = clamp(page, 1, totalPages);

  const pageText = `Página ${p} / ${totalPages}`;
  if (pagerInfo) pagerInfo.textContent = pageText;
  if (pagerInfoBottom) pagerInfoBottom.textContent = pageText;

  const prevDisabled = p <= 1;
  const nextDisabled = p >= totalPages;
  
  if (prevBtn) prevBtn.disabled = prevDisabled;
  if (nextBtn) nextBtn.disabled = nextDisabled;
  if (prevBtnBottom) prevBtnBottom.disabled = prevDisabled;
  if (nextBtnBottom) nextBtnBottom.disabled = nextDisabled;

  const nums = [];
  if (totalPages <= 9) {
    for (let i = 1; i <= totalPages; i++) nums.push(i);
  } else {
    const around = [1, 2, p - 2, p - 1, p, p + 1, p + 2, totalPages - 1, totalPages];
    const set = new Set(around.filter((x) => x >= 1 && x <= totalPages));
    const ordered = Array.from(set).sort((a, b) => a - b);

    let last = 0;
    for (const n of ordered) {
      if (last && n - last > 1) nums.push("…");
      nums.push(n);
      last = n;
    }
  }

  const numsHtml = nums.map((n) => {
    if (n === "…") return `<span class="pagerDots">…</span>`;
    const active = n === p ? "active" : "";
    return `<button class="pagerNum ${active}" data-page="${n}" type="button">${n}</button>`;
  }).join("");
  
  if (pagerNums) pagerNums.innerHTML = numsHtml;
  if (pagerNumsBottom) pagerNumsBottom.innerHTML = numsHtml;

  return { totalPages, page: p };
}

function TiendaPage() {
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

    <div class="tiendaFiltersExtra">
      <select id="catSel" class="select"></select>
      <select id="subSel" class="select"></select>

      <input id="minPrice" class="input small" placeholder="Precio mín" inputmode="decimal" />
      <input id="maxPrice" class="input small" placeholder="Precio máx" inputmode="decimal" />

      <select id="priceMode" class="select">
        <option value="USD">Filtrar en USD (final)</option>
        <option value="ARS">Filtrar en ARS (final, usa FX)</option>
      </select>

      <label class="chk">
        <input id="inStock" type="checkbox" />
        En stock
      </label>

      <select id="sortSel" class="select">
        <option value="relevance">Orden: Relevancia</option>
        <option value="priceAsc">Orden: Precio ↑</option>
        <option value="priceDesc">Orden: Precio ↓</option>
        <option value="nameAsc">Orden: Nombre A→Z</option>
        <option value="nameDesc">Orden: Nombre Z→A</option>
        <option value="brandAsc">Orden: Marca A→Z</option>
      </select>

      <div class="pill" id="countPill">0 items • ${dataSource}</div>
    </div>

    <div class="pager" id="pager">
      <button id="prevPage" class="btn small" type="button">‹</button>
      <div id="pagerInfo" class="pagerInfo">Página 1 / 1</div>
      <button id="nextPage" class="btn small" type="button">›</button>

      <div class="pagerRight">
        <span class="muted small">Items:</span>
        <select id="pageSizeSel" class="select">
          <option value="24">24</option>
          <option value="48" selected>48</option>
          <option value="96">96</option>
          <option value="192">192</option>
        </select>
      </div>
    </div>
    <div class="pagerNums" id="pagerNums"></div>

    <div id="grid" class="tiendaGrid"></div>

    <!-- Paginación inferior (duplicada) -->
    <div class="pager" id="pagerBottom">
      <button id="prevPageBottom" class="btn small" type="button">‹</button>
      <div id="pagerInfoBottom" class="pagerInfo">Página 1 / 1</div>
      <button id="nextPageBottom" class="btn small" type="button">›</button>

      <div class="pagerRight">
        <span class="muted small">Items:</span>
        <select id="pageSizeSelBottom" class="select">
          <option value="24">24</option>
          <option value="48" selected>48</option>
          <option value="96">96</option>
          <option value="192">192</option>
        </select>
      </div>
    </div>
    <div class="pagerNums" id="pagerNumsBottom"></div>

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

export { TiendaPage };

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

  const catSel = root.querySelector("#catSel");
  const subSel = root.querySelector("#subSel");
  const minPrice = root.querySelector("#minPrice");
  const maxPrice = root.querySelector("#maxPrice");
  const priceMode = root.querySelector("#priceMode");
  const inStock = root.querySelector("#inStock");
  const sortSel = root.querySelector("#sortSel");
  const pageSizeSel = root.querySelector("#pageSizeSel");
  const pagerNums = root.querySelector("#pagerNums");
  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");
  
  // Controles del paginador inferior
  const pageSizeSelBottom = root.querySelector("#pageSizeSelBottom");
  const pagerNumsBottom = root.querySelector("#pagerNumsBottom");
  const prevBtnBottom = root.querySelector("#prevPageBottom");
  const nextBtnBottom = root.querySelector("#nextPageBottom");

  const modal = root.querySelector("#tiendaModal");
  const modalBody = root.querySelector("#tiendaModalBody");

  let baseRows = [];
  let viewRows = [];
  let taxonomy = { cats: [], subsByCat: {} };

  let page = 1;
  let pageSize = Number(pageSizeSel?.value || 48) || 48;

  // init config
  const fxInit = getFxUsdArs();
  if (fxInit) fxInput.value = String(fxInit);

  const marginInit = getMarginPct();
  if (marginInit !== null) marginInput.value = String(marginInit);

  fxInput.addEventListener("input", () => {
    setFxUsdArs(fxInput.value);
    page = 1;
    draw();
  });

  marginInput.addEventListener("input", () => {
    setMarginPct(marginInput.value);
    page = 1;
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

  function fillCategorySelects() {
    const catOpts = [`<option value="">Todas las categorías</option>`]
      .concat(taxonomy.cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`));
    catSel.innerHTML = catOpts.join("");

    subSel.innerHTML = `<option value="">Todas las subcategorías</option>`;
  }

  function refreshSubOptions() {
    const cat = (catSel.value || "").trim();
    const subs = cat ? (taxonomy.subsByCat[cat] || []) : [];
    const opts = [`<option value="">Todas las subcategorías</option>`]
      .concat(subs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`));
    subSel.innerHTML = opts.join("");
  }

  function setSourceUi(totalItems) {
    if (tiendaSource) tiendaSource.textContent = `Datos: ${dataSource}`;
    if (countPill) countPill.textContent = `${totalItems} items • ${dataSource}`;
  }

  function applySort(rows, enhanced) {
    const mode = (sortSel.value || "relevance").trim();
    if (mode === "relevance") return { rows, enhanced };

    const copy = [...rows];
    const enhMap = new Map();
    enhanced.forEach((e) => enhMap.set(e.sku + "|" + e.providerId, e));

    copy.sort((a, b) => {
      if (mode === "nameAsc") return norm(a.name).localeCompare(norm(b.name), "es");
      if (mode === "nameDesc") return norm(b.name).localeCompare(norm(a.name), "es");
      if (mode === "brandAsc") return norm(a.brand).localeCompare(norm(b.brand), "es");

      if (mode === "priceAsc" || mode === "priceDesc") {
        const ea = enhMap.get(a.sku + "|" + a.providerId);
        const eb = enhMap.get(b.sku + "|" + b.providerId);
        const fx = getFxUsdArs();
        const pm = priceMode.value || "USD";

        const pa = ea ? computeComparableFinal({ r: ea, fxUsdArs: fx, mode: pm }) : null;
        const pb = eb ? computeComparableFinal({ r: eb, fxUsdArs: fx, mode: pm }) : null;

        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;

        return mode === "priceAsc" ? (pa - pb) : (pb - pa);
      }

      return 0;
    });

    // rearmamos enhanced en el nuevo orden
    const orderedEnhanced = copy.map((r) => enhMap.get(r.sku + "|" + r.providerId)).filter(Boolean);
    return { rows: copy, enhanced: orderedEnhanced };
  }

  function draw() {
    const q = (qInput.value || "").trim().toLowerCase();
    const cat = (catSel.value || "").trim();
    const sub = (subSel.value || "").trim();

    const fx = getFxUsdArs();
    const pm = (priceMode.value || "USD").trim();
    const min = toNumber(minPrice.value);
    const max = toNumber(maxPrice.value);
    const stockOnly = !!inStock.checked;

    let rows = baseRows;

    rows = rows.filter((r) => {
      if (cat && r.cat !== cat) return false;
      if (sub && r.sub !== sub) return false;
      if (stockOnly && !(r.stock !== null && r.stock > 0)) return false;

      if (q) {
        if (!r._search || !r._search.includes(q)) return false;
      }

      return true;
    });

    // Enhanced antes para poder filtrar por precio final
    let enhanced = enhanceRows(rows);

    if (min !== null || max !== null) {
      enhanced = enhanced.filter((e) => {
        const comp = computeComparableFinal({ r: e, fxUsdArs: fx, mode: pm });
        if (comp === null) return false;
        if (min !== null && comp < min) return false;
        if (max !== null && comp > max) return false;
        return true;
      });
      // rows debe acompañar
      const keep = new Set(enhanced.map((e) => e.sku + "|" + e.providerId));
      rows = rows.filter((r) => keep.has(r.sku + "|" + r.providerId));
    }

    // sort
    ({ rows, enhanced } = applySort(rows, enhanced));

    const totalItems = enhanced.length;

    // paginado
    pageSize = Number(pageSizeSel.value) || 48;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    page = clamp(page, 1, totalPages);

    const start = (page - 1) * pageSize;
    viewRows = enhanced.slice(start, start + pageSize);

    setSourceUi(totalItems);
    renderPager({ totalItems, page, pageSize, root });

    grid.innerHTML = viewRows.map((p, i) => renderProductCard(p, i)).join("");
    if (!viewRows.length) {
      grid.innerHTML = `<div class="emptyState">No hay productos para mostrar</div>`;
    }
    
    // Scroll suave al top cuando cambia la página
    scrollToTop();
  }
  
  // Función para hacer scroll suave hacia arriba
  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  let t = null;
  qInput.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { page = 1; draw(); }, 150);
  });

  catSel.addEventListener("change", () => {
    refreshSubOptions();
    page = 1;
    draw();
  });
  subSel.addEventListener("change", () => { page = 1; draw(); });

  const debouncedPriceDraw = () => {
    clearTimeout(t);
    t = setTimeout(() => { page = 1; draw(); }, 150);
  };
  minPrice.addEventListener("input", debouncedPriceDraw);
  maxPrice.addEventListener("input", debouncedPriceDraw);
  priceMode.addEventListener("change", () => { page = 1; draw(); });
  inStock.addEventListener("change", () => { page = 1; draw(); });
  sortSel.addEventListener("change", draw);
  pageSizeSel.addEventListener("change", () => { 
    pageSizeSelBottom.value = pageSizeSel.value;
    page = 1; 
    draw(); 
  });

  prevBtn.addEventListener("click", () => { page = Math.max(1, page - 1); draw(); });
  nextBtn.addEventListener("click", () => { page = page + 1; draw(); });
  
  // Event listeners para paginador inferior
  prevBtnBottom.addEventListener("click", () => { page = Math.max(1, page - 1); draw(); });
  nextBtnBottom.addEventListener("click", () => { page = page + 1; draw(); });

  pagerNums.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-page]");
    if (!b) return;
    const p = Number(b.dataset.page);
    if (!Number.isFinite(p)) return;
    page = p;
    draw();
  });
  
  // Event listener para números del paginador inferior
  pagerNumsBottom.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-page]");
    if (!b) return;
    const p = Number(b.dataset.page);
    if (!Number.isFinite(p)) return;
    page = p;
    draw();
  });
  
  // Sincronizar el selector de tamaño de página inferior con el superior
  pageSizeSelBottom.addEventListener("change", () => {
    pageSizeSel.value = pageSizeSelBottom.value;
    page = 1;
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

      baseRows = products.map((r) => {
        const { cat, sub } = classifyProduct(r);
        return {
          ...r,
          cat,
          sub,
          _search: `${r.sku} ${r.name} ${r.brand}`.toLowerCase(),
        };
      });
    } catch (err) {
      dataSource = "MOCK";
      cachedProviders = mockProviders;

      baseRows = (mockProducts || []).map((r) => {
        const rr = {
          sku: String(r.sku ?? r.id ?? ""),
          providerId: String(r.providerId ?? r.provider ?? "elit"),
          name: String(r.name ?? ""),
          brand: String(r.brand ?? ""),
          price: toNumber(r.price),
          currency: String(r.currency ?? "USD"),
          ivaRate: toNumber(r.ivaRate ?? r.iva),
          stock: toNumber(r.stock),
          imageUrl: r.imageUrl || r.image || null,
          thumbUrl: r.thumbUrl || r.thumbnail || null,
        };
        const { cat, sub } = classifyProduct(rr);
        return {
          ...rr,
          cat,
          sub,
          _search: `${rr.sku} ${rr.name} ${rr.brand}`.toLowerCase(),
        };
      });

      const hint = lastApiError ? `API error: ${lastApiError}` : "API no disponible";
      if (errBox) {
        errBox.style.display = "block";
        errBox.textContent = `${hint}. Si querés ver el diagnóstico real: /api/health y /api/getProducts?limit=5`;
      }

      console.error("Tienda bootstrap error:", err);
    }

    taxonomy = buildTaxonomy(baseRows);
    fillCategorySelects();
    refreshSubOptions();

    draw();
  }

  bootstrap();
}
