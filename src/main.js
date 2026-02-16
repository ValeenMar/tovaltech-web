// File: /src/main.js
// Router principal con separación de vistas cliente/admin

import { HomePage, wireHome } from './pages/home.js';
import { TiendaPage, wireTienda } from './pages/tienda.js';
import { CatalogoPage, wireCatalogo } from './pages/catalogo.js';

// Estado global
let currentUser = null;

// Rutas públicas (sin login)
const PUBLIC_ROUTES = ['/', '/tienda', '/contacto', '/login'];

// Rutas cliente (requieren login customer/admin)
const CLIENT_ROUTES = ['/tienda', '/carrito', '/mis-pedidos'];

// Rutas admin (solo admin)
const ADMIN_ROUTES = ['/catalogo', '/proveedores', '/configuracion', '/admin', '/jeffrey'];

// Router
const routes = {
  '/': { view: HomePage, wire: wireHome, auth: false },
  '/tienda': { view: TiendaPage, wire: wireTienda, auth: false },
  '/catalogo': { view: CatalogoPage, wire: wireCatalogo, auth: 'admin' },
  // ... más rutas según necesidad
};

async function router() {
  const path = window.location.pathname;
  
  // Check auth
  await loadCurrentUser();
  
  const route = routes[path];
  
  if (!route) {
    render404();
    return;
  }
  
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
    appContent.innerHTML = route.view();
    
    if (route.wire) {
      await route.wire();
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
    
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      currentUser = null;
      localStorage.removeItem('toval_token');
      return;
    }
    
    const data = await res.json();
    currentUser = data.user;
    
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
