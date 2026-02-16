// File: /src/components/ProductCard.js
// Componente único de tarjeta de producto (reutilizable en tienda y catálogo)

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function ProductCard(product, options = {}) {
  const {
    mode = 'client', // 'client' | 'admin'
    onAddToCart = null,
    onEdit = null,
    showAdminActions = false
  } = options;
  
  const hasStock = product.stock > 0;
  const img = product.imageUrl || product.thumbUrl;
  
  // Precio calculado (ya viene con finalPrice desde el helper)
  const priceDisplay = product.finalPrice 
    ? `<div class="productPrice">
         <span class="priceMain">${formatMoney(product.finalPrice, 'ARS')}</span>
         <span class="priceLabel">IVA incluido</span>
       </div>`
    : `<div class="productPrice">
         <span class="priceLabel">Consultar</span>
       </div>`;
  
  return `
    <div class="productCard ${!hasStock ? 'outOfStock' : ''}" data-sku="${esc(product.sku)}">
      ${!hasStock ? '<div class="stockBadge">Sin Stock</div>' : ''}
      
      <div class="productImage">
        ${img 
          ? `<img src="${esc(img)}" alt="${esc(product.name)}" loading="lazy" />`
          : `<div class="imagePlaceholder">${esc((product.brand || product.name || '?')[0])}</div>`
        }
      </div>
      
      <div class="productInfo">
        <h3 class="productName">${esc(product.name || 'Producto')}</h3>
        
        ${product.brand ? `<p class="productBrand">${esc(product.brand)}</p>` : ''}
        
        ${mode === 'admin' && product.provider 
          ? `<p class="productProvider">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                 <circle cx="12" cy="7" r="4"/>
               </svg>
               ${esc(product.provider)}
             </p>`
          : ''
        }
        
        ${priceDisplay}
        
        ${hasStock && mode === 'client' && onAddToCart
          ? `<button class="btnAddToCart" data-sku="${esc(product.sku)}">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                 <circle cx="9" cy="21" r="1"/>
                 <circle cx="20" cy="21" r="1"/>
                 <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
               </svg>
               Agregar al carrito
             </button>`
          : ''
        }
        
        ${showAdminActions
          ? `<div class="productActions">
               <button class="btnAction btnEdit" data-action="edit" data-sku="${esc(product.sku)}">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                   <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                 </svg>
                 Editar
               </button>
               <button class="btnAction btnDelete" data-action="delete" data-sku="${esc(product.sku)}">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                   <polyline points="3 6 5 6 21 6"/>
                   <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                 </svg>
                 Eliminar
               </button>
             </div>`
          : ''
        }
      </div>
    </div>
  `;
}

function formatMoney(amount, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('es-AR')}`;
  }
}

export function wireProductCards(container, options = {}) {
  const { onAddToCart, onEdit, onDelete } = options;
  
  if (!container) return;
  
  // Wire "Agregar al carrito"
  if (onAddToCart) {
    container.querySelectorAll('.btnAddToCart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sku = btn.dataset.sku;
        if (sku) onAddToCart(sku);
      });
    });
  }
  
  // Wire admin actions
  if (onEdit || onDelete) {
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const sku = btn.dataset.sku;
        
        if (action === 'edit' && onEdit && sku) {
          onEdit(sku);
        } else if (action === 'delete' && onDelete && sku) {
          if (confirm('¿Eliminar este producto?')) {
            onDelete(sku);
          }
        }
      });
    });
  }
  
  // Click en card completa (ir a detalle)
  container.querySelectorAll('.productCard').forEach(card => {
    card.addEventListener('click', () => {
      const sku = card.dataset.sku;
      if (sku) {
        window.location.href = `/producto/${encodeURIComponent(sku)}`;
      }
    });
  });
}
