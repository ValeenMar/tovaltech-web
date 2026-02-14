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

export function renderProductCards({ rows, providerName, formatMoney }) {
  if (!rows?.length) {
    return `<div class="emptyState">No hay items para mostrar.</div>`;
  }

  return `
    <div class="productsGrid">
      ${rows.map(r => {
        const title = r.name || r.sku || "Producto";
        const money = formatMoney(r.price, r.currency) ?? "-";
        const brand = r.brand || "-";
        const prov = providerName(r.providerId);
        const img = r.image || r.imageUrl || "";

        const media = img
          ? `<img class="pImg" src="${esc(img)}" alt="${esc(title)}" loading="lazy" />`
          : `<div class="pPh">${esc(initials(brand !== "-" ? brand : title))}</div>`;

        return `
          <div class="pCard">
            <div class="pMedia">${media}</div>
            <div class="pBody">
              <div class="pTitle" title="${esc(title)}">${esc(title)}</div>
              <div class="pMeta">
                <span class="pChip">${esc(prov)}</span>
                <span class="pChip">${esc(brand)}</span>
                <span class="pChip mono">${esc(r.sku || "-")}</span>
              </div>
              <div class="pPrice">${esc(money)}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}
