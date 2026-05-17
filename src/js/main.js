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

console.log('Main.js initializing...');

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------
let unlockedFriendIds = new Set();
let timDialogueCompleted = false;
let partyCutsceneStarted = false;
let hasJoinedOnce = false;
let playerHeight = 1.6;

const friendsState = FRIEND_DEFS.map(def => ({
  id: def.id, name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false
}));

// ---------------------------------------------------------------------------
// World Setup
// ---------------------------------------------------------------------------
const grassGroundTex = makeTerrainTextureSet('./textures/Grass002_2K-JPG/Grass002_2K-JPG', 30);
const snowGroundTex = makeTerrainTextureSet('./textures/Snow015_2K-JPG/Snow015_2K-JPG', 12);
const groundMat = new THREE.MeshStandardMaterial({
  map: grassGroundTex.map,
  normalMap: grassGroundTex.normal,
  roughnessMap: grassGroundTex.roughness,
  bumpMap: grassGroundTex.bump,
  aoMap: grassGroundTex.ao,
  roughness: 0.95,
  metalness: 0.01
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

createGardenZone(scene, PARK_CENTER_X, PARK_CENTER_Z);
const forestZone = createForestZone(scene, PARK_CENTER_X, PARK_CENTER_Z);
createCityZone(scene, 22, -4);
const beachZone = createBeachZone(scene, 0, 12);

// ---------------------------------------------------------------------------
// Core Systems
// ---------------------------------------------------------------------------
initAudioListener(camera);

let mobileControlsContainer = null;
const isMobileDevice = isMobile();

if (isMobileDevice) {
  mobileControlsContainer = initMobileControls(camera);
  mobileControlsContainer.style.display = 'none';
}

const triggerFirstJoin = () => {
  if (!hasJoinedOnce) {
    const start = loadPlayerStart();
    controls.getObject().position.set(start.x || -18, (start.y || 0) + playerHeight, start.z || 20);
    controls.getObject().rotation.y = start.rotationY || 0;
    controls.getObject().rotation.x = 0;
    controls.getObject().rotation.z = 0;
    hasJoinedOnce = true;
    
    const blockerEl = document.getElementById('blocker');
    if (blockerEl) blockerEl.classList.add('hidden');
    document.body.classList.remove('pregame');
    playNewQuestSound();

    if (isMobileDevice && mobileControlsContainer) {
      mobileControlsContainer.style.display = 'block';
      const hint = document.getElementById('interact-hint');
      if (hint) hint.innerText = 'INT';
      
      const intUI = document.getElementById('interact-ui');
      if (intUI) intUI.innerText = 'Tap Interact to interact';
      
      // Fake pointer lock state for mobile interactions
      controls.isLocked = true;
    }
  }
};

const { controls, updateMovement } = initPointerLock({
  playerHeight: () => playerHeight,
  isInputBlocked: () => false,
  onFirstJoin: triggerFirstJoin,
  onLockAcquired: hidePauseOverlay,
  onLockReleased: () => {},
  playButton: document.getElementById('play-button'),
  instructions: document.getElementById('instructions'),
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

// For mobile play button interception
if (isMobileDevice) {
  const startMobileGame = (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerFirstJoin();
    hidePauseOverlay();
  };

  const playBtn = document.getElementById('play-button');
  if (playBtn) playBtn.addEventListener('click', startMobileGame);

  const instructionsEl = document.getElementById('instructions');
  if (instructionsEl) instructionsEl.addEventListener('click', startMobileGame);

  const pauseOverlayEl = document.getElementById('pause-overlay');
  if (pauseOverlayEl) pauseOverlayEl.addEventListener('click', startMobileGame);
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
  }, 150);
};

showIntroOverlay();
updateFriendsUI();
rebuildWorldCollisionBoxes();
startAnimationLoop();
