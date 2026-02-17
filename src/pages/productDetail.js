// File: /src/pages/productDetail.js
// Página de detalle de producto (vista cliente y admin con edición real)

import { getFxUsdArs, getMargin, getMarginFromApi } from '../utils/dataHelpers.js';
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

    if (!res.ok || !data.ok) throw new Error('Error al cargar producto');

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
    const globalMargin = isAdminView ? await getMarginFromApi() : getMargin();
    const base = typeof product.price === 'number' ? product.price : parseFloat(product.price) || 0;
    const iva = typeof product.ivaRate === 'number' ? product.ivaRate : parseFloat(product.ivaRate) || 10.5;
    const currency = String(product.currency || 'USD').toUpperCase();

    // Margen efectivo: override del producto o global
    const effectiveMargin = (product.marginOverride !== null && product.marginOverride !== undefined && product.marginOverride >= 0)
      ? product.marginOverride
      : globalMargin;

    function calcFinalPrice(m) {
      const withIva = base * (1 + iva / 100);
      const withMargin = withIva * (1 + m / 100);
      return currency === 'USD' ? Math.round(withMargin * fx) : Math.round(withMargin);
    }

    const finalPrice = calcFinalPrice(effectiveMargin);

    const priceFormatted = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS'
    }).format(finalPrice);

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
            <button class="btn btnPrimary" id="btnToggleEdit">
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
            ${product.imageUrl
              ? `<img src="${product.imageUrl}" alt="${product.name}" />`
              : `<div class="productNoImage">
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
              <div class="metaItem"><span class="metaLabel">SKU:</span><span class="metaValue">${product.sku}</span></div>
              <div class="metaItem"><span class="metaLabel">Marca:</span><span class="metaValue">${product.brand || 'N/A'}</span></div>
              <div class="metaItem"><span class="metaLabel">Categoría:</span><span class="metaValue">${product.category || 'N/A'}</span></div>
              ${isAdminView ? `
                <div class="metaItem"><span class="metaLabel">Proveedor:</span><span class="metaValue">${product.provider || product.providerId || 'N/A'}</span></div>
                <div class="metaItem"><span class="metaLabel">Stock:</span>
                  <span class="metaValue ${product.stock > 0 ? 'inStock' : 'outOfStock'}">${product.stock || 0} unidades</span>
                </div>
                <div class="metaItem"><span class="metaLabel">Precio Base (${currency}):</span><span class="metaValue">$${base.toFixed(2)}</span></div>
                <div class="metaItem"><span class="metaLabel">IVA:</span><span class="metaValue">${iva}%</span></div>
                <div class="metaItem">
                  <span class="metaLabel">Margen:</span>
                  <span class="metaValue">
                    ${effectiveMargin}%
                    ${product.marginOverride !== null && product.marginOverride !== undefined
                      ? '<span class="overrideBadge">Override</span>'
                      : '<span class="globalBadge">Global</span>'
                    }
                  </span>
                </div>
              ` : ''}
            </div>

            <div class="productDetailPrice">
              <span class="priceLabel">Precio Final:</span>
              <span class="priceValue" id="priceDisplay">${priceFormatted}</span>
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

        ${isAdminView ? `
          <!-- Panel de edición (oculto por default) -->
          <div class="editPanel" id="editPanel" style="display:none;">
            <h2 class="editPanelTitle">Editar Producto</h2>
            <div id="editSaveMsg" class="editSaveMsg"></div>

            <div class="editGrid">
              <div class="editField">
                <label class="editLabel">Nombre</label>
                <input type="text" class="editInput" id="editName" value="${escHtml(product.name || '')}" />
              </div>
              <div class="editField">
                <label class="editLabel">Marca</label>
                <input type="text" class="editInput" id="editBrand" value="${escHtml(product.brand || '')}" />
              </div>
              <div class="editField">
                <label class="editLabel">Categoría</label>
                <input type="text" class="editInput" id="editCategory" value="${escHtml(product.category || '')}" />
              </div>
              <div class="editField">
                <label class="editLabel">Precio Base (${currency})</label>
                <input type="number" class="editInput" id="editPrice" value="${base}" step="0.01" min="0" />
              </div>
              <div class="editField">
                <label class="editLabel">IVA %</label>
                <input type="number" class="editInput" id="editIva" value="${iva}" step="0.1" min="0" />
              </div>
              <div class="editField">
                <label class="editLabel">Stock</label>
                <input type="number" class="editInput" id="editStock" value="${product.stock || 0}" step="1" min="0" />
              </div>
              <div class="editField">
                <label class="editLabel">URL Imagen</label>
                <input type="text" class="editInput" id="editImageUrl" value="${escHtml(product.imageUrl || '')}" placeholder="https://..." />
              </div>

              <!-- Margen override -->
              <div class="editField editFieldFull">
                <label class="editLabel">
                  Margen % para este producto
                  <span class="editLabelHint">(dejá vacío para usar el margen global: ${globalMargin}%)</span>
                </label>
                <div class="marginOverrideRow">
                  <input
                    type="number"
                    class="editInput"
                    id="editMarginOverride"
                    value="${product.marginOverride !== null && product.marginOverride !== undefined ? product.marginOverride : ''}"
                    step="0.1"
                    min="0"
                    max="500"
                    placeholder="Global (${globalMargin}%)"
                  />
                  <button class="btn btnSecondary btnSm" id="btnClearMarginOverride">Usar global</button>
                  <span class="marginPreview" id="marginPreview">
                    Precio estimado: <strong id="marginPreviewPrice">${priceFormatted}</strong>
                  </span>
                </div>
              </div>

              <div class="editField editFieldFull">
                <label class="editLabel">Descripción</label>
                <textarea class="editInput editTextarea" id="editDescription">${escHtml(product.description || '')}</textarea>
              </div>
            </div>

            <div class="editActions">
              <button class="btn btnSecondary" id="btnCancelEdit">Cancelar</button>
              <button class="btn btnPrimary" id="btnSaveProduct">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                </svg>
                Guardar Cambios
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // ---- Wiring ----
    if (!isAdminView) {
      wireClientView(product);
    } else {
      wireAdminEdit(product, base, iva, currency, fx, globalMargin, calcFinalPrice);
    }

  } catch (err) {
    console.error('Error loading product detail:', err);
    container.innerHTML = `
      <div class="productDetailError">
        <h2>Error al cargar</h2>
        <p>Hubo un problema al cargar el producto.</p>
        <a href="${isAdminView ? '/catalogo' : '/tienda'}" data-link class="btn btnPrimary">Volver</a>
      </div>
    `;
  }
}

function wireClientView(product) {
  const btnAddToCart = document.getElementById('btnAddToCart');
  if (!btnAddToCart) return;

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

function wireAdminEdit(product, base, iva, currency, fx, globalMargin, calcFinalPrice) {
  const editPanel = document.getElementById('editPanel');
  const btnToggle = document.getElementById('btnToggleEdit');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnSave = document.getElementById('btnSaveProduct');
  const btnClearOverride = document.getElementById('btnClearMarginOverride');
  const marginOverrideInput = document.getElementById('editMarginOverride');
  const priceInput = document.getElementById('editPrice');
  const ivaInput = document.getElementById('editIva');
  const marginPreviewPrice = document.getElementById('marginPreviewPrice');
  const saveMsg = document.getElementById('editSaveMsg');

  // Toggle edit panel
  btnToggle?.addEventListener('click', () => {
    const isOpen = editPanel.style.display !== 'none';
    editPanel.style.display = isOpen ? 'none' : 'block';
    btnToggle.textContent = isOpen ? 'Editar Producto' : 'Cerrar Editor';
    if (!isOpen) editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  btnCancel?.addEventListener('click', () => {
    editPanel.style.display = 'none';
    btnToggle.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      Editar Producto
    `;
  });

  // Clear margin override
  btnClearOverride?.addEventListener('click', () => {
    if (marginOverrideInput) marginOverrideInput.value = '';
    updatePricePreview();
  });

  // Live price preview
  function updatePricePreview() {
    const overrideVal = parseFloat(marginOverrideInput?.value);
    const effectiveMargin = Number.isFinite(overrideVal) ? overrideVal : globalMargin;
    const baseVal = parseFloat(priceInput?.value) || base;
    const ivaVal = parseFloat(ivaInput?.value) || iva;
    const withIva = baseVal * (1 + ivaVal / 100);
    const withMargin = withIva * (1 + effectiveMargin / 100);
    const finalVal = currency === 'USD' ? Math.round(withMargin * fx) : Math.round(withMargin);
    const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(finalVal);
    if (marginPreviewPrice) marginPreviewPrice.textContent = formatted;
  }

  marginOverrideInput?.addEventListener('input', updatePricePreview);
  priceInput?.addEventListener('input', updatePricePreview);
  ivaInput?.addEventListener('input', updatePricePreview);

  // Save changes
  btnSave?.addEventListener('click', async () => {
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';
    if (saveMsg) { saveMsg.textContent = ''; saveMsg.className = 'editSaveMsg'; }

    try {
      const overrideRaw = document.getElementById('editMarginOverride')?.value;
      const overrideVal = overrideRaw !== '' ? parseFloat(overrideRaw) : null;

      const updates = {
        name: document.getElementById('editName')?.value.trim() || product.name,
        brand: document.getElementById('editBrand')?.value.trim() || '',
        category: document.getElementById('editCategory')?.value.trim() || '',
        price: parseFloat(document.getElementById('editPrice')?.value) || 0,
        ivaRate: parseFloat(document.getElementById('editIva')?.value) || 10.5,
        stock: parseInt(document.getElementById('editStock')?.value) || 0,
        imageUrl: document.getElementById('editImageUrl')?.value.trim() || '',
        description: document.getElementById('editDescription')?.value.trim() || '',
        marginOverride: (overrideVal !== null && Number.isFinite(overrideVal)) ? overrideVal : null,
      };

      const token = localStorage.getItem('tt_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const res = await fetch(`/api/productUpdate?sku=${encodeURIComponent(product.sku)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al guardar');
      }

      if (saveMsg) {
        saveMsg.textContent = '✅ Producto guardado correctamente';
        saveMsg.className = 'editSaveMsg saved';
      }

      // Actualizar precio mostrado
      const overrideFinal = (overrideVal !== null && Number.isFinite(overrideVal)) ? overrideVal : globalMargin;
      const newBase = updates.price;
      const newIva = updates.ivaRate;
      const withIva = newBase * (1 + newIva / 100);
      const withMargin = withIva * (1 + overrideFinal / 100);
      const newFinal = currency === 'USD' ? Math.round(withMargin * fx) : Math.round(withMargin);
      const newFormatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(newFinal);
      const priceDisplay = document.getElementById('priceDisplay');
      if (priceDisplay) priceDisplay.textContent = newFormatted;

    } catch (err) {
      console.error('Error saving product:', err);
      if (saveMsg) {
        saveMsg.textContent = `❌ ${err.message}`;
        saveMsg.className = 'editSaveMsg error';
      }
    }

    btnSave.disabled = false;
    btnSave.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
      </svg>
      Guardar Cambios
    `;
  });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}