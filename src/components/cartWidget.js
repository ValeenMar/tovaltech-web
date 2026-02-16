// File: /src/components/cartWidget.js
// Widget de carrito flotante en navbar

export function initCartWidget() {
  const cart = getCart();
  const itemCount = cart.items.length;
  
  // Crear icono de carrito en navbar
  const nav = document.querySelector('.nav');
  if (!nav) return;
  
  // Buscar si ya existe
  let cartIcon = document.getElementById('cartIcon');
  if (!cartIcon) {
    cartIcon = document.createElement('a');
    cartIcon.id = 'cartIcon';
    cartIcon.href = '/cart';
    cartIcon.setAttribute('data-link', '');
    cartIcon.className = 'cartIcon';
    cartIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 2L7 6H3l3 14h12l3-14h-4l-2-4H9z"/>
        <circle cx="9" cy="21" r="1"/>
        <circle cx="15" cy="21" r="1"/>
      </svg>
      <span class="cartCount">${itemCount}</span>
    `;
    
    // Insertar antes de los links de admin
    const settingsLink = nav.querySelector('[href="/settings"]');
    if (settingsLink) {
      nav.insertBefore(cartIcon, settingsLink);
    } else {
      nav.appendChild(cartIcon);
    }
  } else {
    // Actualizar contador
    const countSpan = cartIcon.querySelector('.cartCount');
    if (countSpan) {
      countSpan.textContent = itemCount;
    }
  }
}

export function getCart() {
  try {
    const data = localStorage.getItem('tovaltech_cart');
    return data ? JSON.parse(data) : { items: [], total: 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

export function saveCart(cart) {
  localStorage.setItem('tovaltech_cart', JSON.stringify(cart));
  initCartWidget(); // Actualizar contador
}

export function addToCart(product, quantity = 1) {
  const cart = getCart();
  
  // Buscar si ya existe
  const existing = cart.items.find(item => item.sku === product.sku);
  
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({
      sku: product.sku,
      name: product.name,
      price: product.price,
      priceWithMargin: product.priceWithMargin || product.price,
      currency: product.currency,
      imageUrl: product.imageUrl,
      providerId: product.providerId,
      quantity: quantity
    });
  }
  
  saveCart(cart);
  
  // Mostrar notificación
  showCartNotification(`Agregado al carrito: ${product.name}`);
}

export function removeFromCart(sku) {
  const cart = getCart();
  cart.items = cart.items.filter(item => item.sku !== sku);
  saveCart(cart);
}

export function updateCartQuantity(sku, quantity) {
  const cart = getCart();
  const item = cart.items.find(i => i.sku === sku);
  
  if (item) {
    if (quantity <= 0) {
      removeFromCart(sku);
    } else {
      item.quantity = quantity;
      saveCart(cart);
    }
  }
}

export function clearCart() {
  saveCart({ items: [], total: 0 });
}

function showCartNotification(message) {
  // Crear notificación temporal
  const notif = document.createElement('div');
  notif.className = 'cartNotification';
  notif.textContent = message;
  document.body.appendChild(notif);
  
  setTimeout(() => notif.classList.add('show'), 10);
  
  setTimeout(() => {
    notif.classList.remove('show');
    setTimeout(() => notif.remove(), 300);
  }, 2000);
}
