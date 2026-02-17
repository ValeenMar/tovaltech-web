// File: /src/pages/carrito.js
import {
  getCart,
  removeFromCart,
  clearCart,
  updateQuantity,
  calculateTotals,
  generateWhatsAppMessage
} from "../components/cart.js";

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMoney(amount) {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(amount);
}

let fxUsdArs = null;
const INTERNAL_MARGIN = 25;

async function refreshFxUsdArs() {
  try {
    const res = await fetch("/api/dollar-rate", { method: "GET", cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error("Bad response");

    const venta = typeof data.venta === "number" ? data.venta : Number(data.venta);
    if (!Number.isFinite(venta) || venta <= 0) throw new Error("Invalid venta");

    fxUsdArs = venta;

    return { ok: true, venta };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function CarritoPage() {
  return `
    <section class="page carritoPage">
      <div class="carritoHeader">
        <h1>🛒 Carrito de Cotización</h1>
        <p class="muted">Productos guardados para consultar</p>
      </div>

      <div class="carritoControls">
        <div class="cartSettings">
          <label>
            <span>FX USD→ARS:</span>
            <input id="cartFx" class="input small" type="text" value="Cargando..." disabled />
          </label>
        </div>
        <button id="clearCart" class="btn btnDanger">Vaciar Carrito</button>
      </div>

      <div id="cartItems" class="cartItems"></div>

      <div id="cartSummary" class="cartSummary hidden">
          <div class="cartTotal">
            <h3>Total Estimado</h3>
            <div class="totalAmount" id="totalAmount">-</div>
            <p class="muted">Incluye IVA</p>
          </div>
        <div class="cartActions">
          <button id="shareWhatsApp" class="btn btnPrimary btnLarge">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            Consultar por WhatsApp
          </button>
          <button id="exportPDF" class="btn">Exportar a PDF</button>
        </div>
      </div>

      <div id="emptyCart" class="emptyState hidden">
        <div class="emptyIcon">🛒</div>
        <h3>Tu carrito está vacío</h3>
        <p class="muted">Agregá productos desde la tienda o catálogo</p>
        <a href="/tienda" data-link class="btn btnPrimary">Ir a la Tienda</a>
      </div>
    </section>
  `;
}

export function wireCarrito() {
  const itemsContainer = document.querySelector("#cartItems");
  const summary = document.querySelector("#cartSummary");
  const empty = document.querySelector("#emptyCart");
  const totalEl = document.querySelector("#totalAmount");
  const fxInput = document.querySelector("#cartFx");
  const clearBtn = document.querySelector("#clearCart");
  const whatsappBtn = document.querySelector("#shareWhatsApp");
  const pdfBtn = document.querySelector("#exportPDF");

  function updateFxUI() {
    if (fxInput) {
      fxInput.value = fxUsdArs ? String(fxUsdArs) : "No disponible";
    }
  }

  function render() {
    const cart = getCart();
    const margen = INTERNAL_MARGIN;

    if (cart.length === 0) {
      itemsContainer.innerHTML = "";
      summary.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");
    summary.classList.remove("hidden");

    itemsContainer.innerHTML = cart.map((item, idx) => {
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const iva = item.ivaRate || 10.5;

      const withIva = price * (1 + iva / 100);
      const withMargen = withIva * (1 + margen / 100);

      let inArs = withMargen;
      if (String(item.currency).toUpperCase() === "USD") {
        inArs = fxUsdArs ? (withMargen * fxUsdArs) : null;
      }

      const subtotal = inArs === null ? null : inArs * qty;

      return `
        <div class="cartItem" data-idx="${idx}">
          <div class="cartItemImg">
            ${item.imageUrl || item.thumbUrl
              ? `<img src="${esc(item.imageUrl || item.thumbUrl)}" alt="${esc(item.name)}" />`
              : `<div class="cartItemPh">${esc((item.brand || "P")[0])}</div>`
            }
          </div>
          <div class="cartItemInfo">
            <h4>${esc(item.name)}</h4>
            <div class="cartItemMeta">
              ${item.brand ? `<span class="chip">${esc(item.brand)}</span>` : ""}
              <span class="chip">${esc(item.providerName || item.providerId)}</span>
            </div>
            <div class="cartItemPrice">
              <span class="priceUnit">${formatMoney(inArs)} c/u</span>
              <span class="priceTotal">${formatMoney(subtotal)}</span>
            </div>
          </div>
          <div class="cartItemActions">
            <div class="qtyControl">
              <button class="qtyBtn" data-action="decrease" data-idx="${idx}">-</button>
              <input type="number" class="qtyInput" value="${qty}" min="1" data-idx="${idx}" />
              <button class="qtyBtn" data-action="increase" data-idx="${idx}">+</button>
            </div>
            <button class="btn btnSmall btnDanger" data-action="remove" data-idx="${idx}">
              Eliminar
            </button>
          </div>
        </div>
      `;
    }).join("");

    const fxForTotals = fxUsdArs || 0;
    const total = calculateTotals(cart, fxForTotals, margen);
    totalEl.textContent = fxUsdArs ? formatMoney(total) : "-";
  }

  async function syncFx({ rerender = false } = {}) {
    await refreshFxUsdArs();
    updateFxUI();
    if (rerender) render();
  }

  itemsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const idx = Number(btn.dataset.idx);
    const cart = getCart();
    const item = cart[idx];
    if (!item) return;

    if (action === "remove") {
      removeFromCart(item.sku, item.providerId);
      render();
    } else if (action === "increase") {
      updateQuantity(item.sku, item.providerId, (item.quantity || 1) + 1);
      render();
    } else if (action === "decrease") {
      updateQuantity(item.sku, item.providerId, Math.max(1, (item.quantity || 1) - 1));
      render();
    }
  });

  itemsContainer.addEventListener("input", (e) => {
    if (e.target.classList.contains("qtyInput")) {
      const idx = Number(e.target.dataset.idx);
      const cart = getCart();
      const item = cart[idx];
      if (item) {
        const newQty = Math.max(1, Number(e.target.value) || 1);
        updateQuantity(item.sku, item.providerId, newQty);
        render();
      }
    }
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("¿Vaciar el carrito?")) {
      clearCart();
      render();
    }
  });

  whatsappBtn.addEventListener("click", () => {
    const cart = getCart();
    const margen = INTERNAL_MARGIN;

    if (!fxUsdArs) {
      alert("No hay FX USD→ARS disponible. Probá de nuevo en unos segundos.");
      return;
    }

    const message = generateWhatsAppMessage(cart, fxUsdArs, margen);
    const tel = "5491123413674";
    window.location.assign(`https://wa.me/${tel}?text=${encodeURIComponent(message)}`);
  });

  pdfBtn.addEventListener("click", () => {
    alert("Exportar a PDF - Próximamente");
  });

  (async () => {
    await syncFx({ rerender: false });
    render();
    // refresco cada 5 min (alineado con cache-control del endpoint)
    setInterval(() => syncFx({ rerender: true }), 300000);
  })();
}
