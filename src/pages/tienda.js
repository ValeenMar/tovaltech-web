// File: /src/pages/tienda.js
// Tienda con paginacion server-side

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin } from '../utils/dataHelpers.js';

let pageProducts = [];
let currentFilters = {};
let fx = 1420;
let margin = 15;
let currentSort = 'name-asc';

let currentPage = 1;
let itemsPerPage = 60;
let totalProducts = 0;
let totalPages = 1;

export function TiendaPage() {
  return `
    <div class="storePage">
      <div class="storeHeader">
        <h1 class="pageTitle">Tienda</h1>
        <p class="pageSubtitle">Explora nuestro catalogo de productos</p>

        <button class="btnToggleFilters" id="btnToggleFilters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </button>
      </div>

      <div class="storeLayout">
        <div class="storeFilters" id="storeFilters"></div>

        <div class="storeMain">
          <div class="storeToolbar">
            <div class="resultsCount" id="resultsCount">Cargando productos...</div>

            <select class="sortSelect" id="sortSelect">
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="newest">Mas nuevos</option>
            </select>
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

export async function wireTienda() {
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

  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('storeFilters')?.classList.toggle('show');
  });

  await refreshProducts();
}

function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const iva = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;

  if (base <= 0) return { ...p, finalPrice: null };

  const withIva = base * (1 + iva / 100);
  const withMargin = withIva * (1 + margin / 100);

  let finalPrice = withMargin;
  const currency = String(p.currency || 'USD').toUpperCase();
  if (currency === 'USD' && fx) {
    finalPrice = withMargin * fx;
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
  const container = document.getElementById('storeFilters');
  if (!container) return;

  const brands = [...new Set(pageProducts.map((p) => p.brand).filter(Boolean))].sort();
  const categories = [...new Set(pageProducts.map((p) => p.category).filter(Boolean))].sort();

  container.innerHTML = FilterSidebar({
    mode: 'client',
    brands,
    categories,
    currentFilters,
  });
}

async function handleFilterChange(filters) {
  currentFilters = filters;
  currentPage = 1;
  await refreshProducts();
  document.getElementById('storeFilters')?.classList.remove('show');
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
    totalProducts = Number.isFinite(pagination.totalCount) ? pagination.totalCount : pageProducts.length;
    totalPages = Math.max(1, Number.isFinite(pagination.totalPages) ? pagination.totalPages : 1);

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
    .map((p) => ProductCard(p, { mode: 'client', onAddToCart: handleAddToCart }))
    .join('');

  wireProductCards(grid, { onAddToCart: handleAddToCart });
  renderPagination();
}

function renderPagination() {
  if (totalPages <= 1) {
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
        <select class="itemsPerPageSelect" onchange="window.changeItemsPerPage(this.value)">
          <option value="30" ${itemsPerPage === 30 ? 'selected' : ''}>30 por pagina</option>
          <option value="60" ${itemsPerPage === 60 ? 'selected' : ''}>60 por pagina</option>
          <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100 por pagina</option>
          <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200 por pagina</option>
        </select>
      </div>
      <div class="paginationControls">
        <button onclick="window.changePage(${currentPage - 1}, event)" ${currentPage === 1 ? 'disabled' : ''} class="pageBtn">
          ← Anterior
        </button>
        <span class="pageNumbers">Pagina ${currentPage} de ${totalPages}</span>
        <button onclick="window.changePage(${currentPage + 1}, event)" ${currentPage === totalPages ? 'disabled' : ''} class="pageBtn">
          Siguiente →
        </button>
      </div>
    </div>
  `;

  document.getElementById('paginationTop').innerHTML = html;
  document.getElementById('paginationBottom').innerHTML = html;
}

window.changePage = async function changePage(page, event) {
  if (page < 1 || page > totalPages) return;

  if (event) {
    const isBottom = event.target.closest('#paginationBottom') !== null;
    if (isBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  currentPage = page;
  await refreshProducts();
};

window.changeItemsPerPage = async function changeItemsPerPage(value) {
  const parsed = Number.parseInt(value, 10);
  itemsPerPage = [30, 60, 100, 200].includes(parsed) ? parsed : 60;
  currentPage = 1;
  await refreshProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function handleAddToCart(sku) {
  const product = pageProducts.find((p) => p.sku === sku);
  if (!product) return;

  let cart = [];
  try {
    const stored = localStorage.getItem('toval_cart');
    cart = stored ? JSON.parse(stored) : [];
  } catch {
    cart = [];
  }

  const existing = cart.find((item) => item.sku === sku);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      price: product.finalPrice,
      imageUrl: product.imageUrl || product.thumbUrl,
      quantity: 1,
    });
  }

  localStorage.setItem('toval_cart', JSON.stringify(cart));
  showToast(`${product.name} agregado al carrito`);
  updateCartBadge();
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

function updateCartBadge() {
  try {
    const stored = localStorage.getItem('toval_cart');
    const cart = stored ? JSON.parse(stored) : [];
    const total = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

    const badge = document.querySelector('.cartBadge');
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  } catch {
    // ignore
  }
}
