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
              <a href="mailto:contacto@tovaltech.com" class="infoLink">contacto@tovaltech.com</a>
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
          <div class="formRow">
            <div class="formGroup">
              <label for="cName">Nombre</label>
              <input id="cName" type="text" placeholder="Tu nombre" required />
            </div>
            <div class="formGroup">
              <label for="cEmail">Email</label>
              <input id="cEmail" type="email" placeholder="tu@email.com" required />
            </div>
          </div>

          <div class="formGroup">
            <label for="cSubject">Asunto</label>
            <select id="cSubject">
              <option value="consulta">Consulta General</option>
              <option value="comercial">Consulta Comercial</option>
              <option value="proveedor">Alta de Proveedor</option>
              <option value="soporte">Soporte Técnico</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div class="formGroup">
            <label for="cMsg">Mensaje</label>
            <textarea id="cMsg" placeholder="Contanos cómo podemos ayudarte..." rows="5" required></textarea>
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
  const nameInput = document.querySelector("#cName");
  const emailInput = document.querySelector("#cEmail");
  const subjectInput = document.querySelector("#cSubject");
  const msgInput = document.querySelector("#cMsg");
  const status = document.querySelector("#cStatus");

  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const subject = subjectInput.options[subjectInput.selectedIndex].text;
    const message = msgInput.value.trim();

    if (!name || !email || !message) {
      status.textContent = "⚠️ Por favor completá todos los campos";
      status.className = "statusMsg error";
      return;
    }

    const emailSubject = encodeURIComponent(`[TovalTech] ${subject}`);
    const emailBody = encodeURIComponent(
      `Nombre: ${name}\nEmail: ${email}\nAsunto: ${subject}\n\nMensaje:\n${message}\n\n---\nEnviado desde tovaltech.com`
    );

    const mailtoURL = `mailto:contacto@tovaltech.com?subject=${emailSubject}&body=${emailBody}`;
    
    window.location.href = mailtoURL;
    
    status.textContent = "✅ Abriendo tu cliente de email...";
    status.className = "statusMsg success";

    // Reset form after 3 seconds
    setTimeout(() => {
      form.reset();
      status.textContent = "";
    }, 3000);
  });
}
