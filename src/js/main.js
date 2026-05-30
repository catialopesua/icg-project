/**
 * MAIN GAME ENTRY POINT
 * 
 * This is the core initialization and game loop orchestrator for Birthday Party Quest.
 * It handles:
 * - Scene setup and Three.js initialization
 * - All game systems initialization (audio, controls, UI, physics, etc.)
 * - Game state management and player progression
 * - Multi-zone environment handling
 * - Party sequence management
 * 
 * NOTE: GitHub Copilot was used extensively in the development of this file for:
 * - Code organization and structure
 * - Complex mathematical animations
 */

import * as THREE from 'three';
import { scene, camera, renderer, addAnimationHook, startAnimationLoop } from './core/engine.js';
import { initAudioListener, setupAudioSettings, setupSensitivitySettings, playNewQuestSound, playPartyMusic } from './core/audio.js';
import { initPointerLock } from './core/controls.js';
import { initMenus, showIntroOverlay, setQuestText, renderFriendsPanel, syncWeatherUnlockUI, showWeatherUnlockToast, closePanelsAndRelockIfNeeded, hidePauseOverlay, showPauseOverlay, setIsLockedChecker } from './ui/menus.js';
import { initSettings } from './ui/settings.js';
import { isMobile, initMobileControls } from './ui/mobileControls.js';
import { initWeather, updateWeather, applyWeather } from './core/weather.js';
import { initInteraction, checkInteraction, updateInteractHint, patchInteractionRefs } from './core/interaction.js';
import { rebuildWorldCollisionBoxes } from './core/collision.js';
import { syncSceneMeshShadows } from './core/lighting.js';
import { makeTerrainTextureSet } from './core/terrain.js';
import { loadTimModel, loadFriendModel } from './core/loader.js';

import { createGardenZone } from './environments/garden.js';
import { createCityZone } from './environments/city.js';
import { createBeachZone } from './environments/beach.js';
import { createForestZone } from './environments/forest.js';

import { FRIEND_DEFS, loadFriendPlacements, loadPlayerStart, loadTimPlacement } from './friends.js';
import { PARK_CENTER_X, PARK_CENTER_Z, loadPartyLayout } from './party.js';
import { preparePartyScene, updatePartyProps, loadPartyCakeAsset } from './core/party_system.js';

// ── KeyboardEvent WebKit / iOS Safari Polyfill ─────────────────────────────
(function () {
  if (typeof window !== 'undefined' && 'KeyboardEvent' in window) {
    const OriginalKeyboardEvent = window.KeyboardEvent;
    try {
      const testEvent = new OriginalKeyboardEvent('keydown', { code: 'KeyW' });
      if (testEvent.code !== 'KeyW') {
        const keyCodes = {
          'KeyW': 87, 'ArrowUp': 38,
          'KeyA': 65, 'ArrowLeft': 37,
          'KeyS': 83, 'ArrowDown': 40,
          'KeyD': 68, 'ArrowRight': 39,
          'Space': 32, 'KeyE': 69
        };
        window.KeyboardEvent = function (type, dict) {
          const event = new OriginalKeyboardEvent(type, dict);
          if (dict && dict.code) {
            Object.defineProperty(event, 'code', { value: dict.code, enumerable: true });
            Object.defineProperty(event, 'key', { value: dict.code, enumerable: true });
            const codeVal = keyCodes[dict.code] || 0;
            Object.defineProperty(event, 'keyCode', { value: codeVal, enumerable: true });
            Object.defineProperty(event, 'which', { value: codeVal, enumerable: true });
          }
          return event;
        };
        window.KeyboardEvent.prototype = OriginalKeyboardEvent.prototype;
      }
    } catch (e) { }
  }
})();

console.log('Main.js initializing...');

// ---------------------------------------------------------------------------
// GLOBAL GAME STATE
// Tracks player progress, interactions, and unlocks
// ---------------------------------------------------------------------------
let unlockedFriendIds = new Set(); // Set of friend IDs the player has found
let timDialogueCompleted = false; // Whether player has spoken to Tim
let partyCutsceneStarted = false; // Whether final party celebration has begun
let hasJoinedOnce = false; // Whether player has entered the game world
let playerHeight = 1.6; // Height of player camera above feet

// Initialize friends with locked state - info unlocks when player finds them
const friendsState = FRIEND_DEFS.map(def => ({
  id: def.id, name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false
}));

// ---------------------------------------------------------------------------
// WORLD SETUP & ENVIRONMENT CREATION
// Creates terrain, zones, and environmental assets with textures
// ---------------------------------------------------------------------------
// NOTE: This world creation uses complex mathematical positioning developed with GitHub Copilot
// Create terrain textures with proper scaling and material properties
const grassGroundTex = makeTerrainTextureSet('./textures/Grass002_2K-JPG/Grass002_2K-JPG', 30);
const snowGroundTex = makeTerrainTextureSet('./textures/Snow015_2K-JPG/Snow015_2K-JPG', 12);

// Set up physically-based material for realistic grass appearance
const groundMat = new THREE.MeshStandardMaterial({
  map: grassGroundTex.map,
  normalMap: grassGroundTex.normal,
  roughnessMap: grassGroundTex.roughness,
  bumpMap: grassGroundTex.bump,
  aoMap: grassGroundTex.ao,
  roughness: 0.95,
  metalness: 0.01
});
// Create ground plane and add to scene
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
ground.receiveShadow = true; // Ground receives shadows from objects
scene.add(ground);

// Create the four different zones for the game world
// Each zone has unique environmental assets, NPCs, and visual themes
createGardenZone(scene, PARK_CENTER_X, PARK_CENTER_Z); // Garden zone
const forestZone = createForestZone(scene, PARK_CENTER_X, PARK_CENTER_Z); // Forest zone
createCityZone(scene, 22, -4); // City zone
const beachZone = createBeachZone(scene, 0, 12); // Beach zone

// ---------------------------------------------------------------------------
// INTRO CAMERA SETUP
// Creates initial top-down cinematic view that pans over the city
// This animation plays before the player joins the game
// ---------------------------------------------------------------------------
// City zone centre used for the intro flyover
const INTRO_CITY_X = -3; // X coordinate of intro focus point
const INTRO_CITY_Z = -7; // Z coordinate of intro focus point
const INTRO_CAM_Y = 40;   // Height of camera above ground for aerial view
const INTRO_PAN_RADIUS = 10; // Radius of gentle orbiting motion during intro

// Initialize camera for intro sequence - positioned for aerial view of city
camera.position.set(INTRO_CITY_X, INTRO_CAM_Y, INTRO_CITY_Z);
camera.rotation.set(-Math.PI / 2, 0, 0); // Point camera straight down for cinematic view


// ---------------------------------------------------------------------------
// CORE GAME SYSTEMS INITIALIZATION
// Sets up all major subsystems required for gameplay
// ---------------------------------------------------------------------------
// Initialize 3D audio listener attached to camera for spatial sound
initAudioListener(camera);

// Detect mobile device and initialize appropriate control scheme
let mobileControlsContainer = null;
const isMobileDevice = isMobile(); // Detect if running on touch device

if (isMobileDevice) {
  // Initialize on-screen touch controls for mobile devices
  mobileControlsContainer = initMobileControls(camera);
  mobileControlsContainer.style.display = 'none'; // Hidden until player joins

  // Update UI prompts for touch devices ("Click" → "Tap")
  const playPrompt = document.getElementById('play-prompt');
  if (playPrompt) playPrompt.textContent = 'Tap anywhere to play';

  const pausePrompt = document.getElementById('pause-prompt');
  if (pausePrompt) pausePrompt.textContent = 'Tap anywhere to resume';
}

// Handler called when player first enters the game world
const triggerFirstJoin = () => {
  if (!hasJoinedOnce) {
    // Load player starting position and orientation
    const start = loadPlayerStart();
    controls.getObject().position.set(start.x || -18, (start.y || 0) + playerHeight, start.z || 20);
    controls.getObject().rotation.y = start.rotationY || 0;
    controls.getObject().rotation.x = 0;
    controls.getObject().rotation.z = 0;
    hasJoinedOnce = true;

    // Hide intro overlay and transition to gameplay
    const blockerEl = document.getElementById('blocker');
    if (blockerEl) blockerEl.classList.add('hidden');
    document.body.classList.remove('pregame');
    playNewQuestSound(); // Play sound effect on game start

    if (isMobileDevice && mobileControlsContainer) {
      // Show mobile controls after player joins
      mobileControlsContainer.style.display = 'block';
      // Update interact hint to fit mobile button
      const hint = document.getElementById('interact-hint');
      if (hint) hint.innerText = 'INT';

      // Update interact UI tooltip for touch devices
      const intUI = document.getElementById('interact-ui');
      if (intUI) intUI.innerText = 'Tap INT to interact';

      // Simulate pointer lock state for mobile devices
      controls.isLocked = true;
    }
  }
};

const { controls, updateMovement } = initPointerLock({
  playerHeight: () => playerHeight,
  isInputBlocked: () => false,
  onFirstJoin: triggerFirstJoin,
  onLockAcquired: hidePauseOverlay,
  onLockReleased: () => { },
  playButton: document.getElementById('play-button'),
  instructions: document.getElementById('blocker'), // Use blocker instead of non-existent instructions ID
  pauseOverlay: document.getElementById('pause-overlay'),
  isMobileDevice
});

setIsLockedChecker(() => controls.isLocked);

initMenus({
  panelById: {
    'weather-panel': document.getElementById('weather-panel'),
    'friends-panel': document.getElementById('friends-panel'),
    'settings-panel': document.getElementById('settings-panel'),
    'help-panel': document.getElementById('help-panel')
  },
  chatBubble: document.getElementById('chat-bubble'),
  questText: document.getElementById('quest-main-text'),
  pauseOverlay: document.getElementById('pause-overlay'),
  blocker: document.getElementById('blocker'),
  interactHint: document.getElementById('interact-hint'),
  weatherUnlockToast: document.getElementById('weather-unlock-toast'),
  weatherUnlockedCount: document.getElementById('weather-unlocked-count'),
  friendsList: document.getElementById('friends-list'),
  friendsFoundCount: document.getElementById('friends-found-count'),
  weatherToggleButton: document.getElementById('weather-toggle'),
  friendsToggleButton: document.getElementById('friends-toggle'),
  settingsToggleButton: document.getElementById('settings-toggle'),
  helpToggleButton: document.getElementById('help-toggle'),
  closePanelButtons: Array.from(document.querySelectorAll('[data-close-panel]')),
  requestRelock: () => controls.lock(),
  requestUnlock: () => controls.unlock(),
  hasJoinedOnce: () => hasJoinedOnce
});

initSettings({
  settingShadows: document.getElementById('setting-shadows'),
  saveSettingsButton: document.getElementById('save-settings'),
  getPlayerObj: () => controls.getObject()
});

initWeather({
  controls, forestZone, grassGroundTex, snowGroundTex, groundMat,
  closePanelsFn: closePanelsAndRelockIfNeeded,
  settingParticles: document.getElementById('setting-particles')
});

// ---------------------------------------------------------------------------
// Game Logic
// ---------------------------------------------------------------------------

function updateFriendsUI() {
  renderFriendsPanel(friendsState);
  const unlockedWeathers = new Set(['sunny', 'night']);
  FRIEND_DEFS.forEach(def => {
    if (unlockedFriendIds.has(def.id) && def.weatherId) unlockedWeathers.add(def.weatherId);
  });
  syncWeatherUnlockUI(unlockedWeathers);
}

function unlockFriend(id) {
  if (unlockedFriendIds.has(id)) return;
  const def = FRIEND_DEFS.find(d => d.id === id);
  if (!def) return;

  unlockedFriendIds.add(id);
  const state = friendsState.find(f => f.id === id);
  if (state) {
    state.name = def.name; state.description = def.description; state.weather = def.weatherLabel; state.image = def.image; state.unlocked = true;
  }

  updateFriendsUI();
  if (def.weatherLabel) showWeatherUnlockToast(def.weatherLabel);

  if (unlockedFriendIds.size >= FRIEND_DEFS.length) {
    setQuestText('Return to Tim');
  }
}

const interaction = initInteraction({
  controls,
  actor: null, friendActors: [], friendActorsById: new Map(),
  unlockedFriendIds,
  isTimDialogueCompleted: () => timDialogueCompleted,
  isPartyCutsceneStarted: () => partyCutsceneStarted,
  getTimDialogueKey: () => (!timDialogueCompleted ? 'tim-intro' : (unlockedFriendIds.size >= FRIEND_DEFS.length && !partyCutsceneStarted ? 'tim-party' : null)),
  getDialogueConfig: (key) => {
    if (key === 'tim-intro') return {
      lines: ['Hello! My name is Tim and today is my birthday! I heard you could help me find my friends!', 'Find them all and then meet me here in the park!'],
      speaker: 'Tim', image: 'images/boy1.png',
      onComplete: () => { timDialogueCompleted = true; setQuestText('Find Tim\'s friends'); updateFriendActorsVisibility(); }
    };
    if (key === 'tim-party') return {
      lines: ['It looks like you have found all my friends!', 'It\'s time for the party!'],
      speaker: 'Tim', image: 'images/boy1.png',
      onComplete: () => { startPartyCutscene(); }
    };
    const def = FRIEND_DEFS.find(d => d.id === key);
    if (def) return { lines: def.dialogueLines, speaker: def.name, image: def.image, onComplete: () => unlockFriend(def.id) };
    return null;
  },
  onUnlockFriend: unlockFriend,
  onStartFinalPartyCutscene: () => { },
  requestRelock: () => controls.lock(),
  interactUI: document.getElementById('interact-ui'),
  fadeScreen: document.getElementById('fade-screen'),
  playerHeight: () => playerHeight
});

// ---------------------------------------------------------------------------
// Loading Models
// ---------------------------------------------------------------------------
let friendActors = [];
const friendActorsById = new Map();

function updateFriendActorsVisibility() {
  friendActors.forEach(f => {
    f.visible = timDialogueCompleted;
    f.userData.noCollision = !timDialogueCompleted;
  });
  rebuildWorldCollisionBoxes();
}

loadTimModel(loadTimPlacement(), (actor, height) => {
  playerHeight = height;
  patchInteractionRefs({ actor });
});

const friendPlacements = loadFriendPlacements();
FRIEND_DEFS.forEach(def => {
  const placement = friendPlacements.find(p => p.id === def.id);
  loadFriendModel(def, placement, (friend) => {
    friendActors.push(friend);
    friendActorsById.set(def.id, friend);
    friend.visible = timDialogueCompleted;
    friend.userData.noCollision = !timDialogueCompleted;
    patchInteractionRefs({ friendActors, friendActorsById });
  });
});

// ---------------------------------------------------------------------------
// Final Logic
// ---------------------------------------------------------------------------
function startPartyCutscene() {
  if (partyCutsceneStarted) return;
  partyCutsceneStarted = true;

  // Hide HUD/interaction while transitioning
  const fadeScreen = document.getElementById('fade-screen');
  if (fadeScreen) {
    fadeScreen.style.transition = 'opacity 0.42s ease';
    fadeScreen.style.opacity = '1';
  }

  window.setTimeout(() => {
    // Force unlock all friends for the party scene
    FRIEND_DEFS.forEach(def => unlockedFriendIds.add(def.id));
    updateFriendsUI();

    // Prepare the scene visuals and participants
    preparePartyScene(interaction.actor, interaction.friendActorsById);

    setQuestText('Happy Birthday, Tim!');
    playPartyMusic();

    if (fadeScreen) fadeScreen.style.opacity = '0';
    if (controls && !controls.isLocked) controls.lock();
  }, 1000);
}

addAnimationHook((dt, elapsed) => {
  updateMovement(dt);
  updateWeather(elapsed, dt);
  updatePartyProps(elapsed, dt);
  if (beachZone?.update) beachZone.update(elapsed, dt);
  checkInteraction(camera, scene);
  updateInteractHint(false, false, () => (!timDialogueCompleted || (unlockedFriendIds.size >= FRIEND_DEFS.length && !partyCutsceneStarted)), unlockedFriendIds);

  // Intro camera: slow pan over the city until the player joins.
  if (!hasJoinedOnce) {
    const angle = elapsed * 0.08; // ~72s per full orbit — extremely slow
    camera.position.set(
      INTRO_CITY_X + Math.sin(angle) * INTRO_PAN_RADIUS,
      INTRO_CAM_Y,
      INTRO_CITY_Z + Math.cos(angle) * INTRO_PAN_RADIUS
    );
    // Always look straight down regardless of orbit position
    camera.rotation.set(-Math.PI / 2, 0, 0);
  }
});


setupAudioSettings(document.getElementById('setting-music-volume'), document.getElementById('music-volume-value'), document.getElementById('setting-sfx-volume'), document.getElementById('sfx-volume-value'));
setupSensitivitySettings(document.getElementById('setting-sensitivity'), document.getElementById('sensitivity-value'), () => controls);

// ---------------------------------------------------------------------------
// Pause on Esc (only while in-game, no panels open, pointer was locked)
// ---------------------------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (!hasJoinedOnce) return;

  // Let menus.js handle Esc when a panel is open (it closes the panel)
  const anyPanelOpen = document.querySelector('#weather-panel:not(.hidden), #friends-panel:not(.hidden), #settings-panel:not(.hidden), #help-panel:not(.hidden)');
  if (anyPanelOpen) return;

  if (controls.isLocked) {
    controls.unlock();
  }
});

// For mobile play/resume tap interception
if (isMobileDevice) {
  const startMobileGame = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (controls) controls.lock();
  };

  const blockerEl = document.getElementById('blocker');
  if (blockerEl) {
    blockerEl.addEventListener('touchstart', startMobileGame, { passive: false });
    blockerEl.addEventListener('click', startMobileGame);
  }

  const pauseOverlayEl = document.getElementById('pause-overlay');
  if (pauseOverlayEl) {
    pauseOverlayEl.addEventListener('touchstart', startMobileGame, { passive: false });
    pauseOverlayEl.addEventListener('click', startMobileGame);
  }
}

window.addEventListener('blur', () => {
  if (hasJoinedOnce && !partyCutsceneStarted) {
    const anyPanelOpen = document.querySelector('#weather-panel:not(.hidden), #friends-panel:not(.hidden), #settings-panel:not(.hidden), #help-panel:not(.hidden)');
    if (!anyPanelOpen) showPauseOverlay();
  }
});

THREE.DefaultLoadingManager.onLoad = () => {
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('intro-screen').classList.remove('hidden');
    document.getElementById('blocker').classList.add('intro-active');
  }, 150);
};

showIntroOverlay();
updateFriendsUI();
rebuildWorldCollisionBoxes();
startAnimationLoop();
