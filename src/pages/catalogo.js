// File: /src/pages/catalogo.js
import { products as mockProducts } from "../data/products.js";
import { providers as mockProviders } from "../data/providers.js";
import { renderTable } from "../components/table.js";
import { renderProductCards } from "../components/cards.js";
import { initFiltersSidebar } from "../components/filtersSidebar.js";

// Scroll to top suave
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let cachedProviders = null;
let dataSource = "MOCK";

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

let FX_USD_ARS = null;
let FX_META = { fuente: "", nombre: "", fechaActualizacion: "" };

function getFxUsdArs() {
  return FX_USD_ARS;
}

function getFxMetaText() {
  const parts = [];
  if (FX_META.nombre) parts.push(FX_META.nombre);
  if (FX_META.fuente) parts.push(FX_META.fuente);
  if (FX_META.fechaActualizacion) {
    try {
      parts.push(new Date(FX_META.fechaActualizacion).toLocaleString("es-AR"));
    } catch (_) {}
  }
  return parts.join(" · ");
}

async function refreshFxUsdArs() {
  try {
    const res = await fetch("/api/dollar-rate", { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error("Bad /api/dollar-rate response");

    const venta = typeof data.venta === "number" ? data.venta : Number(data.venta);
    if (!Number.isFinite(venta) || venta <= 0) throw new Error("Invalid venta");

    FX_USD_ARS = venta;
    FX_META = {
      fuente: String(data.fuente || "API"),
      nombre: String(data.nombre || "Dólar Oficial"),
      fechaActualizacion: String(data.fechaActualizacion || ""),
    };

    return { ok: true, venta };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
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
    api: !!p.api,
    currency: String(p.currency ?? "USD"),
    fx: toNumber(p.fx),
    ivaIncluded: String(p.ivaIncluded ?? "").toLowerCase() === "true",
  }));
}

async function loadProductsFromApi({ providerId = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (providerId) params.set("provider", providerId);
  if (q) params.set("q", q);
  // Traemos grande para evitar quedarnos en 1000 (Azure Tables top>1000 da InvalidInput).
  params.set("limit", "20000");

  const res = await fetch(`/api/getProducts?${params.toString()}`, { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");

  const items = Array.isArray(data) ? data : (data.items || []);
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
 * Si en el futuro tus APIs traen categoría real, reemplazamos esto.
 */
function classifyProduct(r) {
  const t = `${r.name || ""} ${r.brand || ""} ${r.sku || ""}`.toLowerCase();

  const has = (re) => re.test(t);

  // Monitores / pantallas
  if (has(/\bmonitor\b|\bdisplay\b|\bpantalla\b|\blcd\b|\bled\b|\bips\b|\bqhd\b|\bfhd\b|\buhd\b|\b4k\b|\b144hz\b|\b165hz\b|\b240hz\b/)) {
    return { cat: "Monitores", sub: "Monitores" };
  }

  // Periféricos
  if (has(/\bteclad(o|os)\b|\bkeyboard\b|\bkeycap\b|\bswitch\b/)) return { cat: "Periféricos", sub: "Teclados" };
  if (has(/\bmouse\b|\bmice\b|\brat[oó]n\b|\bdpi\b|\bsensor\b/)) return { cat: "Periféricos", sub: "Mouse" };
  if (has(/\bheadset\b|\bauricular(es)?\b|\bparlante(s)?\b|\bspeaker\b|\bmicro\b|\bmicrofono\b|\baudio\b/)) return { cat: "Periféricos", sub: "Audio" };
  if (has(/\bwebcam\b|\bc[áa]mara\b|\bcamera\b/)) return { cat: "Periféricos", sub: "Cámaras" };

  // Componentes PC
  if (has(/\brtx\b|\bgtx\b|\bradeon\b|\bgeforce\b|\bgpu\b|\bgraphics\b/)) return { cat: "Componentes PC", sub: "Placas de video" };
  if (has(/\bryzen\b|\bintel\b.*\bcore\b|\bi[3579]-\d{3,5}\b|\bprocessor\b|\bcpu\b/)) return { cat: "Componentes PC", sub: "Procesadores" };
  if (has(/\bmother\b|\bmainboard\b|\bplaca madre\b|\bchipset\b|\bb\d{3}\b|\bx\d{3}\b|\bz\d{3}\b|\bh\d{3}\b/)) return { cat: "Componentes PC", sub: "Motherboards" };
  if (has(/\bddr[345]\b|\bram\b|\bmemoria\b/)) return { cat: "Componentes PC", sub: "Memorias RAM" };
  if (has(/\bnvme\b|\bm\.2\b|\bssd\b/)) return { cat: "Componentes PC", sub: "SSD / NVMe" };
  if (has(/\bhdd\b|\bhard drive\b|\bdisco\b.*\brigido\b/)) return { cat: "Componentes PC", sub: "HDD" };
  if (has(/\bpsu\b|\bfuente\b|\bpower supply\b|\b80\+\b|\bwatt\b/)) return { cat: "Componentes PC", sub: "Fuentes" };
  if (has(/\bgabinete\b|\bcase\b|\bchassis\b|\bmid tower\b|\bfull tower\b/)) return { cat: "Componentes PC", sub: "Gabinetes" };
  if (has(/\bcooler\b|\bfan\b|\bwater\s?cool\b|\baio\b|\bradiator\b|\bpasta t[ée]rmica\b|\bthermal\b/)) return { cat: "Componentes PC", sub: "Refrigeración" };

  // Almacenamiento / accesorios
  if (has(/\bpendrive\b|\busb\s?drive\b|\bmemoria usb\b|\bexternal\b.*\bdrive\b|\bdisco externo\b/)) return { cat: "Almacenamiento", sub: "Externos / USB" };

  // Networking
  if (has(/\brouter\b|\bswitch\b|\baccess point\b|\bwi-?fi\b|\bwifi\b|\bethernet\b|\blan\b|\bred\b/)) return { cat: "Redes", sub: "Networking" };

  // Notebooks / PCs
  if (has(/\bnotebook\b|\blaptop\b|\bport[aá]til\b|\bultrabook\b|\ball[- ]in[- ]one\b|\baio\b/)) return { cat: "Computadoras", sub: "Notebooks / PCs" };

  // Impresión
  if (has(/\bimpresora\b|\bprinter\b|\btoner\b|\bcartucho\b|\bink\b/)) return { cat: "Impresión", sub: "Impresión" };

  return { cat: "Otros", sub: "Otros" };
}

function enhanceRows(rows) {
  const fxUsdArs = getFxUsdArs();
  return rows.map((r) => {
    // default: ELIT suele tener IVA 10.5% (si CSV no trae ivaRate todavía)
    const ivaRate = (r.ivaRate !== null && r.ivaRate !== undefined)
      ? r.ivaRate
      : (r.providerId === "elit" ? 10.5 : null);

    const base = r.price;
    const total = (base !== null && ivaRate !== null) ? base * (1 + ivaRate / 100) : null;

    const priceWithIvaText = (total !== null && ivaRate !== null)
      ? `Con IVA ${formatPct(ivaRate)}: ${formatMoney(total, r.currency)}`
      : "";

    // ARS sólo en modal, pero lo calculamos acá para tenerlo listo
    let arsTotal = null;
    if (total !== null) {
      if (String(r.currency).toUpperCase() === "ARS") arsTotal = total;
      else if (String(r.currency).toUpperCase() === "USD" && fxUsdArs) arsTotal = total * fxUsdArs;
    }

    return {
      ...r,
      providerName: getProviderName(r.providerId),
      ivaRate,
      totalWithIva: total,
      priceWithIvaText,
      arsTotal,
      fxUsdArs,
    };
  });
}

function renderModalBody(p) {
  const img = p.imageUrl || p.thumbUrl || null;

  const baseMoney = formatMoney(p.price, p.currency);
  const ivaMoney = p.totalWithIva !== null ? formatMoney(p.totalWithIva, p.currency) : "-";
  const arsMoney = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : "-";

  const fxLine = p.fxUsdArs ? `FX USD→ARS: ${p.fxUsdArs}` : "";

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
          <div class="muted">Con IVA</div>
          <div class="big"><b>${esc(ivaMoney)}</b></div>
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

function buildTaxonomy(rows) {
  const subsByCat = new Map(); // cat -> Set(sub)
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

function computeComparablePrice({ r, fxUsdArs, priceMode = "USD", withIva = false }) {
  // comparable: USD o ARS. Si no se puede calcular, devolvemos null.
  const cur = String(r.currency || "USD").toUpperCase();
  const base = (withIva && r.totalWithIva !== undefined) ? r.totalWithIva : r.price;

  if (base === null || base === undefined) return null;

  if (priceMode === "USD") {
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
  const pager = root.querySelector("#pager");
  const pagerNums = root.querySelector("#pagerNums");
  const pagerInfo = root.querySelector("#pagerInfo");
  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p = clamp(page, 1, totalPages);

  if (pagerInfo) pagerInfo.textContent = `Página ${p} / ${totalPages}`;

  if (prevBtn) prevBtn.disabled = p <= 1;
  if (nextBtn) nextBtn.disabled = p >= totalPages;

  // Números (compacto)
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

  pagerNums.innerHTML = nums.map((n) => {
    if (n === "…") return `<span class="pagerDots">…</span>`;
    const active = n === p ? "active" : "";
    return `<button class="pagerNum ${active}" data-page="${n}" type="button">${n}</button>`;
  }).join("");

  return { totalPages, page: p };
}

export function CatalogoPage() {
  return `
  <section class="page catalogoPage">
    <div class="pageShell">
    <div class="catalogHeader">
      <h1 class="catalogoTitle">Catálogo</h1>
      <div class="muted" id="catSource">Datos: ${dataSource}</div>
    </div>

    <div class="catalogoLayout" id="catalogLayout">
      <!-- SIDEBAR FILTROS -->
      <aside class="filtersSidebar" id="filtersSidebar" aria-hidden="false">
        <div class="filtersSidebarTop">
          <button id="filtersCollapseBtn" class="sidebarCollapseBtn" type="button" aria-expanded="true" title="Colapsar / expandir filtros">
            <span class="sidebarCollapseIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="7" y1="12" x2="20" y2="12"/>
                <line x1="10" y1="18" x2="20" y2="18"/>
              </svg>
            </span>
            <span class="sidebarCollapseLbl">Filtros</span>
            <span class="sidebarCollapseChev" aria-hidden="true">‹</span>
          </button>

          <button id="filtersCloseBtn" class="sidebarCloseBtn" type="button" aria-label="Cerrar filtros" title="Cerrar">✕</button>
        </div>

        <div class="filtersSidebarInner" id="filtersSidebarInner">
          <div class="filterSection">
            <label class="filterLabel" for="q">Buscar</label>
            <input id="q" class="input" placeholder="SKU / nombre / marca" />
          </div>

          <div class="filterSection">
            <label class="filterLabel" for="provSel">Proveedor</label>
            <select id="provSel" class="select"></select>
          </div>

          <div class="filterSection">
            <label class="filterLabel">Categoría</label>
            <div class="filterRow">
              <select id="catSel" class="select"></select>
              <select id="subSel" class="select"></select>
            </div>
          </div>

          <div class="filterSection">
            <label class="filterLabel">Precio</label>
            <div class="priceRange">
              <input id="minPrice" class="input" placeholder="Mínimo" inputmode="decimal" />
              <span>-</span>
              <input id="maxPrice" class="input" placeholder="Máximo" inputmode="decimal" />
            </div>
            <select id="priceMode" class="select">
              <option value="USD">Filtrar en USD</option>
              <option value="ARS">Filtrar en ARS (usa FX)</option>
            </select>
          </div>

          <div class="filterSection">
            <label class="filterCheckbox" for="withIva">
              <input id="withIva" type="checkbox" />
              <span>Con IVA</span>
            </label>
          </div>

          <div class="filterSection">
            <label class="filterCheckbox" for="inStock">
              <input id="inStock" type="checkbox" />
              <span>En stock</span>
            </label>
          </div>

          <div class="filterSection">
            <label class="filterLabel">Tipo de cambio USD→ARS (API)</label>
            <input id="fxUsdArs" class="input small" value="Cargando..." disabled />
            <div class="muted tiny" id="fxMeta"></div>
          </div>
        </div>
      </aside>

      <!-- CONTENIDO -->
      <main class="catalogoContent">
        <div class="catalogoControls">
          <button id="filtersMobileBtn" class="filtersMobileBtn" type="button" aria-label="Abrir filtros">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="18" x2="20" y2="18"/>
            </svg>
            <span>Filtros</span>
          </button>

          <span class="catalogoCount" id="countPill">0 productos</span>

          <div class="catalogoControlsRight">
            <select id="sortSel" class="select">
              <option value="relevance">Ordenar por: Relevancia</option>
              <option value="priceAsc">Precio: Menor a Mayor</option>
              <option value="priceDesc">Precio: Mayor a Menor</option>
              <option value="nameAsc">Nombre: A → Z</option>
              <option value="nameDesc">Nombre: Z → A</option>
              <option value="brandAsc">Marca: A → Z</option>
            </select>

            <select id="pageSizeSel" class="select">
              <option value="25">25 por página</option>
              <option value="50" selected>50 por página</option>
              <option value="100">100 por página</option>
              <option value="200">200 por página</option>
            </select>

            <div class="viewToggle">
              <button id="viewTable" class="viewBtn" title="Vista de tabla" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button id="viewCards" class="viewBtn active" title="Vista de tarjetas" type="button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div id="productsList"></div>

        <div class="pagerBar">
          <div class="pagination" id="pager">
            <button id="prevPage" class="paginationBtn" type="button" aria-label="Página anterior">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div id="pagerNums"></div>
            <button id="nextPage" class="paginationBtn" type="button" aria-label="Página siguiente">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <div id="pagerInfo" class="pagerInfo">Página 1 / 1</div>
        </div>
      </main>
    </div>

    <div id="filtersOverlay" class="filtersOverlay" hidden></div>

    <div id="ttModal" class="ttModal hidden" role="dialog" aria-modal="true" aria-label="Detalle de producto">
      <div class="ttModalBackdrop" data-tt="modal-close"></div>
      <div class="ttModalPanel">
        <button class="ttModalClose" data-tt="modal-close" aria-label="Cerrar">✕</button>
        <div id="ttModalBody"></div>
      </div>
    </div>
    </div>
  </section>
  `;
}

export function wireCatalogo(rootOrQuery, maybeQuery = "") {
  // Compat:
  // - old main.js called wireCatalogo(queryString)
  // - new versions can call wireCatalogo(rootElement, queryString)
  let root = document;
  let initialQ = "";

  if (rootOrQuery && typeof rootOrQuery.querySelector === "function") {
    root = rootOrQuery;
    initialQ = typeof maybeQuery === "string" ? maybeQuery : "";
  } else {
    root = document;
    initialQ = typeof rootOrQuery === "string" ? rootOrQuery : "";
  }

  const mount = root.querySelector("#productsList");
  const provSel = root.querySelector("#provSel");
  const qInput = root.querySelector("#q");
  if (qInput && initialQ) qInput.value = initialQ;
  const countPill = root.querySelector("#countPill");
  const catSource = root.querySelector("#catSource");
  const fxInputs = root.querySelectorAll("#fxUsdArs");

  const catSel = root.querySelector("#catSel");
  const subSel = root.querySelector("#subSel");
  const minPrice = root.querySelector("#minPrice");
  const maxPrice = root.querySelector("#maxPrice");
  const priceMode = root.querySelector("#priceMode");
  const withIva = root.querySelector("#withIva");
  const inStock = root.querySelector("#inStock");
  const sortSel = root.querySelector("#sortSel");

  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");
  const pageSizeSel = root.querySelector("#pageSizeSel");
  const pagerNums = root.querySelector("#pagerNums");

  const viewTableBtn = root.querySelector("#viewTable");
  const viewCardsBtn = root.querySelector("#viewCards");

  const modal = root.querySelector("#ttModal");
  const modalBody = root.querySelector("#ttModalBody");

  // Sidebar (desktop colapsable + drawer mobile)
  initFiltersSidebar({
    root: document,
    layoutId: "catalogLayout",
    sidebarId: "filtersSidebar",
    mobileBtnId: "filtersMobileBtn",
    collapseBtnId: "filtersCollapseBtn",
    closeBtnId: "filtersCloseBtn",
    overlayId: "filtersOverlay",
    storageKey: "tovaltech_filters_collapsed_catalogo",
  });


  let view = "cards";
  let baseRows = [];
  let viewRows = [];

  let taxonomy = { cats: [], subsByCat: {} };

  // estado paginado
  let page = 1;
  let pageSize = Number(pageSizeSel?.value || 50) || 50;
  // FX USD→ARS (solo API)
  try { localStorage.removeItem("toval_fx_usd_ars"); } catch (_) {}

  function updateFxInputs() {
    const fxMetaEl = root.querySelector("#fxMeta");
    const fx = getFxUsdArs();
    const meta = getFxMetaText();
    if (fxMetaEl) fxMetaEl.textContent = meta ? meta : "";
    for (const el of fxInputs) {
      el.disabled = true;
      el.readOnly = true;
      el.value = fx ? String(fx) : "No disponible";
      if (meta) el.title = meta;
    }
  }

  updateFxInputs();

  function setView(next) {
    view = next;
    if (view === "table") {
      viewTableBtn.classList.add("primary");
      viewCardsBtn.classList.remove("primary");
    } else {
      viewCardsBtn.classList.add("primary");
      viewTableBtn.classList.remove("primary");
    }
    draw();
  }

  viewTableBtn.addEventListener("click", () => setView("table"));
  viewCardsBtn.addEventListener("click", () => setView("cards"));

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

  mount.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-tt='product-card'],[data-tt='product-row']");
    if (!el) return;
    const idx = Number(el.dataset.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= viewRows.length) return;
    openModal(viewRows[idx]);
  });

  function render(rows) {
    const enhanced = enhanceRows(rows);
    viewRows = enhanced;

    if (view === "cards") {
      mount.innerHTML = renderProductCards({
        rows: enhanced,
        formatMoney,
      });
      return;
    }

    // tabla
    const columns = [
      { key: "sku", label: "SKU", value: (r) => esc(r.sku) },
      { key: "name", label: "Nombre", value: (r) => esc(r.name) },
      { key: "brand", label: "Marca", value: (r) => esc(r.brand || "") },
      { key: "cat", label: "Tipo", value: (r) => esc(r.cat ? (r.sub && r.sub !== r.cat ? `${r.cat} / ${r.sub}` : r.cat) : "-") },
      { key: "price", label: "Precio", value: (r) => esc(formatMoney(r.price, r.currency)) },
      { key: "iva", label: "Con IVA", value: (r) => esc(r.priceWithIvaText ? r.priceWithIvaText.replace(/^Con IVA [^:]+:\s*/, "") : "-") },
    ];

    mount.innerHTML = renderTable({ columns, rows: enhanced });
  }

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

  function applySort(rows) {
    const mode = (sortSel.value || "relevance").trim();
    if (mode === "relevance") return rows;

    const fx = getFxUsdArs();
    const pm = priceMode.value || "USD";
    const iva = !!withIva.checked;

    const copy = [...rows];
    copy.sort((a, b) => {
      if (mode === "nameAsc") return norm(a.name).localeCompare(norm(b.name), "es");
      if (mode === "nameDesc") return norm(b.name).localeCompare(norm(a.name), "es");
      if (mode === "brandAsc") return norm(a.brand).localeCompare(norm(b.brand), "es");

      if (mode === "priceAsc" || mode === "priceDesc") {
        const pa = computeComparablePrice({ r: a, fxUsdArs: fx, priceMode: pm, withIva: iva });
        const pb = computeComparablePrice({ r: b, fxUsdArs: fx, priceMode: pm, withIva: iva });

        // nulls al final
        if (pa === null && pb === null) return 0;
        if (pa === null) return 1;
        if (pb === null) return -1;

        return mode === "priceAsc" ? (pa - pb) : (pb - pa);
      }
      return 0;
    });

    return copy;
  }

  function draw() {
    const providerId = (provSel.value || "").trim();
    const q = (qInput.value || "").trim().toLowerCase();

    const fx = getFxUsdArs();
    const min = toNumber(minPrice.value);
    const max = toNumber(maxPrice.value);
    const pm = (priceMode.value || "USD").trim();
    const iva = !!withIva.checked;
    const stockOnly = !!inStock.checked;

    const cat = (catSel.value || "").trim();
    const sub = (subSel.value || "").trim();

    let filtered = baseRows.filter((r) => {
      if (providerId && r.providerId !== providerId) return false;

      if (cat && r.cat !== cat) return false;
      if (sub && r.sub !== sub) return false;

      if (stockOnly && !(r.stock !== null && r.stock > 0)) return false;

      if (q) {
        // usamos campo precomputado para acelerar
        if (!r._search || !r._search.includes(q)) return false;
      }

      if (min !== null || max !== null) {
        // price comparable depende de (USD/ARS + FX + IVA)
        const comparable = computeComparablePrice({
          r,
          fxUsdArs: fx,
          priceMode: pm,
          withIva: iva,
        });

        // Si no podemos calcular (ej: ARS pero no hay FX), lo dejamos pasar SOLO si no hay límites.
        if (comparable === null) return false;

        if (min !== null && comparable < min) return false;
        if (max !== null && comparable > max) return false;
      }

      return true;
    });

    filtered = applySort(filtered);

    const totalItems = filtered.length;

    // paginado
    pageSize = Number(pageSizeSel.value) || 50;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    page = clamp(page, 1, totalPages);

    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    countPill.textContent = `${totalItems} items • ${dataSource}`;
    catSource.textContent = `Datos: ${dataSource}`;

    renderPager({ totalItems, page, pageSize, root });
    render(pageRows);
  }

  // eventos filtros
  provSel.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });

  let t = null;
  qInput.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => { page = 1; draw(); }, 150);
  });

  catSel.addEventListener("change", () => {
    refreshSubOptions();
    page = 1;
    scrollToTop();
    draw();
  });
  subSel.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });

  const debouncedPriceDraw = () => {
    clearTimeout(t);
    t = setTimeout(() => { page = 1; draw(); }, 150);
  };
  minPrice.addEventListener("input", debouncedPriceDraw);
  maxPrice.addEventListener("input", debouncedPriceDraw);
  priceMode.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });
  withIva.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });
  inStock.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });
  sortSel.addEventListener("change", draw);

  prevBtn.addEventListener("click", () => { page = Math.max(1, page - 1); scrollToTop(); draw(); });
  nextBtn.addEventListener("click", () => { page = page + 1; scrollToTop(); draw(); });

  pagerNums.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-page]");
    if (!b) return;
    const p = Number(b.dataset.page);
    if (!Number.isFinite(p)) return;
    page = p;
    scrollToTop();
    draw();
  });

  pageSizeSel.addEventListener("change", () => { page = 1; scrollToTop(); draw(); });

  async function bootstrap() {
    await refreshFxUsdArs();
    updateFxInputs();

    try {
      cachedProviders = await loadProvidersFromApi();
      dataSource = "API";
    } catch (_) {
      cachedProviders = mockProviders;
      dataSource = "MOCK";
    }

    // provSel
    const opts = [
      `<option value="">Todos los proveedores</option>`,
      ...cachedProviders.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`),
    ];
    provSel.innerHTML = opts.join("");

    // data
    let rows;
    try {
      rows = await loadProductsFromApi({ providerId: "", q: "" });
      dataSource = "API";
    } catch (_) {
      rows = mockProducts;
      dataSource = "MOCK";
    }

    // normalizamos shape mock -> igual que api
    const normalized = rows.map((p) => {
      const r = {
        sku: String(p.sku ?? p.id ?? ""),
        providerId: String(p.providerId ?? p.provider ?? "elit"),
        name: String(p.name ?? ""),
        brand: String(p.brand ?? ""),
        price: toNumber(p.price),
        currency: String(p.currency ?? "USD"),
        ivaRate: toNumber(p.ivaRate ?? p.iva),
        stock: toNumber(p.stock),
        imageUrl: p.imageUrl || p.image || null,
        thumbUrl: p.thumbUrl || p.thumbnail || null,
      };

      const { cat, sub } = classifyProduct(r);

      return {
        ...r,
        cat,
        sub,
        _search: `${r.sku} ${r.name} ${r.brand}`.toLowerCase(),
      };
    });

    baseRows = normalized;

    taxonomy = buildTaxonomy(baseRows);
    fillCategorySelects();

    // default selección
    refreshSubOptions();

    draw();
  }

  bootstrap();

  // refresco FX cada 5 min
  setInterval(async () => {
    const prev = getFxUsdArs();
    await refreshFxUsdArs();
    const next = getFxUsdArs();
    updateFxInputs();
    if (next && next !== prev) draw();
  }, 300000);
}
