// File: /src/pages/proveedores.js
import { providers as mockProviders } from "../data/providers.js";
import { renderTable } from "../components/table.js";

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

  dataSource = "API";
  return items.map((p) => ({
    id: String(p.id ?? ""),
    name: (() => {
      const id = String(p.id ?? "").trim();
      const raw = String(p.name ?? id).trim();
      if (!raw) return id;
      if (raw.toLowerCase() === id.toLowerCase()) {
        return id ? (id.charAt(0).toUpperCase() + id.slice(1)) : raw;
      }
      return raw;
    })(),
    api: !!p.api,
    currency: String(p.currency ?? "USD")
  }));
}

export function ProveedoresPage() {
  return `
    <h2>Proveedores</h2>
    <p class="muted">Datos: <span id="provSrc">...</span> <span id="provErr" class="errorText" style="margin-left:8px;"></span></p>
    <div id="provTable"></div>
  `;
}

export async function wireProveedores() {
  const mount = document.querySelector("#provTable");
  const provSrc = document.querySelector("#provSrc");
  const provErr = document.querySelector("#provErr");

  if (!cachedProviders) {
    try {
      cachedProviders = await loadProvidersFromApi();
      lastApiError = "";
    } catch (err) {
      dataSource = "MOCK";
      lastApiError = `API falló: ${err?.message || "error"}. Usando MOCK.`;
      cachedProviders = mockProviders;
    }
  }

  provSrc.textContent = dataSource;
  provErr.textContent = lastApiError;

  const columns = [
    { label: "ID", value: (r) => r.id },
    { label: "Proveedor", value: (r) => r.name },
    { label: "API", value: (r) => (r.api ? "Sí" : "No") },
    { label: "Moneda", value: (r) => r.currency }
  ];

  mount.innerHTML = renderTable({ columns, rows: cachedProviders });
}
