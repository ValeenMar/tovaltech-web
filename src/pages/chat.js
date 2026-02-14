// File: /src/pages/chat.js
export function ChatPage() {
  return `
    <h2>Jeffrey</h2>
    <p class="muted">Historial persistido en Table Storage (GET/POST <code>/api/chat</code>).</p>

    <div class="chat">
      <input id="chatInput" placeholder="Ej: pedir lista de precios a Intermaco" />
      <button id="chatSend" class="btn btnPrimary">Enviar</button>
    </div>

    <div class="chatActions">
      <button id="chatRefresh" class="btn">Recargar historial</button>
      <span id="chatStatus" class="muted"></span>
    </div>

    <div id="chatLog" class="log"></div>
  `;
}

export function wireChat() {
  const input = document.querySelector("#chatInput");
  const btn = document.querySelector("#chatSend");
  const refreshBtn = document.querySelector("#chatRefresh");
  const status = document.querySelector("#chatStatus");
  const log = document.querySelector("#chatLog");

  const add = (role, text, meta = "") => {
    const item = document.createElement("div");
    item.className = "logItem";
    item.innerHTML = `
      <div class="logHead">
        <b>${escapeHtml(role)}:</b>
        ${meta ? `<span class="logMeta">${escapeHtml(meta)}</span>` : ""}
      </div>
      <div class="logBody">${escapeHtml(text)}</div>
    `;
    log.prepend(item);
  };

  const setStatus = (t) => (status.textContent = t || "");

  const formatTs = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  async function loadHistory() {
    setStatus("Cargando historial...");
    try {
      const res = await fetch("/api/chat", { method: "GET" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStatus(`Error cargando historial${data?.error ? `: ${data.error}` : ""}`);
        return;
      }

      log.innerHTML = "";
      const items = Array.isArray(data.items) ? data.items : [];

      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        add("Historial", it.message ?? "", formatTs(it.createdAt));
      }

      setStatus(items.length ? `Historial cargado (${items.length})` : "Sin historial aún");
    } catch {
      setStatus("Error de red cargando historial");
    }
  }

  async function sendMessage() {
    const msg = (input.value || "").trim();
    if (!msg) return;

    add("Vos", msg);
    input.value = "";
    input.focus();

    setStatus("Enviando...");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        add("API", `Error: ${data?.error || `HTTP ${res.status}`}`);
        setStatus("Error al enviar");
        return;
      }

      add("API", data.reply ?? "(ok)");
      setStatus("Guardado. Recargando historial...");
      await loadHistory();
    } catch {
      add("API", "Error de red");
      setStatus("Error de red");
    }
  }

  btn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  refreshBtn.addEventListener("click", loadHistory);
  loadHistory();
}

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
