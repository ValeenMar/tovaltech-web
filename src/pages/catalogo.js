// File: /src/pages/catalogo.js
// Catálogo - Versión admin (filtros completos, acciones de edición)

import { ProductCard, wireProductCards } from '../components/ProductCard.js';
import { FilterSidebar, wireFilterSidebar, getFiltersFromURL, setFiltersToURL } from '../components/FilterSidebar.js';
import { getFxUsdArs, getMargin, setMargin } from '../utils/dataHelpers.js';

let allProducts = [];
let filteredProducts = [];
let currentFilters = {};
let fx = 1420;
let margin = 15;

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
        <div class="catalogFilters" id="catalogFilters">
          <!-- FilterSidebar se inyectará aquí -->
        </div>
        
        <div class="catalogMain">
          <div class="catalogToolbar">
            <div class="resultsCount" id="resultsCount">
              Cargando productos...
            </div>
            
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
                <option value="newest">Más nuevos</option>
                <option value="provider">Proveedor</option>
              </select>
            </div>
          </div>
          
          <div class="productsGrid" id="productsGrid">
            <div class="loading">Cargando productos...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function wireCatalogo() {
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
  
  // Wire margen
  const marginInput = document.getElementById('marginInput');
  if (marginInput) {
    marginInput.addEventListener('change', (e) => {
      const newMargin = setMargin(e.target.value);
      margin = newMargin;
      
      // Re-enriquecer productos
      allProducts = allProducts.map(p => enrichProduct(p));
      applyFilters();
    });
  }
  
  // Wire toggle filters (mobile)
  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('catalogFilters')?.classList.toggle('show');
  });
  
  // Wire admin actions
  document.getElementById('btnAddProduct')?.addEventListener('click', () => {
    window.location.href = '/admin/producto/nuevo';
  });
  
  document.getElementById('btnImportProviders')?.addEventListener('click', () => {
    window.location.href = '/admin/proveedores';
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
  
  const withIva = currentFilters.withIVA !== false 
    ? base * (1 + iva / 100)
    : base;
  const withMargin = withIva * (1 + margin / 100);
  
  let finalPrice = withMargin;
  
  // Si es USD, convertir a ARS
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
    marginRate: margin
  };
}

function renderFilterSidebar() {
  const container = document.getElementById('catalogFilters');
  if (!container) return;
  
  // Extraer listas únicas
  const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))].sort();
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
  const providers = [...new Set(allProducts.map(p => p.provider).filter(Boolean))].sort();
  
  container.innerHTML = FilterSidebar({
    mode: 'admin',
    brands,
    categories,
    providers,
    currentFilters
  });
}

function handleFilterChange(filters) {
  currentFilters = filters;
  setFiltersToURL(filters);
  
  // Re-enriquecer productos con nuevo FX o IVA
  allProducts = allProducts.map(p => enrichProduct(p));
  
  applyFilters();
  
  // Cerrar sidebar en mobile
  document.getElementById('catalogFilters')?.classList.remove('show');
}

function handleClearFilters() {
  currentFilters = {};
  setFiltersToURL({});
  renderFilterSidebar();
  wireFilterSidebar({
    onFilterChange: handleFilterChange,
    onClearFilters: handleClearFilters
  });
  
  allProducts = allProducts.map(p => enrichProduct(p));
  applyFilters();
}

function applyFilters() {
  filteredProducts = allProducts.filter(p => {
    // Search
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase();
      const text = `${p.name || ''} ${p.sku || ''} ${p.brand || ''} ${p.provider || ''}`.toLowerCase();
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
    
    // Provider
    if (currentFilters.provider && p.provider !== currentFilters.provider) {
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
    },
    'provider': (a, b) => (a.provider || '').localeCompare(b.provider || '')
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
    .map(p => ProductCard(p, { 
      mode: 'admin', 
      showAdminActions: true,
      onEdit: handleEditProduct,
      onDelete: handleDeleteProduct
    }))
    .join('');
  
  wireProductCards(grid, { 
    onEdit: handleEditProduct,
    onDelete: handleDeleteProduct
  });
  
  if (count) {
    count.textContent = `${filteredProducts.length} producto${filteredProducts.length !== 1 ? 's' : ''}`;
  }
}

function handleEditProduct(sku) {
  window.location.href = `/admin/producto/${encodeURIComponent(sku)}`;
}

async function handleDeleteProduct(sku) {
  try {
    const res = await fetch(`/api/deleteProduct?sku=${encodeURIComponent(sku)}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Error eliminando producto');
    }
    
    // Recargar productos
    await loadProducts();
    applyFilters();
    
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
