import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { scene, camera } from './engine.js';
import { getLookSensitivity } from './audio.js';
import {
  PLAYER_GRAVITY,
  PLAYER_JUMP_VELOCITY,
  PLAYER_SUPPORT_SNAP_UP,
  isPlayerBlockedAt,
  getSupportSurfaceY
} from './collision.js';

// ---------------------------------------------------------------------------
// Module-level controls reference (populated by initPointerLock)
// ---------------------------------------------------------------------------

/** @type {PointerLockControls|null} */
let _controls = null;

/** @returns {PointerLockControls|null} */
export function getControls() {
  return _controls;
}

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} PointerLockOptions
 * @property {number} playerHeight
 * @property {boolean} partyCutsceneTransitioning - getter fn, called each frame
 * @property {() => boolean} isInputBlocked - called each frame to suppress movement
 * @property {() => void} onFirstJoin - called on the first pointer-lock event
 * @property {() => void} onLockAcquired
 * @property {() => void} onLockReleased
 * @property {HTMLElement|null} playButton
 * @property {HTMLElement|null} instructions
 * @property {HTMLElement|null} blocker
 * @property {HTMLElement|null} pauseOverlay
 */

/**
 * Creates PointerLockControls, wires keyboard / pointer-lock events, and
 * returns the controls instance together with the per-frame `updateMovement` fn.
 *
 * @param {PointerLockOptions} opts
 * @returns {{ controls: PointerLockControls, updateMovement: (dt: number) => void }}
 */
export function initPointerLock(opts) {
  const {
    playerHeight,
    isPartyCutsceneTransitioning,
    isInputBlocked,
    onFirstJoin,
    onLockAcquired,
    onLockReleased,
    playButton,
    instructions,
    pauseOverlay
  } = opts;

  _controls = new PointerLockControls(camera, document.body);
  _controls.pointerSpeed = getLookSensitivity();
  scene.add(_controls.getObject());

  // Movement state
  const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  };
  let canJump = false;
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // Key handlers
  const onKeyDown = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': moveState.forward = true; break;
      case 'ArrowLeft':
      case 'KeyA': moveState.left = true; break;
      case 'ArrowDown':
      case 'KeyS': moveState.backward = true; break;
      case 'ArrowRight':
      case 'KeyD': moveState.right = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': moveState.sprint = true; break;
      case 'Space':
        if (canJump) {
          velocity.y += PLAYER_JUMP_VELOCITY;
          canJump = false;
        }
        break;
    }
  };

  const onKeyUp = (event) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': moveState.forward = false; break;
      case 'ArrowLeft':
      case 'KeyA': moveState.left = false; break;
      case 'ArrowDown':
      case 'KeyS': moveState.backward = false; break;
      case 'ArrowRight':
      case 'KeyD': moveState.right = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': moveState.sprint = false; break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Lock / unlock events
  _controls.addEventListener('lock', () => {
    onLockAcquired?.();
    onFirstJoin?.();
  });

  _controls.addEventListener('unlock', () => {
    onLockReleased?.();
  });

  // Play / instructions buttons
  if (playButton) {
    playButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (_controls && !_controls.isLocked) _controls.lock();
    });
  }
  if (instructions) {
    instructions.addEventListener('click', () => {
      if (_controls && !_controls.isLocked) _controls.lock();
    });
  }
  if (pauseOverlay) {
    pauseOverlay.addEventListener('click', () => {
      if (_controls && !_controls.isLocked) _controls.lock();
    });
  }

  // Per-frame movement update
  /**
   * @param {number} dt - delta time in seconds
   */
  function updateMovement(dt) {
    if (isPartyCutsceneTransitioning?.()) {
      velocity.set(0, 0, 0);
      return;
    }

    const sprintMult = moveState.sprint ? 1.9 : 1;
    const speed = 25.0 * sprintMult;
    const accel = 60.0 * sprintMult;
    const damping = 10.0;

    velocity.y -= PLAYER_GRAVITY * dt;

    direction.x = Number(moveState.left) - Number(moveState.right);
    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.normalize();

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * accel * dt;
    if (moveState.left || moveState.right) velocity.x -= direction.x * accel * dt;

    velocity.x -= velocity.x * Math.min(damping * dt, 1);
    velocity.z -= velocity.z * Math.min(damping * dt, 1);

    const hSpeed = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    if (hSpeed > speed) {
      velocity.x *= speed / hSpeed;
      velocity.z *= speed / hSpeed;
    }

    if (!isInputBlocked?.()) {
      const playerObj = _controls.getObject();
      const currentHeight = typeof playerHeight === 'function' ? playerHeight() : playerHeight;

      const startPos = playerObj.position.clone();

      // Calculate desired target position by applying local translations
      playerObj.translateX(velocity.x * dt);
      playerObj.translateZ(velocity.z * dt);
      const targetPos = playerObj.position.clone();
      
      // Reset position to apply world-axis aligned movements separately
      playerObj.position.copy(startPos);

      const worldDeltaX = targetPos.x - startPos.x;
      const worldDeltaZ = targetPos.z - startPos.z;

      // Apply World X movement
      playerObj.position.x += worldDeltaX;
      if (isPlayerBlockedAt(playerObj.position, currentHeight)) {
        playerObj.position.x = startPos.x;
      }

      // Apply World Z movement
      playerObj.position.z += worldDeltaZ;
      if (isPlayerBlockedAt(playerObj.position, currentHeight)) {
        playerObj.position.z = startPos.z;
      }

      // Apply World Y movement
      const beforeY = playerObj.position.y;
      playerObj.position.y += velocity.y * dt;
      if (isPlayerBlockedAt(playerObj.position, currentHeight)) {
        playerObj.position.y = beforeY;
        if (velocity.y > 0) velocity.y = 0;
      }

      const supportY = getSupportSurfaceY(playerObj.position, currentHeight);
      if (supportY !== null) {
        const targetEyeY = supportY + currentHeight;
        const canSnap =
          velocity.y <= 0 && playerObj.position.y <= targetEyeY + PLAYER_SUPPORT_SNAP_UP;
        if (canSnap) {
          playerObj.position.y = targetEyeY;
          velocity.y = 0;
          canJump = true;
        } else {
          canJump = Math.abs(playerObj.position.y - targetEyeY) <= 0.015;
        }
      } else {
        canJump = false;
      }

      // Hard floor fallback.
      if (playerObj.position.y < currentHeight) {
        playerObj.position.y = currentHeight;
        velocity.y = 0;
        canJump = true;
      }
    }
  }

  return { controls: _controls, updateMovement };
}
