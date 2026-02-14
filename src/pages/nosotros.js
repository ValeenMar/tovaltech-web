// File: /src/pages/nosotros.js
export function NosotrosPage() {
  return `
    <div class="card">
      <h2>Nosotros</h2>
      <p class="muted" style="margin-top:10px;">
        TovalTech centraliza catálogo y proveedores para operar más simple: buscar, comparar, y preparar órdenes.
      </p>

      <div style="margin-top:16px; display:grid; gap:10px;">
        <div class="card" style="background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.08); box-shadow: none;">
          <h3 style="margin:0 0 6px 0;">Objetivo</h3>
          <p class="muted">Unificar información, reducir fricción y acelerar el flujo comercial.</p>
        </div>

        <div class="card" style="background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.08); box-shadow: none;">
          <h3 style="margin:0 0 6px 0;">Estructura</h3>
          <p class="muted">Sitio público (catálogo/proveedores) + panel admin (Jeffrey).</p>
        </div>
      </div>
    </div>
  `;
}

export function wireNosotros() {}
