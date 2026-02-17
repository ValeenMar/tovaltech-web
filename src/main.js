// File: /src/main.js
// Router principal con separación de vistas cliente/admin

import './bootstrap/uiInit.js';

import { HomePage, wireHome } from './pages/home.js';
import { TiendaPage, wireTienda } from './pages/tienda.js';
import { CatalogoPage, wireCatalogo } from './pages/catalogo.js';
import { LoginPage, wireLogin } from './pages/login.js';
import { ContactoPage, wireContacto } from './pages/contacto.js';
import { CarritoPage, wireCarrito } from './pages/carrito.js';
import { ProductDetailPage, wireProductDetail } from './pages/productDetail.js';

// Estado global
let currentUser = null;

// Rutas públicas (sin login)
const PUBLIC_ROUTES = ['/', '/tienda', '/contacto', '/login'];

// Rutas cliente (requieren login customer/admin)
const CLIENT_ROUTES = ['/tienda', '/carrito', '/mis-pedidos'];

// Rutas admin (solo admin)
const ADMIN_ROUTES = ['/catalogo', '/proveedores', '/configuracion', '/admin', '/jeffrey'];

// Router con soporte para parámetros
const routes = [
  { path: '/', view: HomePage, wire: wireHome, auth: false },
  { path: '/tienda', view: TiendaPage, wire: wireTienda, auth: false },
  { path: '/catalogo', view: CatalogoPage, wire: wireCatalogo, auth: 'admin' },
  { path: '/login', view: LoginPage, wire: wireLogin, auth: false },
  { path: '/contacto', view: ContactoPage, wire: wireContacto, auth: false },
  { path: '/carrito', view: CarritoPage, wire: wireCarrito, auth: false },
  
  // Rutas con parámetros
  { 
    path: '/producto/:sku', 
    view: ProductDetailPage, 
    wire: async (params) => wireProductDetail(params.sku, false),
    auth: false 
  },
  { 
    path: '/admin/producto/nuevo', 
    view: () => '<div class="page"><p>Próximamente: Formulario de nuevo producto</p><a href="/catalogo" data-link class="btn btnPrimary">Volver al Catálogo</a></div>', 
    auth: 'admin' 
  },
  { 
    path: '/admin/producto/:sku', 
    view: ProductDetailPage, 
    wire: async (params) => wireProductDetail(params.sku, true),
    auth: 'admin' 
  },
];

// Función para matchear rutas con parámetros
function matchRoute(path) {
  // Primero intentar match exacto
  const exactMatch = routes.find(route => route.path === path);
  if (exactMatch) {
    return { route: exactMatch, params: {} };
  }
  
  // Luego intentar match con parámetros
  for (const route of routes) {
    const pattern = route.path.replace(/:[^\s/]+/g, '([^/]+)');
    const regex = new RegExp(`^${pattern}$`);
    const match = path.match(regex);
    
    if (match) {
      const paramNames = (route.path.match(/:[^\s/]+/g) || []).map(p => p.slice(1));
      const params = {};
      paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });
      return { route, params };
    }
  }
  
  return null;
}

async function router() {
  const path = window.location.pathname;
  
  // Check auth
  await loadCurrentUser();
  
  // Match route
  const match = matchRoute(path);
  
  if (!match) {
    render404();
    return;
  }
  
  const { route, params } = match;
  
  // Verificar permisos
  if (route.auth === 'admin' && !isAdmin()) {
    redirectToLogin();
    return;
  }
  
  if (route.auth && !currentUser) {
    redirectToLogin();
    return;
  }
  
  // Renderizar
  const appContent = document.getElementById('appContent');
  if (appContent && route.view) {
    appContent.innerHTML = route.view(params);
    
    if (route.wire) {
      await route.wire(params);
    }
  }
  
  updateNav();
}

async function loadCurrentUser() {
  try {
    const token = localStorage.getItem('toval_token');
    if (!token) {
      currentUser = null;
      return;
    }
    
    // Try to fetch user info, but don't fail if endpoint doesn't exist
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        return;
      }
    } catch (apiErr) {
      // /api/me might not exist, that's OK
      console.log('API /me not available, using token payload');
    }
    
    // Fallback: decode token to get user info
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = {
        email: payload.email || payload.sub,
        role: payload.role || 'customer',
        name: payload.name || payload.email
      };
    } catch (decodeErr) {
      // Token invalid
      currentUser = null;
      localStorage.removeItem('toval_token');
    }
    
  } catch (err) {
    console.error('Error loading user:', err);
    currentUser = null;
  }
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function isCustomer() {
  return currentUser && (currentUser.role === 'customer' || currentUser.role === 'admin');
}

function redirectToLogin() {
  window.location.href = '/login';
}

function render404() {
  const appContent = document.getElementById('appContent');
  if (appContent) {
    appContent.innerHTML = `
      <div class="page404">
        <h1>404</h1>
        <p>Página no encontrada</p>
        <a href="/" data-link class="btn btnPrimary">Volver al Home</a>
      </div>
    `;
  }
}

function updateNav() {
  const navLinks = document.querySelectorAll('[data-nav-link]');
  const currentPath = window.location.pathname;
  
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Mostrar/ocultar elementos según rol
  const adminOnly = document.querySelectorAll('[data-admin-only]');
  const clientOnly = document.querySelectorAll('[data-client-only]');
  
  if (isAdmin()) {
    adminOnly.forEach(el => el.style.display = '');
    clientOnly.forEach(el => el.style.display = '');
  } else if (isCustomer()) {
    adminOnly.forEach(el => el.style.display = 'none');
    clientOnly.forEach(el => el.style.display = '');
  } else {
    adminOnly.forEach(el => el.style.display = 'none');
    clientOnly.forEach(el => el.style.display = 'none');
  }
  
  // Trigger userMenu update from index.html
  if (typeof window.updateUserMenu === 'function') {
    window.updateUserMenu();
  }
}

// Navegación SPA
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-link]') || e.target.closest('[data-link]')) {
    e.preventDefault();
    const link = e.target.matches('[data-link]') ? e.target : e.target.closest('[data-link]');
    const href = link.getAttribute('href');
    
    if (href && href !== window.location.pathname) {
      window.history.pushState({}, '', href);
      router();
    }
  }
});

window.addEventListener('popstate', router);
window.addEventListener('DOMContentLoaded', router);

// Export helpers
export { currentUser, isAdmin, isCustomer };
