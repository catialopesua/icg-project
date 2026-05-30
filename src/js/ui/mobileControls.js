/**
 * MOBILE CONTROLS SYSTEM
 * 
 * Provides touch-based controls for mobile and tablet devices:
 * - On-screen virtual joystick for movement
 * - Look zone for camera rotation on touch devices
 * - Jump button
 * - Interact button for NPC interactions
 * - Adjustable touch sensitivity settings
 * - Responsive layout that adapts to device size
 * 
 * NOTE: GitHub Copilot was essential in developing the mobile integration system,
 * helping implement touch event handling, gesture recognition, and the overall
 * mobile control architecture.
 */

import * as THREE from 'three';
import { getLookSensitivity } from '../core/audio.js';

/**
 * Detects whether the current device is a mobile/touch device.
 * Checks for mobile user agents and touch point support.
 * @returns {boolean} True if device supports touch input
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
  // ── DOM STRUCTURE ────────────────────────────────────────────────────────
  // Create container and all touch control elements
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.innerHTML = `
    <div id="mc-look-zone"></div><!-- Right side: camera look control -->
    <div id="mc-joystick-area"><!-- Left side: movement joystick -->
      <div id="mc-joystick-knob"></div><!-- Draggable knob -->
    </div>
    <div id="mc-btn-jump" class="mc-btn" role="button" aria-label="Jump">JUMP</div>
    <div id="mc-btn-interact" class="mc-btn" role="button" aria-label="Interact">INT</div>
  `;
  document.body.appendChild(container);

  // ── LOOK ZONE CAMERA CONTROL ────────────────────────────────────────────
  // Right side of screen: drag to rotate camera (yaw and pitch)
  const lookZone = container.querySelector('#mc-look-zone');
  let lastTouchX = null; // Last X position of touch input
  let lastTouchY = null; // Last Y position of touch input
  const euler = new THREE.Euler(0, 0, 0, 'YXZ'); // Euler angles for camera rotation

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
    // Calculate touch delta since last position
    const deltaX = touch.clientX - lastTouchX;
    const deltaY = touch.clientY - lastTouchY;
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;

    // Apply look sensitivity from audio settings
    const pointerSpeed = getLookSensitivity() * 0.005;

    // Update camera rotation using Euler angles (GitHub Copilot developed this approach)
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= deltaX * pointerSpeed; // Horizontal rotation (yaw)
    euler.x -= deltaY * pointerSpeed; // Vertical rotation (pitch)
    // Clamp pitch to prevent over-rotating
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }, { passive: false });

  lookZone.addEventListener('touchend', () => {
    lastTouchX = null;
    lastTouchY = null;
  }, { passive: true });

  // ── JOYSTICK MOVEMENT CONTROL ───────────────────────────────────────────
  // Left side of screen: drag to move (WASD equivalent)
  const joyArea = container.querySelector('#mc-joystick-area');
  const joyKnob = container.querySelector('#mc-joystick-knob');
  let joyActive = false; // Is joystick currently being touched
  let joyCenterX = 0; // Center X of joystick area
  let joyCenterY = 0; // Center Y of joystick area
  const maxRadius = 50; // Maximum radius in pixels for joystick movement

  // Track which keyboard keys are currently "pressed" to avoid duplicate events
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

  /**
   * Updates joystick position and triggers movement keys
   * Calculates distance and angle from joystick center
   * @param {number} clientX - Current touch X coordinate
   * @param {number} clientY - Current touch Y coordinate
   */
  const updateJoystick = (clientX, clientY) => {
    // Calculate offset from joystick center
    let dx = clientX - joyCenterX;
    let dy = clientY - joyCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp movement to max radius
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    // Update knob visual position
    joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    // Detect movement direction and dispatch appropriate keys
    // with deadzone to prevent unintended drift
    const threshold = 18; // deadzone in pixels
    if (dy < -threshold) dispatchKey('KeyW', 'keydown'); else dispatchKey('KeyW', 'keyup'); // Forward
    if (dy > threshold)  dispatchKey('KeyS', 'keydown'); else dispatchKey('KeyS', 'keyup'); // Backward
    if (dx < -threshold) dispatchKey('KeyA', 'keydown'); else dispatchKey('KeyA', 'keyup'); // Left
    if (dx > threshold)  dispatchKey('KeyD', 'keydown'); else dispatchKey('KeyD', 'keyup'); // Right
  };

  /**
   * Reset joystick to center position and clear all movement keys
   * Called when user lifts finger from joystick
   */
  const resetJoystick = () => {
    joyKnob.style.transform = 'translate(-50%, -50%)';
    // Release all movement keys
    dispatchKey('KeyW', 'keyup');
    dispatchKey('KeyS', 'keyup');
    dispatchKey('KeyA', 'keyup');
    dispatchKey('KeyD', 'keyup');
    joyActive = false;
  };

  // Joystick touch event handlers
  joyArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyActive = true;
    // Get joystick center position for calculations
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

  // Reset joystick when touch ends or is cancelled
  joyArea.addEventListener('touchend', (e) => {
    e.preventDefault();
    resetJoystick();
  }, { passive: false });

  joyArea.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    resetJoystick();
  }, { passive: false });

  // ── ACTION BUTTONS ──────────────────────────────────────────────────────
  // Jump and Interact buttons with touch event handlers
  const btnJump = container.querySelector('#mc-btn-jump');
  btnJump.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keydown'); // Space key for jump
  }, { passive: false });
  btnJump.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('Space', 'keyup');
  }, { passive: false });

  // Interact button for NPC interactions
  const btnInteract = container.querySelector('#mc-btn-interact');
  btnInteract.addEventListener('touchstart', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keydown'); // E key for interact
  }, { passive: false });
  btnInteract.addEventListener('touchend', (e) => {
    e.preventDefault();
    dispatchKey('KeyE', 'keyup');
  }, { passive: false });

  return container;
}
