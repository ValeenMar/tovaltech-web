// File: /src/bootstrap/uiInit.js
// Inicializacion de UI global (tema, menu usuario, carrito drawer)

const CART_KEY = 'toval_cart';
const LEGACY_CART_KEY = 'tovaltech_cart';
const WHATSAPP_PHONE = '5491123413674';
let cartFxUsdArs = 1200;
let cartFxAt = 0;

function getAuthHeaders() {
  const token = localStorage.getItem('tt_token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readCartItems() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    }

    const legacy = localStorage.getItem(LEGACY_CART_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy)) {
        localStorage.setItem(CART_KEY, JSON.stringify(parsedLegacy));
        return parsedLegacy;
      }
      if (parsedLegacy && Array.isArray(parsedLegacy.items)) {
        localStorage.setItem(CART_KEY, JSON.stringify(parsedLegacy.items));
        return parsedLegacy.items;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

function saveCartItems(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  localStorage.removeItem(LEGACY_CART_KEY);
  window.dispatchEvent(new CustomEvent('cartUpdated'));
}

function getCartCount() {
  const cart = readCartItems();
  return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
}

function updateCartBadge() {
  const total = getCartCount();
  const badge = document.querySelector('.cartBadge');
  if (!badge) return;

  badge.textContent = String(total);
  badge.classList.toggle('isEmpty', total <= 0);
}

function formatMoney(amount) {
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUsd(amount) {
  if (!Number.isFinite(amount)) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getItemFinalPrice(item) {
  const direct = Number(item.finalPrice);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const base = Number(item.price);
  if (!Number.isFinite(base) || base <= 0) return 0;

  const ivaRate = Number(item.ivaRate);
  const iva = Number.isFinite(ivaRate) ? ivaRate : 10.5;
  const withIva = base * (1 + iva / 100);
  return Math.round(withIva);
}

function getItemUsdWithIva(item) {
  const base = Number(item.price);
  if (!Number.isFinite(base) || base <= 0) return null;

  const ivaRate = Number(item.ivaRate);
  const iva = Number.isFinite(ivaRate) ? ivaRate : 10.5;
  const withIva = base * (1 + iva / 100);
  const currency = String(item.currency || 'USD').toUpperCase();

  if (currency === 'USD') return withIva;
  if (currency === 'ARS' && cartFxUsdArs > 0) return withIva / cartFxUsdArs;
  return null;
}

function getItemArsFinal(item) {
  const direct = Number(item.finalPrice);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const usdWithIva = getItemUsdWithIva(item);
  if (Number.isFinite(usdWithIva) && cartFxUsdArs > 0) {
    return Math.round(usdWithIva * cartFxUsdArs);
  }

  return getItemFinalPrice(item);
}

function getItemImage(item) {
  const raw = item?.imageUrl || item?.thumbUrl || '';
  const value = String(raw || '').trim();
  if (!value) return null;
  return value;
}

async function ensureCartFxFresh() {
  const now = Date.now();
  if (now - cartFxAt < 5 * 60 * 1000) return;

  try {
    const res = await fetch('/api/dollar-rate', { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    const value = Number(data?.venta);
    if (res.ok && Number.isFinite(value) && value > 0) {
      cartFxUsdArs = value;
      cartFxAt = now;
    }
  } catch {
    // keep last known fx
  }
}

function buildWhatsAppMessage(cart) {
  if (!cart.length) {
    return encodeURIComponent('Hola! Quiero consultar por productos.');
  }

  let message = 'Hola! Quiero consultar por estos productos:\n\n';
  let total = 0;

  cart.forEach((item, idx) => {
    const qty = item.quantity || 1;
    const unit = getItemFinalPrice(item);
    const subtotal = unit * qty;
    total += subtotal;

    message += `${idx + 1}. ${item.name || 'Producto'}\n`;
    if (item.brand) message += `   Marca: ${item.brand}\n`;
    message += `   SKU: ${item.sku || '-'}\n`;
    message += `   Cantidad: ${qty}\n`;
    message += `   Subtotal: ${formatMoney(subtotal)}\n\n`;
  });

  message += `Total estimado: ${formatMoney(total)}\n\n`;
  message += 'Quedo atento a disponibilidad. Gracias!';

  return encodeURIComponent(message);
}

function ensureCartDrawer() {
  if (document.getElementById('cartDrawer')) return;

  const host = document.createElement('div');
  host.innerHTML = `
    <div class="cartDrawerOverlay" id="cartDrawerOverlay" hidden></div>
    <aside class="cartDrawer" id="cartDrawer" aria-hidden="true">
      <div class="cartDrawerHeader">
        <h3>Tu carrito</h3>
        <button class="cartDrawerCloseBtn" id="cartDrawerClose" type="button" aria-label="Cerrar carrito">×</button>
      </div>
      <div class="cartDrawerBody" id="cartDrawerBody"></div>
      <div class="cartDrawerFooter" id="cartDrawerFooter"></div>
    </aside>
  `;

  document.body.appendChild(host);
}

function renderCartDrawer() {
  const body = document.getElementById('cartDrawerBody');
  const footer = document.getElementById('cartDrawerFooter');
  if (!body || !footer) return;

  const cart = readCartItems();
  if (!cart.length) {
    body.innerHTML = '<p class="muted">Tu carrito esta vacio.</p>';
    footer.innerHTML = '<a href="/tienda" data-link class="btn btnPrimary" id="cartDrawerGoStore">Ir a tienda</a>';
    return;
  }

  let total = 0;
  body.innerHTML = cart.map((item, idx) => {
    const qty = item.quantity || 1;
    const unit = getItemArsFinal(item);
    const usdWithIva = getItemUsdWithIva(item);
    const subtotal = unit * qty;
    const img = getItemImage(item);
    total += subtotal;

    return `
      <div class="cartDrawerItem" data-idx="${idx}">
        <div class="cartDrawerItemThumb">
          ${img
            ? `<img src="${esc(img)}" alt="${esc(item.name || 'Producto')}" loading="lazy" />`
            : `<div class="cartDrawerItemPh">${esc((item.brand || item.name || 'P')[0])}</div>`
          }
        </div>
        <div class="cartDrawerItemMain">
          <strong>${esc(item.name || 'Producto')}</strong>
          <span class="muted">SKU: ${esc(item.sku || '-')}</span>
          <span class="cartDrawerUsd">USD (IVA incl.): ${usdWithIva ? formatUsd(usdWithIva * qty) : '-'}</span>
          <span class="cartDrawerArs">${formatMoney(subtotal)}</span>
        </div>
        <div class="cartDrawerQty">
          <button type="button" class="cartDrawerQtyBtn" data-cart-action="dec" data-idx="${idx}" aria-label="Restar unidad">-</button>
          <span class="cartDrawerQtyValue">${qty}</span>
          <button type="button" class="cartDrawerQtyBtn" data-cart-action="inc" data-idx="${idx}" aria-label="Sumar unidad">+</button>
          <button type="button" class="cartDrawerRemoveBtn" data-cart-action="remove" data-idx="${idx}">Quitar</button>
        </div>
      </div>
    `;
  }).join('');

  footer.innerHTML = `
    <div class="cartDrawerTotal">
      <span>Total</span>
      <strong>${formatMoney(total)}</strong>
    </div>
    <button type="button" class="btn btnPrimary cartDrawerWhatsAppBtn" id="cartDrawerWhatsApp">Consultar por WhatsApp</button>
  `;
}

async function openCartDrawer() {
  ensureCartDrawer();
  await ensureCartFxFresh();
  renderCartDrawer();

  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');
  if (!drawer || !overlay) return;

  overlay.hidden = false;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');
  if (!drawer || !overlay) return;

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.hidden = true;
}

function mutateCartItem(action, idx) {
  const cart = readCartItems();
  const item = cart[idx];
  if (!item) return;

  if (action === 'remove') {
    cart.splice(idx, 1);
  } else if (action === 'inc') {
    item.quantity = (item.quantity || 1) + 1;
  } else if (action === 'dec') {
    item.quantity = Math.max(1, (item.quantity || 1) - 1);
  }

  saveCartItems(cart);
  renderCartDrawer();
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: getAuthHeaders() });
  } catch {
    // ignore
  }
  localStorage.removeItem('tt_token');
  window.location.href = '/';
}

async function updateUserMenu() {
  const userMenu = document.getElementById('userMenu');
  if (!userMenu) return;

  let displayName = null;
  let role = null;

  try {
    const res = await fetch('/api/me', {
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      const user = data?.user || {};
      displayName = user.name || user.email || null;
      role = user.role || null;
    }
  } catch {
    // ignore
  }

  if (!displayName) {
    userMenu.innerHTML = '<a href="/login" data-link class="btn btnPrimary">Ingresar</a>';
    return;
  }

  userMenu.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 14px; color: var(--text-secondary);">
        ${esc(displayName || 'Usuario')}${role === 'admin' ? ' (Admin)' : ''}
      </span>
      <button class="btn btnSecondary" data-logout>Salir</button>
    </div>
  `;
}

function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  const savedTheme = localStorage.getItem('toval_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  themeToggle?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('toval_theme', next);
  });
}

function initGlobalHandlers() {
  document.addEventListener('click', (event) => {
    const logoutBtn = event.target.closest('[data-logout]');
    if (logoutBtn) {
      event.preventDefault();
      logout();
      return;
    }

    const cartOpen = event.target.closest('.cartIcon a, #cartOpenBtn');
    if (cartOpen) {
      event.preventDefault();
      openCartDrawer();
      return;
    }

    if (event.target.closest('#cartDrawerOverlay') || event.target.closest('#cartDrawerClose')) {
      event.preventDefault();
      closeCartDrawer();
      return;
    }

    const actionBtn = event.target.closest('[data-cart-action]');
    if (actionBtn) {
      event.preventDefault();
      const action = actionBtn.dataset.cartAction;
      const idx = Number.parseInt(actionBtn.dataset.idx || '', 10);
      if (!Number.isFinite(idx)) return;
      mutateCartItem(action, idx);
      return;
    }

    const waBtn = event.target.closest('#cartDrawerWhatsApp');
    if (waBtn) {
      event.preventDefault();
      const message = buildWhatsAppMessage(readCartItems());
      window.location.assign(`https://wa.me/${WHATSAPP_PHONE}?text=${message}`);
      return;
    }
  });

  window.addEventListener('cartUpdated', () => {
    updateCartBadge();
    renderCartDrawer();
  });
}

function initUiShell() {
  initThemeToggle();
  initGlobalHandlers();
  ensureCartDrawer();
  ensureCartFxFresh();
  updateCartBadge();
  renderCartDrawer();
  updateUserMenu();
}

window.updateUserMenu = updateUserMenu;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUiShell, { once: true });
} else {
  initUiShell();
}