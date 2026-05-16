import * as THREE from 'three';
import { camera, scene } from './engine.js';
import { playChatContinueSound } from './audio.js';
import {
  showChatBubble,
  hideChatBubble,
  isChatBubbleVisible,
  hideInteractHint,
  showInteractHint,
  setDialogueOpenedFromPointerLock,
  isDialogueOpenedFromPointerLock
} from '../ui/menus.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const INTERACT_DISTANCE = 2.0;
const FACING_DOT_THRESHOLD = 0.60;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
let _controls = null;
let _actor = null;                  // Tim NPC
let _friendActors = [];
let _friendActorsById = new Map();
let _unlockedFriendIds = new Set();
let _timDialogueCompleted = false;
let _partyCutsceneStarted = false;
let _activeDialogue = null;
let _activeDialogueIndex = -1;

// Callbacks provided by main.js
let _onUnlockFriend = null;
let _onStartFinalPartyCutscene = null;
let _getTimDialogueKey = null;   // () => string|null
let _getDialogueConfig = null;   // (key) => {lines, speaker, image, onComplete}|null
let _requestRelock = null;

// Helpers for the "stair" trigger (E to teleport)
let _canInteract = false;
/** @type {HTMLElement|null} */
let _interactUI = null;
/** @type {HTMLElement|null} */
let _fadeScreen = null;
let _playerHeight = 1.6;

// For camera look-at during dialogue (unused snap removed but helpers kept)
const _focusLooker = new THREE.Object3D();
const _camWorldPos = new THREE.Vector3();
const _camParentQuat = new THREE.Quaternion();
const _camLocalQuat = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} InteractionOptions
 * @property {import('./controls.js').PointerLockControls} controls
 * @property {THREE.Object3D} actor - Tim NPC
 * @property {THREE.Object3D[]} friendActors
 * @property {Map<string, THREE.Object3D>} friendActorsById
 * @property {Set<string>} unlockedFriendIds
 * @property {() => boolean} isTimDialogueCompleted
 * @property {() => boolean} isPartyCutsceneStarted
 * @property {() => string|null} getTimDialogueKey
 * @property {(key: string) => {lines:string[], speaker:string, image:string, onComplete:()=>void}|null} getDialogueConfig
 * @property {(id: string) => void} onUnlockFriend
 * @property {() => void} onStartFinalPartyCutscene
 * @property {() => void} requestRelock
 * @property {HTMLElement|null} interactUI
 * @property {HTMLElement|null} fadeScreen
 * @property {number} playerHeight
 */

/**
 * Initialises all E-key interaction: NPC dialogue, stair trigger, interact-hint proximity.
 * @param {InteractionOptions} opts
 */
export function initInteraction(opts) {
  _controls = opts.controls;
  _actor = opts.actor;
  _friendActors = opts.friendActors;
  _friendActorsById = opts.friendActorsById;
  _unlockedFriendIds = opts.unlockedFriendIds;
  _onUnlockFriend = opts.onUnlockFriend;
  _onStartFinalPartyCutscene = opts.onStartFinalPartyCutscene;
  _getTimDialogueKey = opts.getTimDialogueKey;
  _getDialogueConfig = opts.getDialogueConfig;
  _requestRelock = opts.requestRelock;
  _interactUI = opts.interactUI;
  _fadeScreen = opts.fadeScreen;
  _playerHeight = opts.playerHeight ?? 1.6;

  return {
    get actor() { return _actor; },
    get friendActors() { return _friendActors; },
    get friendActorsById() { return _friendActorsById; }
  };
}


/**
 * Updates the references that can change after init (actor loaded async, etc.).
 * @param {{ actor?: THREE.Object3D, friendActors?: THREE.Object3D[], friendActorsById?: Map<string, THREE.Object3D>, controls?: any }} patch
 */
export function patchInteractionRefs(patch) {
  if (patch.actor !== undefined) _actor = patch.actor;
  if (patch.friendActors !== undefined) _friendActors = patch.friendActors;
  if (patch.friendActorsById !== undefined) _friendActorsById = patch.friendActorsById;
  if (patch.controls !== undefined) _controls = patch.controls;
}


// ---------------------------------------------------------------------------
// Stair trigger (E key teleport)
// ---------------------------------------------------------------------------
/**
 * Call every frame to show/hide the interact UI near a stairTrigger.
 * @param {THREE.Camera} cam
 * @param {THREE.Scene} sc
 */
export function checkInteraction(cam, sc) {
  const trigger = sc.userData.stairTrigger;
  if (!trigger) return;

  const playerPos = cam.position;
  const distToBase = trigger.position ? playerPos.distanceTo(trigger.position) : Infinity;
  const distToTop = trigger.target ? playerPos.distanceTo(trigger.target) : Infinity;
  const radius = Number(trigger.radius) || 2.2;

  if (distToBase < radius || distToTop < radius) {
    if (_interactUI) _interactUI.style.display = 'block';
    _canInteract = true;
  } else {
    if (_interactUI) _interactUI.style.display = 'none';
    _canInteract = false;
  }
}

// E-key stair teleport listener
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || !_canInteract) return;
  const trigger = scene.userData.stairTrigger;
  if (!trigger) return;

  if (_fadeScreen) _fadeScreen.style.opacity = '1';

  const playerObj =
    _controls && _controls.getObject ? _controls.getObject() : camera;
  const playerPos = playerObj?.position?.clone?.() ?? new THREE.Vector3(
    camera.position.x, camera.position.y, camera.position.z
  );

  const atTop =
    Boolean(trigger._isAtTop) ||
    Math.abs(playerPos.y - (trigger.target?.y ?? 0)) < 1.5;

    setTimeout(() => {
      const currentHeight = typeof _playerHeight === 'function' ? _playerHeight() : _playerHeight;
      if (!atTop) {
        try { trigger._lastGroundPosition = playerPos.clone(); } catch (_) { /* ignore */ }
        trigger._isAtTop = true;
        const dest = trigger.target?.clone?.() ??
          new THREE.Vector3(trigger.position.x, trigger.position.y + 4, trigger.position.z);
        const finalY = dest.y + currentHeight;
        if (_controls?.getObject) _controls.getObject().position.set(dest.x, finalY, dest.z);
        else camera.position.set(dest.x, finalY, dest.z);
      } else {
        const dest = trigger._lastGroundPosition?.clone?.() ??
          trigger.position?.clone?.() ??
          new THREE.Vector3(trigger.position.x, trigger.position.y, trigger.position.z);
        trigger._isAtTop = false;
        if (_controls?.getObject) _controls.getObject().position.set(dest.x, dest.y, dest.z);
        else camera.position.set(dest.x, dest.y, dest.z);
      }
      if (_fadeScreen) _fadeScreen.style.opacity = '0';
    }, 1000);
});

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------
/**
 * Starts a dialogue sequence for a given key (e.g. 'tim-intro', friendId).
 * @param {string} dialogueKey
 * @returns {boolean} true if dialogue started
 */
export function startDialogue(dialogueKey) {
  const cfg = _getDialogueConfig?.(dialogueKey);
  if (!cfg || !cfg.lines || !cfg.lines.length) return false;
  _activeDialogue = dialogueKey;
  _activeDialogueIndex = 0;

  if (_controls?.isLocked) {
    setDialogueOpenedFromPointerLock(true);
    _controls.unlock();
  }

  showChatBubble(cfg.lines[_activeDialogueIndex], 0, cfg.image, cfg.speaker);
  return true;
}

export function getActiveDialogue() { return _activeDialogue; }
export function clearActiveDialogue() {
  _activeDialogue = null;
  _activeDialogueIndex = -1;
}

// E-key dialogue handler
document.addEventListener('keydown', (ev) => {
  if (ev.code !== 'KeyE' || ev.repeat) return;
  if (_canInteract) return; // stair trigger has priority

  try {
    // Advance or finish active dialogue
    if (_activeDialogue) {
      const cfg = _getDialogueConfig?.(_activeDialogue);
      if (!cfg) {
        clearActiveDialogue();
        hideChatBubble();
        return;
      }

      playChatContinueSound();

      if (_activeDialogueIndex < cfg.lines.length - 1) {
        _activeDialogueIndex++;
        showChatBubble(cfg.lines[_activeDialogueIndex], 0, cfg.image, cfg.speaker);
      } else {
        hideChatBubble();
        clearActiveDialogue();
        if (typeof cfg.onComplete === 'function') cfg.onComplete();
        if (isDialogueOpenedFromPointerLock()) {
          setDialogueOpenedFromPointerLock(false);
          _requestRelock?.();
        }
      }
      return;
    }

    // Close orphan bubble
    if (isChatBubbleVisible()) {
      hideChatBubble();
      return;
    }

    // Start dialogue (only when locked)
    if (!_controls?.getObject || !_controls.isLocked) return;

    const camObj = _controls.getObject();
    const playerPos = camObj.position.clone();
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camObj.quaternion)
      .setY(0)
      .normalize();

    // 1) Tim
    const timKey = _getTimDialogueKey?.();
    if (_actor && timKey) {
      const actorPos = new THREE.Vector3();
      _actor.getWorldPosition(actorPos);
      if (actorPos.distanceTo(playerPos) <= INTERACT_DISTANCE) {
        const dot = forward.dot(actorPos.clone().sub(playerPos).setY(0).normalize());
        if (dot >= FACING_DOT_THRESHOLD) {
          startDialogue(timKey);
          return;
        }
      }
    }

    // 2) Nearest unlocked friend
    let nearestId = null;
    let nearestDist = Infinity;
    for (const friend of _friendActors) {
      if (!friend?.visible) continue;
      const fId = String(friend.userData?.friendId || friend.name || '');
      if (_unlockedFriendIds.has(fId)) continue;
      const fPos = new THREE.Vector3();
      friend.getWorldPosition(fPos);
      const d = fPos.distanceTo(playerPos);
      if (d > INTERACT_DISTANCE) continue;
      const dot = forward.dot(fPos.clone().sub(playerPos).setY(0).normalize());
      if (dot < FACING_DOT_THRESHOLD) continue;
      if (d < nearestDist) { nearestDist = d; nearestId = fId; }
    }
    if (nearestId) startDialogue(nearestId);
  } catch (_) { /* keep game running */ }
});

// ---------------------------------------------------------------------------
// Per-frame interact hint update
// ---------------------------------------------------------------------------
/**
 * Call every frame to show/hide the "Press E" hint near NPCs.
 * @param {boolean} partyCutsceneActive
 * @param {boolean} partyCutsceneTransitioning
 * @param {boolean} timDialogueCompleted
 * @param {boolean} partyCutsceneStarted
 * @param {Set<string>} unlockedFriendIds
 * @param {(friendId: string) => boolean} isTimCanTalk
 */
export function updateInteractHint(
  partyCutsceneActive,
  partyCutsceneTransitioning,
  isTimCanTalk,
  unlockedFriendIds
) {
  try {
    if (partyCutsceneActive || partyCutsceneTransitioning) { hideInteractHint(); return; }
    if (!_controls?.getObject || !_controls.isLocked) { hideInteractHint(); return; }
    if (isChatBubbleVisible()) { hideInteractHint(); return; }

    const camObj = _controls.getObject();
    const playerPos = camObj.position;
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camObj.quaternion)
      .setY(0)
      .normalize();

    let shouldShow = false;

    if (_actor && isTimCanTalk?.()) {
      const actorPos = new THREE.Vector3();
      _actor.getWorldPosition(actorPos);
      const d = actorPos.distanceTo(playerPos);
      const dot = forward.dot(actorPos.clone().sub(playerPos).setY(0).normalize());
      if (d <= INTERACT_DISTANCE && dot >= FACING_DOT_THRESHOLD) shouldShow = true;
    }

    if (!shouldShow) {
      for (const friend of _friendActors) {
        if (!friend?.visible) continue;
        const fId = String(friend.userData?.friendId || friend.name || '');
        if (unlockedFriendIds.has(fId)) continue;
        const fPos = new THREE.Vector3();
        friend.getWorldPosition(fPos);
        const d = fPos.distanceTo(playerPos);
        if (d > INTERACT_DISTANCE) continue;
        const dot = forward.dot(fPos.clone().sub(playerPos).setY(0).normalize());
        if (dot >= FACING_DOT_THRESHOLD) { shouldShow = true; break; }
      }
    }

    if (shouldShow) showInteractHint(); else hideInteractHint();
  } catch (_) { /* ignore */ }
}
