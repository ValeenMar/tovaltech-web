// File: /src/utils/musicTroll.js
// Sistema de trolleo musical para Tobias 😈

export function initMusicTroll(userEmail) {
  if (!userEmail) return;
  
  // Lista de víctimas del trolleo
  const targets = ['tobias@toval-tech.com'];
  
  if (!targets.includes(userEmail.toLowerCase())) {
    return; // Usuario normal, no hacer nada
  }
  
  console.log('🎵 Iniciando experiencia musical especial para Tobias...');
  
  // Crear el reproductor de audio (oculto)
  const audio = new Audio();
  audio.src = '/assets/troll.mp3';
  audio.loop = true;
  audio.volume = 0.35; // Volumen al 35% (mínimo permitido)
  
  // Posiciones aleatorias posibles para el botón
  const positions = [
    { bottom: '12px', left: '12px' },
    { bottom: '12px', right: '12px' },
    { top: '80px', left: '12px' },
    { top: '80px', right: '12px' },
    { top: '50%', left: '12px', transform: 'translateY(-50%)' },
    { top: '50%', right: '12px', transform: 'translateY(-50%)' },
    { bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)' }
  ];
  
  // Elegir posición aleatoria
  const randomPos = positions[Math.floor(Math.random() * positions.length)];
  
  // Crear botón de control (escondidito en posición aleatoria)
  const controlBtn = document.createElement('button');
  controlBtn.innerHTML = '🎵';
  controlBtn.title = 'Control de música especial';
  controlBtn.style.cssText = `
    position: fixed;
    ${Object.entries(randomPos).map(([key, val]) => `${key}: ${val}`).join('; ')};
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(0,229,255,.15) 0%, rgba(140,90,255,.15) 100%);
    border: 1px solid rgba(255,255,255,.08);
    backdrop-filter: blur(12px);
    color: rgba(255,255,255,.6);
    font-size: 18px;
    cursor: pointer;
    z-index: 9999;
    transition: all 0.3s;
    box-shadow: 0 4px 12px rgba(0,0,0,.3);
    opacity: 0.3;
  `;
  
  let isPlaying = false;
  
  // Función para actualizar el botón
  function updateButton() {
    controlBtn.innerHTML = isPlaying ? '⏸️' : '▶️';
    const baseTransform = randomPos.transform || '';
    const scaleTransform = isPlaying ? ' scale(1.1)' : ' scale(1)';
    controlBtn.style.transform = baseTransform + scaleTransform;
  }
  
  // Click en el botón
  controlBtn.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
    } else {
      audio.play().catch(err => {
        console.log('Auto-play bloqueado');
      });
      isPlaying = true;
    }
    updateButton();
  });
  
  // Hover effect
  controlBtn.addEventListener('mouseenter', () => {
    controlBtn.style.opacity = '1';
    controlBtn.style.boxShadow = '0 6px 20px rgba(0,229,255,.3)';
    controlBtn.style.borderColor = 'rgba(0,229,255,.3)';
  });
  
  controlBtn.addEventListener('mouseleave', () => {
    controlBtn.style.opacity = '0.3';
    controlBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,.3)';
    controlBtn.style.borderColor = 'rgba(255,255,255,.08)';
  });
  
  // Agregar al DOM
  document.body.appendChild(controlBtn);
  
  // Control de volumen con límite mínimo
  const volumeControl = document.createElement('input');
  volumeControl.type = 'range';
  volumeControl.min = '35'; // Mínimo 35%
  volumeControl.max = '100';
  volumeControl.value = '35';
  volumeControl.style.cssText = `
    position: fixed;
    ${randomPos.bottom ? `bottom: ${parseInt(randomPos.bottom) + 50}px` : ''};
    ${randomPos.top ? `top: ${parseInt(randomPos.top) + 50}px` : ''};
    ${randomPos.left ? `left: ${randomPos.left}` : ''};
    ${randomPos.right ? `right: ${randomPos.right}` : ''};
    width: 100px;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  `;
  
  document.body.appendChild(volumeControl);
  
  volumeControl.addEventListener('input', (e) => {
    const vol = Math.max(0.35, e.target.value / 100);
    audio.volume = vol;
  });
  
  // Mostrar control de volumen al pasar sobre el botón
  controlBtn.addEventListener('mouseenter', () => {
    volumeControl.style.opacity = '1';
    volumeControl.style.pointerEvents = 'all';
  });
  
  volumeControl.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (!controlBtn.matches(':hover')) {
        volumeControl.style.opacity = '0';
        volumeControl.style.pointerEvents = 'none';
      }
    }, 1000);
  });
  
  // Intentar reproducir automáticamente
  document.addEventListener('click', function startOnFirstClick() {
    if (!isPlaying) {
      audio.play().then(() => {
        isPlaying = true;
        updateButton();
        console.log('🎵 Música iniciada para Tobias!');
      }).catch(err => {
        console.log('⚠️ Click en el botón para iniciar');
      });
    }
    document.removeEventListener('click', startOnFirstClick);
  }, { once: true });
  
  // Cleanup al salir
  window.addEventListener('beforeunload', () => {
    audio.pause();
    audio.src = '';
  });
}

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
  
  const volume = document.querySelector('input[type="range"]');
  if (volume) {
    volume.remove();
  }
}
