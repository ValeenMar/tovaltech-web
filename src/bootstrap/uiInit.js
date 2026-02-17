// File: /src/bootstrap/uiInit.js
// Inicializacion de UI global (tema, menu usuario, carrito)

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function logout() {
  localStorage.removeItem('toval_token');
  window.location.href = '/';
}

async function updateUserMenu() {
  const userMenu = document.getElementById('userMenu');
  if (!userMenu) return;

  const token = localStorage.getItem('toval_token');

  if (!token) {
    userMenu.innerHTML = '<a href="/login" data-link class="btn btnPrimary">Ingresar</a>';
    return;
  }

  let displayName = null;

  try {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const user = data?.user || {};
      displayName = user.name || user.email || null;
    }
  } catch {
    // ignore and fallback to token decode
  }

  if (!displayName) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      displayName = payload.name || payload.email || payload.sub || null;
    } catch {
      localStorage.removeItem('toval_token');
      userMenu.innerHTML = '<a href="/login" data-link class="btn btnPrimary">Ingresar</a>';
      return;
    }
  }

  userMenu.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 14px; color: var(--text-secondary);">
        ${esc(displayName || 'Usuario')}
      </span>
      <button class="btn btnSecondary" data-logout>Salir</button>
    </div>
  `;
}

function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  const savedTheme = localStorage.getItem('toval_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);

  themeToggle?.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('toval_theme', next);
  });
}

function initGlobalHandlers() {
  document.addEventListener('click', (event) => {
    const logoutBtn = event.target.closest('[data-logout]');
    if (logoutBtn) {
      event.preventDefault();
      logout();
    }
  });
}

function initUiShell() {
  initThemeToggle();
  initGlobalHandlers();
  updateCartBadge();
  updateUserMenu();
}

window.updateUserMenu = updateUserMenu;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUiShell, { once: true });
} else {
  initUiShell();
}
