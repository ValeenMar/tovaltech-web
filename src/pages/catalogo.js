// File: /src/pages/catalogo.js
import { products as mockProducts } from "../data/products.js";
import { providers as mockProviders } from "../data/providers.js";
import { renderTable } from "../components/table.js";
import { renderProductCards } from "../components/cards.js";

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

function formatMoney(amount, currency = "USD") {
  const n = typeof amount === "number" ? amount : toNumber(amount);
  if (n === null) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(n).replace(currency, currency);
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

async function loadProvidersFromApi() {
  const res = await fetch("/api/getProviders", { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");

  const items = Array.isArray(data) ? data : (data.items || []);
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
    imageUrl: p.imageUrl || p.image || null,
    thumbUrl: p.thumbUrl || p.thumbnail || null,
  }));
}

function getProviderName(providerId) {
  const p = cachedProviders?.find((x) => x.id === providerId);
  return p?.name || providerId;
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

  const fxLine =
    (String(p.currency).toUpperCase() === "USD")
      ? (p.fxUsdArs ? `FX USD→ARS: ${p.fxUsdArs}` : "FX USD→ARS: (configurá arriba)")
      : "";

  return `
    <div class="ttModalGrid">
      <div class="ttModalImg">
        ${img ? `<img src="${esc(img)}" alt="${esc(p.name)}" />` : `<div class="ttModalPh">${esc((p.brand || p.providerName || "P")[0] || "P")}</div>`}
      </div>

      <div class="ttModalInfo">
        <div class="ttModalTitle">${esc(p.name)}</div>
        <div class="ttModalSub">
          <span class="chip">${esc(p.providerName)}</span>
          ${p.brand ? `<span class="chip">${esc(p.brand)}</span>` : ""}
          ${p.sku ? `<span class="chip">${esc(p.sku)}</span>` : ""}
        </div>

        <div class="ttModalPrices">
          <div class="row"><span>Base</span><b>${baseMoney}</b></div>
          ${p.ivaRate !== null ? `<div class="row"><span>IVA</span><b>${formatPct(p.ivaRate)}</b></div>` : ""}
          <div class="row"><span>Total con IVA</span><b>${ivaMoney}</b></div>
          <div class="row"><span>Total en ARS</span><b>${arsMoney}</b></div>
          ${fxLine ? `<div class="row small"><span>${esc(fxLine)}</span></div>` : ""}
        </div>

        <div class="ttModalHint">El precio en ARS es estimado según el FX que configures (no es un valor oficial).</div>
      </div>
    </div>
  `;
}

export function CatalogoPage() {
  return `
  <section class="page">
    <h1>Catálogo</h1>
    <div class="muted" id="catSource">Datos: ${dataSource}</div>

    <div class="filters">
      <input id="q" class="input" placeholder="Buscar por SKU / nombre / marca" />
      <select id="provSel" class="select"></select>

      <input id="fxUsdArs" class="input fxInput" placeholder="FX USD→ARS (opcional)" inputmode="decimal" />

      <div class="viewToggle">
        <button id="viewTable" class="btn small">Tabla</button>
        <button id="viewCards" class="btn small primary">Cards</button>
      </div>

      <div class="pill" id="countPill">0 items • ${dataSource}</div>
    </div>

    <div id="productsList"></div>

    <div id="ttModal" class="ttModal hidden" role="dialog" aria-modal="true" aria-label="Detalle de producto">
      <div class="ttModalBackdrop" data-tt="modal-close"></div>
      <div class="ttModalPanel">
        <button class="ttModalClose" data-tt="modal-close" aria-label="Cerrar">✕</button>
        <div id="ttModalBody"></div>
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
  const fxInput = root.querySelector("#fxUsdArs");

  const viewTableBtn = root.querySelector("#viewTable");
  const viewCardsBtn = root.querySelector("#viewCards");

  const modal = root.querySelector("#ttModal");
  const modalBody = root.querySelector("#ttModalBody");

  let view = "cards";
  let baseRows = [];
  let viewRows = [];

  // FX UI
  const fxInit = getFxUsdArs();
  if (fxInit) fxInput.value = String(fxInit);

  fxInput.addEventListener("input", () => {
    setFxUsdArs(fxInput.value);
    draw(); // re-render sin volver a pedir API
  });

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

    const providerId = provSel.value || "";
    const providerName = providerId ? getProviderName(providerId) : "";

    if (view === "cards") {
      mount.innerHTML = renderProductCards({
        rows: enhanced,
        providerName,
        formatMoney,
      });
      return;
    }

    // tabla
    const columns = [
      { key: "sku", label: "SKU", value: (r) => esc(r.sku) },
      { key: "name", label: "Nombre", value: (r) => esc(r.name) },
      { key: "brand", label: "Marca", value: (r) => esc(r.brand || "") },
      { key: "price", label: "Precio", value: (r) => esc(formatMoney(r.price, r.currency)) },
      { key: "iva", label: "Con IVA", value: (r) => esc(r.priceWithIvaText ? r.priceWithIvaText.replace(/^Con IVA [^:]+:\s*/, "") : "-") },
    ];

    mount.innerHTML = renderTable({ columns, rows: enhanced });
  }

  function draw() {
    const providerId = (provSel.value || "").trim();
    const q = (qInput.value || "").trim();

    const filtered = baseRows.filter((r) => {
      if (providerId && r.providerId !== providerId) return false;
      if (!q) return true;

      const s = q.toLowerCase();
      return (
        (r.sku && r.sku.toLowerCase().includes(s)) ||
        (r.name && r.name.toLowerCase().includes(s)) ||
        (r.brand && r.brand.toLowerCase().includes(s))
      );
    });

    countPill.textContent = `${filtered.length} items • ${dataSource}`;
    catSource.textContent = `Datos: ${dataSource}`;

    render(filtered);
  }

  async function bootstrap() {
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
    const normalized = rows.map((p) => ({
      sku: String(p.sku ?? p.id ?? ""),
      providerId: String(p.providerId ?? p.provider ?? "elit"),
      name: String(p.name ?? ""),
      brand: String(p.brand ?? ""),
      price: toNumber(p.price),
      currency: String(p.currency ?? "USD"),
      ivaRate: toNumber(p.ivaRate ?? p.iva),
      imageUrl: p.imageUrl || p.image || null,
      thumbUrl: p.thumbUrl || p.thumbnail || null,
    }));

    // dataset base (sin filtros)
    baseRows = normalized;

    // eventos filtros
    provSel.addEventListener("change", draw);

    let t = null;
    qInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(draw, 150);
    });

    draw();
  }

  bootstrap();
}
