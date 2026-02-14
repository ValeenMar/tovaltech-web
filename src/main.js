// File: /src/main.js
import { AUTH_KEY } from "./config.js";

import { CatalogoPage, wireCatalogo } from "./pages/catalogo.js";
import { ProveedoresPage, wireProveedores } from "./pages/proveedores.js";
import { ChatPage, wireChat } from "./pages/chat.js";
import { NosotrosPage, wireNosotros } from "./pages/nosotros.js";
import { ContactoPage, wireContacto } from "./pages/contacto.js";

const app = document.querySelector("#app");

const isAuthed = () => localStorage.getItem(AUTH_KEY) !== null;
const setAuthed = (token) => {
  if (token) localStorage.setItem(AUTH_KEY, token);
  else localStorage.removeItem(AUTH_KEY);
};

// Solo Jeffrey (chat) es admin-only
const PROTECTED = new Set(["/chat"]);

// Hero copy (por defecto opción 1)
const HOME_COPY = {
  badge: "TovalTech • Catálogo + Proveedores",
  title: "Catálogo y proveedores en un solo lugar.",
  sub: "Buscá productos, compará proveedores y centralizá pedidos. Jeffrey queda para administración.",
  ctas: [
    { href: "/catalogo", label: "Ver Catálogo", cls: "btn btnPrimary" },
    { href: "/proveedores", label: "Ver Proveedores", cls: "btn" },
    { href: "/chat", label: "Jeffrey (admin)", cls: "btn btnGhost" },
  ]
};

const routes = {
  "/": () => `
    <section class="hero">
      <span class="badge">${HOME_COPY.badge}</span>
      <h1 class="heroTitle">${HOME_COPY.title}</h1>
      <p class="heroSub">${HOME_COPY.sub}</p>
      <div class="heroActions">
        ${HOME_COPY.ctas.map(c => `<a class="${c.cls}" href="${c.href}" data-link>${c.label}</a>`).join("")}
      </div>
    </section>
  `,

  "/catalogo": CatalogoPage,
  "/proveedores": ProveedoresPage,
  "/nosotros": NosotrosPage,
  "/contacto": ContactoPage,
  "/chat": ChatPage,

  "/login": () => `
  <div class="authWrap">
    <div class="authCard">
      <h2>Login</h2>
      <p class="muted" style="margin-top:8px;">Ingresá con tu email y contraseña.</p>

      <div style="display:flex; flex-direction:column; gap:12px; margin-top:16px;">
        <input id="email" type="email" placeholder="Email" autocomplete="email" style="width:100%;" />
        <input id="pw" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;" />
        <button id="loginBtn" class="btn btnPrimary" style="width:100%;">Entrar</button>
      </div>

      <p id="msg" class="errorText"></p>
    </div>
  </div>
`,
};

function navigateTo(path, { replace = false } = {}) {
  const url = new URL(path, window.location.origin);
  if (replace) window.history.replaceState({}, "", url.pathname + url.search);
  else window.history.pushState({}, "", url.pathname + url.search);
  render();
}

async function tryLogin() {
  const emailInput = document.querySelector("#email");
  const pwInput = document.querySelector("#pw");
  const msg = document.querySelector("#msg");
  
  const email = (emailInput?.value || "").trim();
  const password = (pwInput?.value || "").trim();

  // Validación básica
  if (!email) {
    msg.textContent = "Por favor ingresá tu email";
    emailInput?.focus();
    return;
  }

  if (!password) {
    msg.textContent = "Por favor ingresá tu contraseña";
    pwInput?.focus();
    return;
  }

  msg.textContent = "Verificando...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const raw = await response.text();
    let result = {};
    try { 
      result = raw ? JSON.parse(raw) : {}; 
    } catch { 
      result = { message: raw }; 
    }

    if (response.ok && result.success) {
      // Guardar token
      setAuthed(result.token);
      
      // Guardar info del usuario (opcional, para mostrar nombre después)
      if (result.user) {
        localStorage.setItem("tovaltech_user", JSON.stringify(result.user));
      }

      msg.textContent = "Login exitoso, redirigiendo...";
      msg.style.color = "#4ade80"; // verde

      // Redirigir según rol
      setTimeout(() => {
        const next = new URLSearchParams(window.location.search).get("next");
        navigateTo(next || "/", { replace: true });
      }, 500);
    } else {
      msg.style.color = "#ff6b6b"; // rojo
      msg.textContent = result.message || `Error: ${response.status}`;
    }
  } catch (err) {
    msg.style.color = "#ff6b6b";
    msg.textContent = "Error de conexión. Intentá de nuevo.";
    console.error("Login error:", err);
  }
}

function wireLogin() {
  const loginBtn = document.querySelector("#loginBtn");
  const emailInput = document.querySelector("#email");
  const pwInput = document.querySelector("#pw");

  loginBtn?.addEventListener("click", tryLogin);
  
  // Enter en cualquier campo hace submit
  emailInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });
  
  pwInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryLogin();
  });

  // Focus automático en email al cargar
  emailInput?.focus();
}

function updateNavUI() {
  const nav = document.querySelector("nav.nav");
  if (!nav) return;

  const authed = isAuthed();

  nav.querySelectorAll('[data-auth="login"]').forEach((el) => {
    el.style.display = authed ? "none" : "inline-flex";
  });
  nav.querySelectorAll('[data-auth="logout"]').forEach((el) => {
    el.style.display = authed ? "inline-flex" : "none";
  });
  nav.querySelectorAll('[data-auth="admin"]').forEach((el) => {
    el.style.display = authed ? "inline-flex" : "none";
  });

  const path = window.location.pathname;
  nav.querySelectorAll("a[data-link]").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href === "/logout") return;
    a.classList.toggle("active", href === path);
  });
}

/* Navbar inteligente:
   - si escriben “contacto” -> /contacto
   - si escriben “nosotros” -> /nosotros
   - si escriben “proveedores” -> /proveedores
   - si escriben “productos/catalogo” -> /catalogo
   - si escriben cualquier cosa -> /catalogo?q=...
*/
let navSearchWired = false;

function classifyNavQuery(raw) {
  const q = (raw || "").trim();
  const n = q.toLowerCase();

  if (!q) return null;

  const isOnly = (w) => n === w || n === w.replace("ó","o");

  if (isOnly("home") || isOnly("inicio")) return { type: "route", path: "/" };

  if (n.includes("contact")) return { type: "route", path: "/contacto" };
  if (n.includes("nosotr") || n.includes("about")) return { type: "route", path: "/nosotros" };

  if (n.includes("proveedor")) return { type: "route", path: "/proveedores" };

  if (n.includes("producto") || n.includes("catalogo") || n.includes("catálogo")) {
    // si escriben “productos i5 4600t” => buscar en catálogo con resto
    const cleaned = q.replace(/productos?|cat[aá]logo/ig, "").trim();
    if (cleaned) return { type: "catalog", query: cleaned };
    return { type: "route", path: "/catalogo" };
  }

  if (n.includes("jeffrey") || n === "chat" || n.includes("admin")) return { type: "route", path: "/chat" };

  return { type: "catalog", query: q };
}

function buildSuggestions(raw) {
  const intent = classifyNavQuery(raw);
  const q = (raw || "").trim();

  if (!q) return [];

  const out = [];

  // sugerencias de navegación
  const navTargets = [
    { key: "Contacto", match: /contact/i, path: "/contacto" },
    { key: "Nosotros", match: /nosotr|about/i, path: "/nosotros" },
    { key: "Proveedores", match: /proveedor/i, path: "/proveedores" },
    { key: "Productos", match: /producto|cat[aá]logo/i, path: "/catalogo" },
    { key: "Jeffrey", match: /jeffrey|admin|chat/i, path: "/chat" },
  ];

  for (const t of navTargets) {
    if (t.match.test(q)) out.push({ label: `Ir a ${t.key}`, path: t.path, kind: "go" });
  }

  // siempre ofrecer búsqueda en catálogo
  if (intent?.type === "catalog") {
    out.unshift({ label: `Buscar en Catálogo: “${q}”`, path: `/catalogo?q=${encodeURIComponent(q)}`, kind: "search" });
  } else if (intent?.type === "route") {
    out.unshift({ label: `Abrir: ${intent.path}`, path: intent.path, kind: "go" });
  }

  // cortar
  return out.slice(0, 5);
}

function wireNavSearchSmart() {
  if (navSearchWired) return;
  navSearchWired = true;

  const form = document.querySelector("#navSearch");
  const input = document.querySelector("#navQ");
  const suggest = document.querySelector("#navSuggest");

  if (!form || !input || !suggest) return;

  const closeSuggest = () => { suggest.hidden = true; suggest.innerHTML = ""; };

  const openSuggest = (items) => {
    if (!items.length) return closeSuggest();
    suggest.innerHTML = items.map((it, idx) => `
      <div class="navSuggestItem" data-idx="${idx}">
        <span>${escapeHtml(it.label)}</span>
        <span class="navSuggestKbd">↵</span>
      </div>
    `).join("");
    suggest.hidden = false;

    // attach click
    suggest.querySelectorAll(".navSuggestItem").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        // mousedown para que no se cierre antes por blur
        e.preventDefault();
        const i = Number(el.getAttribute("data-idx"));
        const items2 = buildSuggestions(input.value);
        const chosen = items2[i];
        if (chosen) {
          closeSuggest();
          navigateTo(chosen.path);
        }
      });
    });
  };

  input.addEventListener("input", () => {
    openSuggest(buildSuggestions(input.value));
  });

  input.addEventListener("focus", () => {
    openSuggest(buildSuggestions(input.value));
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSuggest();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = (input.value || "").trim();
    if (!raw) return;

    const items = buildSuggestions(raw);
    const chosen = items[0] || null;

    closeSuggest();

    if (chosen) return navigateTo(chosen.path);

    // fallback
    const intent = classifyNavQuery(raw);
    if (intent?.type === "route") return navigateTo(intent.path);
    return navigateTo(`/catalogo?q=${encodeURIComponent(raw)}`);
  });

  document.addEventListener("click", (e) => {
    if (form.contains(e.target)) return;
    closeSuggest();
  });
}

function render() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (PROTECTED.has(path) && !isAuthed()) {
    navigateTo(`/login?next=${encodeURIComponent(path)}`, { replace: true });
    return;
  }

  const viewFn = routes[path] || (() => `<div class="card"><h2>404</h2><p class="muted" style="margin-top:10px;">Ruta no encontrada.</p></div>`);
  app.innerHTML = viewFn();

  updateNavUI();
  wireNavSearchSmart();

  if (path === "/catalogo") wireCatalogo(app, params.get("q") || "");
  if (path === "/proveedores") wireProveedores();
  if (path === "/chat") wireChat();
  if (path === "/nosotros") wireNosotros();
  if (path === "/contacto") wireContacto();
  if (path === "/login") wireLogin();
}

window.addEventListener("popstate", render);

document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-link]");
    if (!link) return;

    e.preventDefault();
    const href = link.getAttribute("href");

    if (href === "/logout") {
      setAuthed(null);
      navigateTo("/", { replace: true });
      return;
    }

    navigateTo(href);
  });

  render();
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => {
    switch (m) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return m;
    }
  });
}
// ... imports existentes ...
import { SettingsPage, wireSettings } from "./pages/settings.js";

// ... código existente ...

const routes = {
  "/": () => `...`,
  "/catalogo": CatalogoPage,
  "/proveedores": ProveedoresPage,
  "/nosotros": NosotrosPage,
  "/contacto": ContactoPage,
  "/chat": ChatPage,
  "/settings": SettingsPage, // ← NUEVA LÍNEA
  "/login": () => `...`,
};

// ... más código ...

// En la función render(), agregar:
function render() {
  // ... código existente ...

  if (path === "/settings") wireSettings();
  
  // ... resto del código ...
}