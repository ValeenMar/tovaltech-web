// File: /src/pages/contacto.js
export function ContactoPage() {
  return `
    <div class="contactContainer">
      <div class="contactCard card">
        <div class="contactHeader">
          <h2>Contacto</h2>
          <p class="muted">Escribinos para consultas comerciales, alta de proveedores o soporte técnico</p>
        </div>

        <div class="contactInfo">
          <div class="infoCard">
            <div class="infoIcon">📧</div>
            <div class="infoContent">
              <h3>Email</h3>
              <a href="mailto:valentin@toval-tech.com" class="infoLink">valentin@toval-tech.com</a>
              <p class="muted small">Respondemos en 24-48hs hábiles</p>
            </div>
          </div>

          <div class="infoCard">
            <div class="infoIcon">📱</div>
            <div class="infoContent">
              <h3>WhatsApp</h3>
              <a href="https://wa.me/5491123413674" class="infoLink" target="_blank">+54 9 11 2341-3674</a>
              <p class="muted small">Lunes a Viernes 9-18hs</p>
            </div>
          </div>
        </div>

        <div class="contactDivider">
          <span>o envianos un mensaje rápido</span>
        </div>

        <form id="contactForm" class="contactForm">
          <!-- Web3Forms Access Key -->
          <input type="hidden" name="access_key" value="1dd49439-8cef-47e3-aaf2-93ce94285b9c">
          
          <!-- Redirect después de enviar (opcional) -->
          <input type="hidden" name="redirect" value="https://tovaltech.com/contacto?success=true">
          
          <div class="formRow">
            <div class="formGroup">
              <label for="cName">Nombre</label>
              <input id="cName" name="name" type="text" placeholder="Tu nombre" required />
            </div>
            <div class="formGroup">
              <label for="cEmail">Email</label>
              <input id="cEmail" name="email" type="email" placeholder="tu@email.com" required />
            </div>
          </div>

          <div class="formGroup">
            <label for="cSubject">Asunto</label>
            <select id="cSubject" name="subject">
              <option value="consulta">Consulta General</option>
              <option value="comercial">Consulta Comercial</option>
              <option value="proveedor">Alta de Proveedor</option>
              <option value="soporte">Soporte Técnico</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div class="formGroup">
            <label for="cMsg">Mensaje</label>
            <textarea id="cMsg" name="message" placeholder="Contanos cómo podemos ayudarte..." rows="5" required></textarea>
          </div>

          <button type="submit" class="btn btnPrimary btnFull">
            Enviar Mensaje
          </button>
        </form>

        <p id="cStatus" class="statusMsg"></p>
      </div>
    </div>
  `;
}

export function wireContacto() {
  const form = document.querySelector("#contactForm");
  const status = document.querySelector("#cStatus");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    // Mostrar loading
    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";
    status.textContent = "📤 Enviando mensaje...";
    status.className = "statusMsg";

    try {
      const formData = new FormData(form);

      // Enviar a Web3Forms
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Éxito
        status.textContent = "✅ ¡Mensaje enviado! Te responderemos a la brevedad.";
        status.className = "statusMsg success";

        // Reset form
        form.reset();

        // Limpiar mensaje después de 5 segundos
        setTimeout(() => {
          status.textContent = "";
          status.className = "statusMsg";
        }, 5000);
      } else {
        // Error del servidor
        throw new Error(data.message || "Error al enviar el mensaje");
      }
    } catch (error) {
      // Error de red o servidor
      console.error("Error enviando formulario:", error);
      status.textContent = `❌ Error: ${error.message}. Por favor intentá de nuevo o escribinos a valentin@toval-tech.com`;
      status.className = "statusMsg error";
    } finally {
      // Restaurar botón
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
}
