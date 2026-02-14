/**
 * Utilidad para agregar toggle de password
 * Uso: wrapPasswordInput(inputElement)
 */

/**
 * Convierte un input[type=password] en uno con toggle visible
 */
export function wrapPasswordInput(input) {
  if (!input || input.type !== "password") return input;

  // Si ya está wrapped, no hacer nada
  if (input.parentElement?.classList.contains("passwordWrapper")) {
    return input.parentElement;
  }

  // Crear wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "passwordWrapper";

  // Crear botón toggle
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "passwordToggle";
  toggle.setAttribute("aria-label", "Mostrar contraseña");
  toggle.innerHTML = getEyeIcon(false);

  let isVisible = false;

  toggle.addEventListener("click", () => {
    isVisible = !isVisible;
    input.type = isVisible ? "text" : "password";
    toggle.innerHTML = getEyeIcon(isVisible);
    toggle.setAttribute("aria-label", isVisible ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  // Reemplazar input con wrapper
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  wrapper.appendChild(toggle);

  return wrapper;
}

/**
 * SVG del ícono de ojo (abierto/cerrado)
 */
function getEyeIcon(visible) {
  if (visible) {
    // Ojo tachado (ocultar)
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    `;
  } else {
    // Ojo abierto (mostrar)
    return `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
  }
}

/**
 * Wire todos los inputs de password en un contenedor
 */
export function wirePasswordToggles(container = document) {
  const inputs = container.querySelectorAll('input[type="password"]');
  inputs.forEach(wrapPasswordInput);
}