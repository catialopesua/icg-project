import * as THREE from 'three';
import { getLookSensitivity } from '../core/audio.js'; // sensitivity setting

export function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}

export function initMobileControls(camera) {
  // Inject CSS
  const style = document.createElement('style');
  style.innerHTML = `
    #mobile-controls {
      position: fixed;
      inset: 0;
      z-index: 20; /* below ui-panels (23) so modals can scroll/click */
      pointer-events: none; /* Let clicks pass through where there are no controls */
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    #mc-look-zone {
      position: absolute;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      pointer-events: auto;
    }
    #mc-joystick-area {
      position: absolute;
      bottom: 40px;
      left: 40px;
      width: 120px;
      height: 120px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      pointer-events: auto;
    }
    #mc-joystick-knob {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 50px;
      height: 50px;
      background: rgba(255, 255, 255, 0.7);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .mc-btn {
      position: absolute;
      width: 60px;
      height: 60px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 50%;
      color: white;
      font-weight: bold;
      display: flex;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
      font-family: sans-serif;
      font-size: 14px;
    }
    .mc-btn:active {
      background: rgba(255, 255, 255, 0.5);
    }
    #mc-btn-jump {
      bottom: 40px;
      right: 120px;
    }
    #mc-btn-interact {
      bottom: 120px;
      right: 40px;
      width: 90px;
      border-radius: 30px;
    }
    
    /* Responsive UI overrides for mobile */
    @media (max-width: 768px) {
      #ui-panels {
        padding: 70px 10px 10px !important;
        justify-content: center !important;
      }
      .floating-panel {
        width: 95vw !important;
        max-height: 75vh !important;
        padding: 14px !important;
        border-radius: 20px !important;
        border-width: 3px !important;
      }
      .panel-title-row h2 {
        font-size: 1.5rem !important;
      }
      .panel-close {
        width: 40px !important;
        height: 40px !important;
        font-size: 1.6rem !important;
      }
      .weather-option {
        grid-template-columns: 60px 1fr !important;
        gap: 12px !important;
        padding: 10px !important;
      }
      .option-icon {
        width: 54px !important;
        height: 54px !important;
        font-size: 2rem !important;
        border-radius: 14px !important;
      }
      .weather-option strong {
        font-size: 1.3rem !important;
      }
      .weather-option small {
        font-size: 0.95rem !important;
      }
      #tool-dock {
        top: 10px !important;
        left: 10px !important;
        gap: 6px !important;
      }
      .tool-btn {
        width: 46px !important;
        height: 46px !important;
      }
      .tool-icon {
        font-size: 22px !important;
      }
      .quest-card {
        position: absolute !important;
        top: 10px !important;
        right: 10px !important;
        width: auto !important;
        max-width: 45vw !important;
        padding: 4px 8px !important;
        gap: 6px !important;
      }
      .quest-main {
        font-size: 1rem !important;
        white-space: normal !important;
      }
      .quest-label {
        display: none !important;
      }
      .quest-orb {
        width: 24px !important;
        height: 24px !important;
        font-size: 0.8rem !important;
      }
      .setting-row {
        grid-template-columns: 1fr !important;
        justify-items: start !important;
        gap: 10px !important;
      }
      .volume-control {
        width: 100% !important;
        align-items: flex-start !important;
        justify-items: start !important;
      }
      .volume-slider {
        width: 100% !important;
      }
      .friend-card {
        grid-template-columns: 56px 1fr !important;
        padding: 10px !important;
      }
      .friend-avatar {
        width: 56px !important;
        height: 56px !important;
        border-radius: 12px !important;
      }
      .friend-name {
        font-size: 1.25rem !important;
      }
      #interact-hint {
        bottom: 30% !important;
      }
      #chat-bubble {
        bottom: 20px !important;
        width: 90vw !important;
        padding: 12px !important;
        border-radius: 20px !important;
      }
      .chat-avatar-wrap {
        width: 50px !important;
        height: 50px !important;
      }
      .chat-name {
        font-size: 1.2rem !important;
      }
      .chat-text {
        font-size: 0.95rem !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Inject HTML
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.innerHTML = `
    <div id="mc-look-zone"></div>
    <div id="mc-joystick-area">
      <div id="mc-joystick-knob"></div>
    </div>
    <div id="mc-btn-jump" class="mc-btn">JUMP</div>
    <div id="mc-btn-interact" class="mc-btn">Interact</div>
  `;
  document.body.appendChild(container);

  // --- Look Zone (Camera Rotation) ---
  const lookZone = container.querySelector('#mc-look-zone');
  let lastTouchX = null;
  let lastTouchY = null;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  lookZone.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  });

  lookZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    const pointerSpeed = getLookSensitivity() * 0.005; // mobile modifier

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= deltaX * pointerSpeed;
    euler.x -= deltaY * pointerSpeed;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  });

  lookZone.addEventListener('touchend', () => {
    lastTouchX = null;
    lastTouchY = null;
  });

  // --- Joystick (Movement) ---
  const joyArea = container.querySelector('#mc-joystick-area');
  const joyKnob = container.querySelector('#mc-joystick-knob');
  let joyActive = false;
  let joyCenterX = 0;
  let joyCenterY = 0;
  const maxRadius = 60;

  const activeKeys = new Set();
  const dispatchKey = (code, type) => {
    if (type === 'keydown' && !activeKeys.has(code)) {
      activeKeys.add(code);
      document.dispatchEvent(new KeyboardEvent('keydown', { code }));
    } else if (type === 'keyup' && activeKeys.has(code)) {
      activeKeys.delete(code);
      document.dispatchEvent(new KeyboardEvent('keyup', { code }));
    }
  };

  const updateJoystick = (clientX, clientY) => {
    let dx = clientX - joyCenterX;
    let dy = clientY - joyCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Map to WASD
    const threshold = 20; // deadzone
    if (dy < -threshold) dispatchKey('KeyW', 'keydown'); else dispatchKey('KeyW', 'keyup');
    if (dy > threshold)  dispatchKey('KeyS', 'keydown'); else dispatchKey('KeyS', 'keyup');
    if (dx < -threshold) dispatchKey('KeyA', 'keydown'); else dispatchKey('KeyA', 'keyup');
    if (dx > threshold)  dispatchKey('KeyD', 'keydown'); else dispatchKey('KeyD', 'keyup');
  };

  const resetJoystick = () => {
    joyKnob.style.transform = 'translate(-50%, -50%)';
    dispatchKey('KeyW', 'keyup');
    dispatchKey('KeyS', 'keyup');
    dispatchKey('KeyA', 'keyup');
    dispatchKey('KeyD', 'keyup');
  };

  joyArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyActive = true;
    const rect = joyArea.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    updateJoystick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  joyArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joyActive) return;
    updateJoystick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  joyArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    joyActive = false;
    resetJoystick();
  });
  
  joyArea.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    joyActive = false;
    resetJoystick();
  });

  // --- Buttons ---
  const btnJump = container.querySelector('#mc-btn-jump');
  btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keydown');
  });
  btnJump.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keyup');
  });

  const btnInteract = container.querySelector('#mc-btn-interact');
  btnInteract.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keydown');
  });
  btnInteract.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keyup');
  });

  return container;
}
