// File: /src/pages/catalogo.js
// Catalogo admin con paginacion server-side

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin, setMargin } from '../utils/dataHelpers.js';

let pageProducts = [];
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

export function CatalogoPage() {
  return `
    <div class="catalogPage">
      <div class="catalogHeader">
        <div>
          <h1 class="pageTitle">Catalogo Completo</h1>
          <p class="pageSubtitle">Gestion de productos (Admin)</p>
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
                <label for="marginInput">Margen %:</label>
                <input
                  type="number"
                  id="marginInput"
                  value="${margin}"
                  min="0"
                  max="100"
                  step="0.1"
                  class="marginInput"
                />
              </div>

              <select class="sortSelect" id="sortSelect">
                <option value="name-asc">Nombre A-Z</option>
                <option value="name-desc">Nombre Z-A</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="newest">Mas nuevos</option>
              </select>
            </div>
          </div>

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
  fx = await getFxUsdArs();
  margin = getMargin();
  currentFilters = getFiltersFromURL();

  const url = new URL(window.location.href);
  const pageFromUrl = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const pageSizeFromUrl = Number.parseInt(url.searchParams.get('pageSize') || '60', 10);
  const sortFromUrl = url.searchParams.get('sort') || 'name-asc';

  currentPage = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  itemsPerPage = [30, 60, 100, 200].includes(pageSizeFromUrl) ? pageSizeFromUrl : 60;
  currentSort = sortFromUrl;

  renderFilterSidebar();
  wireFilterSidebar({
    onFilterChange: handleFilterChange,
    onClearFilters: handleClearFilters,
  });

  const sortSel = document.getElementById('sortSelect');
  if (sortSel) {
    sortSel.value = currentSort;
    sortSel.addEventListener('change', async (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      await refreshProducts();
    });
  }

  const marginInput = document.getElementById('marginInput');
  if (marginInput) {
    marginInput.addEventListener('change', () => {
      margin = setMargin(marginInput.value);
      pageProducts = pageProducts.map((p) => enrichProduct(p));
      renderProducts();
    });
  }

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

function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const iva = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;

  if (base <= 0) return { ...p, finalPrice: null };

  const withIva = currentFilters.withIVA !== false ? base * (1 + iva / 100) : base;
  const withMargin = withIva * (1 + margin / 100);

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
    marginRate: margin,
  };
}

function renderFilterSidebar() {
  const container = document.getElementById('catalogFilters');
  if (!container) return;

  const brands = [...new Set(pageProducts.map((p) => p.brand).filter(Boolean))].sort();
  const categories = [...new Set(pageProducts.map((p) => p.category).filter(Boolean))].sort();
  const providers = [...new Set(pageProducts.map((p) => p.providerId || p.provider).filter(Boolean))].sort();

  container.innerHTML = FilterSidebar({
    mode: 'admin',
    brands,
    categories,
    providers,
    currentFilters,
  });
}

async function handleFilterChange(filters) {
  currentFilters = filters;
  currentPage = 1;
  await refreshProducts();
  document.getElementById('catalogFilters')?.classList.remove('show');
}

async function handleClearFilters() {
  currentFilters = {};
  currentPage = 1;
  await refreshProducts();
}

async function refreshProducts() {
  setFiltersToURL({ ...currentFilters, page: currentPage, pageSize: itemsPerPage, sort: currentSort });
  await loadProducts();
  renderFilterSidebar();
  wireFilterSidebar({
    onFilterChange: handleFilterChange,
    onClearFilters: handleClearFilters,
  });
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
    pageProducts = items.map((p) => enrichProduct(p));

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
        ? (currentPage * itemsPerPage) + 1
        : ((currentPage - 1) * itemsPerPage) + pageProducts.length;
      console.warn('getProducts response without pagination metadata; using fallback pagination mode.');
    }

    if (totalProducts > 0 && pageProducts.length === 0 && currentPage > totalPages) {
      currentPage = totalPages;
      return loadProducts();
    }

    currentPage = Math.min(Math.max(1, currentPage), totalPages);
  } catch (err) {
    console.error('Error loading products:', err);
    pageProducts = [];
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

  if (count) {
    count.textContent = `${totalProducts} producto${totalProducts !== 1 ? 's' : ''}`;
  }

  if (totalProducts === 0 || pageProducts.length === 0) {
    grid.innerHTML = `
      <div class="emptyState">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <h3>No se encontraron productos</h3>
        <p>Intenta con otros filtros</p>
        <button class="btn btnPrimary" id="btnClearEmpty">Limpiar filtros</button>
      </div>
    `;

    document.getElementById('btnClearEmpty')?.addEventListener('click', handleClearFilters);
    document.getElementById('paginationTop').innerHTML = '';
    document.getElementById('paginationBottom').innerHTML = '';
    return;
  }

  grid.innerHTML = pageProducts
    .map((p) => ProductCard(p, {
      mode: 'admin',
      showAdminActions: true,
      onEdit: handleEditProduct,
      onDelete: handleDeleteProduct,
    }))
    .join('');

  wireProductCards(grid, {
    onEdit: handleEditProduct,
    onDelete: handleDeleteProduct,
  });

  renderPagination();
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
          <option value="30" ${itemsPerPage === 30 ? 'selected' : ''}>30 por pagina</option>
          <option value="60" ${itemsPerPage === 60 ? 'selected' : ''}>60 por pagina</option>
          <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100 por pagina</option>
          <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200 por pagina</option>
        </select>
      </div>
      <div class="paginationControls">
        <button data-pagination-action="page" data-page="${currentPage - 1}" ${!hasPrevPage ? 'disabled' : ''} class="pageBtn">
          ← Anterior
        </button>
        <span class="pageNumbers">Pagina ${currentPage} de ${totalPages}</span>
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

  if (fromBottom) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  currentPage = page;
  await refreshProducts();
}

async function changeCatalogItemsPerPage(value) {
  const parsed = Number.parseInt(value, 10);
  itemsPerPage = [30, 60, 100, 200].includes(parsed) ? parsed : 60;
  currentPage = 1;
  await refreshProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wirePaginationControls() {
  const top = document.getElementById('paginationTop');
  const bottom = document.getElementById('paginationBottom');

  [top, bottom].forEach((container) => {
    if (!container) return;

    container.querySelectorAll('[data-pagination-action="page"]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const page = Number.parseInt(btn.dataset.page || '', 10);
        if (!Number.isFinite(page)) return;
        const isBottom = container.id === 'paginationBottom';
        await changeCatalogPage(page, isBottom);
      });
    });

    container.querySelectorAll('[data-pagination-action="page-size"]').forEach((select) => {
      select.addEventListener('change', async (event) => {
        await changeCatalogItemsPerPage(event.target.value);
      });
    });
  });
}

function handleEditProduct(sku) {
  window.location.href = `/admin/producto/${encodeURIComponent(sku)}`;
}

async function handleDeleteProduct(sku) {
  try {
    const res = await fetch(`/api/deleteProduct?sku=${encodeURIComponent(sku)}`, {
      method: 'DELETE',
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Error eliminando producto');
    }

    await refreshProducts();
    showToast('Producto eliminado');
  } catch (err) {
    console.error('Error deleting product:', err);
    alert('Error eliminando producto: ' + err.message);
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
