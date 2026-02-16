// File: /src/components/themeSwitcher.js

export function initThemeSwitcher() {
  // Verificar si ya existe el botón
  if (document.querySelector('.themeSwitcher')) return;
  
  // Leer tema guardado o usar oscuro por defecto
  const savedTheme = localStorage.getItem('tovaltech_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Crear el botón
  const button = document.createElement('button');
  button.className = 'themeSwitcher';
  button.setAttribute('aria-label', 'Cambiar tema');
  button.setAttribute('title', 'Cambiar tema');
  
  // Iconos SVG
  const sunIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  `;
  
  const moonIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  `;
  
  // Establecer icono inicial
  button.innerHTML = savedTheme === 'dark' ? sunIcon : moonIcon;
  
  // Función para cambiar tema
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    // Actualizar DOM
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Guardar preferencia
    localStorage.setItem('tovaltech_theme', newTheme);
    
    // Actualizar icono
    button.innerHTML = newTheme === 'dark' ? sunIcon : moonIcon;
    
    // Animación suave
    document.documentElement.style.transition = 'background-color 0.55s ease, color 0.55s ease';
    document.body.style.transition = 'background 0.55s ease, color 0.55s ease';
    setTimeout(() => {
      document.documentElement.style.transition = '';
      document.body.style.transition = '';
    }, 550);
  }
  
  button.addEventListener('click', toggleTheme);
  
  // Insertar al lado del carrito (a la derecha)
  const nav = document.querySelector('nav.nav');
  if (nav) {
    const cartIcon = nav.querySelector('#cartIcon,[data-cart-widget]');
    if (cartIcon && cartIcon.nextSibling) {
      nav.insertBefore(button, cartIcon.nextSibling);
    } else if (cartIcon) {
      nav.appendChild(button);
    } else {
      nav.appendChild(button);
    }
  }
}

// Detectar preferencia del sistema
export function detectSystemTheme() {
  if (!localStorage.getItem('tovaltech_theme')) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tovaltech_theme', theme);
  }
}
