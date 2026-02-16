// File: /src/pages/login.js
export function LoginPage() {
  return `
    <div class="loginContainer">
      <div class="loginCard card">
        <div class="loginHeader">
          <h2>Iniciar Sesión</h2>
          <p class="muted">Accedé a tu cuenta de TovalTech</p>
        </div>

        <form id="loginForm" class="loginForm">
          <div class="formGroup">
            <label for="loginEmail">Email</label>
            <input 
              id="loginEmail" 
              type="email" 
              placeholder="tu@email.com" 
              required 
              autocomplete="email"
            />
          </div>

          <div class="formGroup">
            <label for="loginPassword">Contraseña</label>
            <input 
              id="loginPassword" 
              type="password" 
              placeholder="••••••••" 
              required 
              autocomplete="current-password"
            />
          </div>

          <div id="loginError" class="errorText"></div>

          <button type="submit" class="btn btnPrimary btnFull" id="loginBtn">
            Ingresar
          </button>
        </form>

        <div class="loginFooter">
          <p class="muted">¿No tenés cuenta? Contactá al administrador</p>
        </div>
      </div>
    </div>
  `;
}

export async function wireLogin() {
  const form = document.querySelector("#loginForm");
  const emailInput = document.querySelector("#loginEmail");
  const passwordInput = document.querySelector("#loginPassword");
  const errorDiv = document.querySelector("#loginError");
  const loginBtn = document.querySelector("#loginBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorDiv.textContent = "Por favor completá todos los campos";
      return;
    }

    // Clear previous error
    errorDiv.textContent = "";
    loginBtn.textContent = "Ingresando...";
    loginBtn.disabled = true;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      // Save token
      if (data.token) {
        localStorage.setItem("toval_token", data.token);
        
        // Redirect based on role with full page reload to update UI
        if (data.user && data.user.role === "admin") {
          window.location.href = "/catalogo";
        } else {
          window.location.href = "/tienda";
        }
      } else {
        throw new Error("No se recibió token de autenticación");
      }

    } catch (err) {
      console.error("Login error:", err);
      errorDiv.textContent = err.message || "Error al iniciar sesión. Verificá tus credenciales.";
      loginBtn.textContent = "Ingresar";
      loginBtn.disabled = false;
    }
  });
}
