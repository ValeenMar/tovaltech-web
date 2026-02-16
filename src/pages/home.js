// File: /src/pages/home.js
// Home E-commerce profesional para TovalTech

import { fetchFeaturedProducts, getCategoryStats } from '../utils/dataHelpers.js';

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORIES = [
  {
    id: 'monitores',
    name: 'Monitores',
    icon: '🖥️',
    description: 'Pantallas LED, IPS, QHD, 4K'
  },
  {
    id: 'componentes',
    name: 'Componentes PC',
    icon: '⚡',
    description: 'GPUs, CPUs, RAM, Storage'
  },
  {
    id: 'perifericos',
    name: 'Periféricos',
    icon: '⌨️',
    description: 'Teclados, Mouse, Audio'
  },
  {
    id: 'notebooks',
    name: 'Notebooks',
    icon: '💻',
    description: 'Portátiles y All-in-One'
  },
  {
    id: 'redes',
    name: 'Networking',
    icon: '📡',
    description: 'Routers, Switches, WiFi'
  },
  {
    id: 'almacenamiento',
    name: 'Almacenamiento',
    icon: '💾',
    description: 'Discos externos, Pendrives'
  }
];

export function HomePage() {
  return `
    <div class="homePage">
      <!-- Hero Section -->
      <section class="homeHero">
        <div class="heroContent">
          <span class="heroBadge">TovalTech</span>
          <h1 class="heroTitle">
            Tecnología para <span class="heroAccent">empresas</span>
            <br/>y particulares
          </h1>
          <p class="heroSubtitle">
            Hardware, periféricos y soluciones informáticas con 
            asesoramiento personalizado y precios competitivos.
          </p>
          <div class="heroActions">
            <a href="/tienda" data-link class="btn btnHero btnPrimary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Ver Tienda
            </a>
            <a href="/contacto" data-link class="btn btnHero btnSecondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Consultar
            </a>
          </div>
        </div>
        
        <div class="heroVisual">
          <div class="heroGradient"></div>
          <div class="heroPattern"></div>
        </div>
      </section>

      <!-- Categories Grid -->
      <section class="homeSection">
        <div class="sectionHeader">
          <h2 class="sectionTitle">Categorías</h2>
          <p class="sectionSubtitle">Explorá por tipo de producto</p>
        </div>
        
        <div class="categoriesGrid" id="categoriesGrid">
          ${CATEGORIES.map(cat => `
            <a href="/tienda?cat=${esc(cat.id)}" data-link class="categoryCard">
              <div class="categoryIcon">${cat.icon}</div>
              <h3 class="categoryName">${esc(cat.name)}</h3>
              <p class="categoryDesc">${esc(cat.description)}</p>
              <div class="categoryArrow">→</div>
            </a>
          `).join('')}
        </div>
      </section>

      <!-- Featured Products -->
      <section class="homeSection">
        <div class="sectionHeader">
          <h2 class="sectionTitle">Productos Destacados</h2>
          <p class="sectionSubtitle">Selección de equipamiento tech</p>
        </div>
        
        <div id="featuredProducts" class="featuredGrid">
          <div class="loading">Cargando productos...</div>
        </div>
      </section>

      <!-- What We Do (3 blocks) -->
      <section class="homeSection homeServices">
        <div class="sectionHeader">
          <h2 class="sectionTitle">¿Qué hacemos?</h2>
          <p class="sectionSubtitle">Soluciones integrales en tecnología</p>
        </div>
        
        <div class="servicesGrid">
          <div class="serviceCard">
            <div class="serviceIcon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <h3 class="serviceTitle">Cotizaciones</h3>
            <p class="serviceDesc">
              Presupuestos personalizados para empresas y particulares. 
              Precios competitivos y asesoramiento técnico incluido.
            </p>
          </div>

          <div class="serviceCard">
            <div class="serviceIcon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <h3 class="serviceTitle">Abastecimiento</h3>
            <p class="serviceDesc">
              Acceso a múltiples proveedores. Stock permanente de 
              componentes, periféricos y equipamiento informático.
            </p>
          </div>

          <div class="serviceCard">
            <div class="serviceIcon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M2 12h20"/>
                <circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <h3 class="serviceTitle">Soporte & Asesoría</h3>
            <p class="serviceDesc">
              Consultoría técnica pre y post-venta. Te ayudamos a elegir 
              el equipamiento ideal para tus necesidades.
            </p>
          </div>
        </div>
      </section>

      <!-- Brands -->
      <section class="homeSection homeBrands">
        <div class="sectionHeader">
          <h2 class="sectionTitle">Marcas con las que trabajamos</h2>
        </div>
        
        <div class="brandsMarquee">
          <div class="brandsTrack">
            ${['DELL EMC', 'LENOVO', 'CISCO', 'APC', 'ASUSTOR', 'SEAGATE', 'VEEAM', 'ARUBA', 'MICROSOFT', 'JABRA', 'PURE', 'SANDISK', 'KINGSTON', 'HPE', 'EATON', 'UBIQUITI'].map(brand => `
              <div class="brandItem">
                <span>${esc(brand)}</span>
              </div>
            `).join('')}
            ${['DELL EMC', 'LENOVO', 'CISCO', 'APC', 'ASUSTOR', 'SEAGATE', 'VEEAM', 'ARUBA'].map(brand => `
              <div class="brandItem">
                <span>${esc(brand)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `;
}

export function wireHome() {
  loadFeaturedProducts();
  
  // Animación de entrada
  const cards = document.querySelectorAll('.categoryCard, .serviceCard');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, 100 * i);
  });
}

async function loadFeaturedProducts() {
  const container = document.getElementById('featuredProducts');
  if (!container) return;
  
  try {
    const products = await fetchFeaturedProducts(6);
    
    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="emptyState">
          <p>No hay productos destacados disponibles</p>
          <a href="/tienda" data-link class="btn btnPrimary">Ver Tienda Completa</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = products.map((p, idx) => renderProductCard(p, idx)).join('');
    
    // Lazy loading
    setupLazyLoading();
    
    // Wire clicks
    container.querySelectorAll('.featuredCard').forEach((card, idx) => {
      card.addEventListener('click', () => {
        window.location.href = `/tienda?sku=${encodeURIComponent(products[idx].sku)}`;
      });
    });
    
  } catch (err) {
    console.error('Error loading featured:', err);
    container.innerHTML = `
      <div class="emptyState">
        <p>Error cargando productos</p>
        <a href="/tienda" data-link class="btn btnPrimary">Ir a la Tienda</a>
      </div>
    `;
  }
}

function renderProductCard(p, idx) {
  const priceDisplay = p.finalPrice 
    ? `<div class="cardPrice">
         <span class="priceAmount">${formatMoney(p.finalPrice, 'ARS')}</span>
         <span class="priceLabel">IVA incluido</span>
       </div>`
    : '<div class="cardPrice"><span class="priceLabel">Consultar</span></div>';
  
  const img = p.imageUrl || p.thumbUrl;
  const hasStock = p.stock > 0;
  
  return `
    <div class="featuredCard" data-idx="${idx}">
      ${hasStock ? '' : '<div class="cardBadge outOfStock">Sin Stock</div>'}
      
      <div class="cardMedia">
        ${img 
          ? `<img data-src="${esc(img)}" alt="${esc(p.name)}" class="cardImg" />`
          : `<div class="cardPlaceholder">${esc((p.brand || p.name || '?')[0])}</div>`
        }
      </div>
      
      <div class="cardBody">
        <h3 class="cardTitle">${esc(p.name || 'Producto')}</h3>
        ${p.brand ? `<p class="cardBrand">${esc(p.brand)}</p>` : ''}
        ${priceDisplay}
      </div>
    </div>
  `;
}

function formatMoney(amount, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('es-AR')}`;
  }
}

function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
            observer.unobserve(img);
          }
        }
      });
    }, { rootMargin: '50px' });
    
    document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
  } else {
    // Fallback
    document.querySelectorAll('img[data-src]').forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      img.classList.add('loaded');
    });
  }
}
