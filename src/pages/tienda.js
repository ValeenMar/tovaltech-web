// File: /src/pages/tienda.js
// Tienda con paginacion server-side

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin } from '../utils/dataHelpers.js';
import { addToCart } from '../components/cart.js';

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
  products.forEach((p) => {
    const cat = (p.category || 'Otros').trim();
    const sub = (p.subcategory || '').trim();
    if (!tree[cat]) tree[cat] = {};
    if (sub) tree[cat][sub] = (tree[cat][sub] || 0) + 1;
    else tree[cat][''] = (tree[cat][''] || 0) + 1;
  });
  return tree;
}

function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const currency = String(p.currency || 'USD').toUpperCase();
  const ivaRate = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;

  // Stock: si viene null/undefined, mantenerlo (lo tratamos como "disponible/desconocido")
  let stock = p.stock;
  if (stock !== null && stock !== undefined) {
    stock = typeof stock === 'number' ? stock : parseFloat(stock) || 0;
  }

  if (base <= 0) {
    return { ...p, stock, currency, ivaRate, finalPrice: null };
  }

  // Precio base en ARS (si viene en USD, convertir; si viene en ARS, usar tal cual)
  const baseArs = currency === 'USD' ? (fx ? base * fx : base) : base;

  // Aplicar margen + IVA
  const withMargin = baseArs * (1 + (margin || 0) / 100);
  const withIva = withMargin * (1 + ivaRate / 100);

  const finalPrice = Math.round(withIva);

  return {
    ...p,
    stock,
    currency,
    ivaRate,
    finalPrice,
    // extras útiles
    basePrice: base,
    basePriceArs: Math.round(baseArs),
    marginRate: margin || 0
  };
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
        <div class="storeFilters" id="storeFilters"></div>

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

  currentPage = Number.isFinite(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  itemsPerPage =
    Number.isFinite(pageSizeFromUrl) && pageSizeFromUrl > 0
      ? pageSizeFromUrl
      : (Number.isFinite(pageSizeFromStorage) && pageSizeFromStorage > 0 ? pageSizeFromStorage : 60);

  const sortFromUrl = url.searchParams.get('sort');
  if (sortFromUrl) currentSort = sortFromUrl;

  // UI events
  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('storeFilters')?.classList.toggle('show');
  });

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', async (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      await refreshProducts();
    });
  }

  const pageSizeSelect = document.getElementById('pageSizeSelect');
  if (pageSizeSelect) {
    pageSizeSelect.value = String(itemsPerPage);
    pageSizeSelect.addEventListener('change', async (e) => {
      itemsPerPage = parseInt(e.target.value, 10) || 60;
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(itemsPerPage));
      currentPage = 1;
      await refreshProducts();
    });
  }

  await refreshProducts();
}

function renderFilterSidebar() {
  const container = document.getElementById('storeFilters');
  if (!container) return;

  const brands = [...new Set(pageProducts.map(p => p.brand).filter(Boolean))].sort();
  const subcategoryTree = buildSubcategoryTree(pageProducts);

  container.innerHTML = FilterSidebar({
    mode: 'client',
    brands,
    subcategoryTree,
    providers: [], // tienda no muestra proveedor
    currentFilters,
  });

  wireFilterSidebar({
    onChange: handleFilterChange,
    onClear: handleClearFilters,
    isAdmin: false,
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

function handleAddToCart(sku) {
  const p = pageProducts.find(x => String(x.sku) === String(sku));
  if (!p) return;

  addToCart({
    sku: p.sku,
    name: p.name,
    brand: p.brand,
    providerId: p.providerId || p.provider || null,
    price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
    currency: p.currency || 'USD',
    ivaRate: typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5,
    stock: p.stock === undefined ? null : p.stock,
    imageUrl: p.imageUrl || p.thumbUrl || p.image || null,
  });
}

async function refreshProducts() {
  setFiltersToURL({ ...currentFilters, page: currentPage, pageSize: itemsPerPage, sort: currentSort });
  await loadProducts();
  renderFilterSidebar();
  renderProducts();
  renderPagination();
}

async function loadProducts() {
  const grid = document.getElementById('productsGrid');
  if (grid) grid.innerHTML = '<div class="loading">Cargando productos...</div>';

  try {
    const res = await fetch(`/api/getProducts?${buildQuery()}`);
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data?.error || 'API error');

    totalProducts = data.total || 0;
    totalPages = data.totalPages || 1;
    hasNextPage = !!data.hasNextPage;
    hasPrevPage = !!data.hasPrevPage;
    currentPage = data.page || currentPage;

    pageProducts = (Array.isArray(data.items) ? data.items : []).map(enrichProduct);
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

  grid.innerHTML = pageProducts.map((p) => ProductCard(p, {
    mode: 'client',
    onAddToCart: handleAddToCart,
  })).join('');

  wireProductCards(grid, {
    onAddToCart: handleAddToCart,
  });
}

function renderPagination() {
  const top = document.getElementById('paginationTop');
  const bottom = document.getElementById('paginationBottom');
  if (!top || !bottom) return;

  const mini = `
    <button class="btn btnGhost btnMini" id="btnPrevTop" ${hasPrevPage ? '' : 'disabled'}>Anterior</button>
    <span class="pageMiniInfo">Página ${currentPage} de ${totalPages}</span>
    <button class="btn btnGhost btnMini" id="btnNextTop" ${hasNextPage ? '' : 'disabled'}>Siguiente</button>
  `;

  top.innerHTML = mini;

  bottom.innerHTML = `
    <div class="paginationFull">
      <button class="btn btnGhost" id="btnPrevBottom" ${hasPrevPage ? '' : 'disabled'}>← Anterior</button>
      <div class="paginationInfo">Página ${currentPage} de ${totalPages}</div>
      <button class="btn btnGhost" id="btnNextBottom" ${hasNextPage ? '' : 'disabled'}>Siguiente →</button>
    </div>
  `;

  document.getElementById('btnPrevTop')?.addEventListener('click', goPrev);
  document.getElementById('btnNextTop')?.addEventListener('click', goNext);
  document.getElementById('btnPrevBottom')?.addEventListener('click', goPrev);
  document.getElementById('btnNextBottom')?.addEventListener('click', goNext);
}

async function goPrev() {
  if (!hasPrevPage) return;
  currentPage -= 1;
  await refreshProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function goNext() {
  if (!hasNextPage) return;
  currentPage += 1;
  await refreshProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
