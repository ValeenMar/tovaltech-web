// File: /src/utils/musicTroll.js
// Si alguien loguea con el mail de Tobias, reproducimos un audio (troll) y ponemos un botón para frenarlo.
// Audio esperado: /assets/troll.mp3 (no lo incluimos en el zip, para que lo mantengas vos).

let audioEl = null;

export function initMusicTroll({ onLogout } = {}) {
  // Exponer un stop global (por si el router cambia rápido)
  if (!window.stopMusicTroll) {
    window.stopMusicTroll = () => {
      try {
        if (audioEl) {
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.remove();
          audioEl = null;
        }
      } catch {
        // ignore
      }
    };
  }

  function stopAndCleanup(btn) {
    window.stopMusicTroll();
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    if (typeof onLogout === "function") onLogout();
  }

  return function startMusicTroll({ email } = {}) {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return;

    // Ajustá esto si el mail de Tobias cambia
    const isTobias = e === "tobias@toval-tech.com";

    if (!isTobias) return;

    // Asegurar que no quede sonando de antes
    window.stopMusicTroll();

    audioEl = document.createElement("audio");
    audioEl.src = "/assets/troll.mp3";
    audioEl.loop = true;
    audioEl.autoplay = true;
    audioEl.style.display = "none";

    // Si el archivo no existe, no rompemos nada
    audioEl.addEventListener("error", () => {
      try {
        audioEl?.remove();
        audioEl = null;
      } catch {}
    });

    document.body.appendChild(audioEl);

    const btn = document.createElement("button");
    btn.className = "stopMusicBtn";
    btn.textContent = "Detener música";
    btn.addEventListener("click", () => stopAndCleanup(btn));

    document.body.appendChild(btn);

    // Intentar play (autoplay policies pueden bloquearlo)
    audioEl.play().catch(() => {
      // Si no puede reproducir automáticamente, dejamos el botón igual
    });
  };
}

export function stopMusicTroll() {
  if (window.stopMusicTroll) window.stopMusicTroll();
}
