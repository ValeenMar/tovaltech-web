// File: /src/pages/cart.js
// Página del carrito de compras

import { getCart, removeFromCart, updateCartQuantity, clearCart } from "../components/cartWidget.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function CartPage() {
  return `
    <section class="page cartPage">
      <h1>🛒 Carrito de Compras</h1>
      <div id="cartContent"></div>
    </section>
  `;
}

export async function wireCart(root) {
  const contentDiv = root.querySelector("#cartContent");
  if (!contentDiv) return;
  
  // Obtener cotización dólar
  let dollarRate = 1200; // Fallback
  try {
    const res = await fetch("/api/dollar-rate");
    const data = await res.json();
    if (data.ok) {
      dollarRate = data.venta;
    }
  } catch (err) {
    console.log("No se pudo obtener cotización, usando fallback");
  }
  
  const renderCart = () => {
    const cart = getCart();
    
    if (cart.items.length === 0) {
      contentDiv.innerHTML = `
        <div class="emptyCart">
          <p>Tu carrito está vacío</p>
          <a href="/catalogo" class="btn btnPrimary" data-link>Ver Catálogo</a>
        </div>
      `;
      return;
    }
    
    // Calcular totales
    let totalUSD = 0;
    cart.items.forEach(item => {
      const price = item.priceWithMargin || item.price;
      totalUSD += price * item.quantity;
    });
    
    const totalARS = totalUSD * dollarRate;
    const iva = totalUSD * 0.21;
    const totalWithIVA = totalUSD + iva;
    const totalARSWithIVA = totalWithIVA * dollarRate;
    
    contentDiv.innerHTML = `
      <div class="cartGrid">
        <div class="cartItems">
          <h2>Productos (${cart.items.length})</h2>
          ${cart.items.map((item, idx) => {
            const itemPrice = item.priceWithMargin || item.price;
            const itemTotal = itemPrice * item.quantity;
            
            return `
              <div class="cartItem" data-sku="${esc(item.sku)}">
                <div class="cartItemImg">
                  ${item.imageUrl 
                    ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.name)}" />` 
                    : `<div class="cartItemPh">${esc(item.name[0])}</div>`
                  }
                </div>
                <div class="cartItemInfo">
                  <h3>${esc(item.name)}</h3>
                  <p class="muted">SKU: ${esc(item.sku)}</p>
                  <p class="cartItemPrice">USD ${itemPrice.toFixed(2)}</p>
                </div>
                <div class="cartItemQty">
                  <button class="btnQty" data-action="decrease" data-sku="${esc(item.sku)}">−</button>
                  <input type="number" value="${item.quantity}" min="1" max="999" 
                         data-sku="${esc(item.sku)}" class="qtyInput" />
                  <button class="btnQty" data-action="increase" data-sku="${esc(item.sku)}">+</button>
                </div>
                <div class="cartItemTotal">
                  <p><strong>USD ${itemTotal.toFixed(2)}</strong></p>
                  <p class="muted">ARS ${(itemTotal * dollarRate).toLocaleString('es-AR')}</p>
                </div>
                <button class="btnRemove" data-sku="${esc(item.sku)}" title="Eliminar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
                  </svg>
                </button>
              </div>
            `;
          }).join('')}
          
          <button class="btn btnSecondary" id="clearCart">
            Vaciar Carrito
          </button>
        </div>
        
        <div class="cartSummary">
          <h2>Resumen</h2>
          
          <div class="summaryRow">
            <span>Subtotal:</span>
            <span>USD ${totalUSD.toFixed(2)}</span>
          </div>
          
          <div class="summaryRow">
            <span>IVA (21%):</span>
            <span>USD ${iva.toFixed(2)}</span>
          </div>
          
          <div class="summaryRow summaryTotal">
            <span><strong>Total USD:</strong></span>
            <span><strong>USD ${totalWithIVA.toFixed(2)}</strong></span>
          </div>
          
          <div class="summaryRow summaryTotal">
            <span><strong>Total ARS:</strong></span>
            <span><strong>$ ${totalARSWithIVA.toLocaleString('es-AR')}</strong></span>
          </div>
          
          <p class="muted summaryNote">
            Tipo de cambio: $ ${dollarRate.toLocaleString('es-AR')} (BNA Venta)
          </p>
          
          <hr />
          
          <div class="cartActions">
            <button class="btn btnPrimary btnBlock" id="btnCheckout">
              💳 Finalizar Compra
            </button>
            
            <button class="btn btnSecondary btnBlock" id="btnWhatsApp">
              💬 Consultar por WhatsApp
            </button>
            
            <button class="btn btnSecondary btnBlock" id="btnEmail">
              📧 Enviar por Email
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Event listeners
    wireCartEvents(renderCart, dollarRate);
  };
  
  renderCart();
}

function wireCartEvents(renderCart, dollarRate) {
  const contentDiv = document.getElementById("cartContent");
  if (!contentDiv) return;
  
  // Botones de cantidad
  contentDiv.querySelectorAll('.btnQty').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const sku = btn.dataset.sku;
      const cart = getCart();
      const item = cart.items.find(i => i.sku === sku);
      
      if (item) {
        if (action === 'increase') {
          updateCartQuantity(sku, item.quantity + 1);
        } else if (action === 'decrease') {
          updateCartQuantity(sku, Math.max(1, item.quantity - 1));
        }
        renderCart();
      }
    });
  });
  
  // Input de cantidad
  contentDiv.querySelectorAll('.qtyInput').forEach(input => {
    input.addEventListener('change', () => {
      const sku = input.dataset.sku;
      const qty = Math.max(1, parseInt(input.value) || 1);
      updateCartQuantity(sku, qty);
      renderCart();
    });
  });
  
  // Botones eliminar
  contentDiv.querySelectorAll('.btnRemove').forEach(btn => {
    btn.addEventListener('click', () => {
      const sku = btn.dataset.sku;
      removeFromCart(sku);
      renderCart();
    });
  });
  
  // Vaciar carrito
  const clearBtn = contentDiv.querySelector('#clearCart');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('¿Estás seguro de vaciar el carrito?')) {
        clearCart();
        renderCart();
      }
    });
  }
  
  // Checkout
  const checkoutBtn = contentDiv.querySelector('#btnCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      // Verificar si está logueado
      const token = localStorage.getItem('tovaltech_auth');
      if (!token) {
        alert('Debes iniciar sesión para finalizar la compra');
        window.location.href = '/login?next=/cart';
      } else {
        window.location.href = '/checkout';
      }
    });
  }
  
  // WhatsApp
  const whatsappBtn = contentDiv.querySelector('#btnWhatsApp');
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const cart = getCart();
      const message = generateWhatsAppMessage(cart, dollarRate);
      const phone = '5491123413674'; // WhatsApp Valentín
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    });
  }
  
  // Email
  const emailBtn = contentDiv.querySelector('#btnEmail');
  if (emailBtn) {
    emailBtn.addEventListener('click', () => {
      const cart = getCart();
      const message = generateEmailMessage(cart, dollarRate);
      const emails = 'valentin@toval-tech.com,tobias@toval-tech.com';
      const subject = 'Cotización - TovalTech';
      const url = `mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.location.href = url;
    });
  }
}

function generateWhatsAppMessage(cart, dollarRate) {
  let msg = '*Consulta desde TovalTech*\n\n';
  msg += '*Productos:*\n';
  
  cart.items.forEach(item => {
    const price = item.priceWithMargin || item.price;
    msg += `• ${item.name}\n`;
    msg += `  SKU: ${item.sku}\n`;
    msg += `  Cantidad: ${item.quantity}\n`;
    msg += `  Precio: USD ${price.toFixed(2)}\n\n`;
  });
  
  const total = cart.items.reduce((sum, item) => {
    const price = item.priceWithMargin || item.price;
    return sum + (price * item.quantity);
  }, 0);
  
  const totalWithIVA = total * 1.21;
  
  msg += `*Total USD:* ${totalWithIVA.toFixed(2)}\n`;
  msg += `*Total ARS:* $ ${(totalWithIVA * dollarRate).toLocaleString('es-AR')}\n`;
  msg += `\n_Tipo de cambio: $ ${dollarRate.toLocaleString('es-AR')}_`;
  
  return msg;
}

function generateEmailMessage(cart, dollarRate) {
  let msg = 'Solicito cotización para los siguientes productos:\n\n';
  
  cart.items.forEach(item => {
    const price = item.priceWithMargin || item.price;
    msg += `- ${item.name}\n`;
    msg += `  SKU: ${item.sku}\n`;
    msg += `  Cantidad: ${item.quantity}\n`;
    msg += `  Precio unitario: USD ${price.toFixed(2)}\n\n`;
  });
  
  const total = cart.items.reduce((sum, item) => {
    const price = item.priceWithMargin || item.price;
    return sum + (price * item.quantity);
  }, 0);
  
  const totalWithIVA = total * 1.21;
  
  msg += `\nTotal estimado USD: ${totalWithIVA.toFixed(2)}\n`;
  msg += `Total estimado ARS: $ ${(totalWithIVA * dollarRate).toLocaleString('es-AR')}\n`;
  msg += `\nTipo de cambio referencia: $ ${dollarRate.toLocaleString('es-AR')} (BNA)\n`;
  msg += '\nQuedo a la espera de su respuesta.\nSaludos!';
  
  return msg;
}
