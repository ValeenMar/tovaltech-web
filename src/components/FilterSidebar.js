// File: /src/components/FilterSidebar.js
// Sidebar de filtros con árbol de categorías y subcategorías

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
    mode = 'client',
    brands = [],
    subcategoryTree = {},
    providers = [],
    currentFilters = {}
  } = options;

  const isAdmin = mode === 'admin';
  const categories = Object.keys(subcategoryTree).sort();

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

      <div class="filterGroup">
        <label class="filterLabel" for="filterSearch">Buscar</label>
        <input type="text" class="filterInput" id="filterSearch"
          placeholder="Nombre, SKU, marca..."
          value="${esc(currentFilters.search || '')}"/>
      </div>

      ${categories.length > 0 ? `
        <div class="filterGroup filterAccordion open" data-accordion="category">
          <button class="accordionHeader" data-toggle="category">
            <span class="accordionTitle">Categoría</span>
            <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="accordionContent catTreeContent" id="accordionCategory">
            ${renderCategoryTree(categories, subcategoryTree, currentFilters)}
          </div>
        </div>
      ` : ''}

      ${brands.length > 0 ? `
        <div class="filterGroup filterAccordion" data-accordion="brand">
          <button class="accordionHeader" data-toggle="brand">
            <span class="accordionTitle">Marca</span>
            <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="accordionContent" id="accordionBrand">
            <div class="brandList">
              <label class="filterCheckbox brandItem">
                <input type="radio" name="filterBrand" value="" ${!currentFilters.brand ? 'checked' : ''}/>
                <span class="checkboxLabel">Todas</span>
              </label>
              ${brands.map(brand => `
                <label class="filterCheckbox brandItem">
                  <input type="radio" name="filterBrand" value="${esc(brand)}"
                    ${currentFilters.brand === brand ? 'checked' : ''}/>
                  <span class="checkboxLabel">${esc(brand)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      ${isAdmin && providers.length > 0 ? `
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
                  ${esc(prov)}</option>
              `).join('')}
            </select>
          </div>
        </div>
      ` : ''}

      <div class="filterGroup filterAccordion" data-accordion="price">
        <button class="accordionHeader" data-toggle="price">
          <span class="accordionTitle">Precio</span>
          <svg class="accordionIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="accordionContent" id="accordionPrice">
          ${renderPricePills(currentFilters)}
          <div class="priceInputs">
            <input type="number" class="priceInput" id="filterPriceMin"
              placeholder="Mín" value="${currentFilters.priceMin || ''}" min="0"/>
            <span class="priceSeparator">—</span>
            <input type="number" class="priceInput" id="filterPriceMax"
              placeholder="Máx" value="${currentFilters.priceMax || ''}" min="0"/>
          </div>
          ${!isAdmin ? `
            <div class="currencyToggle">
              <button class="btnCurrency ${currentFilters.currency !== 'USD' ? 'active' : ''}" data-currency="ARS">ARS</button>
              <button class="btnCurrency ${currentFilters.currency === 'USD' ? 'active' : ''}" data-currency="USD">USD</button>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="filterGroup">
        <label class="filterCheckbox">
          <input type="checkbox" id="filterStock" ${currentFilters.inStock ? 'checked' : ''}/>
          <span class="checkboxLabel">Solo con stock</span>
        </label>
      </div>

      ${!isAdmin ? `
        <div class="filterGroup">
          <label class="filterCheckbox">
            <input type="checkbox" id="filterIVA" checked disabled/>
            <span class="checkboxLabel">IVA incluido</span>
          </label>
        </div>
      ` : `
        <div class="filterGroup">
          <label class="filterCheckbox">
            <input type="checkbox" id="filterIVA" ${currentFilters.withIVA !== false ? 'checked' : ''}/>
            <span class="checkboxLabel">Mostrar con IVA</span>
          </label>
        </div>
      `}

      ${isAdmin ? `
        <div class="filterGroup">
          <label class="filterLabel" for="filterFX">Tipo de cambio USD→ARS</label>
          <input type="number" class="filterInput" id="filterFX"
            placeholder="1420" value="${currentFilters.fx || ''}" min="1" step="0.01"/>
        </div>
      ` : ''}

      <div class="filterFooter">
        <button class="btn btnPrimary btnApplyFilters" id="btnApplyFilters">Aplicar Filtros</button>
      </div>
    </aside>
  `;
}

function renderCategoryTree(categories, tree, currentFilters) {
  return categories.map(cat => {
    const subs = Object.entries(tree[cat] || {}).sort(([a], [b]) => a.localeCompare(b));
    const isCatSelected = currentFilters.category === cat;
    const totalCount = Object.values(tree[cat] || {}).reduce((s, n) => s + n, 0);

    return `
      <div class="catItem ${isCatSelected ? 'catSelected' : ''}" data-cat="${esc(cat)}">
        <button class="catHeader" data-cat-select="${esc(cat)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            class="catArrow ${isCatSelected && subs.length > 1 ? 'catArrowOpen' : ''}">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span class="catName">${esc(cat)}</span>
          <span class="catCount">${totalCount}</span>
        </button>
        ${subs.length > 1 ? `
          <div class="subList ${isCatSelected ? 'subListOpen' : ''}">
            <label class="filterCheckbox subItem">
              <input type="radio" name="filterSub" value=""
                ${isCatSelected && !currentFilters.subcategory ? 'checked' : ''}/>
              <span class="checkboxLabel">Todos</span>
            </label>
            ${subs.map(([sub, count]) => `
              <label class="filterCheckbox subItem">
                <input type="radio" name="filterSub" value="${esc(sub)}"
                  ${currentFilters.subcategory === sub && isCatSelected ? 'checked' : ''}/>
                <span class="checkboxLabel">${esc(sub)}</span>
                <span class="subCount">${count}</span>
              </label>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderPricePills(currentFilters = {}) {
  const pills = [
    { label: 'Hasta $50k', max: 50000 },
    { label: '$50k–$150k', min: 50000, max: 150000 },
    { label: '$150k–$400k', min: 150000, max: 400000 },
    { label: '+$400k', min: 400000 }
  ];

  return `
    <div class="pricePills">
      ${pills.map(pill => {
        const isActive = Boolean(
          (!pill.min || pill.min == currentFilters.priceMin) &&
          (!pill.max || pill.max == currentFilters.priceMax) &&
          (currentFilters.priceMin || currentFilters.priceMax)
        );
        return `
          <button class="pricePill ${isActive ? 'active' : ''}"
            data-min="${pill.min || ''}" data-max="${pill.max || ''}">
            ${esc(pill.label)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export function wireFilterSidebar(callbacks = {}) {
  const { onFilterChange = () => {}, onClearFilters = () => {} } = callbacks;

  // Accordions
  const filterSidebar = document.getElementById('filterSidebar');
  if (filterSidebar && !filterSidebar.dataset.accordionDelegated) {
    filterSidebar.dataset.accordionDelegated = '1';
    filterSidebar.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-toggle]');
      if (toggleBtn) {
        toggleBtn.closest('.filterAccordion')?.classList.toggle('open');
      }
    });
  }

  // Category tree clicks
  // Category tree clicks (funciona en Tienda y Catálogo)
const sidebar = document.getElementById('filterSidebar');
  if (sidebar && !sidebar.dataset.catDelegated) {
    sidebar.dataset.catDelegated = '1';
    sidebar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat-select]');
      if (!btn) return;
      const catItem = btn.closest('.catItem');
      const wasSelected = catItem?.classList.contains('catSelected');
      document.querySelectorAll('.catItem').forEach(el => {
        el.classList.remove('catSelected');
        el.querySelector('.subList')?.classList.remove('subListOpen');
        el.querySelector('.catArrow')?.classList.remove('catArrowOpen');
      });
      if (!wasSelected) {
        catItem?.classList.add('catSelected');
        catItem?.querySelector('.subList')?.classList.add('subListOpen');
        catItem?.querySelector('.catArrow')?.classList.add('catArrowOpen');
        const allRadio = catItem?.querySelector('[name="filterSub"][value=""]');
        if (allRadio) allRadio.checked = true;
      }
    });
  }

  // Price pills
  document.querySelectorAll('.pricePill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.getElementById('filterPriceMin').value = pill.dataset.min || '';
      document.getElementById('filterPriceMax').value = pill.dataset.max || '';
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

  document.getElementById('btnApplyFilters')?.addEventListener('click', () => {
    onFilterChange(collectFilters());
  });

  document.getElementById('btnClearFilters')?.addEventListener('click', () => {
    onClearFilters();
  });

  document.querySelectorAll('.filterInput, .priceInput').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') onFilterChange(collectFilters());
    });
  });
}

function collectFilters() {
  const selectedCat = document.querySelector('.catItem.catSelected');
  const category = selectedCat?.dataset.cat || '';
  const selectedSub = document.querySelector('[name="filterSub"]:checked');
  const subcategory = selectedSub?.value || '';

  return {
    search: document.getElementById('filterSearch')?.value.trim() || '',
    category,
    subcategory,
    brand: document.querySelector('[name="filterBrand"]:checked')?.value || '',
    provider: document.getElementById('filterProvider')?.value || '',
    priceMin: parseFloat(document.getElementById('filterPriceMin')?.value) || null,
    priceMax: parseFloat(document.getElementById('filterPriceMax')?.value) || null,
    currency: document.querySelector('.btnCurrency.active')?.dataset.currency || 'ARS',
    inStock: document.getElementById('filterStock')?.checked || false,
    withIVA: document.getElementById('filterIVA')?.checked !== false,
    fx: parseFloat(document.getElementById('filterFX')?.value) || null,
  };
}

export function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('q') || '',
    category: params.get('cat') || '',
    subcategory: params.get('sub') || '',
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
  if (filters.subcategory) params.set('sub', filters.subcategory);
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
