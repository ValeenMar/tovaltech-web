/**
 * Panel de administración de usuarios
 * Solo accesible por admins
 */

import { AUTH_KEY } from "../config.js";
import { wirePasswordToggles } from "../utils/passwordToggle.js";

export function SettingsPage() {
  return `
    <div class="settingsPage">
      <h2>Configuración</h2>
      <p class="muted">Gestión de usuarios y permisos</p>

      <div class="settingsTabs">
        <button class="tabBtn active" data-tab="users">Usuarios</button>
        <button class="tabBtn" data-tab="general">General</button>
      </div>

      <div id="tabContent" class="tabContent">
        <div id="usersTab" class="tabPane active">
          <div class="settingsHeader">
            <h3>Usuarios del Sistema</h3>
            <button id="addUserBtn" class="btn btnPrimary">+ Agregar Usuario</button>
          </div>

          <div id="usersList" class="usersList">
            <div class="loading">Cargando usuarios...</div>
          </div>
        </div>

        <div id="generalTab" class="tabPane hidden">
          <h3>Configuración General</h3>
          <p class="muted">Próximamente: configuración de proveedores, FX, etc.</p>
        </div>
      </div>
    </div>

    <!-- Modal: Agregar/Editar Usuario -->
    <div id="userModal" class="modal hidden" role="dialog">
      <div class="modalBackdrop" data-close-modal></div>
      <div class="modalPanel">
        <div class="modalHeader">
          <h3 id="modalTitle">Agregar Usuario</h3>
          <button class="modalClose" data-close-modal aria-label="Cerrar">✕</button>
        </div>

        <div class="modalBody">
          <div class="formGroup">
            <label for="userEmail">Email *</label>
            <input id="userEmail" type="email" placeholder="usuario@ejemplo.com" required />
          </div>

          <div class="formGroup">
            <label for="userName">Nombre</label>
            <input id="userName" type="text" placeholder="Nombre completo" />
          </div>

          <div class="formGroup">
            <label for="userRole">Rol *</label>
            <select id="userRole" required>
              <option value="customer">Cliente</option>
              <option value="vendor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div class="formGroup">
            <label for="userPassword">Password *</label>
            <input id="userPassword" type="password" placeholder="Mínimo 6 caracteres" />
            <small class="muted">Dejar vacío para mantener la actual (al editar)</small>
          </div>

          <p id="modalError" class="errorText"></p>
        </div>

        <div class="modalFooter">
          <button id="cancelBtn" class="btn" data-close-modal>Cancelar</button>
          <button id="saveUserBtn" class="btn btnPrimary">Guardar</button>
        </div>
      </div>
    </div>
  `;
}

export function wireSettings() {
  const usersList = document.querySelector("#usersList");
  const addUserBtn = document.querySelector("#addUserBtn");
  const modal = document.querySelector("#userModal");
  const modalTitle = document.querySelector("#modalTitle");
  const modalError = document.querySelector("#modalError");
  const saveUserBtn = document.querySelector("#saveUserBtn");

  const emailInput = document.querySelector("#userEmail");
  const nameInput = document.querySelector("#userName");
  const roleInput = document.querySelector("#userRole");
  const passwordInput = document.querySelector("#userPassword");

  let editingEmail = null;

  // Tabs
  document.querySelectorAll(".tabBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;

      document.querySelectorAll(".tabBtn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tabPane").forEach((p) => p.classList.add("hidden"));

      btn.classList.add("active");
      document.querySelector(`#${tab}Tab`).classList.remove("hidden");
    });
  });

  // Cerrar modal
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });

  // Abrir modal (crear)
  addUserBtn.addEventListener("click", () => {
    editingEmail = null;
    modalTitle.textContent = "Agregar Usuario";
    emailInput.value = "";
    nameInput.value = "";
    roleInput.value = "customer";
    passwordInput.value = "";
    passwordInput.required = true;
    emailInput.disabled = false;
    modalError.textContent = "";
    modal.classList.remove("hidden");
    emailInput.focus();
    wirePasswordToggles(modal);
  });

  // Guardar usuario
  saveUserBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const name = nameInput.value.trim();
    const role = roleInput.value;
    const password = passwordInput.value.trim();

    modalError.textContent = "";

    if (!email) {
      modalError.textContent = "El email es requerido";
      emailInput.focus();
      return;
    }

    if (!editingEmail && !password) {
      modalError.textContent = "La contraseña es requerida";
      passwordInput.focus();
      return;
    }

    if (password && password.length < 6) {
      modalError.textContent = "La contraseña debe tener al menos 6 caracteres";
      passwordInput.focus();
      return;
    }

    saveUserBtn.disabled = true;
    saveUserBtn.textContent = "Guardando...";

    try {
      // Intentar obtener el token de localStorage
      let token = localStorage.getItem(AUTH_KEY);
      
      // DEBUGGING: Ver si el token existe
      console.log('🔍 AUTH_KEY:', AUTH_KEY);
      console.log('🔍 Token desde AUTH_KEY:', token ? 'Existe' : 'NO existe');
      
      // Fallback: intentar con la key hardcoded por si AUTH_KEY está mal
      if (!token) {
        console.warn('⚠️ No hay token con AUTH_KEY, intentando con "tovaltech_auth"');
        token = localStorage.getItem('tovaltech_auth');
      }
      
      // Si sigue sin token, intentar con _v1
      if (!token) {
        console.warn('⚠️ Intentando con "tovaltech_auth_v1"');
        token = localStorage.getItem('tovaltech_auth_v1');
      }

      if (!token) {
        modalError.textContent = "No hay token de autenticación. Por favor cerrá sesión y volvé a entrar.";
        console.error('❌ No se encontró token en ninguna key');
        return;
      }

      console.log('✅ Token encontrado, length:', token.length);

      const method = editingEmail ? "PUT" : "POST";
      const url = editingEmail
        ? `/api/users/${encodeURIComponent(editingEmail)}`
        : `/api/users`;

      const body = { email, name, role };
      if (password) body.password = password;

      console.log('📤 Enviando petición:', method, url);
      console.log('📦 Body:', body);
      console.log('🔑 Token preview:', token.substring(0, 50) + '...');

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      console.log('📥 Respuesta HTTP:', res.status, res.statusText);

      const data = await res.json();
      console.log('📥 Respuesta data:', data);

      if (!res.ok || !data.ok) {
        modalError.textContent = data.error || `Error: ${res.status}`;
        console.error('❌ Error en respuesta:', data);
        return;
      }

      console.log('✅ Usuario guardado exitosamente');
      closeModal();
      loadUsers();
    } catch (err) {
      modalError.textContent = "Error de conexión: " + err.message;
      console.error('❌ Error de conexión:', err);
    } finally {
      saveUserBtn.disabled = false;
      saveUserBtn.textContent = "Guardar";
    }
  });

  // Cargar usuarios
  async function loadUsers() {
    usersList.innerHTML = '<div class="loading">Cargando usuarios...</div>';

    try {
      // Intentar obtener el token con fallback
      let token = localStorage.getItem(AUTH_KEY);
      if (!token) token = localStorage.getItem('tovaltech_auth');
      if (!token) token = localStorage.getItem('tovaltech_auth_v1');
      
      if (!token) {
        usersList.innerHTML = `
          <div class="emptyState">
            No estás autenticado. 
            <a href="/login" data-link style="color: var(--accent);">Ir a Login</a>
          </div>
        `;
        return;
      }

      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        if (res.status === 403) {
          usersList.innerHTML = `
            <div class="emptyState">
              <p><strong>Acceso denegado</strong></p>
              <p class="muted" style="margin-top:8px;">${data.error || "No tenés permisos de administrador"}</p>
              <p class="muted" style="margin-top:8px;">Si creés que esto es un error, cerrá sesión y volvé a entrar.</p>
              <div style="margin-top:16px;">
                <a href="/logout" data-link class="btn btnPrimary">Cerrar Sesión</a>
              </div>
            </div>
          `;
        } else {
          usersList.innerHTML = `<div class="emptyState">Error: ${data.error || res.status}</div>`;
        }
        return;
      }

      if (!data.users || !data.users.length) {
        usersList.innerHTML = '<div class="emptyState">No hay usuarios registrados</div>';
        return;
      }

      renderUsers(data.users);
    } catch (err) {
      usersList.innerHTML = '<div class="emptyState">Error de conexión</div>';
      console.error(err);
    }
  }

  function renderUsers(users) {
    const roleLabels = {
      admin: "Administrador",
      vendor: "Vendedor",
      customer: "Cliente",
    };

    const roleColors = {
      admin: "#00E5FF",
      vendor: "#8C5AFF",
      customer: "#4ade80",
    };

    usersList.innerHTML = `
      <div class="usersTable">
        ${users
          .map(
            (u) => `
          <div class="userRow" data-email="${esc(u.email)}">
            <div class="userInfo">
              <div class="userEmail">${esc(u.email)}</div>
              <div class="userName">${esc(u.name || "-")}</div>
            </div>
            <div class="userRole">
              <span class="roleBadge" style="background: ${roleColors[u.role] || "#666"}22; color: ${roleColors[u.role] || "#666"}; border-color: ${roleColors[u.role] || "#666"}44;">
                ${roleLabels[u.role] || u.role}
              </span>
            </div>
            <div class="userActions">
              <button class="btnIcon" data-action="edit" data-email="${esc(u.email)}" title="Editar">✏️</button>
              <button class="btnIcon" data-action="delete" data-email="${esc(u.email)}" title="Eliminar">🗑️</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    usersList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const email = btn.dataset.email;

      if (action === "edit") editUser(email);
      if (action === "delete") deleteUser(email);
    });
  }

  function editUser(email) {
    const userRow = usersList.querySelector(`.userRow[data-email="${email}"]`);
    if (!userRow) return;

    const name = userRow.querySelector(".userName")?.textContent.trim() || "";
    const roleText = userRow.querySelector(".roleBadge")?.textContent.trim().toLowerCase() || "";
    
    let role = "customer";
    if (roleText.includes("admin")) role = "admin";
    else if (roleText.includes("vendedor")) role = "vendor";

    editingEmail = email;
    modalTitle.textContent = "Editar Usuario";
    emailInput.value = email;
    emailInput.disabled = true;
    nameInput.value = name === "-" ? "" : name;
    roleInput.value = role;
    passwordInput.value = "";
    passwordInput.required = false;
    modalError.textContent = "";
    modal.classList.remove("hidden");
    nameInput.focus();
    wirePasswordToggles(modal);
  }

  async function deleteUser(email) {
    if (!confirm(`¿Eliminar usuario ${email}?`)) return;

    try {
      let token = localStorage.getItem(AUTH_KEY);
      if (!token) token = localStorage.getItem('tovaltech_auth');
      if (!token) token = localStorage.getItem('tovaltech_auth_v1');

      const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(`Error: ${data.error || res.status}`);
        return;
      }

      loadUsers();
    } catch (err) {
      alert("Error de conexión");
      console.error(err);
    }
  }

  function closeModal() {
    modal.classList.add("hidden");
    editingEmail = null;
  }

  loadUsers();
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
