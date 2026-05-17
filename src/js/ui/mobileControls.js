import * as THREE from 'three';
import { getLookSensitivity } from '../core/audio.js';

/**
 * Returns true if the current device appears to be a touch/mobile device.
 * @returns {boolean}
 */
export function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;
}

/**
 * Returns true if any floating panel is currently visible.
 * Used to suppress look-zone camera rotation while menus are open.
 * @returns {boolean}
 */
function isPanelOpen() {
  return Boolean(document.querySelector('.floating-panel:not(.hidden)'));
}

/**
 * Initialises on-screen touch controls (joystick, look zone, jump & interact
 * buttons) for mobile devices. All CSS now lives in responsive.css — this
 * function no longer injects a <style> block.
 *
 * @param {THREE.Camera} camera
 * @returns {HTMLElement} The root #mobile-controls container.
 */
export function initMobileControls(camera) {
  // ── DOM ──────────────────────────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.innerHTML = `
    <div id="mc-look-zone"></div>
    <div id="mc-joystick-area">
      <div id="mc-joystick-knob"></div>
    </div>
    <div id="mc-btn-jump" class="mc-btn" role="button" aria-label="Jump">JUMP</div>
    <div id="mc-btn-interact" class="mc-btn" role="button" aria-label="Interact">INT</div>
  `;
  document.body.appendChild(container);

  // ── Look Zone (camera rotation) ──────────────────────────────────────────
  const lookZone = container.querySelector('#mc-look-zone');
  let lastTouchX = null;
  let lastTouchY = null;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  lookZone.addEventListener('touchstart', (e) => {
    // Do not rotate camera when a UI panel is open — let taps reach the panel
    if (isPanelOpen()) return;
    const touch = e.changedTouches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
  }, { passive: true });

  lookZone.addEventListener('touchmove', (e) => {
    if (isPanelOpen()) return;
    // Must be non-passive to call preventDefault and prevent page scroll
    e.preventDefault();
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    const pointerSpeed = getLookSensitivity() * 0.005;

    euler.setFromQuaternion(camera.quaternion);
    euler.y -= deltaX * pointerSpeed;
    euler.x -= deltaY * pointerSpeed;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }, { passive: false });

  lookZone.addEventListener('touchend', () => {
    lastTouchX = null;
    lastTouchY = null;
  }, { passive: true });

  // ── Joystick (movement) ───────────────────────────────────────────────────
  const joyArea = container.querySelector('#mc-joystick-area');
  const joyKnob = container.querySelector('#mc-joystick-knob');
  let joyActive = false;
  let joyCenterX = 0;
  let joyCenterY = 0;
  const maxRadius = 50; // half the joystick area radius

  const activeKeys = new Set();

  /**
   * Dispatches a synthetic keyboard event once per key state change.
   * Avoids flooding the event queue with repeated keydown events.
   * @param {string} code
   * @param {'keydown'|'keyup'} type
   */
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

    const threshold = 18; // deadzone in pixels
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
    joyActive = false;
  };

  joyArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyActive = true;
    const rect = joyArea.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    updateJoystick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: false });

  joyArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joyActive) return;
    updateJoystick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: false });

  joyArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    resetJoystick();
  }, { passive: false });

  joyArea.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    resetJoystick();
  }, { passive: false });

  // ── Buttons ───────────────────────────────────────────────────────────────
  const btnJump = container.querySelector('#mc-btn-jump');
  btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keydown');
  }, { passive: false });
  btnJump.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keyup');
  }, { passive: false });

  const btnInteract = container.querySelector('#mc-btn-interact');
  btnInteract.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keydown');
  }, { passive: false });
  btnInteract.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keyup');
  }, { passive: false });

  return container;
}
