// File: /src/utils/musicTroll.js
// Sistema de trolleo musical para usuarios específicos 😈

/**
 * Inicia el trolleo musical si el usuario es "especial"
 * @param {string} userEmail - Email del usuario logueado
 */
export function initMusicTroll(userEmail) {
  if (!userEmail) return;
  
  // Lista de víctimas del trolleo
  const targets = ['tobias@toval-tech.com'];
  
  if (!targets.includes(userEmail.toLowerCase())) {
    return; // Usuario normal, no hacer nada
  }
  
  console.log('🎵 Iniciando experiencia musical especial...');
  
  // Crear el reproductor de audio (oculto)
  const audio = new Audio();
  
  // URL del audio (podés usar cualquier MP3 público)
  // Recomendaciones trolleables:
  // - Caramelldansen
  // - Nyan Cat
  // - Never Gonna Give You Up (Rickroll clásico)
  // - Baby Shark
  // - Cantina Band (Star Wars)
  
  // Usar el MP3 incluido en el proyecto (subido a /assets)
  // Archivo: assets/troll.mp3
  audio.src = '/assets/troll.mp3';
  audio.loop = true;
  audio.volume = 0.3; // Volumen al 30% para no ser tan cruel 😄
  
  // Crear botón de control (bien escondidito)
  const controlBtn = document.createElement('button');
  controlBtn.innerHTML = '🎵';
  controlBtn.title = 'Control de música especial';
  controlBtn.style.cssText = `
    position: fixed;
    bottom: 12px;
    left: 12px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(0,229,255,.15) 0%, rgba(140,90,255,.15) 100%);
    border: 1px solid rgba(255,255,255,.1);
    backdrop-filter: blur(12px);
    color: rgba(255,255,255,.8);
    font-size: 20px;
    cursor: pointer;
    z-index: 9999;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(0,0,0,.3);
  `;
  
  let isPlaying = false;
  
  // Función para actualizar el botón
  function updateButton() {
    controlBtn.innerHTML = isPlaying ? '⏸️' : '▶️';
    controlBtn.style.transform = isPlaying ? 'scale(1.1)' : 'scale(1)';
  }
  
  // Click en el botón
  controlBtn.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().catch(err => {
        console.log('Auto-play bloqueado por el navegador');
      });
      isPlaying = true;
    }
    updateButton();
  });
  
  // Hover effect
  controlBtn.addEventListener('mouseenter', () => {
    controlBtn.style.boxShadow = '0 6px 20px rgba(0,229,255,.3)';
    controlBtn.style.borderColor = 'rgba(0,229,255,.3)';
  });
  
  controlBtn.addEventListener('mouseleave', () => {
    controlBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)';
    controlBtn.style.borderColor = 'rgba(255,255,255,.1)';
  });
  
  // Agregar al DOM
  document.body.appendChild(controlBtn);
  
  // Intentar reproducir automáticamente (puede fallar por políticas del navegador)
  // La música solo empezará después de la primera interacción del usuario
  document.addEventListener('click', function startOnFirstClick() {
    if (!isPlaying) {
      audio.play().then(() => {
        isPlaying = true;
        updateButton();
        console.log('🎵 Música iniciada!');
      }).catch(err => {
        console.log('⚠️ Auto-play bloqueado - el usuario debe hacer click en el botón');
      });
    }
    // Remover el listener después del primer click
    document.removeEventListener('click', startOnFirstClick);
  }, { once: true });
  
  // Easter egg: doble-click en el logo para cambiar volumen
  const logo = document.querySelector('.brand');
  if (logo) {
    logo.addEventListener('dblclick', () => {
      audio.volume = audio.volume === 0.3 ? 0.1 : 0.3;
      console.log('🔊 Volumen:', audio.volume === 0.3 ? 'Normal' : 'Bajo');
    });
  }
  
  // Cleanup cuando el usuario haga logout
  window.addEventListener('beforeunload', () => {
    audio.pause();
    audio.src = '';
  });
}

/**
 * Detener el trolleo (llamar al hacer logout)
 */
export function stopMusicTroll() {
  const audio = document.querySelector('audio');
  if (audio) {
    audio.pause();
    audio.remove();
  }
  
  const btn = document.querySelector('button[title*="música especial"]');
  if (btn) {
    btn.remove();
  }
}