// File: /src/components/cards.js

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  const t = String(name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/g).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("") || "?";
}

export function renderProductCards({ rows, formatMoney }) {
  if (!rows?.length) {
    return `<div class="emptyState">No hay items para mostrar.</div>`;
  }

  return `
    <div class="productsGrid">
      ${rows.map((r, idx) => {
        const title = r.name || r.sku || "Producto";
        const basePrice = formatMoney(r.price, r.currency) || "-";
        const brand = r.brand || "-";
        
        // Usar providerName directamente del objeto (ya viene procesado desde catalogo.js)
        const prov = r.providerName || r.providerId || "-";
        
        const img = r.imageUrl || r.thumbUrl || r.image || "";

        // Precio con IVA (si existe)
        const priceWithIva = r.priceWithIvaText || "";

        const ph = `<div class="pPh">${esc(initials(brand !== "-" ? brand : title))}</div>`;

        const media = `
          ${ph}
          ${img ? `<img class="pImg" src="${esc(img)}" alt="${esc(title)}" loading="lazy" onerror="this.remove()" />` : ""}
        `;

        return `
          <div class="pCard" data-tt="product-card" data-idx="${idx}" style="cursor:pointer;">
            <div class="pMedia">${media}</div>
            <div class="pBody">
              <div class="pTitle" title="${esc(title)}">${esc(title)}</div>
              
              <div class="pMeta">
                <span class="pChip">${esc(prov)}</span>
                <span class="pChip">${esc(brand)}</span>
                <span class="pChip mono">${esc(r.sku || "-")}</span>
              </div>

              <div class="pPricing">
                <div class="pPriceBase">${esc(basePrice)}</div>
                ${priceWithIva ? `<div class="pPriceIva">${esc(priceWithIva)}</div>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}