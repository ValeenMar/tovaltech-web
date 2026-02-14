// File: /src/pages/catalogo.js
import { products as mockProducts } from "../data/products.js";
import { providers as mockProviders } from "../data/providers.js";
import { renderTable } from "../components/table.js";
import { renderProductCards } from "../components/cards.js";

let cachedProviders = null;
let dataSource = "MOCK";
let lastApiError = "";

async function loadProvidersFromApi() {
  const res = await fetch("/api/getProviders", { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!data) throw new Error("No JSON");
  if (data?.ok === false) throw new Error(data?.error || "API error");

  const items = Array.isArray(data) ? data : (data.items || []);
  if (!Array.isArray(items)) throw new Error("Invalid items");

  return items.map((p) => ({
    id: String(p.id ?? ""),
    name: (() => {
      const id = String(p.id ?? "").trim();
      const raw = String(p.name ?? id).trim();
      if (!raw) return id;
      // si no hay nombre “humano”, capitalizamos el id
      if (raw.toLowerCase() === id.toLowerCase()) {
        return id ? (id.charAt(0).toUpperCase() + id.slice(1)) : raw;
      }
      return raw;
    })(),
    api: !!p.api,
    currency: String(p.currency ?? "USD"),
  }));
}

async function loadProductsFromApi({ providerId = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (providerId) params.set("provider", providerId);
  if (q) params.set("q", q);
  // Traemos hasta 5000 para que puedas ver todo el catálogo de un proveedor
  // (ELIT en tu caso ronda ~1121 items).
  params.set("limit", "5000");

  const res = await fetch(`/api/getProducts?${params.toString()}`, { method: "GET" });
  const data = await res.json().catch(() => null);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!data) throw new Error("No JSON");
  if (data?.ok === false) throw new Error(data?.error || "API error");

  const items = Array.isArray(data) ? data : (data.items || []);
  if (!Array.isArray(items)) throw new Error("Invalid items");

  dataSource = "API";
  return items.map((p) => ({
    sku: String(p.sku ?? ""),
    name: String(p.name ?? ""),
    brand: String(p.brand ?? ""),
    providerId: String(p.providerId ?? ""),
    imageUrl: p.imageUrl || p.image || null,
    price: p.price ?? null,
    currency: String(p.currency ?? "USD"),
  }));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  // Soporta formatos tipo:
  //  - 2167.68
  //  - 2.167,68
  //  - 2 167,68
  //  - 2,167.68
  let s = String(value).trim();
  if (!s) return null;
  s = s.replace(/\s+/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "");
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(/,/g, ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(amount, currency = "USD") {
  const n = toNumber(amount);
  if (n === null) return null;

  // currencyDisplay:"code" => "ARS 2.167,68" (en es-AR)
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    // fallback si currency code raro
    const num = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
    return `${currency} ${num}`;
  }
}

export function CatalogoPage() {
  return `
    <h2>Catálogo</h2>
    <p class="muted">Datos: <span id="dataSrc">...</span> <span id="apiErr" class="errorText" style="margin-left:8px;"></span></p>

    <div class="filters">
      <input id="q" placeholder="Buscar por SKU / nombre / marca" />
      <select id="prov">
        <option value="">Todos los proveedores</option>
      </select>
      <div class="viewToggle" role="group" aria-label="Vista">
        <button id="viewTable" class="btnSm" type="button">Tabla</button>
        <button id="viewCards" class="btnSm" type="button">Cards</button>
      </div>
      <div class="pill" id="count"></div>
    </div>

    <div id="catTable"></div>
  `;
}

export async function wireCatalogo(search = "") {
  const qInput = document.querySelector("#q");
  const prov = document.querySelector("#prov");
  const mount = document.querySelector("#catTable");
  const viewTableBtn = document.querySelector("#viewTable");
  const viewCardsBtn = document.querySelector("#viewCards");
  const count = document.querySelector("#count");
  const dataSrc = document.querySelector("#dataSrc");
  const apiErr = document.querySelector("#apiErr");

  // Vista (persistida)
  let viewMode = localStorage.getItem("tt_catalog_view") || "table";
  function syncViewButtons() {
    viewTableBtn.classList.toggle("active", viewMode === "table");
    viewCardsBtn.classList.toggle("active", viewMode === "cards");
  }
  viewTableBtn.addEventListener("click", () => {
    viewMode = "table";
    localStorage.setItem("tt_catalog_view", viewMode);
    syncViewButtons();
    fetchAndDraw();
  });
  viewCardsBtn.addEventListener("click", () => {
    viewMode = "cards";
    localStorage.setItem("tt_catalog_view", viewMode);
    syncViewButtons();
    fetchAndDraw();
  });
  syncViewButtons();

  if (search) qInput.value = search;

  // Providers (API -> fallback)
  if (!cachedProviders) {
    try {
      cachedProviders = await loadProvidersFromApi();
      lastApiError = "";
    } catch (err) {
      lastApiError = `API providers falló: ${err?.message || "error"}. Usando MOCK.`;
      cachedProviders = mockProviders;
    }
  }

  prov.innerHTML = `
    <option value="">Todos los proveedores</option>
    ${cachedProviders.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
  `;

  const providerName = (id) => cachedProviders.find(p => p.id === id)?.name ?? id;

  const columns = [
    { label: "SKU", value: (r) => r.sku },
    { label: "Producto", value: (r) => r.name || "-" },
    { label: "Marca", value: (r) => r.brand || "-" },
    { label: "Proveedor", value: (r) => providerName(r.providerId) },
    {
      label: "Precio",
      value: (r) => {
        const fm = formatMoney(r.price, r.currency);
        return fm ?? "-";
      }
    },
  ];

  async function fetchAndDraw() {
    const term = (qInput.value || "").trim();
    const providerId = prov.value;

    let rows = [];
    try {
      rows = await loadProductsFromApi({ providerId, q: term });
      lastApiError = "";
    } catch (err) {
      // fallback local mock con filtro
      dataSource = "MOCK";
      lastApiError = `API products falló: ${err?.message || "error"}. Usando MOCK.`;
      rows = mockProducts.filter((p) => {
        const matchesText =
          !term ||
          String(p.sku).toLowerCase().includes(term.toLowerCase()) ||
          String(p.name).toLowerCase().includes(term.toLowerCase()) ||
          String(p.brand).toLowerCase().includes(term.toLowerCase());

        const matchesProv = !providerId || p.providerId === providerId;
        return matchesText && matchesProv;
      });
    }

    dataSrc.textContent = dataSource;
    apiErr.textContent = lastApiError;
    count.textContent = `${rows.length} items • ${dataSource}`;

    if (viewMode === "cards") {
      mount.innerHTML = renderProductCards({
        rows,
        providerName,
        formatMoney
      });
    } else {
      mount.innerHTML = renderTable({ columns, rows });
    }
  }

  qInput.addEventListener("input", () => {
    // debounce simple
    window.clearTimeout(window.__tt_cat_t);
    window.__tt_cat_t = window.setTimeout(fetchAndDraw, 180);
  });
  prov.addEventListener("change", fetchAndDraw);

  await fetchAndDraw();
}
