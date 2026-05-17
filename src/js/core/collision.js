import * as THREE from 'three';
import { scene } from './engine.js';

// ---------------------------------------------------------------------------
// Player collision constants
// ---------------------------------------------------------------------------
export const PLAYER_HEIGHT = 1.6;
export const PLAYER_COLLISION_RADIUS = 0.34;
export const PLAYER_COLLISION_TOP_OFFSET = 0.2;
export const PLAYER_COLLISION_FOOT_OFFSET = 0.03;
export const PLAYER_SUPPORT_SNAP_DOWN = 0.55;
export const PLAYER_SUPPORT_SNAP_UP = 0.12;
export const PLAYER_JUMP_VELOCITY = 5.0;
export const PLAYER_GRAVITY = 12.5;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
const worldCollisionBoxes = [];
const _probeBox = new THREE.Box3();
const _tempBox = new THREE.Box3();
const _tempSize = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Helpers – which meshes should have collision?
// ---------------------------------------------------------------------------
/**
 * Returns true when any ancestor has `userData.noCollision = true`.
 * @param {THREE.Object3D} obj
 * @returns {boolean}
 */
function hasNoCollisionAncestor(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.noCollision) return true;
    cur = cur.parent;
  }
  return false;
}

/**
 * Heuristic name-based exclusion: grass, rocks, lamps, road markings, etc.
 * @param {THREE.Object3D} obj
 * @returns {boolean}
 */
function matchesCollisionExclusionByName(obj) {
  const names = [];
  let cur = obj;
  let steps = 0;
  while (cur && steps < 8) {
    if (typeof cur.name === 'string' && cur.name) names.push(cur.name.toLowerCase());
    cur = cur.parent;
    steps++;
  }
  const label = names.join(' ');
  if (!label) return false;
  return /(towel|trashbin|trash_bin|\bbin\b|\broad\b|\blane\b|asphalt|grass|streetlight|street_light|lamp|lamp-post|lamp_post|pole|bulb|cone|foliage|leaf)/i.test(
    label
  );
}

/**
 * Returns true when a mesh should contribute a collision AABB.
 * @param {THREE.Object3D} obj
 * @returns {boolean}
 */
function shouldCreateCollisionForMesh(obj) {
  if (!obj || !obj.isMesh) return false;
  if (!obj.visible) return false;
  if (obj.userData && obj.userData.noAutoCollision) return false;
  if (hasNoCollisionAncestor(obj)) return false;
  if (matchesCollisionExclusionByName(obj)) return false;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  return !mats.some(
    (mat) => mat && mat.transparent && typeof mat.opacity === 'number' && mat.opacity < 0.2
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Rebuilds the flat array of world AABB boxes from visible scene meshes.
 * Call once at startup and then periodically (e.g. every ~1 s) while loading.
 */
export function rebuildWorldCollisionBoxes() {
  worldCollisionBoxes.length = 0;
  scene.updateMatrixWorld(true);

  scene.traverse((obj) => {
    if (!shouldCreateCollisionForMesh(obj)) return;

    _tempBox.setFromObject(obj);
    if (!Number.isFinite(_tempBox.min.x) || !Number.isFinite(_tempBox.max.x)) return;

    _tempBox.getSize(_tempSize);
    if (_tempSize.y < 0.04) return;
    if (Math.max(_tempSize.x, _tempSize.z) < 0.08) return;

    // Check if it's a tree to reduce its collision box
    let isTree = false;
    let cur = obj;
    let steps = 0;
    while (cur && steps < 8) {
      if (typeof cur.name === 'string' && /tree/i.test(cur.name)) {
        isTree = true;
        break;
      }
      cur = cur.parent;
      steps++;
    }

    if (isTree) {
      const centerX = (_tempBox.min.x + _tempBox.max.x) / 2;
      const centerZ = (_tempBox.min.z + _tempBox.max.z) / 2;
      const extentX = (_tempSize.x * 0.30) / 2; // shrink X to 30%
      const extentZ = (_tempSize.z * 0.30) / 2; // shrink Z to 30%

      _tempBox.min.x = centerX - extentX;
      _tempBox.max.x = centerX + extentX;
      _tempBox.min.z = centerZ - extentZ;
      _tempBox.max.z = centerZ + extentZ;
    }

    worldCollisionBoxes.push(_tempBox.clone());
  });
}

/**
 * Returns true when the player's AABB (centred on `position`) intersects any world box.
 * @param {THREE.Vector3} position - camera/player eye position
 * @param {number} [eyeHeight]
 * @returns {boolean}
 */
export function isPlayerBlockedAt(position, eyeHeight = PLAYER_HEIGHT) {
  if (!worldCollisionBoxes.length) return false;
  const minY = position.y - eyeHeight + PLAYER_COLLISION_FOOT_OFFSET;
  const maxY = position.y + PLAYER_COLLISION_TOP_OFFSET;
  _probeBox.min.set(
    position.x - PLAYER_COLLISION_RADIUS,
    minY,
    position.z - PLAYER_COLLISION_RADIUS
  );
  _probeBox.max.set(
    position.x + PLAYER_COLLISION_RADIUS,
    maxY,
    position.z + PLAYER_COLLISION_RADIUS
  );
  for (const box of worldCollisionBoxes) {
    if (_probeBox.intersectsBox(box)) return true;
  }
  return false;
}

/**
 * Finds the highest surface top-y that the player is currently standing on (or near).
 * Returns `null` if no surface is underneath.
 * @param {THREE.Vector3} position
 * @param {number} [eyeHeight]
 * @returns {number|null}
 */
export function getSupportSurfaceY(position, eyeHeight = PLAYER_HEIGHT) {
  const footY = position.y - eyeHeight;
  const minCheckY = footY - PLAYER_SUPPORT_SNAP_DOWN;
  const maxCheckY = footY + PLAYER_SUPPORT_SNAP_UP;
  const minX = position.x - PLAYER_COLLISION_RADIUS;
  const maxX = position.x + PLAYER_COLLISION_RADIUS;
  const minZ = position.z - PLAYER_COLLISION_RADIUS;
  const maxZ = position.z + PLAYER_COLLISION_RADIUS;

  let bestY = null;

  // World floor y = 0 is always a valid surface.
  if (0 >= minCheckY && 0 <= maxCheckY) bestY = 0;

  for (const box of worldCollisionBoxes) {
    const topY = box.max.y;
    if (topY < minCheckY || topY > maxCheckY) continue;
    if (box.max.x < minX || box.min.x > maxX) continue;
    if (box.max.z < minZ || box.min.z > maxZ) continue;
    if (bestY === null || topY > bestY) bestY = topY;
  }

  return bestY;
}
