import * as THREE from 'three';
import { scene, renderer } from './engine.js';

// ---------------------------------------------------------------------------
// Shadow / light constants
// ---------------------------------------------------------------------------
export const DAY_LIGHT_POS = new THREE.Vector3(15, 56, 37);
export const NIGHT_LIGHT_POS = new THREE.Vector3(-24, 26, -16);
export const SHADOW_TARGET_POS = new THREE.Vector3(2, 0, 14);
export const DAY_SHADOW_BOUNDS = 46;
export const NIGHT_SHADOW_BOUNDS = 44;
export const MAX_DYNAMIC_NIGHT_STREETLIGHT_SHADOWS = 2;
export const NIGHT_STREETLIGHT_SHADOW_RANGE = 24;

// ---------------------------------------------------------------------------
// Ambient light
// ---------------------------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.06));

// ---------------------------------------------------------------------------
// Directional light (starts in night configuration)
// ---------------------------------------------------------------------------
/** @type {THREE.DirectionalLight} */
export const dir = new THREE.DirectionalLight(0x7688c0, 0.15);
dir.position.copy(NIGHT_LIGHT_POS);
dir.castShadow = true;
dir.shadow.mapSize.set(4096, 4096);
dir.shadow.camera.near = 0.5;
dir.shadow.bias = -0.001;
dir.shadow.normalBias = 0.05;
dir.shadow.camera.far = 140;
dir.shadow.camera.left = -NIGHT_SHADOW_BOUNDS;
dir.shadow.camera.right = NIGHT_SHADOW_BOUNDS;
dir.shadow.camera.top = NIGHT_SHADOW_BOUNDS;
dir.shadow.camera.bottom = -NIGHT_SHADOW_BOUNDS;
dir.shadow.radius = 5;
dir.shadow.blurSamples = 8;
scene.add(dir);
scene.add(dir.target);
dir.target.position.copy(SHADOW_TARGET_POS);
dir.target.updateMatrixWorld(true);

// ---------------------------------------------------------------------------
// Hemisphere light
// ---------------------------------------------------------------------------
/** @type {THREE.HemisphereLight} */
export const hemi = new THREE.HemisphereLight(0x0a1b2e, 0x02040a, 0.05);
scene.add(hemi);

// ---------------------------------------------------------------------------
// Fog
// ---------------------------------------------------------------------------
scene.fog = new THREE.FogExp2(0x02030a, 0.007);

// ---------------------------------------------------------------------------
// Celestial bodies (sun / moon)
// ---------------------------------------------------------------------------
/**
 * Creates a sphere + additive halo group for sun or moon.
 * @param {number} coreColor
 * @param {number} haloColor
 * @param {number} radius
 * @param {number} [haloScale]
 * @param {number} [haloOpacity]
 * @returns {THREE.Group}
 */
export function makeCelestialBody(
  coreColor,
  haloColor,
  radius,
  haloScale = 1.75,
  haloOpacity = 0.22
) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 24),
    new THREE.MeshBasicMaterial({ color: coreColor, fog: false })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * haloScale, 24, 24),
    new THREE.MeshBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: haloOpacity,
      fog: false,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  [core, halo].forEach((m) => {
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.noAutoShadow = true;
  });
  group.add(core, halo);
  return group;
}

export const sun = makeCelestialBody(0xfffbf0, 0xfff2dc, 2.2, 1.8, 0.24);
sun.position.copy(DAY_LIGHT_POS);
sun.visible = false;
scene.add(sun);

export const moon = makeCelestialBody(0xd8e6ff, 0x9ab7ff, 1.65, 1.9, 0.18);
moon.position.set(-58, 45, 30);
moon.visible = true;
scene.add(moon);

// ---------------------------------------------------------------------------
// Shadow helpers
// ---------------------------------------------------------------------------
/**
 * Returns true when the mesh should receive automatic cast/receive shadow.
 * @param {THREE.Object3D} obj
 * @returns {boolean}
 */
export function shouldAutoShadowMesh(obj) {
  if (!obj || !obj.isMesh) return false;
  if (obj.userData && obj.userData.noAutoShadow) return false;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  return !mats.some(
    (mat) => mat && mat.transparent && typeof mat.opacity === 'number' && mat.opacity < 0.2
  );
}

/**
 * Walks the scene and applies or removes cast/receive shadow on every eligible mesh.
 * @param {boolean} [enabled]
 */
export function syncSceneMeshShadows(enabled = renderer.shadowMap.enabled) {
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!shouldAutoShadowMesh(obj)) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      return;
    }
    obj.castShadow = enabled;
    obj.receiveShadow = enabled;
  });
}

/**
 * Applies a consistent shadow profile to a spot-light the first time it is seen.
 * @param {THREE.SpotLight} light
 */
export function configureStreetLightShadow(light) {
  if (!light || !light.isSpotLight) return;
  if (light.userData && light.userData._shadowProfileApplied) return;
  light.shadow.mapSize.set(768, 768);
  light.shadow.camera.near = 0.2;
  const baseDistance =
    typeof light.distance === 'number' && light.distance > 0 ? light.distance : 10;
  light.shadow.camera.far = Math.max(8, baseDistance + 2);
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.015;
  light.shadow.radius = 3;
  light.shadow.blurSamples = 6;
  light.userData = light.userData || {};
  light.userData._shadowProfileApplied = true;
}

/**
 * Selects the N closest streetlights to the player and gives them shadow maps.
 * @param {boolean} [forceUpdate]
 * @param {THREE.Object3D} [playerObj] - camera wrapper or camera itself
 * @param {HTMLInputElement|null} [settingShadows]
 */
export function updateNightStreetlightShadowCasters(
  forceUpdate = false,
  playerObj = null,
  settingShadows = null
) {
  const sLights =
    scene.userData && scene.userData.streetLights ? scene.userData.streetLights : [];
  if (!sLights.length) return;

  for (const sl of sLights) {
    if (!sl || !sl.isSpotLight) continue;
    if (sl.castShadow) {
      sl.castShadow = false;
      if (forceUpdate) sl.shadow.needsUpdate = true;
    }
  }

  const shadowsEnabled =
    renderer.shadowMap.enabled && (!settingShadows || settingShadows.checked);
  const isDay = Boolean(scene.userData && scene.userData.isDay);
  if (isDay || !shadowsEnabled) return;

  const origin = playerObj ? playerObj.position : new THREE.Vector3();
  const maxDistSq = NIGHT_STREETLIGHT_SHADOW_RANGE * NIGHT_STREETLIGHT_SHADOW_RANGE;
  const candidates = [];

  for (const sl of sLights) {
    if (!sl || !sl.isSpotLight) continue;
    if (sl.visible === false || sl.intensity <= 0.01) continue;
    const distSq = sl.position.distanceToSquared(origin);
    if (distSq > maxDistSq) continue;
    candidates.push({ light: sl, distSq });
  }

  candidates.sort((a, b) => a.distSq - b.distSq);
  const activeCount = Math.min(MAX_DYNAMIC_NIGHT_STREETLIGHT_SHADOWS, candidates.length);
  for (let i = 0; i < activeCount; i++) {
    const sl = candidates[i].light;
    configureStreetLightShadow(sl);
    sl.castShadow = true;
    if (forceUpdate) sl.shadow.needsUpdate = true;
  }
}
