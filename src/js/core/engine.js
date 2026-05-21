import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const container = document.getElementById('canvas-container') || document.body;

/** @type {THREE.WebGLRenderer} */
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x02030a);
if (container) {
  container.appendChild(renderer.domElement);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
/** @type {THREE.Scene} */
export const scene = new THREE.Scene();

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
/** @type {THREE.PerspectiveCamera} */
export const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 2.0, 5);

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------
export const timer = new THREE.Timer();
timer.connect(document);

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
/**
 * Updates camera aspect ratio and renderer size on window resize.
 */
export function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize, false);

// ---------------------------------------------------------------------------
// Animate loop
// Consumers register per-frame callbacks via addAnimationHook(fn).
// ---------------------------------------------------------------------------
/** @type {Array<(dt: number, elapsed: number) => void>} */
const _hooks = [];

/**
 * Registers a per-frame callback.
 * @param {(dt: number, elapsed: number) => void} fn
 */
export function addAnimationHook(fn) {
  _hooks.push(fn);
}

/**
 * Starts the render loop. Call once from main.js after all hooks are registered.
 */
export function startAnimationLoop() {
  function loop(timestamp) {
    requestAnimationFrame(loop);
    timer.update(timestamp);
    const dt = timer.getDelta();
    const elapsed = timer.getElapsed();

    for (let i = 0; i < _hooks.length; i++) {
      try { _hooks[i](dt, elapsed); } catch (e) { /* keep loop alive */ }
    }
    renderer.render(scene, camera);
  }
  loop();
}
