// File: /src/components/cart.js
/**
 * Carrito de Cotización
 * Permite guardar productos para consultar después
 */

const CART_KEY = "toval_cart";
const LEGACY_CART_KEY = "tovaltech_cart";
const LISTS_KEY = "tovaltech_cart_lists";

export function getCart() {
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

    return [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  localStorage.removeItem(LEGACY_CART_KEY);
  dispatchCartUpdate();
}

export function addToCart(product) {
  const cart = getCart();
  const exists = cart.find(p => p.sku === product.sku && p.providerId === product.providerId);
  
  if (!exists) {
    cart.push({
      ...product,
      addedAt: Date.now(),
      quantity: 1
    });
    saveCart(cart);
    return true;
  }
  return false;
}

export function removeFromCart(sku, providerId) {
  const cart = getCart();
  const filtered = cart.filter(p => !(p.sku === sku && p.providerId === providerId));
  saveCart(filtered);
}

export function clearCart() {
  saveCart([]);
}

export function updateQuantity(sku, providerId, quantity) {
  const cart = getCart();
  const item = cart.find(p => p.sku === sku && p.providerId === providerId);
  if (item) {
    item.quantity = Math.max(1, quantity);
    saveCart(cart);
  }
}

// Sistema de listas múltiples
export function getLists() {
  try {
    const data = localStorage.getItem(LISTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function createList(name) {
  const lists = getLists();
  const newList = {
    id: `list_${Date.now()}`,
    name,
    items: [],
    createdAt: Date.now()
  };
  lists.push(newList);
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  return newList;
}

export function saveToList(listId, product) {
  const lists = getLists();
  const list = lists.find(l => l.id === listId);
  if (list) {
    const exists = list.items.find(p => p.sku === product.sku && p.providerId === product.providerId);
    if (!exists) {
      list.items.push(product);
      localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    }
  }
}

export function deleteList(listId) {
  const lists = getLists();
  const filtered = lists.filter(l => l.id !== listId);
  localStorage.setItem(LISTS_KEY, JSON.stringify(filtered));
}

// Event system para actualizar UI
function dispatchCartUpdate() {
  window.dispatchEvent(new CustomEvent("cartUpdated", {
    detail: {
      count: getCart().reduce((sum, item) => sum + (item.quantity || 1), 0)
    }
  }));
}

// Calcular totales
export function calculateTotals(cart, fx = 1420, margen = 25) {
  let total = 0;
  
  for (const item of cart) {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const iva = item.ivaRate || 10.5;
    
    const withIva = price * (1 + iva / 100);
    const withMargen = withIva * (1 + margen / 100);
    
    let inArs = withMargen;
    if (String(item.currency).toUpperCase() === "USD") {
      inArs = withMargen * fx;
    }
    
    total += inArs * qty;
  }
  
  return total;
}

// Generar WhatsApp message
export function generateWhatsAppMessage(cart, fx, margen) {
  const items = cart.map((item, idx) => {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const iva = item.ivaRate || 10.5;
    
    const withIva = price * (1 + iva / 100);
    const withMargen = withIva * (1 + margen / 100);
    
    let inArs = withMargen;
    if (String(item.currency).toUpperCase() === "USD") {
      inArs = withMargen * fx;
    }
    
    const formatted = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS"
    }).format(inArs * qty);
    
    return `${idx + 1}. ${item.name} (x${qty}) - ${formatted}`;
  }).join("\n");
  
  const total = calculateTotals(cart, fx, margen);
  const totalFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(total);
  
  return `Hola! Me gustaría consultar por los siguientes productos:\n\n${items}\n\n*TOTAL ESTIMADO: ${totalFormatted}*\n\n¿Están disponibles?`;
}

// Renderizar badge del carrito
export function renderCartBadge() {
  const count = getCart().reduce((sum, item) => sum + (item.quantity || 1), 0);
  if (count === 0) return "";
  
  return `<span class="cartBadge">${count}</span>`;
}
