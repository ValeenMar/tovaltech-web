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
let hasNextPage = false;
let hasPrevPage = false;
const PAGE_SIZE_STORAGE_KEY = 'toval_page_size_tienda';

function buildSubcategoryTree(products = []) {
  const tree = {};
  products.forEach(p => {
    const cat = (p.category && String(p.category).trim()) || 'Otros';
    const sub = (p.subcategory && String(p.subcategory).trim()) || 'Otros';
    if (!tree[cat]) tree[cat] = {};
    tree[cat][sub] = (tree[cat][sub] || 0) + 1;
  });
  return tree;
}

export function TiendaPage() {
  return `
    <div class="storePage">
      <div class="storeHeader">
        <h1 class="pageTitle">Tienda</h1>

        <button class="btn btnGhost btnFilters" id="btnToggleFilters">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </button>

        <div class="storeControls">
          <div class="sortBox">
            <label class="sortLabel" for="sortSelect">Orden</label>
            <select id="sortSelect" class="sortSelect">
              <option value="name-asc">Nombre (A→Z)</option>
              <option value="name-desc">Nombre (Z→A)</option>
              <option value="price-asc">Precio (Menor→Mayor)</option>
              <option value="price-desc">Precio (Mayor→Menor)</option>
              <option value="brand-asc">Marca (A→Z)</option>
              <option value="brand-desc">Marca (Z→A)</option>
            </select>
          </div>

          <div class="pageSizeBox">
            <label class="sortLabel" for="pageSizeSelect">Por página</label>
            <select id="pageSizeSelect" class="sortSelect">
              <option value="30">30</option>
              <option value="60">60</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>
      </div>

      <div class="storeLayout">
        <div class="storeSidebar" id="storeFilters"></div>

        <div class="storeMain">
          <div class="resultsBar">
            <div class="resultsCount" id="resultsCount">0 productos</div>
            <div class="paginationMini" id="paginationTop"></div>
          </div>

          <div class="productsGrid" id="productsGrid"></div>

          <div class="paginationBottom" id="paginationBottom"></div>
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

  const pageSizeSel = document.getElementById('pageSizeSelect');
  if (pageSizeSel) {
    pageSizeSel.value = String(itemsPerPage);
    pageSizeSel.addEventListener('change', async (e) => {
      const v = Number.parseInt(e.target.value, 10);
      if ([30, 60, 100, 200].includes(v)) {
        itemsPerPage = v;
        localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
        currentPage = 1;
        await refreshProducts();
      }
    });
  }

  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('storeFilters')?.classList.toggle('show');
  });

  await refreshProducts();
}

function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const currency = (p.currency || 'USD').toUpperCase();
  const ivaRate = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 0;

  const usd = currency === 'USD' ? base : (fx ? base / fx : base);
  const usdWithMargin = usd * (1 + (margin / 100));
  const ars = Math.round(usdWithMargin * fx);

  const arsIva = Math.round(ars * (1 + (ivaRate / 100)));

  return {
    ...p,
    priceUSD: usdWithMargin,
    priceARS: ars,
    priceARSIVA: arsIva,
    fxUsed: fx,
    marginUsed: margin,
  };
}

function renderFilterSidebar() {
  const container = document.getElementById('storeFilters');
  if (!container) return;

  const brands = [...new Set(pageProducts.map((p) => p.brand).filter(Boolean))].sort();
  const subcategoryTree = buildSubcategoryTree(pageProducts);

  container.innerHTML = FilterSidebar({
    mode: 'client',
    brands,
    subcategoryTree,
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
  renderPagination();
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set('page', String(currentPage));
  params.set('pageSize', String(itemsPerPage));
  params.set('sort', currentSort);

  if (currentFilters.search) params.set('q', currentFilters.search);
  if (currentFilters.brand) params.set('brand', currentFilters.brand);
  if (currentFilters.category) params.set('category', currentFilters.category);
  if (currentFilters.subcategory) params.set('subcategory', currentFilters.subcategory);
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
    document.getElementById('paginationTop')?.replaceChildren();
    document.getElementById('paginationBottom')?.replaceChildren();
    return;
  }

  grid.innerHTML = pageProducts.map((p) => ProductCard(p, { fx, margin, showProvider: false })).join('');
  wireProductCards();
}

function renderPagination() {
  const top = document.getElementById('paginationTop');
  const bottom = document.getElementById('paginationBottom');
  if (!top || !bottom) return;

  const disablePrev = !hasPrevPage || currentPage <= 1;
  const disableNext = !hasNextPage || currentPage >= totalPages;

  const html = `
    <div class="pagination">
      <button class="btn btnGhost" id="btnPrevPage" ${disablePrev ? 'disabled' : ''}>Anterior</button>
      <div class="pageInfo">Página ${currentPage} de ${totalPages}</div>
      <button class="btn btnGhost" id="btnNextPage" ${disableNext ? 'disabled' : ''}>Siguiente</button>
    </div>
  `;

  top.innerHTML = html;
  bottom.innerHTML = html;

  const goPrev = async () => {
    if (disablePrev) return;
    currentPage = Math.max(1, currentPage - 1);
    await refreshProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goNext = async () => {
    if (disableNext) return;
    currentPage = Math.min(totalPages, currentPage + 1);
    await refreshProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  document.querySelectorAll('#btnPrevPage').forEach(btn => btn.addEventListener('click', goPrev));
  document.querySelectorAll('#btnNextPage').forEach(btn => btn.addEventListener('click', goNext));
}
