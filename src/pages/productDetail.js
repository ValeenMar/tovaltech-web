// File: /src/pages/productDetail.js
// Página de detalle de producto (vista cliente y admin)

import { getFxUsdArs, getMargin } from '../utils/dataHelpers.js';
import { addToCart } from '../components/cart.js';

export function ProductDetailPage() {
  return `
    <div class="productDetailContainer">
      <div class="productDetailLoading">
        <div class="loading">Cargando producto...</div>
      </div>
    </div>
  `;
}

export async function wireProductDetail(sku, isAdminView = false) {
  const container = document.querySelector('.productDetailContainer');
  if (!container) return;

  try {
    const res = await fetch(`/api/product?sku=${encodeURIComponent(sku)}`);
    const data = await res.json();
    
    if (!res.ok || !data.ok) {
      throw new Error('Error al cargar producto');
    }

    const product = data.item || null;

    if (!product) {
      container.innerHTML = `
        <div class="productDetailError">
          <h2>Producto no encontrado</h2>
          <p>El producto "${sku}" no existe o fue eliminado.</p>
          <a href="${isAdminView ? '/catalogo' : '/tienda'}" data-link class="btn btnPrimary">
            Volver al ${isAdminView ? 'Catálogo' : 'Tienda'}
          </a>
        </div>
      `;
      return;
    }

    // Calcular precio
    const fx = await getFxUsdArs();
    const margin = getMargin();
    const base = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
    const iva = typeof product.ivaRate === 'number' ? product.ivaRate : parseFloat(product.ivaRate) || 10.5;
    
    const withIva = base * (1 + iva / 100);
    const withMargin = withIva * (1 + margin / 100);
    
    let finalPrice = withMargin;
    const currency = String(product.currency || 'USD').toUpperCase();
    if (currency === 'USD') {
      finalPrice = withMargin * fx;
    }

    const priceFormatted = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(Math.round(finalPrice));

    // Renderizar detalle
    container.innerHTML = `
      <div class="productDetail">
        <div class="productDetailHeader">
          <a href="${isAdminView ? '/catalogo' : '/tienda'}" data-link class="btnBack">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Volver
          </a>
          ${isAdminView ? `
            <button class="btn btnPrimary" id="btnEditProduct">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar Producto
            </button>
          ` : ''}
        </div>

        <div class="productDetailContent">
          <div class="productDetailImage">
            ${product.imageUrl ? 
              `<img src="${product.imageUrl}" alt="${product.name}" />` : 
              `<div class="productNoImage">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>`
            }
          </div>

          <div class="productDetailInfo">
            <h1>${product.name}</h1>
            
            <div class="productDetailMeta">
              <div class="metaItem">
                <span class="metaLabel">SKU:</span>
                <span class="metaValue">${product.sku}</span>
              </div>
              <div class="metaItem">
                <span class="metaLabel">Marca:</span>
                <span class="metaValue">${product.brand || 'N/A'}</span>
              </div>
              <div class="metaItem">
                <span class="metaLabel">Categoría:</span>
                <span class="metaValue">${product.category || 'N/A'}</span>
              </div>
              ${isAdminView ? `
                <div class="metaItem">
                  <span class="metaLabel">Proveedor:</span>
                  <span class="metaValue">${product.provider || product.providerId || 'N/A'}</span>
                </div>
                <div class="metaItem">
                  <span class="metaLabel">Stock:</span>
                  <span class="metaValue ${product.stock > 0 ? 'inStock' : 'outOfStock'}">
                    ${product.stock || 0} unidades
                  </span>
                </div>
                <div class="metaItem">
                  <span class="metaLabel">Precio Base (${currency}):</span>
                  <span class="metaValue">$${base.toFixed(2)}</span>
                </div>
                <div class="metaItem">
                  <span class="metaLabel">IVA:</span>
                  <span class="metaValue">${iva}%</span>
                </div>
                <div class="metaItem">
                  <span class="metaLabel">Margen:</span>
                  <span class="metaValue">${margin}%</span>
                </div>
              ` : ''}
            </div>

            <div class="productDetailPrice">
              <span class="priceLabel">Precio Final:</span>
              <span class="priceValue">${priceFormatted}</span>
              <span class="priceIva">IVA incluido</span>
            </div>

            ${!isAdminView ? `
              <div class="productDetailActions">
                <button class="btn btnPrimary btnLarge" id="btnAddToCart">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                  Agregar al Carrito
                </button>
              </div>
            ` : ''}

            ${product.description ? `
              <div class="productDetailDescription">
                <h3>Descripción</h3>
                <p>${product.description}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // Wire eventos
    if (!isAdminView) {
      const btnAddToCart = document.getElementById('btnAddToCart');
      if (btnAddToCart) {
        btnAddToCart.addEventListener('click', () => {
          const added = addToCart(product);
          if (added) {
            btnAddToCart.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Agregado al Carrito
            `;
            btnAddToCart.disabled = true;
            setTimeout(() => {
              btnAddToCart.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Agregar al Carrito
              `;
              btnAddToCart.disabled = false;
            }, 2000);
          }
        });
      }
    } else {
      const btnEditProduct = document.getElementById('btnEditProduct');
      if (btnEditProduct) {
        btnEditProduct.addEventListener('click', () => {
          alert(
            `Editar Producto\n\n` +
            `SKU: ${product.sku}\n` +
            `Nombre: ${product.name}\n` +
            `Marca: ${product.brand}\n` +
            `Categoría: ${product.category}\n` +
            `Proveedor: ${product.provider || product.providerId}\n` +
            `Precio: ${currency} ${base}\n` +
            `Stock: ${product.stock}\n\n` +
            `Próximamente: Modal de edición completo.\n` +
            `Por ahora, editá el producto reimportando el CSV con los cambios.`
          );
        });
      }
    }

  } catch (err) {
    console.error('Error loading product detail:', err);
    container.innerHTML = `
      <div class="productDetailError">
        <h2>Error al cargar</h2>
        <p>Hubo un problema al cargar el producto.</p>
        <a href="${isAdminView ? '/catalogo' : '/tienda'}" data-link class="btn btnPrimary">
          Volver
        </a>
      </div>
    `;
  }
}
