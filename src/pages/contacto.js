// File: /src/pages/contacto.js
export function ContactoPage() {
  return `
    <div class="card">
      <h2>Contacto</h2>
      <p class="muted" style="margin-top:10px;">
        Escribinos para consultas comerciales, alta de proveedores o soporte.
      </p>

      <div style="margin-top:16px; display:grid; gap:10px;">
        <div class="card" style="background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.08); box-shadow: none;">
          <h3 style="margin:0 0 6px 0;">Email</h3>
          <p class="muted">contacto@tovaltech.com (placeholder)</p>
        </div>

        <div class="card" style="background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.08); box-shadow: none;">
          <h3 style="margin:0 0 6px 0;">Mensaje rápido</h3>
          <div class="filters" style="margin-top:10px;">
            <input id="cName" placeholder="Nombre" />
            <input id="cEmail" placeholder="Email" />
          </div>
          <div class="filters">
            <input id="cMsg" placeholder="Tu mensaje" style="flex:1; min-width: 280px;" />
            <button id="cSend" class="btn btnPrimary">Armar email</button>
          </div>
          <p id="cStatus" class="muted" style="margin-top:10px;"></p>
        </div>
      </div>
    </div>
  `;
}

export function wireContacto() {
  const name = document.querySelector("#cName");
  const email = document.querySelector("#cEmail");
  const msg = document.querySelector("#cMsg");
  const btn = document.querySelector("#cSend");
  const status = document.querySelector("#cStatus");

  if (!btn) return;

  btn.addEventListener("click", () => {
    const n = (name?.value || "").trim();
    const e = (email?.value || "").trim();
    const m = (msg?.value || "").trim();

    const subject = encodeURIComponent("Contacto TovalTech");
    const body = encodeURIComponent(
      `Nombre: ${n}\nEmail: ${e}\n\nMensaje:\n${m}\n`
    );

    // placeholder email
    const to = "contacto@tovaltech.com";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    status.textContent = "Abriendo tu cliente de mail…";
  });
}
