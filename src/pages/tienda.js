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
  if (has(/\bpendrive\b|\busb\s?drive\b|\bmemoria usb\b|\bexternal\b.*\bdrive\b|\bdisco externo\b/)) return { cat: "Almacenamiento", sub: "Externos / USB" };
  if (has(/\brouter\b|\bswitch\b|\baccess point\b|\bwi-?fi\b|\bwifi\b|\bethernet\b|\blan\b|\bred\b/)) return { cat: "Redes", sub: "Networking" };
  if (has(/\bnotebook\b|\blaptop\b|\bport[aá]til\b|\bultrabook\b|\ball[- ]in[- ]one\b|\baio\b/)) return { cat: "Computadoras", sub: "Notebooks / PCs" };
  if (has(/\bimpresora\b|\bprinter\b|\btoner\b|\bcartucho\b|\bink\b/)) return { cat: "Impresión", sub: "Impresión" };

  return { cat: "Otros", sub: "Otros" };
}

function buildTaxonomy(rows) {
  const subsByCat = new Map();
  const brands = new Set();
  
  for (const r of rows) {
    const cat = r.cat || "Otros";
    const sub = r.sub || "Otros";
    if (!subsByCat.has(cat)) subsByCat.set(cat, new Set());
    subsByCat.get(cat).add(sub);
    
    if (r.brand) brands.add(r.brand);
  }

  const cats = Array.from(subsByCat.keys()).sort((a, b) => a.localeCompare(b, "es"));
  const subsObj = {};
  for (const c of cats) subsObj[c] = Array.from(subsByCat.get(c)).sort((a, b) => a.localeCompare(b, "es"));
  
  return { 
    cats, 
    subsByCat: subsObj,
    brands: Array.from(brands).sort((a, b) => a.localeCompare(b, "es"))
  };
}

function computeFinalPrice({ price, ivaRate, marginPct }) {
  const base = typeof price === "number" ? price : toNumber(price);
  const iva = typeof ivaRate === "number" ? ivaRate : toNumber(ivaRate);
  const margin = typeof marginPct === "number" ? marginPct : toNumber(marginPct);

  if (base === null) return { totalUsd: null, ivaRateUsed: iva };

  const ivaUsed = iva !== null ? iva : null;
  const marginUsed = margin !== null ? margin : 0;

  const withIva = ivaUsed !== null ? base * (1 + ivaUsed / 100) : base;
  const total = withIva * (1 + marginUsed / 100);

  return { totalUsd: total, ivaRateUsed: ivaUsed };
}

function enhanceRows(rows) {
  const fxUsdArs = getFxUsdArs();
  const marginPct = getMarginPct();

  return rows.map((r) => {
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

// Lazy loading de imágenes
function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px'
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      img.classList.add('loaded');
    });
  }
}

function initials(name) {
  const t = String(name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/g).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "?";
}

function renderProductCard(p, idx) {
  const img = p.imageUrl || p.thumbUrl || null;
  const priceUsd = p.totalWithIvaAndMargin !== null ? formatMoney(p.totalWithIvaAndMargin, p.currency) : null;
  const arsMoney = p.arsTotal !== null ? formatMoney(p.arsTotal, "ARS") : null;
  
  const hasStock = p.stock !== null && p.stock > 0;
  const stockBadge = hasStock 
    ? `<div class="pBadge">Disponible</div>`
    : p.stock === 0 
      ? `<div class="pBadge outOfStock">Sin Stock</div>`
      : '';

  const ph = `<div class="pPh">${esc(initials(p.brand || p.name))}</div>`;
  
  // Lazy loading
  const media = img 
    ? `${ph}<img class="pImg" data-src="${esc(img)}" alt="${esc(p.name || p.sku)}" onerror="this.remove()" />`
    : ph;

  let priceDisplay = '';
  if (priceUsd) {
    priceDisplay = `<div class="pPriceBase">${esc(priceUsd)}</div>`;
  } else {
    priceDisplay = `<div class="pPriceBase muted">Consultar</div>`;
  }
  
  const arsDisplay = arsMoney ? `<div class="pPriceIva">${esc(arsMoney)}</div><div class="pPriceLabel">INCLUYE IVA • MARGEN APLICADO</div>` : '';

  return `
    <div class="pCard tiendaCard" data-tt="product-card" data-idx="${idx}">
      ${stockBadge}
      
      <div class="pMedia">
        ${media}
      </div>
      
      <div class="pBody">
        <div class="pTitle" title="${esc(p.name || p.sku)}">${esc(p.name || p.sku || "Producto")}</div>
        
        <div class="pMeta">
          ${p.brand ? `<span class="pChip">${esc(p.brand)}</span>` : ''}
          ${p.cat ? `<span class="pChip">${esc(p.cat)}</span>` : ''}
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
  const fxLine = p.fxUsdArs ? `Tipo de cambio: $${p.fxUsdArs}` : "";
  
  const hasStock = p.stock !== null && p.stock > 0;
  
  // Mensaje de WhatsApp
  const productName = esc(p.name || p.sku || "Producto");
  const productSKU = esc(p.sku || "");
  const productBrand = esc(p.brand || "");
  
  const whatsappMessage = `Hola! Me interesa el siguiente producto:%0A%0A` +
    `*${productName}*%0A` +
    `SKU: ${productSKU}%0A` +
    `${productBrand ? `Marca: ${productBrand}%0A` : ''}` +
    `Precio: ${totalMoney}%0A` +
    `${arsMoney !== "-" ? `En pesos: ${arsMoney}%0A` : ''}` +
    `%0A¿Está disponible? ¿Cuándo podría retirarlo/recibirlo?`;
  
  const whatsappURL = `https://wa.me/5491123413674?text=${whatsappMessage}`;

  return `
    <div class="ttModalBody">
      <div class="ttModalTop">
        <div class="ttModalImg">
          ${img ? `<img src="${esc(img)}" alt="${productName}" loading="lazy" />` : `<div class="ttModalImgPh">Sin imagen</div>`}
        </div>

        <div class="ttModalInfo">
          <div class="ttModalTitle">${productName}</div>
          
          <div class="ttModalSub">
            ${productBrand ? `<span class="chip">${productBrand}</span>` : ''}
            ${p.cat ? `<span class="chip">${esc(p.cat)}</span>` : ''}
            <span class="chip mono">${productSKU}</span>
            ${hasStock ? '<span class="chip" style="background: rgba(0, 255, 127, 0.15); color: #00FF7F; border-color: rgba(0, 255, 127, 0.3);">Disponible</span>' : ''}
          </div>
          
          <div class="ttModalPrices">
            <div class="row highlight">
              <span>Precio final</span>
              <b>${totalMoney}</b>
            </div>
            
            ${arsMoney !== "-" ? `
            <div class="row highlight">
              <span>En pesos argentinos</span>
              <b>${arsMoney}</b>
            </div>
            ` : ''}
            
            ${fxLine ? `<div class="row small"><span>${fxLine}</span></div>` : ''}
            
            <div class="row small">
              <span style="color: rgba(255,255,255,0.6); font-size: 11px;">
                * Precio incluye IVA y margen aplicado
              </span>
            </div>
          </div>
          
          <div class="ttModalActions">
            <a href="${whatsappURL}" target="_blank" class="btn btnPrimary btnWhatsapp btnBlock">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Consultar por WhatsApp
            </a>
          </div>
          
          <p class="ttModalHint">Consultá disponibilidad y formas de pago por WhatsApp</p>
        </div>
      </div>
    </div>
  `;
}

function computeComparableFinal({ r, fxUsdArs, mode = "USD" }) {
  const cur = String(r.currency || "USD").toUpperCase();
  const base = r.totalWithIvaAndMargin;

  if (base === null || base === undefined) return null;

  if (mode === "USD") {
    if (cur === "USD") return base;
    if (cur === "ARS" && fxUsdArs) return base / fxUsdArs;
    return null;
  }

  if (cur === "ARS") return base;
  if (cur === "USD" && fxUsdArs) return base * fxUsdArs;
  return null;
}

function renderPager({ totalItems, page, pageSize, root }) {
  const pagerInfo = root.querySelector("#pagerInfo");
  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");
  const pagerNums = root.querySelector("#pagerNums");

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const p = clamp(page, 1, totalPages);

  const pageText = `Página ${p} de ${totalPages}`;
  if (pagerInfo) pagerInfo.textContent = pageText;

  const prevDisabled = p <= 1;
  const nextDisabled = p >= totalPages;
  
  if (prevBtn) prevBtn.disabled = prevDisabled;
  if (nextBtn) nextBtn.disabled = nextDisabled;

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

  if (pagerNums) {
    pagerNums.innerHTML = nums.map((n) => {
      if (n === "…") return `<span class="pagerDots">…</span>`;
      const active = n === p ? "active" : "";
      return `<button class="paginationBtn ${active}" data-page="${n}" type="button">${n}</button>`;
    }).join("");
  }

  return { totalPages, page: p };
}

export function TiendaPage() {
  return `
  <section class="page tiendaPage">
    <div class="tiendaHeader">
      <h1>Tienda</h1>
      <p class="muted" id="tiendaSource">Datos: API</p>
      <div id="tiendaErr" class="errorBox" hidden></div>
    </div>

    <div class="tiendaConfig">
      <label>
        <span>FX USD→ARS (API)</span>
        <input id="fxUsdArs" class="input small" value="Cargando..." disabled />
      </label>
      <label>
        <span>Margen %</span>
        <input id="marginPct" class="input small" placeholder="15" inputmode="decimal" />
      </label>
    </div>

    <div class="filtersContainer">
      <div class="filtersMain">
        <div class="filterSection">
          <label class="filterLabel">Buscar</label>
          <input id="q" class="input" placeholder="Buscar por nombre o marca..." />
        </div>

        <div class="filterSection">
          <label class="filterLabel">Categoría</label>
          <div class="filterRow">
            <select id="catSel" class="select"></select>
            <select id="subSel" class="select"></select>
          </div>
        </div>

        <div class="filterSection">
          <label class="filterLabel">Marca</label>
          <select id="brandSel" class="select">
            <option value="">Todas las marcas</option>
          </select>
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
            <option value="ARS">Filtrar en ARS</option>
          </select>
        </div>

        <div class="filterSection">
          <label class="filterCheckbox">
            <input id="inStock" type="checkbox" />
            <span>Solo productos disponibles</span>
          </label>
        </div>
      </div>
    </div>

    <div class="catalogoControls">
      <span class="catalogoCount" id="countPill">0 productos</span>
      
      <select id="sortSel" class="select">
        <option value="relevance">Ordenar por: Relevancia</option>
        <option value="priceAsc">Precio: Menor a Mayor</option>
        <option value="priceDesc">Precio: Mayor a Menor</option>
        <option value="nameAsc">Nombre: A → Z</option>
        <option value="nameDesc">Nombre: Z → A</option>
        <option value="brandAsc">Marca: A → Z</option>
      </select>

      <select id="pageSizeSel" class="select">
        <option value="24">24 por página</option>
        <option value="48" selected>48 por página</option>
        <option value="96">96 por página</option>
      </select>
    </div>

    <div class="pagination" id="pager">
      <button id="prevPage" class="paginationBtn" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div id="pagerNums"></div>
      <button id="nextPage" class="paginationBtn" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
    <div id="pagerInfo" style="text-align: center; margin: 12px 0; color: var(--muted);">Página 1 de 1</div>

    <div id="grid" class="productsGrid"></div>

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

  const catSel = root.querySelector("#catSel");
  const subSel = root.querySelector("#subSel");
  const brandSel = root.querySelector("#brandSel");
  const minPrice = root.querySelector("#minPrice");
  const maxPrice = root.querySelector("#maxPrice");
  const priceMode = root.querySelector("#priceMode");
  const inStock = root.querySelector("#inStock");
  const sortSel = root.querySelector("#sortSel");
  const pageSizeSel = root.querySelector("#pageSizeSel");
  const pagerNums = root.querySelector("#pagerNums");
  const prevBtn = root.querySelector("#prevPage");
  const nextBtn = root.querySelector("#nextPage");

  const modal = root.querySelector("#tiendaModal");
  const modalBody = root.querySelector("#tiendaModalBody");

  let baseRows = [];
  let viewRows = [];
  let taxonomy = { cats: [], subsByCat: {}, brands: [] };

  let page = 1;
  let pageSize = Number(pageSizeSel?.value || 48) || 48;
  // init FX (solo API)
  try { localStorage.removeItem("toval_fx_usd_ars"); } catch (_) {}
  if (fxInput) {
    fxInput.disabled = true;
    fxInput.readOnly = true;
    fxInput.value = "Cargando...";
    fxInput.title = "Se actualiza automáticamente desde /api/dollar-rate";
  }

  const marginInit = getMarginPct();
  if (marginInit !== null && marginInput) marginInput.value = String(marginInit);

  if (marginInput) {
    marginInput.addEventListener("input", () => {
      setMarginPct(marginInput.value);
      baseRows = enhanceRows(baseRows);
      page = 1;
      draw();
    });
  }

  function openModal(p) {
    if (modalBody) modalBody.innerHTML = renderModalBody(p);
    if (modal) modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (modal) modal.classList.add("hidden");
    if (modalBody) modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  if (modal) {
    modal.addEventListener("click", (ev) => {
      const close = ev.target.closest("[data-tt='modal-close']");
      if (close) closeModal();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && modal && !modal.classList.contains("hidden")) closeModal();
  });

  if (grid) {
    grid.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-tt='product-card']");
      if (!el) return;
      const idx = Number(el.dataset.idx);
      if (!Number.isFinite(idx) || idx < 0 || idx >= viewRows.length) return;
      openModal(viewRows[idx]);
    });
  }

  function fillCategorySelects() {
    const catOpts = [`<option value="">Todas las categorías</option>`]
      .concat(taxonomy.cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`));
    if (catSel) catSel.innerHTML = catOpts.join("");
    if (subSel) subSel.innerHTML = `<option value="">Todas las subcategorías</option>`;
    
    const brandOpts = [`<option value="">Todas las marcas</option>`]
      .concat(taxonomy.brands.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`));
    if (brandSel) brandSel.innerHTML = brandOpts.join("");
  }

  function refreshSubOptions() {
    const cat = catSel ? (catSel.value || "").trim() : "";
    const subs = cat ? (taxonomy.subsByCat[cat] || []) : [];
    const opts = [`<option value="">Todas las subcategorías</option>`]
      .concat(subs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`));
    if (subSel) subSel.innerHTML = opts.join("");
  }

  function setSourceUi(totalItems) {
    if (tiendaSource) tiendaSource.textContent = `Datos: ${dataSource}`;
    if (countPill) countPill.textContent = `${totalItems} productos`;
  }

  function applySort(rows) {
    const mode = sortSel ? (sortSel.value || "relevance").trim() : "relevance";
    if (mode === "relevance") return rows;

    const fx = getFxUsdArs();
    const pm = priceMode ? (priceMode.value || "USD").trim() : "USD";

    const copy = [...rows];
    copy.sort((a, b) => {
      if (mode === "nameAsc") return norm(a.name).localeCompare(norm(b.name), "es");
      if (mode === "nameDesc") return norm(b.name).localeCompare(norm(a.name), "es");
      if (mode === "brandAsc") return norm(a.brand).localeCompare(norm(b.brand), "es");

      if (mode === "priceAsc" || mode === "priceDesc") {
        const pa = computeComparableFinal({ r: a, fxUsdArs: fx, mode: pm });
        const pb = computeComparableFinal({ r: b, fxUsdArs: fx, mode: pm });

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
    const q = qInput ? (qInput.value || "").trim().toLowerCase() : "";
    const selectedBrand = brandSel ? (brandSel.value || "").trim() : "";

    const fx = getFxUsdArs();
    const min = minPrice ? toNumber(minPrice.value) : null;
    const max = maxPrice ? toNumber(maxPrice.value) : null;
    const pm = priceMode ? (priceMode.value || "USD").trim() : "USD";
    const stockOnly = inStock ? !!inStock.checked : false;

    const cat = catSel ? (catSel.value || "").trim() : "";
    const sub = subSel ? (subSel.value || "").trim() : "";

    let filtered = baseRows.filter((r) => {
      if (cat && r.cat !== cat) return false;
      if (sub && r.sub !== sub) return false;
      if (selectedBrand && r.brand !== selectedBrand) return false;
      if (stockOnly && !(r.stock !== null && r.stock > 0)) return false;

      if (q) {
        if (!r._search || !r._search.includes(q)) return false;
      }

      if (min !== null || max !== null) {
        const comparable = computeComparableFinal({ r, fxUsdArs: fx, mode: pm });
        if (comparable === null) return false;
        if (min !== null && comparable < min) return false;
        if (max !== null && comparable > max) return false;
      }

      return true;
    });

    filtered = applySort(filtered);

    const totalItems = filtered.length;
    pageSize = pageSizeSel ? Number(pageSizeSel.value) || 48 : 48;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    page = clamp(page, 1, totalPages);

    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    viewRows = pageRows;

    setSourceUi(totalItems);
    renderPager({ totalItems, page, pageSize, root });

    if (grid) {
      grid.innerHTML = pageRows.map((r, idx) => renderProductCard(r, idx)).join("");
      
      // Inicializar lazy loading después de renderizar
      setTimeout(() => setupLazyLoading(), 0);
    }
  }

  // eventos filtros
  if (qInput) {
    let t = null;
    qInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => { page = 1; draw(); }, 150);
    });
  }

  if (catSel) {
    catSel.addEventListener("change", () => {
      refreshSubOptions();
      page = 1;
      draw();
    });
  }

  if (subSel) subSel.addEventListener("change", () => { page = 1; draw(); });
  if (brandSel) brandSel.addEventListener("change", () => { page = 1; draw(); });

  if (minPrice || maxPrice) {
    let t = null;
    const debouncedPriceDraw = () => {
      clearTimeout(t);
      t = setTimeout(() => { page = 1; draw(); }, 150);
    };
    if (minPrice) minPrice.addEventListener("input", debouncedPriceDraw);
    if (maxPrice) maxPrice.addEventListener("input", debouncedPriceDraw);
  }

  if (priceMode) priceMode.addEventListener("change", () => { page = 1; draw(); });
  if (inStock) inStock.addEventListener("change", () => { page = 1; draw(); });
  if (sortSel) sortSel.addEventListener("change", draw);

  if (prevBtn) prevBtn.addEventListener("click", () => { page = Math.max(1, page - 1); draw(); });
  if (nextBtn) nextBtn.addEventListener("click", () => { page = page + 1; draw(); });

  if (pagerNums) {
    pagerNums.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-page]");
      if (!b) return;
      const p = Number(b.dataset.page);
      if (!Number.isFinite(p)) return;
      page = p;
      draw();
    });
  }

  if (pageSizeSel) pageSizeSel.addEventListener("change", () => { page = 1; draw(); });

  async function bootstrap() {
    // FX USD→ARS desde API
    await refreshFxUsdArs();
    if (fxInput) {
      const fx = getFxUsdArs();
      fxInput.value = fx ? String(fx) : "No disponible";
      const meta = getFxMetaText();
      if (meta) fxInput.title = meta;
    }

    try {
      cachedProviders = await loadProvidersFromApi();
      dataSource = "API";
    } catch (err) {
      lastApiError = String(err);
      cachedProviders = mockProviders;
      dataSource = "MOCK";
      if (errBox) {
        errBox.textContent = "Error cargando proveedores: " + lastApiError;
        errBox.hidden = false;
      }
    }

    let rows;
    try {
      rows = await loadProductsFromApi({ providerId: "", q: "" });
      dataSource = "API";
      if (errBox) errBox.hidden = true;
    } catch (err) {
      lastApiError = String(err);
      rows = mockProducts;
      dataSource = "MOCK";
      if (errBox) {
        errBox.textContent = "Error cargando productos: " + lastApiError;
        errBox.hidden = false;
      }
    }

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

    baseRows = enhanceRows(normalized);
    taxonomy = buildTaxonomy(baseRows);
    fillCategorySelects();
    refreshSubOptions();

    draw();
  }

  bootstrap();

  // refresco FX cada 5 min
  setInterval(async () => {
    const prev = getFxUsdArs();
    await refreshFxUsdArs();
    const next = getFxUsdArs();

    if (fxInput) {
      fxInput.value = next ? String(next) : "No disponible";
      const meta = getFxMetaText();
      if (meta) fxInput.title = meta;
    }

    if (next && next !== prev && baseRows.length) {
      baseRows = enhanceRows(baseRows);
      draw();
    }
  }, 300000);
}