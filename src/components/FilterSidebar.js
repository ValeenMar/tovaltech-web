// File: /src/components/FilterSidebar.js
// Sidebar de filtros reutilizable (versión cliente y admin)

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function FilterSidebar(options = {}) {
  const {
    mode = 'client', // 'client' | 'admin'
    brands = [],
    categories = [],
    providers = [],
    currentFilters = {}
  } = options;
  
  const isAdmin = mode === 'admin';
  
  return `
    <aside class="filterSidebar" id="filterSidebar">
      <div class="filterHeader">
        <h3 class="filterTitle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filtros
        </h3>
        <button class="btnClearFilters" id="btnClearFilters">Limpiar</button>
      </div>
      
      <!-- Buscador -->
      <div class="filterGroup">
        <label class="filterLabel">Buscar</label>
        <input 
          type="text" 
          class="filterInput" 
          id="filterSearch" 
          placeholder="Nombre, SKU, marca..."
          value="${esc(currentFilters.search || '')}"
        />
      </div>
      
      <!-- Categoría + Subcategoría -->
      <div class="filterGroup filterAccordion" data-accordion="category">
        <button class="accordionHeader" data-toggle="category">
          <span class="accordionTitle">Categoría</span>
          <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="accordionContent" id="accordionCategory">
          <select class="filterSelect" id="filterCategory">
            <option value="">Todas las categorías</option>
            ${categories.map(cat => `
              <option value="${esc(cat)}" ${currentFilters.category === cat ? 'selected' : ''}>
                ${esc(cat)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <!-- Marca -->
      <div class="filterGroup filterAccordion" data-accordion="brand">
        <button class="accordionHeader" data-toggle="brand">
          <span class="accordionTitle">Marca</span>
          <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="accordionContent" id="accordionBrand">
          <select class="filterSelect" id="filterBrand">
            <option value="">Todas las marcas</option>
            ${brands.map(brand => `
              <option value="${esc(brand)}" ${currentFilters.brand === brand ? 'selected' : ''}>
                ${esc(brand)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      ${isAdmin ? `
        <!-- Proveedor (admin only) -->
        <div class="filterGroup filterAccordion" data-accordion="provider">
          <button class="accordionHeader" data-toggle="provider">
            <span class="accordionTitle">Proveedor</span>
            <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="accordionContent" id="accordionProvider">
            <select class="filterSelect" id="filterProvider">
              <option value="">Todos los proveedores</option>
              ${providers.map(prov => `
                <option value="${esc(prov)}" ${currentFilters.provider === prov ? 'selected' : ''}>
                  ${esc(prov)}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      ` : ''}
      
      <!-- Precio -->
      <div class="filterGroup filterAccordion open" data-accordion="price">
        <button class="accordionHeader" data-toggle="price">
          <span class="accordionTitle">Precio</span>
          <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="accordionContent" id="accordionPrice">
          ${renderPricePills(currentFilters)}
          
          <div class="priceInputs">
            <input 
              type="number" 
              class="priceInput" 
              id="filterPriceMin" 
              placeholder="Mín"
              value="${currentFilters.priceMin || ''}"
              min="0"
            />
            <span class="priceSeparator">—</span>
            <input 
              type="number" 
              class="priceInput" 
              id="filterPriceMax" 
              placeholder="Máx"
              value="${currentFilters.priceMax || ''}"
              min="0"
            />
          </div>
          
          ${!isAdmin ? `
            <div class="currencyToggle">
              <button class="btnCurrency ${currentFilters.currency !== 'USD' ? 'active' : ''}" data-currency="ARS">
                ARS
              </button>
              <button class="btnCurrency ${currentFilters.currency === 'USD' ? 'active' : ''}" data-currency="USD">
                USD
              </button>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Stock -->
      <div class="filterGroup">
        <label class="filterCheckbox">
          <input 
            type="checkbox" 
            id="filterStock" 
            ${currentFilters.inStock ? 'checked' : ''}
          />
          <span class="checkboxLabel">Solo con stock</span>
        </label>
      </div>
      
      <!-- IVA incluido (client: siempre on, admin: toggle) -->
      ${!isAdmin ? `
        <div class="filterGroup">
          <label class="filterCheckbox">
            <input type="checkbox" id="filterIVA" checked disabled />
            <span class="checkboxLabel">IVA incluido</span>
          </label>
        </div>
      ` : `
        <div class="filterGroup">
          <label class="filterCheckbox">
            <input 
              type="checkbox" 
              id="filterIVA" 
              ${currentFilters.withIVA !== false ? 'checked' : ''}
            />
            <span class="checkboxLabel">Mostrar con IVA</span>
          </label>
        </div>
      `}
      
      ${isAdmin ? `
        <!-- FX USD->ARS (admin only) -->
        <div class="filterGroup">
          <label class="filterLabel">Tipo de cambio USD→ARS</label>
          <input 
            type="number" 
            class="filterInput" 
            id="filterFX" 
            placeholder="1420"
            value="${currentFilters.fx || ''}"
            min="1"
            step="0.01"
          />
        </div>
      ` : ''}
      
      <div class="filterFooter">
        <button class="btn btnPrimary btnApplyFilters" id="btnApplyFilters">
          Aplicar Filtros
        </button>
      </div>
    </aside>
  `;
}

function renderPricePills(currentFilters = {}) {
  const pills = [
    { label: 'Hasta $50k', max: 50000 },
    { label: '$50k - $100k', min: 50000, max: 100000 },
    { label: '$100k - $200k', min: 100000, max: 200000 },
    { label: 'Más de $200k', min: 200000 }
  ];
  
  const selected = currentFilters.priceMin || currentFilters.priceMax;
  
  return `
    <div class="pricePills">
      ${pills.map(pill => {
        const isActive = (
          (!pill.min || pill.min == currentFilters.priceMin) &&
          (!pill.max || pill.max == currentFilters.priceMax)
        );
        
        return `
          <button 
            class="pricePill ${isActive ? 'active' : ''}" 
            data-min="${pill.min || ''}" 
            data-max="${pill.max || ''}"
          >
            ${esc(pill.label)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export function wireFilterSidebar(callbacks = {}) {
  const {
    onFilterChange = () => {},
    onClearFilters = () => {}
  } = callbacks;
  
  // Accordions
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const accordionId = btn.dataset.toggle;
      const accordion = btn.closest('.filterAccordion');
      
      if (accordion) {
        accordion.classList.toggle('open');
      }
    });
  });
  
  // Price pills
  document.querySelectorAll('.pricePill').forEach(pill => {
    pill.addEventListener('click', () => {
      const min = pill.dataset.min;
      const max = pill.dataset.max;
      
      document.getElementById('filterPriceMin').value = min || '';
      document.getElementById('filterPriceMax').value = max || '';
      
      document.querySelectorAll('.pricePill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
  
  // Currency toggle
  document.querySelectorAll('.btnCurrency').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btnCurrency').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Apply filters
  const btnApply = document.getElementById('btnApplyFilters');
  if (btnApply) {
    btnApply.addEventListener('click', () => {
      onFilterChange(collectFilters());
    });
  }
  
  // Clear filters
  const btnClear = document.getElementById('btnClearFilters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      onClearFilters();
    });
  }
  
  // Enter key en inputs
  document.querySelectorAll('.filterInput, .priceInput').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        onFilterChange(collectFilters());
      }
    });
  });
}

function collectFilters() {
  return {
    search: document.getElementById('filterSearch')?.value.trim() || '',
    category: document.getElementById('filterCategory')?.value || '',
    brand: document.getElementById('filterBrand')?.value || '',
    provider: document.getElementById('filterProvider')?.value || '',
    priceMin: parseFloat(document.getElementById('filterPriceMin')?.value) || null,
    priceMax: parseFloat(document.getElementById('filterPriceMax')?.value) || null,
    currency: document.querySelector('.btnCurrency.active')?.dataset.currency || 'ARS',
    inStock: document.getElementById('filterStock')?.checked || false,
    withIVA: document.getElementById('filterIVA')?.checked !== false,
    fx: parseFloat(document.getElementById('filterFX')?.value) || null
  };
}

export function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  return {
    search: params.get('q') || '',
    category: params.get('cat') || '',
    brand: params.get('brand') || '',
    provider: params.get('prov') || '',
    priceMin: params.get('pmin') ? parseFloat(params.get('pmin')) : null,
    priceMax: params.get('pmax') ? parseFloat(params.get('pmax')) : null,
    currency: params.get('curr') || 'ARS',
    inStock: params.get('stock') === '1',
    withIVA: params.get('iva') !== '0',
    fx: params.get('fx') ? parseFloat(params.get('fx')) : null,
    page: params.get('page') ? parseInt(params.get('page'), 10) : null,
    pageSize: params.get('pageSize') ? parseInt(params.get('pageSize'), 10) : null,
    sort: params.get('sort') || ''
  };
}

export function setFiltersToURL(filters) {
  const params = new URLSearchParams();
  
  if (filters.search) params.set('q', filters.search);
  if (filters.category) params.set('cat', filters.category);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.provider) params.set('prov', filters.provider);
  if (filters.priceMin) params.set('pmin', String(filters.priceMin));
  if (filters.priceMax) params.set('pmax', String(filters.priceMax));
  if (filters.currency && filters.currency !== 'ARS') params.set('curr', filters.currency);
  if (filters.inStock) params.set('stock', '1');
  if (filters.withIVA === false) params.set('iva', '0');
  if (filters.fx) params.set('fx', String(filters.fx));
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sort) params.set('sort', String(filters.sort));
  
  const newUrl = params.toString() 
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;
  
  window.history.replaceState({}, '', newUrl);
}
