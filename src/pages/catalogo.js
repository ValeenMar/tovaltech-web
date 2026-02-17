// File: /src/pages/catalogo.js
// Catalogo admin con paginacion server-side, margen global via API y subcategorías

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin, getMarginFromApi, saveMarginToApi, classifyProduct } from '../utils/dataHelpers.js';
import { getAuthHeaders } from '../utils/authHelper.js';

let pageProducts = [];       // productos de la página actual (ya enriquecidos)
let allPageRaw = [];         // productos raw (sin enriquecer) para re-filtrar subcategoría
let currentFilters = {};
let fx = 1420;
let margin = 15;
let currentSort = 'name-asc';

let currentPage = 1;
let itemsPerPage = 60;
let totalProducts = 0;
let totalPages = 1;
let hasNextPage = false;
let hasPrevPage = false;
const PAGE_SIZE_STORAGE_KEY = 'toval_page_size_catalogo';

export function CatalogoPage() {
  return `
    <div class="catalogPage">
      <div class="catalogHeader">
        <div>
          <h1 class="pageTitle">Catálogo Completo</h1>
          <p class="pageSubtitle">Gestión de productos (Admin)</p>
        </div>

        <div class="catalogActions">
          <button class="btn btnSecondary" id="btnImportProviders">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Importar Proveedores
          </button>
          <button class="btn btnPrimary" id="btnAddProduct">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo Producto
          </button>
        </div>

        <button class="btnToggleFilters" id="btnToggleFilters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </button>
      </div>

      <div class="catalogLayout">
        <div class="catalogFilters" id="catalogFilters"></div>

        <div class="catalogMain">
          <div class="catalogToolbar">
            <div class="resultsCount" id="resultsCount">Cargando productos...</div>

            <div class="toolbarActions">
              <div class="marginControl">
                <label for="marginInput">Margen global %:</label>
                <input
                  type="number"
                  id="marginInput"
                  name="marginInput"
                  aria-label="Margen porcentual"
                  value="${margin}"
                  min="0"
                  max="500"
                  step="0.1"
                  class="marginInput"
                />
                <button class="btn btnSecondary btnSm" id="btnSaveMargin" title="Guardar margen para todos los admins">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Guardar
                </button>
              </div>

              <select class="sortSelect" id="sortSelect" name="sortOrder" aria-label="Ordenar productos">
                <option value="name-asc">Nombre A-Z</option>
                <option value="name-desc">Nombre Z-A</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="newest">Más nuevos</option>
              </select>
            </div>
          </div>

          <div id="marginSaveStatus" class="marginSaveStatus"></div>
          <div id="paginationTop"></div>

          <div class="productsGrid" id="productsGrid">
            <div class="loading">Cargando productos...</div>
          </div>

          <div id="paginationBottom"></div>
        </div>
      </div>
    </div>
  `;
}

export async function wireCatalogo() {
  // Cargar FX y margen global desde API
  [fx, margin] = await Promise.all([
    getFxUsdArs(),
    getMarginFromApi()
  ]);

  // Actualizar el input con el margen real
  const marginInputEl = document.getElementById('marginInput');
  if (marginInputEl) marginInputEl.value = String(margin);

  currentFilters = getFiltersFromURL();

  const url = new URL(window.location.href);
  const pageFromUrl = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const pageSizeFromUrl = Number.parseInt(url.searchParams.get('pageSize') || '60', 10);
  const pageSizeFromStorage = Number.parseInt(localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '0', 10);
  const sortFromUrl = url.searchParams.get('sort') || 'name-asc';

  currentPage = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  if ([30, 60, 100, 200].includes(pageSizeFromUrl)) {
    itemsPerPage = pageSizeFromUrl;
  } else if ([30, 60, 100, 200].includes(pageSizeFromStorage)) {
    itemsPerPage = pageSizeFromStorage;
  } else {
    itemsPerPage = 60;
  }
  currentSort = sortFromUrl;

  renderFilterSidebar();
  wireFilterSidebar({ onFilterChange: handleFilterChange, onClearFilters: handleClearFilters });

  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.value = currentSort;
    sortSel.addEventListener('change', async e => {
      currentSort = e.target.value;
      currentPage = 1;
      await refreshProducts();
    });
  }

  // Margen: al cambiar el input, re-renderiza los precios (sin guardar aún)
  document.getElementById('marginInput')?.addEventListener('input', () => {
    const val = parseFloat(document.getElementById('marginInput').value);
    if (Number.isFinite(val) && val >= 0) {
      margin = val;
      pageProducts = allPageRaw.map(p => enrichProduct(p));
      applySubcategoryFilter();
      renderProducts();
    }
  });

  // Guardar margen globalmente (API)
  document.getElementById('btnSaveMargin')?.addEventListener('click', async () => {
    const btn = document.getElementById('btnSaveMargin');
    const statusEl = document.getElementById('marginSaveStatus');
    const val = parseFloat(document.getElementById('marginInput').value);
    if (!Number.isFinite(val) || val < 0) return;

    btn.disabled = true;
    btn.textContent = 'Guardando...';
    statusEl.textContent = '';

    const token = localStorage.getItem('tt_token');
    const saved = await saveMarginToApi(val, token);

    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Guardar
    `;

    if (saved !== null) {
      margin = saved;
      pageProducts = allPageRaw.map(p => enrichProduct(p));
      applySubcategoryFilter();
      renderProducts();
      statusEl.textContent = `✅ Margen guardado: ${saved}% (aplica para todos los admins)`;
      statusEl.className = 'marginSaveStatus saved';
    } else {
      statusEl.textContent = '❌ Error al guardar. Revisá permisos.';
      statusEl.className = 'marginSaveStatus error';
    }

    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'marginSaveStatus'; }, 4000);
  });

  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('catalogFilters')?.classList.toggle('show');
  });

  document.getElementById('btnAddProduct')?.addEventListener('click', () => {
    window.location.href = '/admin/producto/nuevo';
  });

  document.getElementById('btnImportProviders')?.addEventListener('click', () => {
    window.location.href = '/admin/proveedores';
  });

  await refreshProducts();
}

// Enriquecer producto: usa marginOverride si el producto lo tiene, sino margen global
function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const iva = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;

  if (base <= 0) return { ...p, finalPrice: null };

  // Override por producto si existe
  const effectiveMargin = (p.marginOverride !== null && p.marginOverride !== undefined && p.marginOverride >= 0)
    ? p.marginOverride
    : margin;

  const withIva = currentFilters.withIVA !== false ? base * (1 + iva / 100) : base;
  const withMargin = withIva * (1 + effectiveMargin / 100);

  let finalPrice = withMargin;
  const currency = String(p.currency || 'USD').toUpperCase();
  const fxToUse = currentFilters.fx || fx;
  if (currency === 'USD' && fxToUse) {
    finalPrice = withMargin * fxToUse;
  }

  return {
    ...p,
    finalPrice: Math.round(finalPrice),
    basePriceUsd: base,
    ivaRate: iva,
    marginRate: effectiveMargin,
    hasMarginOverride: p.marginOverride !== null && p.marginOverride !== undefined,
  };
}

// Construye árbol de subcategorías desde los productos
function buildSubcategoryTree(products) {
  const tree = {};
  products.forEach(p => {
    const { cat, sub } = classifyProduct(p);
    if (!tree[cat]) tree[cat] = {};
    tree[cat][sub] = (tree[cat][sub] || 0) + 1;
  });
  return tree;
}

// Filtra productos por subcategoría (client-side)
let displayedProducts = [];

function applySubcategoryFilter() {
  if (!currentFilters.subcategory) {
    displayedProducts = pageProducts;
    return;
  }
  displayedProducts = pageProducts.filter(p => {
    const { sub } = classifyProduct(p);
    return sub === currentFilters.subcategory;
  });
}

function renderFilterSidebar() {
  const container = document.getElementById('catalogFilters');
  if (!container) return;

  const brands = [...new Set(allPageRaw.map(p => p.brand).filter(Boolean))].sort();
  const providers = [...new Set(allPageRaw.map(p => p.providerId || p.provider).filter(Boolean))].sort();
  const subcategoryTree = buildSubcategoryTree(allPageRaw);

  container.innerHTML = FilterSidebar({
    mode: 'admin',
    brands,
    subcategoryTree,
    providers,
    currentFilters,
  });
}

async function handleFilterChange(filters) {
  currentFilters = filters;
  currentPage = 1;
  // Si solo cambia subcategoría, no recargar desde API
  if (filters.subcategory !== undefined && pageProducts.length > 0) {
    applySubcategoryFilter();
    renderProducts();
    document.getElementById('catalogFilters')?.classList.remove('show');
    return;
  }
  await refreshProducts();
  document.getElementById('catalogFilters')?.classList.remove('show');
}

async function handleClearFilters() {
  currentFilters = {};
  currentPage = 1;
  displayedProducts = [];
  await refreshProducts();
}

async function refreshProducts() {
  setFiltersToURL({ ...currentFilters, page: currentPage, pageSize: itemsPerPage, sort: currentSort });
  await loadProducts();
  applySubcategoryFilter();
  renderFilterSidebar();
  wireFilterSidebar({ onFilterChange: handleFilterChange, onClearFilters: handleClearFilters });
  renderProducts();
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set('page', String(currentPage));
  params.set('pageSize', String(itemsPerPage));
  params.set('sort', currentSort);
  if (currentFilters.search) params.set('q', currentFilters.search);
  if (currentFilters.brand) params.set('brand', currentFilters.brand);
  if (currentFilters.category) params.set('category', currentFilters.category);
  if (currentFilters.provider) params.set('provider', currentFilters.provider);
  if (currentFilters.inStock) params.set('inStock', '1');
  return params.toString();
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (grid) grid.innerHTML = '<div class="loading">Cargando productos...</div>';

  try {
    const res = await fetch(`/api/getProducts?${buildQuery()}`);
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data?.error || 'API error');

    const items = Array.isArray(data.items) ? data.items : [];
    allPageRaw = items;
    pageProducts = items.map(p => enrichProduct(p));

    const pagination = data.pagination || {};
    const hasServerPagination = Number.isFinite(pagination.totalPages) && Number.isFinite(pagination.totalCount);

    if (hasServerPagination) {
      totalProducts = pagination.totalCount;
      totalPages = Math.max(1, pagination.totalPages);
      hasNextPage = Boolean(pagination.hasNextPage);
      hasPrevPage = Boolean(pagination.hasPrevPage);
    } else {
      hasPrevPage = currentPage > 1;
      hasNextPage = pageProducts.length === itemsPerPage;
      totalPages = hasNextPage ? currentPage + 1 : currentPage;
      totalProducts = hasNextPage
        ? currentPage * itemsPerPage + 1
        : (currentPage - 1) * itemsPerPage + pageProducts.length;
    }

    if (totalProducts > 0 && pageProducts.length === 0 && currentPage > totalPages) {
      currentPage = totalPages;
      return loadProducts();
    }
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
  } catch (err) {
    console.error('Error loading products:', err);
    allPageRaw = [];
    pageProducts = [];
    displayedProducts = [];
    totalProducts = 0;
    totalPages = 1;
    hasNextPage = false;
    hasPrevPage = false;
  }
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const count = document.getElementById('resultsCount');
  if (!grid) return;

  const toShow = displayedProducts.length > 0 || currentFilters.subcategory ? displayedProducts : pageProducts;
  const showCount = currentFilters.subcategory ? toShow.length : totalProducts;

  if (count) {
    count.textContent = `${showCount} producto${showCount !== 1 ? 's' : ''}${currentFilters.subcategory ? ` en "${currentFilters.subcategory}"` : ''}`;
  }

  if (toShow.length === 0) {
    grid.innerHTML = `
      <div class="emptyState">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>No se encontraron productos</h3>
        <p>Intentá con otros filtros</p>
        <button class="btn btnPrimary" id="btnClearEmpty">Limpiar filtros</button>
      </div>
    `;
    document.getElementById('btnClearEmpty')?.addEventListener('click', handleClearFilters);
    document.getElementById('paginationTop').innerHTML = '';
    document.getElementById('paginationBottom').innerHTML = '';
    return;
  }

  grid.innerHTML = toShow.map(p => ProductCard(p, {
    mode: 'admin',
    showAdminActions: true,
    onEdit: handleEditProduct,
    onDelete: handleDeleteProduct,
  })).join('');

  wireProductCards(grid, {
    onEdit: handleEditProduct,
    onDelete: handleDeleteProduct,
  });

  // Solo mostrar paginación si no hay filtro de subcategoría activo
  if (!currentFilters.subcategory) {
    renderPagination();
  } else {
    document.getElementById('paginationTop').innerHTML = '';
    document.getElementById('paginationBottom').innerHTML = '';
  }
}

function renderPagination() {
  const shouldRender = totalPages > 1 || hasNextPage || hasPrevPage;
  if (!shouldRender) {
    document.getElementById('paginationTop').innerHTML = '';
    document.getElementById('paginationBottom').innerHTML = '';
    return;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalProducts);

  const html = `
    <div class="simplePagination">
      <div class="paginationInfo">
        <span>Mostrando <strong>${startItem}-${endItem}</strong> de <strong>${totalProducts}</strong></span>
        <select class="itemsPerPageSelect" data-pagination-action="page-size">
          <option value="30" ${itemsPerPage === 30 ? 'selected' : ''}>30 por página</option>
          <option value="60" ${itemsPerPage === 60 ? 'selected' : ''}>60 por página</option>
          <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100 por página</option>
          <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200 por página</option>
        </select>
      </div>
      <div class="paginationControls">
        <button data-pagination-action="page" data-page="${currentPage - 1}" ${!hasPrevPage ? 'disabled' : ''} class="pageBtn">
          ← Anterior
        </button>
        <span class="pageNumbers">Página ${currentPage} de ${totalPages}</span>
        <button data-pagination-action="page" data-page="${currentPage + 1}" ${!hasNextPage ? 'disabled' : ''} class="pageBtn">
          Siguiente →
        </button>
      </div>
    </div>
  `;

  document.getElementById('paginationTop').innerHTML = html;
  document.getElementById('paginationBottom').innerHTML = html;
  wirePaginationControls();
}

async function changeCatalogPage(page, fromBottom = false) {
  if (page < 1 || page > totalPages) return;
  if (fromBottom) window.scrollTo({ top: 0, behavior: 'smooth' });
  currentPage = page;
  await refreshProducts();
}

async function changeCatalogItemsPerPage(value) {
  const parsed = Number.parseInt(value, 10);
  itemsPerPage = [30, 60, 100, 200].includes(parsed) ? parsed : 60;
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
  currentPage = 1;
  await refreshProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wirePaginationControls() {
  [document.getElementById('paginationTop'), document.getElementById('paginationBottom')].forEach(container => {
    if (!container) return;
    container.querySelectorAll('[data-pagination-action="page"]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const page = Number.parseInt(btn.dataset.page || '', 10);
        if (!Number.isFinite(page)) return;
        await changeCatalogPage(page, container.id === 'paginationBottom');
      });
    });
    container.querySelectorAll('[data-pagination-action="page-size"]').forEach(sel => {
      sel.addEventListener('change', async e => {
        await changeCatalogItemsPerPage(e.target.value);
      });
    });
  });
}

function handleEditProduct(sku) {
  window.location.href = `/admin/producto/${encodeURIComponent(sku)}`;
}

async function handleDeleteProduct(sku) {
  try {
    const token = localStorage.getItem('tt_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/deleteProduct?sku=${encodeURIComponent(sku)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers,
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || 'Error eliminando producto');
    await refreshProducts();
    showToast('Producto eliminado');
  } catch (err) {
    console.error('Error deleting product:', err);
    alert('Error eliminando producto: ' + err.message);
  }
}

function showToast(message, type = 'ok') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toastError' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}