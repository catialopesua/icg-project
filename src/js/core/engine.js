/**
 * THREE.JS ENGINE INITIALIZATION & CORE RENDERING
 * 
 * Sets up the WebGL rendering engine and main scene:
 * - Initializes Three.js renderer with proper quality settings
 * - Creates main 3D scene and camera setup
 * - Manages animation loop and frame rate
 * - Handles window resize and responsive rendering
 * - Provides animation hooks for game systems
 * 
 * NOTE: This core engine was organized with GitHub Copilot's assistance
 * to ensure clean architecture and proper rendering pipeline.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// RENDERER CONFIGURATION
// Initializes WebGL renderer with shadow mapping and anti-aliasing
// ---------------------------------------------------------------------------
// Get or create canvas container for 3D rendering
const container = document.getElementById('canvas-container') || document.body;

/** THREE.js WebGL Renderer - handles all 3D graphics rendering */
export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio || 1); // Use device pixel ratio for sharp rendering
renderer.setSize(window.innerWidth, window.innerHeight); // Set to full window size
renderer.shadowMap.enabled = true; // Enable shadow rendering
renderer.shadowMap.type = THREE.PCFShadowMap; // Use soft shadows
renderer.setClearColor(0x02030a); // Deep dark blue background
if (container) {
  container.appendChild(renderer.domElement); // Add canvas to page
}

// ---------------------------------------------------------------------------
// MAIN SCENE
// The 3D scene graph that contains all game objects
// ---------------------------------------------------------------------------
/** Main Three.js scene containing all 3D objects, lights, and entities */
export const scene = new THREE.Scene();

// ---------------------------------------------------------------------------
// CAMERA SETUP
// Perspective camera for first-person game view
// ---------------------------------------------------------------------------
/** Main perspective camera used for player's first-person view */
export const camera = new THREE.PerspectiveCamera(
  50, // Field of view (FOV) in degrees
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  2000 // Far clipping plane
);
// Initial camera position (will be updated by game systems)
camera.position.set(0, 2.0, 5);

// ---------------------------------------------------------------------------
// TIMER
// Manages delta time and elapsed time for frame-based calculations
// ---------------------------------------------------------------------------
/** Three.js timer for tracking frame delta time and elapsed time */
export const timer = new THREE.Timer();
timer.connect(document); // Connect to document for timing events

// ---------------------------------------------------------------------------
// WINDOW RESIZE HANDLING
// Ensures renderer and camera stay properly sized when window resizes
// ---------------------------------------------------------------------------
/**
 * Updates camera aspect ratio and renderer size to match window dimensions.
 * Called automatically on window resize events.
 */
export function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight; // Update aspect
  camera.updateProjectionMatrix(); // Recalculate camera projection
  renderer.setSize(window.innerWidth, window.innerHeight); // Resize rendering surface
}
window.addEventListener('resize', onWindowResize, false);

// ---------------------------------------------------------------------------
// ANIMATION LOOP & HOOKS SYSTEM
// Central frame-based update mechanism for all game systems
// Systems register callbacks that are called every frame (GitHub Copilot developed this architecture)
// ---------------------------------------------------------------------------
/** Array of per-frame callback functions registered by game systems */
const _hooks = [];

/**
 * Registers a per-frame callback that will be called on every animation frame.
 * Used by all game systems (physics, AI, UI, etc.) to update their state.
 * @param {(dt: number, elapsed: number) => void} fn - Callback function receiving delta time and elapsed time
 */
export function addAnimationHook(fn) {
  _hooks.push(fn);
}

/**
 * Starts the main animation/render loop.
 * Should be called once from main.js after all hooks are registered.
 * Continuously renders the scene and calls all registered hooks.
 */
export function startAnimationLoop() {
  function loop(timestamp) {
    requestAnimationFrame(loop); // Request next frame
    timer.update(timestamp); // Update timer
    const dt = timer.getDelta(); // Time since last frame (delta time)
    const elapsed = timer.getElapsed(); // Total elapsed time

    // Call all registered hooks with timing information
    for (let i = 0; i < _hooks.length; i++) {
      try { _hooks[i](dt, elapsed); } catch (e) { /* Keep loop alive on errors */ }
    }
    // Render current frame
    renderer.render(scene, camera);
  }
  loop();
}
