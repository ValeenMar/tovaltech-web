// File: /src/pages/tienda.js
// Tienda - Versión cliente (filtros simplificados, precios con IVA siempre)

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin, formatMoney } from '../utils/dataHelpers.js';

let allProducts = [];
let filteredProducts = [];
let currentFilters = {};
let fx = 1420;
let margin = 15;

export function TiendaPage() {
  return `
    <div class="storePage">
      <div class="storeHeader">
        <h1 class="pageTitle">Tienda</h1>
        <p class="pageSubtitle">Explorá nuestro catálogo de productos</p>
        
        <button class="btnToggleFilters" id="btnToggleFilters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </button>
      </div>
      
      <div class="storeLayout">
        <div class="storeFilters" id="storeFilters">
          <!-- FilterSidebar se inyectará aquí -->
        </div>
        
        <div class="storeMain">
          <div class="storeToolbar">
            <div class="resultsCount" id="resultsCount">
              Cargando productos...
            </div>
            
            <select class="sortSelect" id="sortSelect">
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="newest">Más nuevos</option>
            </select>
          </div>
          
          <div class="productsGrid" id="productsGrid">
            <div class="loading">Cargando productos...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function wireTienda() {
  // Obtener FX y margen
  fx = await getFxUsdArs();
  margin = getMargin();
  
  // Cargar filtros desde URL
  currentFilters = getFiltersFromURL();
  
  // Cargar productos
  await loadProducts();
  
  // Renderizar sidebar
  renderFilterSidebar();
  
  // Wire filtros
  wireFilterSidebar({
    onFilterChange: handleFilterChange,
    onClearFilters: handleClearFilters
  });
  
  // Wire sort
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    sortProducts(e.target.value);
    renderProducts();
  });
  
  // Wire toggle filters (mobile)
  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('storeFilters')?.classList.toggle('show');
  });
  
  // Aplicar filtros iniciales
  applyFilters();
}

async function loadProducts() {
  try {
    const res = await fetch('/api/getProducts?limit=5000');
    const data = await res.json();
    
    if (!res.ok || !data.ok) {
      throw new Error('API error');
    }
    
    allProducts = Array.isArray(data.items) ? data.items : [];
    
    // Enriquecer con precio final
    allProducts = allProducts.map(p => enrichProduct(p));
    
    filteredProducts = [...allProducts];
    
  } catch (err) {
    console.error('Error loading products:', err);
    allProducts = [];
    filteredProducts = [];
  }
}

function enrichProduct(p) {
  const base = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
  const iva = typeof p.ivaRate === 'number' ? p.ivaRate : parseFloat(p.ivaRate) || 10.5;
  
  if (base <= 0) {
    return { ...p, finalPrice: null };
  }
  
  const withIva = base * (1 + iva / 100);
  const withMargin = withIva * (1 + margin / 100);
  
  let finalPrice = withMargin;
  
  // Si es USD, convertir a ARS
  const currency = String(p.currency || 'USD').toUpperCase();
  if (currency === 'USD' && fx) {
    finalPrice = withMargin * fx;
  }
  
  return {
    ...p,
    finalPrice: Math.round(finalPrice),
    basePriceUsd: base,
    ivaRate: iva,
    marginRate: margin
  };
}

function renderFilterSidebar() {
  const container = document.getElementById('storeFilters');
  if (!container) return;
  
  // Extraer listas únicas
  const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))].sort();
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  
  container.innerHTML = FilterSidebar({
    mode: 'client',
    brands,
    categories,
    providers: [],
    currentFilters
  });
}

function handleFilterChange(filters) {
  currentFilters = filters;
  setFiltersToURL(filters);
  applyFilters();
  
  // Cerrar sidebar en mobile
  document.getElementById('storeFilters')?.classList.remove('show');
}

function handleClearFilters() {
  currentFilters = {};
  setFiltersToURL({});
  renderFilterSidebar();
  wireFilterSidebar({
    onFilterChange: handleFilterChange,
    onClearFilters: handleClearFilters
  });
  applyFilters();
}

function applyFilters() {
  filteredProducts = allProducts.filter(p => {
    // Search
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      const text = `${p.name || ''} ${p.sku || ''} ${p.brand || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    
    // Category
    if (currentFilters.category && p.category !== currentFilters.category) {
      return false;
    }
    
    // Brand
    if (currentFilters.brand && p.brand !== currentFilters.brand) {
      return false;
    }
    
    // Price range
    if (currentFilters.priceMin || currentFilters.priceMax) {
      const price = p.finalPrice || 0;
      
      if (currentFilters.priceMin && price < currentFilters.priceMin) return false;
      if (currentFilters.priceMax && price > currentFilters.priceMax) return false;
    }
    
    // Stock
    if (currentFilters.inStock && (!p.stock || p.stock <= 0)) {
      return false;
    }
    
    return true;
  });
  
  renderProducts();
}

function sortProducts(order) {
  const sorters = {
    'name-asc': (a, b) => (a.name || '').localeCompare(b.name || ''),
    'name-desc': (a, b) => (b.name || '').localeCompare(a.name || ''),
    'price-asc': (a, b) => (a.finalPrice || 0) - (b.finalPrice || 0),
    'price-desc': (a, b) => (b.finalPrice || 0) - (a.finalPrice || 0),
    'newest': (a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    }
  };
  
  const sorter = sorters[order] || sorters['name-asc'];
  filteredProducts.sort(sorter);
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const count = document.getElementById('resultsCount');
  
  if (!grid) return;
  
  if (filteredProducts.length === 0) {
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
    
    if (count) count.textContent = '0 productos';
    return;
  }
  
  grid.innerHTML = filteredProducts
    .map(p => ProductCard(p, { mode: 'client', onAddToCart: handleAddToCart }))
    .join('');
  
  wireProductCards(grid, { onAddToCart: handleAddToCart });
  
  if (count) {
    count.textContent = `${filteredProducts.length} producto${filteredProducts.length !== 1 ? 's' : ''}`;
  }
}

function handleAddToCart(sku) {
  const product = allProducts.find(p => p.sku === sku);
  if (!product) return;
  
  // Obtener carrito actual
  let cart = [];
  try {
    const stored = localStorage.getItem('toval_cart');
    cart = stored ? JSON.parse(stored) : [];
  } catch {
    cart = [];
  }
  
  // Buscar si ya existe
  const existing = cart.find(item => item.sku === sku);
  
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      price: product.finalPrice,
      imageUrl: product.imageUrl || product.thumbUrl,
      quantity: 1
    });
  }
  
  // Guardar
  localStorage.setItem('toval_cart', JSON.stringify(cart));
  
  // Feedback visual
  showToast(`${product.name} agregado al carrito`);
  
  // Actualizar contador de carrito (si existe)
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
