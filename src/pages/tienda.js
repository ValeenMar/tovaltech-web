// File: /src/pages/tienda.js
/**
 * Tienda Pública - Catálogo con margen para clientes finales
 * Muestra precios finales en ARS (con IVA + margen)
 */

import { products as mockProducts } from "../data/products.js";
import { providers as mockProviders } from "../data/providers.js";

let cachedProviders = null;
let dataSource = "MOCK";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll("&gt;", "&gt;")
    .replaceAll('"', "&quot;");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  let s = String(v).trim().replace(/\s+/g, "");
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

function formatMoney(amount, currency = "ARS") {
  const n = typeof amount === "number" ? amount : toNumber(amount);
  if (n === null) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(n).replace(currency, currency);
}

function getFxUsdArs() {
  const v = toNumber(localStorage.getItem("tt_tienda_fx"));
  return v && v > 0 ? v : 1420; // Default 1420
}

function setFxUsdArs(v) {
  const n = toNumber(v);
  if (!n || n <= 0) {
    localStorage.setItem("tt_tienda_fx", "1420");
    return 1420;
  }
  localStorage.setItem("tt_tienda_fx", String(n));
  return n;
}

function getMargen() {
  const v = toNumber(localStorage.getItem("tt_tienda_margen"));
  return v && v > 0 && v <= 100 ? v : 25; // Default 25%
}

function setMargen(v) {
  const n = toNumber(v);
  if (!n || n <= 0 || n > 100) {
    localStorage.setItem("tt_tienda_margen", "25");
    return 25;
  }
  localStorage.setItem("tt_tienda_margen", String(n));
  return n;
}

async function loadProvidersFromApi() {
  const res = await fetch("/api/getProviders", { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");

  const items = Array.isArray(data) ? data : (data.items || []);
  return items.map((p) => ({
    id: String(p.id ?? ""),
    name: String(p.name ?? p.id ?? ""),
  }));
}

async function loadProductsFromApi({ providerId = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (providerId) params.set("provider", providerId);
  if (q) params.set("q", q);
  params.set("limit", "5000");

  const res = await fetch(`/api/getProducts?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error("Bad API response");

  const items = Array.isArray(data) ? data : (data.items || []);
  return items.map((p) => ({
    sku: String(p.sku ?? ""),
    providerId: String(p.providerId ?? ""),
    name: String(p.name ?? ""),
    brand: p.brand ? String(p.brand) : "",
    price: toNumber(p.price),
    currency: String(p.currency ?? "USD"),
    ivaRate: toNumber(p.ivaRate ?? p.iva) ?? 10.5, // Default IVA 10.5%
    imageUrl: p.imageUrl || p.image || null,
    thumbUrl: p.thumbUrl || p.thumbnail || null,
  }));
}

function getProviderName(providerId) {
  const p = cachedProviders?.find((x) => x.id === providerId);
  return p?.name || providerId;
}

function calcularPrecioFinal(producto, margen, fx) {
  const base = producto.price;
  if (base === null) return null;

  // 1. Aplicar IVA
  const conIva = base * (1 + (producto.ivaRate / 100));

  // 2. Aplicar margen
  const conMargen = conIva * (1 + (margen / 100));

  // 3. Convertir a ARS si es USD
  if (String(producto.currency).toUpperCase() === "USD") {
    return conMargen * fx;
  } else if (String(producto.currency).toUpperCase() === "ARS") {
    return conMargen;
  }

  return null;
}

function enhanceProductos(productos, margen, fx) {
  return productos.map((p) => {
    const precioFinal = calcularPrecioFinal(p, margen, fx);
    const precioBase = p.price;
    const conIva = precioBase ? precioBase * (1 + (p.ivaRate / 100)) : null;

    return {
      ...p,
      providerName: getProviderName(p.providerId),
      precioFinal,
      precioBase,
      precioConIva: conIva,
      margenAplicado: margen,
      fxAplicado: fx,
    };
  });
}

function renderProductCard(p, idx) {
  const img = p.thumbUrl || p.imageUrl || null;
  const initials = p.brand ? p.brand.substring(0, 2).toUpperCase() : "PR";

  const precioText = p.precioFinal !== null
    ? formatMoney(p.precioFinal, "ARS")
    : "Consultar";

  return `
    <div class="tiendaCard" data-idx="${idx}">
      <div class="tiendaCardMedia">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="tiendaCardPh">${esc(initials)}</div>`
        }
      </div>
      <div class="tiendaCardBody">
        <h3 class="tiendaCardTitle">${esc(p.name)}</h3>
        <div class="tiendaCardMeta">
          ${p.brand ? `<span class="chip">${esc(p.brand)}</span>` : ""}
          <span class="chip">${esc(p.providerName)}</span>
        </div>
        <div class="tiendaCardPrice">
          <span class="tiendaPrecioFinal">${precioText}</span>
          ${p.precioFinal ? `<span class="tiendaPrecioDetalle">IVA y envío incluidos</span>` : ""}
        </div>
        <button class="btn btnPrimary tiendaCardBtn" data-action="consultar" data-idx="${idx}">
          💬 Consultar
        </button>
      </div>
    </div>
  `;
}

function renderModal(p) {
  const img = p.imageUrl || p.thumbUrl || null;
  const precioBaseText = p.precioBase !== null ? formatMoney(p.precioBase, p.currency) : "-";
  const precioIvaText = p.precioConIva !== null ? formatMoney(p.precioConIva, p.currency) : "-";
  const precioFinalText = p.precioFinal !== null ? formatMoney(p.precioFinal, "ARS") : "-";

  return `
    <div class="tiendaModalGrid">
      <div class="tiendaModalImg">
        ${img
          ? `<img src="${esc(img)}" alt="${esc(p.name)}" />`
          : `<div class="tiendaModalPh">${esc(p.brand?.substring(0, 1) || "P")}</div>`
        }
      </div>
      <div class="tiendaModalInfo">
        <h2 class="tiendaModalTitle">${esc(p.name)}</h2>
        <div class="tiendaModalMeta">
          ${p.brand ? `<span class="chip">${esc(p.brand)}</span>` : ""}
          <span class="chip">${esc(p.providerName)}</span>
          ${p.sku ? `<span class="chip mono">${esc(p.sku)}</span>` : ""}
        </div>

        <div class="tiendaModalDesglose">
          <h4>Desglose de Precio:</h4>
          <div class="tiendaModalRow">
            <span>Precio base:</span>
            <b>${precioBaseText}</b>
          </div>
          <div class="tiendaModalRow">
            <span>IVA (${p.ivaRate}%):</span>
            <b>${precioIvaText}</b>
          </div>
          <div class="tiendaModalRow">
            <span>Margen (${p.margenAplicado}%):</span>
            <b>+${p.margenAplicado}%</b>
          </div>
          ${String(p.currency).toUpperCase() === "USD" ? `
            <div class="tiendaModalRow">
              <span>FX USD→ARS:</span>
              <b>${p.fxAplicado}</b>
            </div>
          ` : ""}
          <div class="tiendaModalRow tiendaModalTotal">
            <span>PRECIO FINAL:</span>
            <b>${precioFinalText}</b>
          </div>
        </div>

        <div class="tiendaModalActions">
          <button class="btn btnPrimary" data-action="whatsapp">
            💬 Consultar por WhatsApp
          </button>
          <button class="btn" data-action="email">
            📧 Consultar por Email
          </button>
        </div>

        <p class="tiendaModalNote">
          Los precios son estimados e incluyen IVA. Margen configurable desde los filtros.
          Envío no incluido.
        </p>
      </div>
    </div>
  `;
}

export function TiendaPage() {
  return `
    <section class="page tiendaPage">
      <div class="tiendaHeader">
        <h1>Tienda TovalTech</h1>
        <p class="muted">Precios finales para clientes • IVA incluido</p>
      </div>

      <div class="tiendaFilters">
        <input id="tiendaQ" class="input" placeholder="Buscar productos..." />
        <select id="tiendaProv" class="select"></select>

        <div class="tiendaConfig">
          <label>
            <span>FX USD→ARS:</span>
            <input id="tiendaFx" class="input small" type="number" min="1" step="0.01" />
          </label>
          <label>
            <span>Margen %:</span>
            <input id="tiendaMargen" class="input small" type="number" min="0" max="100" step="1" />
          </label>
        </div>

        <div class="pill" id="tiendaCount">0 productos</div>
      </div>

      <div id="tiendaGrid" class="tiendaGrid">
        <div class="loading">Cargando productos...</div>
      </div>

      <!-- Modal -->
      <div id="tiendaModal" class="ttModal hidden" role="dialog">
        <div class="ttModalBackdrop" data-close-modal></div>
        <div class="ttModalPanel">
          <button class="ttModalClose" data-close-modal>✕</button>
          <div id="tiendaModalBody"></div>
        </div>
      </div>
    </section>
  `;
}

export function wireTienda() {
  const grid = document.querySelector("#tiendaGrid");
  const qInput = document.querySelector("#tiendaQ");
  const provSel = document.querySelector("#tiendaProv");
  const fxInput = document.querySelector("#tiendaFx");
  const margenInput = document.querySelector("#tiendaMargen");
  const countPill = document.querySelector("#tiendaCount");
  const modal = document.querySelector("#tiendaModal");
  const modalBody = document.querySelector("#tiendaModalBody");

  let baseProductos = [];
  let viewProductos = [];

  // Inicializar valores
  fxInput.value = getFxUsdArs();
  margenInput.value = getMargen();

  // Eventos de configuración
  fxInput.addEventListener("input", () => {
    setFxUsdArs(fxInput.value);
    render();
  });

  margenInput.addEventListener("input", () => {
    setMargen(margenInput.value);
    render();
  });

  // Filtros
  let debounceTimer = null;
  qInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(filter, 200);
  });

  provSel.addEventListener("change", filter);

  // Modal
  function openModal(p) {
    modalBody.innerHTML = renderModal(p);
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Wire modal actions
    modalBody.querySelector('[data-action="whatsapp"]')?.addEventListener("click", () => {
      consultarWhatsApp(p);
    });

    modalBody.querySelector('[data-action="email"]')?.addEventListener("click", () => {
      consultarEmail(p);
    });
  }

  function closeModal() {
    modal.classList.add("hidden");
    modalBody.innerHTML = "";
    document.body.style.overflow = "";
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  // Click en cards
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='consultar']");
    if (!btn) return;

    const idx = Number(btn.dataset.idx);
    if (idx >= 0 && idx < viewProductos.length) {
      openModal(viewProductos[idx]);
    }
  });

  function consultarWhatsApp(p) {
    const tel = "5491123413674"; // TODO: Configurar número real
    const msg = encodeURIComponent(
      `Hola! Me interesa consultar sobre:\n\n` +
      `📦 ${p.name}\n` +
      `🏷️ Marca: ${p.brand || "N/A"}\n` +
      `💰 Precio: ${p.precioFinal !== null ? formatMoney(p.precioFinal, "ARS") : "Consultar"}\n\n` +
      `¿Está disponible?`
    );
    window.open(`https://wa.me/${tel:5491123413674}?text=${msg}`, "_blank");
  }

  function consultarEmail(p) {
    const email = "ventas@toval-tech.com"; // TODO: Configurar email real
    const subject = encodeURIComponent(`Consulta: ${p.name}`);
    const body = encodeURIComponent(
      `Hola,\n\nMe interesa consultar sobre el siguiente producto:\n\n` +
      `Producto: ${p.name}\n` +
      `Marca: ${p.brand || "N/A"}\n` +
      `SKU: ${p.sku}\n` +
      `Precio estimado: ${p.precioFinal !== null ? formatMoney(p.precioFinal, "ARS") : "Consultar"}\n\n` +
      `¿Podrían confirmar disponibilidad y forma de pago?\n\n` +
      `Gracias!`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }

  function filter() {
    const providerId = provSel.value || "";
    const q = (qInput.value || "").trim().toLowerCase();

    const filtered = baseProductos.filter((p) => {
      if (providerId && p.providerId !== providerId) return false;
      if (!q) return true;

      return (
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );
    });

    countPill.textContent = `${filtered.length} productos`;
    viewProductos = filtered;
    render();
  }

  function render() {
    const margen = getMargen();
    const fx = getFxUsdArs();

    const enhanced = enhanceProductos(viewProductos, margen, fx);

    if (!enhanced.length) {
      grid.innerHTML = `<div class="emptyState">No hay productos para mostrar</div>`;
      return;
    }

    grid.innerHTML = enhanced
      .map((p, idx) => renderProductCard(p, idx))
      .join("");
  }

  async function bootstrap() {
    try {
      cachedProviders = await loadProvidersFromApi();
      dataSource = "API";
    } catch {
      cachedProviders = mockProviders;
      dataSource = "MOCK";
    }

    // Llenar select de proveedores
    provSel.innerHTML = [
      `<option value="">Todos los proveedores</option>`,
      ...cachedProviders.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`),
    ].join("");

    // Cargar productos
    let productos;
    try {
      productos = await loadProductsFromApi();
      dataSource = "API";
    } catch {
      productos = mockProducts;
      dataSource = "MOCK";
    }

    baseProductos = productos;
    viewProductos = productos;
    countPill.textContent = `${productos.length} productos`;

    render();
  }

  bootstrap();
}
