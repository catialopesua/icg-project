import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGardenZone } from './garden.js';
import { createCityZone } from './city.js';
import { createBeachZone } from './beach.js';

// Scene & renderer
const container = document.getElementById('canvas-container') || document.body;
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// set a dark clear color for night testing
renderer.setClearColor(0x02030a);
container.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 2.0, 5);
// global player height (camera eye height above ground)
let PLAYER_HEIGHT = 1.6;
const PLAYER_COLLISION_RADIUS = 0.34;
const PLAYER_COLLISION_TOP_OFFSET = 0.2;
const PLAYER_COLLISION_FOOT_OFFSET = 0.03;
const PLAYER_SUPPORT_SNAP_DOWN = 0.55;
const PLAYER_SUPPORT_SNAP_UP = 0.12;
const PLAYER_JUMP_VELOCITY = 5.0;
const PLAYER_GRAVITY = 12.5;

// PointerLock controls (first-person)
let controls = null;
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');
const playButton = document.getElementById('play-button');
const weatherToggleButton = document.getElementById('weather-toggle');
const weatherPanelElement = document.getElementById('weather-panel');
const friendsToggleButton = document.getElementById('friends-toggle');
const settingsToggleButton = document.getElementById('settings-toggle');
const helpToggleButton = document.getElementById('help-toggle');
const friendsPanelElement = document.getElementById('friends-panel');
const settingsPanelElement = document.getElementById('settings-panel');
const helpPanelElement = document.getElementById('help-panel');
const friendsListElement = document.getElementById('friends-list');
const friendsFoundCountElement = document.getElementById('friends-found-count');
const closePanelButtons = Array.from(document.querySelectorAll('[data-close-panel]'));
const saveSettingsButton = document.getElementById('save-settings');
const settingShadows = document.getElementById('setting-shadows');
const settingMusicVolume = document.getElementById('setting-music-volume');
const musicVolumeValue = document.getElementById('music-volume-value');
const settingSfxVolume = document.getElementById('setting-sfx-volume');
const sfxVolumeValue = document.getElementById('sfx-volume-value');
const settingSensitivity = document.getElementById('setting-sensitivity');
const sensitivityValue = document.getElementById('sensitivity-value');
const chatBubbleElement = document.getElementById('chat-bubble');
const questMainTextElement = document.getElementById('quest-main-text');
const pauseOverlay = document.getElementById('pause-overlay');

// Audio
const buttonClickAudio = new Audio('./audio/button-click.mp3');
buttonClickAudio.preload = 'auto';
const newQuestAudio = new Audio('./audio/new-quest.mp3');
newQuestAudio.preload = 'auto';
const chatContinueAudio = new Audio('./audio/chat-continue.mp3');
chatContinueAudio.preload = 'auto';
const MUSIC_VOLUME_STORAGE_KEY = 'tim-birthday-music-volume';
const SFX_VOLUME_STORAGE_KEY = 'tim-birthday-sfx-volume';
const SENSITIVITY_STORAGE_KEY = 'tim-birthday-look-sensitivity';

let lookSensitivity = 1;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function applyMusicVolume(percentage) {
  // Placeholder until background music tracks are added to the project.
  return Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
}

function applySoundEffectsVolume(percentage) {
  const normalized = clamp01(Number(percentage) / 100);
  buttonClickAudio.volume = clamp01(normalized * 0.75);
  newQuestAudio.volume = clamp01(normalized * 0.95);
  chatContinueAudio.volume = clamp01(normalized * 0.9);
}

function applyLookSensitivity(percentage) {
  const normalized = Math.max(0.2, Math.min(3, Number(percentage) / 100));
  lookSensitivity = normalized;
  if (controls) controls.pointerSpeed = normalized;
}

function loadSavedPercentage(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored == null) return null;
    const parsed = Number(stored);
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  } catch (e) {
    return null;
  }
}

function savePercentage(storageKey, percentage) {
  try {
    window.localStorage.setItem(storageKey, String(percentage));
  } catch (e) {
    // Ignore persistence failures (private mode or blocked storage).
  }
}

const QUEST_FIND_BIRTHDAY_BOY = 'Find Tim';
const QUEST_FIND_FRIENDS = "Find Tim's friends";

const timDialogueLines = [
  'Hello! My name is Tim and today is my birthday! I heard you could help me find my friends!',
  "I'm inviting five friends to my birthday party! Find them all and then meet me here in the park!"
];

let currentQuest = '';
let initialQuestSoundPlayed = false;
let activeDialogue = null;
let activeDialogueIndex = -1;
let timDialogueCompleted = false;

function playButtonClickSound() {
  try {
    buttonClickAudio.currentTime = 0;
    buttonClickAudio.play().catch(() => {});
  } catch (e) {
    // ignore audio playback failures
  }
}

function playNewQuestSound() {
  try {
    newQuestAudio.currentTime = 0;
    newQuestAudio.play().catch(() => {});
  } catch (e) {
    // ignore audio playback failures
  }
}

function playChatContinueSound() {
  try {
    chatContinueAudio.currentTime = 0;
    chatContinueAudio.play().catch(() => {});
  } catch (e) {
    // ignore audio playback failures
  }
}

function setQuest(text, { playSound = true } = {}) {
  if (!text || text === currentQuest) return;
  currentQuest = text;
  if (questMainTextElement) questMainTextElement.textContent = text;
  if (playSound) playNewQuestSound();
}



document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button) return;
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
  playButtonClickSound();
});

if (document.body) document.body.classList.add('pregame');

let hasJoinedOnce = false;
let panelOpenedFromPointerLock = false;

const PANEL_BY_ID = {
  'weather-panel': weatherPanelElement,
  'friends-panel': friendsPanelElement,
  'settings-panel': settingsPanelElement,
  'help-panel': helpPanelElement
};

const friendsState = [
  {
    name: 'Hunter',
    description: "He's quiet and a bit shy, but with a sassy edge and a love for the loud energy of the city",
    weather: '⛈️ Stormy Night',
    image: 'images/friend1.png',
    unlocked: true
  },
  { name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false },
  { name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false },
  { name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false },
  { name: '???', description: 'Find this friend to unlock their info!', weather: '🔒 Locked', image: '', unlocked: false }
];

function showIntroOverlay() {
  if (blocker) blocker.classList.remove('hidden');
}

function showPauseOverlay() {
  if (!pauseOverlay) return;
  pauseOverlay.classList.remove('hidden');
  pauseOverlay.setAttribute('aria-hidden', 'false');
}

function hidePauseOverlay() {
  if (!pauseOverlay) return;
  pauseOverlay.classList.add('hidden');
  pauseOverlay.setAttribute('aria-hidden', 'true');
}

function closeAllPanels() {
  Object.entries(PANEL_BY_ID).forEach(([panelId, panel]) => {
    if (!panel) return;
    panel.classList.add('hidden');
    const toggle = document.querySelector(`[aria-controls="${panelId}"]`);
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}

function closePanelsAndRelockIfNeeded() {
  closeAllPanels();
  if (panelOpenedFromPointerLock) {
    panelOpenedFromPointerLock = false;
    if (controls && !controls.isLocked) controls.lock();
  }
}

function openPanel(panelId) {
  closeAllPanels();
  const panel = PANEL_BY_ID[panelId];
  if (!panel) return;
  panel.classList.remove('hidden');
  const toggle = document.querySelector(`[aria-controls="${panelId}"]`);
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

function togglePanel(panelId) {
  const panel = PANEL_BY_ID[panelId];
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    closePanelsAndRelockIfNeeded();
    return;
  }

  if (controls && controls.isLocked) {
    panelOpenedFromPointerLock = true;
    controls.unlock();
  }
  if (blocker) blocker.classList.add('hidden');
  openPanel(panelId);
}

function renderFriendsPanel() {
  if (!friendsListElement) return;
  const foundCount = friendsState.filter((friend) => friend.unlocked).length;
  if (friendsFoundCountElement) friendsFoundCountElement.textContent = `Found ${foundCount} of ${friendsState.length} friends`;

  friendsListElement.innerHTML = friendsState.map((friend) => {
    const cardClass = friend.unlocked ? 'friend-card' : 'friend-card locked';
    const imageMarkup = friend.unlocked
      ? `<img class="friend-avatar" src="${friend.image}" alt="${friend.name}" />`
      : '<div class="friend-avatar" aria-hidden="true">🔒</div>';
    const weatherClass = friend.unlocked ? 'friend-weather' : 'friend-weather locked';

    return `
      <article class="${cardClass}">
        ${imageMarkup}
        <div>
          <h3 class="friend-name">${friend.name}</h3>
          <p class="friend-desc">${friend.description}</p>
          <span class="${weatherClass}">${friend.weather}</span>
        </div>
      </article>
    `;
  }).join('');
}

function setupInterface() {
  if (chatBubbleElement) chatBubbleElement.classList.add('hidden');
  hidePauseOverlay();
  setQuest(QUEST_FIND_BIRTHDAY_BOY, { playSound: false });
  renderFriendsPanel();

  if (weatherToggleButton) weatherToggleButton.addEventListener('click', () => togglePanel('weather-panel'));
  if (friendsToggleButton) friendsToggleButton.addEventListener('click', () => togglePanel('friends-panel'));
  if (settingsToggleButton) settingsToggleButton.addEventListener('click', () => togglePanel('settings-panel'));
  if (helpToggleButton) helpToggleButton.addEventListener('click', () => togglePanel('help-panel'));

  closePanelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closePanelsAndRelockIfNeeded();
    });
  });

  document.addEventListener('click', (event) => {
    const activePanel = Object.values(PANEL_BY_ID).find((panel) => panel && !panel.classList.contains('hidden'));
    if (!activePanel) return;
    const clickedInsidePanel = activePanel.contains(event.target);
    const clickedToggle = event.target.closest('[aria-controls]');
    if (clickedInsidePanel || clickedToggle) return;
    closePanelsAndRelockIfNeeded();
  });

  document.addEventListener('keydown', (event) => {
    if (!hasJoinedOnce) return;
    if (event.repeat) return;
    if (event.code === 'KeyC') {
      playButtonClickSound();
      togglePanel('weather-panel');
      return;
    }
    if (event.code === 'KeyV') {
      playButtonClickSound();
      togglePanel('friends-panel');
      return;
    }
    if (event.code === 'KeyB') {
      playButtonClickSound();
      togglePanel('settings-panel');
      return;
    }
    if (event.code === 'KeyN') {
      playButtonClickSound();
      togglePanel('help-panel');
      return;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') return;
    const hasOpenPanel = Object.values(PANEL_BY_ID).some((panel) => panel && !panel.classList.contains('hidden'));
    if (hasOpenPanel) closePanelsAndRelockIfNeeded();
  });

  if (settingMusicVolume && musicVolumeValue) {
    const savedVolume = loadSavedPercentage(MUSIC_VOLUME_STORAGE_KEY);
    if (savedVolume !== null) settingMusicVolume.value = String(savedVolume);

    const syncMusicVolume = () => {
      const value = Number(settingMusicVolume.value);
      musicVolumeValue.textContent = `${value}%`;
      applyMusicVolume(value);
      savePercentage(MUSIC_VOLUME_STORAGE_KEY, value);
    };
    settingMusicVolume.addEventListener('input', syncMusicVolume);
    syncMusicVolume();
  } else {
    applyMusicVolume(70);
  }

  if (settingSfxVolume && sfxVolumeValue) {
    const savedSfxVolume = loadSavedPercentage(SFX_VOLUME_STORAGE_KEY);
    if (savedSfxVolume !== null) settingSfxVolume.value = String(savedSfxVolume);

    const syncSfxVolume = () => {
      const value = Number(settingSfxVolume.value);
      sfxVolumeValue.textContent = `${value}%`;
      applySoundEffectsVolume(value);
      savePercentage(SFX_VOLUME_STORAGE_KEY, value);
    };
    settingSfxVolume.addEventListener('input', syncSfxVolume);
    syncSfxVolume();
  } else {
    applySoundEffectsVolume(80);
  }

  if (settingSensitivity && sensitivityValue) {
    const savedSensitivity = loadSavedPercentage(SENSITIVITY_STORAGE_KEY);
    if (savedSensitivity !== null) settingSensitivity.value = String(savedSensitivity);

    const syncSensitivity = () => {
      const value = Number(settingSensitivity.value);
      const multiplier = Math.max(0.2, Math.min(3, value / 100));
      sensitivityValue.textContent = `${multiplier.toFixed(2)}x`;
      applyLookSensitivity(value);
      savePercentage(SENSITIVITY_STORAGE_KEY, value);
    };
    settingSensitivity.addEventListener('input', syncSensitivity);
    syncSensitivity();
  } else {
    applyLookSensitivity(100);
  }

  if (settingShadows) {
    settingShadows.checked = true;
    renderer.shadowMap.enabled = true;
    syncSceneMeshShadows(true);
    updateNightStreetlightShadowCasters(true);
    settingShadows.addEventListener('change', () => {
      renderer.shadowMap.enabled = settingShadows.checked;
      syncSceneMeshShadows(settingShadows.checked);
      updateNightStreetlightShadowCasters(true);
    });
  }

  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', () => {
      saveSettingsButton.textContent = 'Saved!';
      window.setTimeout(() => { saveSettingsButton.textContent = 'Save Settings'; }, 900);
    });
  }
}

showIntroOverlay();
setupInterface();

function initPointerLock() {
  controls = new PointerLockControls(camera, document.body);
  controls.pointerSpeed = lookSensitivity;
  scene.add(controls.getObject());

  // movement state
  const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
  let canJump = false;
  const velocity = new THREE.Vector3();
  const direction = new THREE.Vector3();

  
  // Note: the player is represented by the PointerLockControls object (camera wrapper).
  // We do NOT parent the NPC to the player — the NPC is independent in the scene.

  const onKeyDown = function (event) {
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
        if (canJump === true) {
          velocity.y += PLAYER_JUMP_VELOCITY;
          canJump = false;
        }
        break;
    }
  };

  const onKeyUp = function (event) {
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

  // Pointer lock events
  controls.addEventListener('lock', function () {
    panelOpenedFromPointerLock = false;
    hidePauseOverlay();
    if (blocker) blocker.classList.add('hidden');
    if (!hasJoinedOnce) {
      hasJoinedOnce = true;
      if (document.body) document.body.classList.remove('pregame');
      if (!initialQuestSoundPlayed) {
        initialQuestSoundPlayed = true;
        playNewQuestSound();
      }
    }
  });

  controls.addEventListener('unlock', function () {
    const hasOpenPanel = Object.values(PANEL_BY_ID).some((panel) => panel && !panel.classList.contains('hidden'));
    if (panelOpenedFromPointerLock || hasOpenPanel) return;
    if (!hasJoinedOnce) {
      showIntroOverlay();
      return;
    }
    showPauseOverlay();
  });

  // start pointer lock from explicit action buttons
  const lockButtons = [playButton].filter(Boolean);
  lockButtons.forEach((btn) => {
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      controls.lock();
    });
  });

  if (instructions) {
    instructions.addEventListener('click', function () {
      if (!hasJoinedOnce && controls && !controls.isLocked) {
        playButtonClickSound();
        controls.lock();
      }
    });
  }

  if (pauseOverlay) {
    pauseOverlay.addEventListener('click', function () {
      if (!hasJoinedOnce || !controls) return;
      hidePauseOverlay();
      controls.lock();
    });
  }

  // movement update called from animate
  function updateMovement(delta) {
    const sprintMultiplier = moveState.sprint ? 1.9 : 1;
    const speed = 15.0 * sprintMultiplier; // units/sec
    const accel = 50.0 * sprintMultiplier;
    const damping = 10.0;

    // apply gravity
    velocity.y -= PLAYER_GRAVITY * delta;

    // compute direction from input (forward = W, left = A)
    direction.x = Number(moveState.left) - Number(moveState.right);
    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.normalize();

    // apply acceleration
    if (moveState.forward || moveState.backward) velocity.z -= direction.z * accel * delta;
    if (moveState.left || moveState.right) velocity.x -= direction.x * accel * delta;

    // apply damping
    velocity.x -= velocity.x * Math.min(damping * delta, 1);
    velocity.z -= velocity.z * Math.min(damping * delta, 1);

    // clamp horizontal speed
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    if (horizontalSpeed > speed) {
      const factor = speed / horizontalSpeed;
      velocity.x *= factor;
      velocity.z *= factor;
    }

    // move the control object (the camera wrapper)
    if (controls.isLocked === true) {
      const playerObject = controls.getObject();

      const beforeXMove = playerObject.position.clone();
      playerObject.translateX(velocity.x * delta);
      if (isPlayerBlockedAt(playerObject.position, PLAYER_HEIGHT)) {
        playerObject.position.copy(beforeXMove);
        velocity.x = 0;
      }

      const beforeZMove = playerObject.position.clone();
      playerObject.translateZ(velocity.z * delta);
      if (isPlayerBlockedAt(playerObject.position, PLAYER_HEIGHT)) {
        playerObject.position.copy(beforeZMove);
        velocity.z = 0;
      }

      const beforeYMove = playerObject.position.y;
      playerObject.position.y += velocity.y * delta;
      if (isPlayerBlockedAt(playerObject.position, PLAYER_HEIGHT)) {
        playerObject.position.y = beforeYMove;
        if (velocity.y > 0) velocity.y = 0;
      }

      // Grounding on terrain or object tops so jumping works from elevated surfaces.
      const supportY = getSupportSurfaceY(playerObject.position, PLAYER_HEIGHT);
      if (supportY !== null) {
        const targetEyeY = supportY + PLAYER_HEIGHT;
        const canSnapToSupport = velocity.y <= 0 && playerObject.position.y <= targetEyeY + PLAYER_SUPPORT_SNAP_UP;
        if (canSnapToSupport) {
          playerObject.position.y = targetEyeY;
          velocity.y = 0;
          canJump = true;
        } else {
          canJump = Math.abs(playerObject.position.y - targetEyeY) <= 0.015;
        }
      } else {
        canJump = false;
      }

      // Hard fallback: never allow sinking below the base world floor.
      if (playerObject.position.y < PLAYER_HEIGHT) {
        playerObject.position.y = PLAYER_HEIGHT;
        velocity.y = 0;
        canJump = true;
      }
    }
  }

  // provide update function to animate loop
  return { controls, updateMovement, playerHeight: PLAYER_HEIGHT };
}

const pointerLockState = initPointerLock();
controls = pointerLockState.controls;
const updateMovement = pointerLockState.updateMovement;

// Lights (night mode setup - will be adjusted by applyDayNight)
scene.add(new THREE.AmbientLight(0xffffff, 0.06));
const DAY_LIGHT_POS = new THREE.Vector3(62, 56, -32);
const NIGHT_LIGHT_POS = new THREE.Vector3(-24, 26, -16);
const SHADOW_TARGET_POS = new THREE.Vector3(2, 0, 14);
const DAY_SHADOW_BOUNDS = 46;
const NIGHT_SHADOW_BOUNDS = 44;
const MAX_DYNAMIC_NIGHT_STREETLIGHT_SHADOWS = 2;
const NIGHT_STREETLIGHT_SHADOW_RANGE = 24;
const dir = new THREE.DirectionalLight(0x7688c0, 0.15);
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

function makeCelestialBody(coreColor, haloColor, radius, haloScale = 1.75, haloOpacity = 0.22) {
  const group = new THREE.Group();
  const coreMat = new THREE.MeshBasicMaterial({ color: coreColor, fog: false });
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), coreMat);
  const haloMat = new THREE.MeshBasicMaterial({
    color: haloColor,
    transparent: true,
    opacity: haloOpacity,
    fog: false,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * haloScale, 24, 24), haloMat);
  core.castShadow = false;
  core.receiveShadow = false;
  core.userData.noAutoShadow = true;
  halo.castShadow = false;
  halo.receiveShadow = false;
  halo.userData.noAutoShadow = true;
  group.add(core);
  group.add(halo);
  return group;
}

const sun = makeCelestialBody(0xfffbf0, 0xfff2dc, 2.2, 3.8, 0.24);
sun.position.copy(DAY_LIGHT_POS);
sun.visible = false;
scene.add(sun);

const moon = makeCelestialBody(0xd8e6ff, 0x9ab7ff, 1.65, 1.9, 0.18);
moon.position.set(-58, 45, 30);
moon.visible = true;
scene.add(moon);

// Subtle hemisphere for night sky/ground ambient light
const hemi = new THREE.HemisphereLight(0x0a1b2e, 0x02040a, 0.05);
scene.add(hemi);

// Fog for night ambiance - enhanced for better atmosphere
scene.fog = new THREE.FogExp2(0x02030a, 0.007);

// Simple ground with procedurally generated grass-like texture
function makeGrassTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Rich base green so grass stays visible under night lighting.
  ctx.fillStyle = '#3f7a35';
  ctx.fillRect(0, 0, size, size);

  // Broad tonal patches to break repetition.
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * (size * 0.09);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const h = 90 + Math.floor(Math.random() * 32);
    const s = 30 + Math.floor(Math.random() * 32);
    const l = 26 + Math.floor(Math.random() * 20);
    g.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${0.08 + Math.random() * 0.09})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Dense micro-blades so the floor reads as grass, not leaves.
  const bladeCount = Math.floor((size * size) / 62);
  for (let i = 0; i < bladeCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 10;
    const bend = (Math.random() - 0.5) * 1.0;
    const hue = 94 + Math.floor(Math.random() * 26);
    const sat = 38 + Math.floor(Math.random() * 34);
    const light = 24 + Math.floor(Math.random() * 26);
    const alpha = 0.24 + Math.random() * 0.30;
    const width = 0.45 + Math.random() * 1.0;

    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend * len * 0.45, y - len * 0.5, x + bend * len, y - len);
    ctx.stroke();
  }

  // Small dry/bright speckles to keep the texture natural.
  for (let i = 0; i < 3800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.25 + Math.random() * 1.0;
    const v = 130 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${v},${Math.max(0, v + 8)},${Math.max(0, v - 60)},${0.025 + Math.random() * 0.055})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Build a bump map with fine directional strokes to fake blade relief.
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = Math.max(256, size / 2);
  const bctx = bumpCanvas.getContext('2d');
  bctx.fillStyle = '#7f7f7f';
  bctx.fillRect(0, 0, bumpCanvas.width, bumpCanvas.height);

  const bumpBlades = Math.floor((bumpCanvas.width * bumpCanvas.height) / 120);
  for (let i = 0; i < bumpBlades; i++) {
    const x = Math.random() * bumpCanvas.width;
    const y = Math.random() * bumpCanvas.height;
    const len = 1.5 + Math.random() * 4.5;
    const bend = (Math.random() - 0.5) * 0.8;
    const v = 126 + Math.floor(Math.random() * 56);
    bctx.strokeStyle = `rgba(${v},${v},${v},${0.10 + Math.random() * 0.22})`;
    bctx.lineWidth = 0.5 + Math.random() * 0.9;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.quadraticCurveTo(x + bend * len * 0.4, y - len * 0.5, x + bend * len, y - len);
    bctx.stroke();
  }

  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * bumpCanvas.width;
    const y = Math.random() * bumpCanvas.height;
    const r = 0.3 + Math.random() * 1.2;
    const v = 110 + Math.floor(Math.random() * 50);
    bctx.fillStyle = `rgba(${v},${v},${v},${0.04 + Math.random() * 0.1})`;
    bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2); bctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(9, 9);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(map.repeat);

  return { map, bump };
}

const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundTex = makeGrassTexture();
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x95c878,
  map: groundTex.map,
  bumpMap: groundTex.bump,
  roughness: 0.96,
  metalness: 0
});
groundMat.bumpScale = 0.05;
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// create zones placed around the map
createGardenZone(scene, -18, 12);

createCityZone(scene, 22, -4);
const beachZone = createBeachZone(scene, 0, 12);

const worldCollisionBoxes = [];
const collisionProbeBox = new THREE.Box3();
const collisionTempBox = new THREE.Box3();
const collisionTempSize = new THREE.Vector3();
let collisionRebuildAccumulator = 0;

function hasNoCollisionAncestor(obj) {
  let current = obj;
  while (current) {
    if (current.userData && current.userData.noCollision) return true;
    current = current.parent;
  }
  return false;
}

function matchesCollisionExclusionByName(obj) {
  const names = [];
  let current = obj;
  let steps = 0;
  while (current && steps < 8) {
    if (typeof current.name === 'string' && current.name) names.push(current.name.toLowerCase());
    current = current.parent;
    steps++;
  }
  const label = names.join(' ');
  if (!label) return false;
  return /(towel|trashbin|trash_bin|\bbin\b|\broad\b|\blane\b|asphalt)/i.test(label);
}

function shouldCreateCollisionForMesh(obj) {
  if (!obj || !obj.isMesh) return false;
  if (!obj.visible) return false;
  if (obj.userData && obj.userData.noAutoCollision) return false;
  if (hasNoCollisionAncestor(obj)) return false;
  if (matchesCollisionExclusionByName(obj)) return false;

  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  const hasVeryTransparentMaterial = mats.some((mat) => mat && mat.transparent && typeof mat.opacity === 'number' && mat.opacity < 0.2);
  if (hasVeryTransparentMaterial) return false;

  return true;
}

function rebuildWorldCollisionBoxes() {
  worldCollisionBoxes.length = 0;
  scene.updateMatrixWorld(true);

  scene.traverse((obj) => {
    if (!shouldCreateCollisionForMesh(obj)) return;

    collisionTempBox.setFromObject(obj);
    if (!Number.isFinite(collisionTempBox.min.x) || !Number.isFinite(collisionTempBox.max.x)) return;

    collisionTempBox.getSize(collisionTempSize);
    if (collisionTempSize.y < 0.04) return;
    if (Math.max(collisionTempSize.x, collisionTempSize.z) < 0.08) return;

    worldCollisionBoxes.push(collisionTempBox.clone());
  });
}

function isPlayerBlockedAt(position, eyeHeight = PLAYER_HEIGHT) {
  if (!worldCollisionBoxes.length) return false;

  const minY = position.y - eyeHeight + PLAYER_COLLISION_FOOT_OFFSET;
  const maxY = position.y + PLAYER_COLLISION_TOP_OFFSET;
  collisionProbeBox.min.set(position.x - PLAYER_COLLISION_RADIUS, minY, position.z - PLAYER_COLLISION_RADIUS);
  collisionProbeBox.max.set(position.x + PLAYER_COLLISION_RADIUS, maxY, position.z + PLAYER_COLLISION_RADIUS);

  for (const box of worldCollisionBoxes) {
    if (collisionProbeBox.intersectsBox(box)) return true;
  }
  return false;
}

function getSupportSurfaceY(position, eyeHeight = PLAYER_HEIGHT) {
  const footY = position.y - eyeHeight;
  const minCheckY = footY - PLAYER_SUPPORT_SNAP_DOWN;
  const maxCheckY = footY + PLAYER_SUPPORT_SNAP_UP;
  const minX = position.x - PLAYER_COLLISION_RADIUS;
  const maxX = position.x + PLAYER_COLLISION_RADIUS;
  const minZ = position.z - PLAYER_COLLISION_RADIUS;
  const maxZ = position.z + PLAYER_COLLISION_RADIUS;

  let bestY = null;

  // Base world floor at y=0 remains a valid support surface.
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

rebuildWorldCollisionBoxes();

function shouldAutoShadowMesh(obj) {
  if (!obj || !obj.isMesh) return false;
  if (obj.userData && obj.userData.noAutoShadow) return false;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  const isVolumetricLike = mats.some((mat) => mat && mat.transparent && typeof mat.opacity === 'number' && mat.opacity < 0.2);
  return !isVolumetricLike;
}

function syncSceneMeshShadows(enabled = renderer.shadowMap.enabled) {
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

function configureStreetLightShadow(light) {
  if (!light || !light.isSpotLight) return;
  if (light.userData && light.userData._shadowProfileApplied) return;
  light.shadow.mapSize.set(768, 768);
  light.shadow.camera.near = 0.2;
  const baseDistance = (typeof light.distance === 'number' && light.distance > 0) ? light.distance : 10;
  light.shadow.camera.far = Math.max(8, baseDistance + 2);
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.015;
  light.shadow.radius = 3;
  light.shadow.blurSamples = 6;
  light.userData = light.userData || {};
  light.userData._shadowProfileApplied = true;
}

function updateNightStreetlightShadowCasters(forceUpdate = false) {
  const sLights = (scene.userData && scene.userData.streetLights) ? scene.userData.streetLights : [];
  if (!sLights.length) return;

  // Start from a clean state so only selected local lights cast shadows.
  for (const sl of sLights) {
    if (!sl || !sl.isSpotLight) continue;
    if (sl.castShadow) {
      sl.castShadow = false;
      if (forceUpdate) sl.shadow.needsUpdate = true;
    }
  }

  const shadowsEnabled = renderer.shadowMap.enabled && (!settingShadows || settingShadows.checked);
  const isDay = Boolean(scene.userData && scene.userData.isDay);
  if (isDay || !shadowsEnabled) return;

  const origin = (controls && controls.getObject) ? controls.getObject().position : camera.position;
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

syncSceneMeshShadows(true);

// GLTF/GLB model loader and placement
const loader = new GLTFLoader();
let actor = null;

function enableShadows(model) {
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}

function scaleModelToHeight(model, desiredHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const height = size.y || 1;
  const scale = desiredHeight / height;
  model.scale.setScalar(scale);
  return box;
}

function placeModelOnGround(model, box) {
  box.setFromObject(model);
  model.position.y -= box.min.y;
}

function smoothModelShading(model) {
  model.traverse((node) => {
    if (!node.isMesh) return;
    try {
      if (node.geometry && node.geometry.isBufferGeometry) node.geometry.computeVertexNormals();
      if (!node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        material.flatShading = false;
        material.needsUpdate = true;
      });
    } catch (e) {
      console.warn('Smoothing attempt failed on mesh', node, e);
    }
  });
}

function loadFriendModel(friendLoader, config) {
  const { fileName, desiredHeight, offsetX, offsetZ } = config;
  friendLoader.load(`./models/Friends/${fileName}`, (gltf) => {
    const friend = gltf.scene;
    enableShadows(friend);
    const box = scaleModelToHeight(friend, desiredHeight);
    placeModelOnGround(friend, box);
    try {
      friend.position.x = actor.position.x + offsetX;
      friend.position.z = actor.position.z + offsetZ;
    } catch (e) {
      friend.position.set(offsetX, 0, offsetZ);
    }
    scene.add(friend);
  }, undefined, (err) => {
    console.warn(`Failed to load ${fileName}`, err);
  });
}

loader.load('./models/boy1.glb', (gltf) => {
  actor = gltf.scene;
  enableShadows(actor);
  const desiredHeight = 1.2;
  const box = scaleModelToHeight(actor, desiredHeight);
  placeModelOnGround(actor, box);
  actor.position.z = 0;
  actor.position.x = 0;
  smoothModelShading(actor);

  // keep the NPC independent in the scene
  scene.add(actor);

  const friendLoader = new GLTFLoader();
  [
    { fileName: 'friend1.glb', desiredHeight: 1.1, offsetX: 1.4, offsetZ: 1.0 },
    { fileName: 'friend2.glb', desiredHeight: 1.05, offsetX: -1.2, offsetZ: 0.15 },
    { fileName: 'friend3.glb', desiredHeight: 1.08, offsetX: 0.2, offsetZ: -1.3 },
    { fileName: 'friend4.glb', desiredHeight: 1.06, offsetX: 1.6, offsetZ: 1.6 },
    { fileName: 'friend5.glb', desiredHeight: 1.02, offsetX: -1.6, offsetZ: -1.4 }
  ].forEach((config) => loadFriendModel(friendLoader, config));

  // Make player height match the NPC approximate height so the camera eye is at similar level
  // desiredHeight was used to scale the model earlier; use it for the camera height
  try {
    PLAYER_HEIGHT = desiredHeight;
    if (controls && controls.getObject) {
      // maintain current x/z but set camera Y to PLAYER_HEIGHT
      const cur = controls.getObject().position;
      controls.getObject().position.set(cur.x, PLAYER_HEIGHT, cur.z);
    }
  } catch (e) {
    console.warn('Could not set PLAYER_HEIGHT to model size', e);
  }

  // compute a forward direction from actor's orientation (fallback if none)
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actor.quaternion).normalize();
  // position the control/camera object some distance in front of the actor so player spawns facing NPC
  const actorWorldPos = new THREE.Vector3();
  actor.getWorldPosition(actorWorldPos);
  const spawnDistance = 6.0; // units away from actor
  // place the camera in front of the actor (along actor forward)
  const spawnPos = actorWorldPos.clone().add(forward.clone().multiplyScalar(spawnDistance));
  controls.getObject().position.set(spawnPos.x, PLAYER_HEIGHT, spawnPos.z);

  // look at actor
  camera.lookAt(actorWorldPos);

  console.log('Loaded actor (NPC):', actor);
}, undefined, (err) => {
  console.error('Failed to load model:', err);
});

const INTERACT_DISTANCE = 2.0; // units
const FACING_DOT_THRESHOLD = 0.60; // cosine of acceptable facing angle (~53deg)
const interactHint = document.getElementById('interact-hint');

// E-key handler: trigger chat when near NPC
document.addEventListener('keydown', (ev) => {
  if (ev.code !== 'KeyE') return;

  try {
    // 👉 If dialogue is active → handle it FIRST
    if (activeDialogue === 'tim-intro') {
      playChatContinueSound();

      if (activeDialogueIndex < timDialogueLines.length - 1) {
        activeDialogueIndex++;
        showChatBubble(
          timDialogueLines[activeDialogueIndex],
          0,
          'images/boy1.png',
          'Tim'
        );
      } else {
        chatBubbleElement.classList.add('hidden');
        chatBubbleElement.innerHTML = '';
        activeDialogue = null;
        activeDialogueIndex = -1;
        timDialogueCompleted = true;

        setQuest(QUEST_FIND_FRIENDS, { playSound: true });
      }
      return;
    }

    // 👉 If bubble is open but NOT in dialogue → just close it
    if (chatBubbleElement && !chatBubbleElement.classList.contains('hidden')) {
      chatBubbleElement.classList.add('hidden');
      return;
    }

    // 👉 Start dialogue
    if (!actor || !controls || !controls.getObject) return;
    if (!controls.isLocked) return;

    const actorPos = new THREE.Vector3();
    actor.getWorldPosition(actorPos);

    const playerPos = controls.getObject().position.clone();
    const d = actorPos.distanceTo(playerPos);
    if (d > INTERACT_DISTANCE) return;

    const camObj = controls.getObject();
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camObj.quaternion)
      .setY(0)
      .normalize();

    const toActor = actorPos.clone()
      .sub(playerPos)
      .setY(0)
      .normalize();

    const dot = forward.dot(toActor);
    if (dot >= FACING_DOT_THRESHOLD) {
      if (timDialogueCompleted) return;

      activeDialogue = 'tim-intro';
      activeDialogueIndex = 0;

      showChatBubble(
        timDialogueLines[activeDialogueIndex],
        0,
        'images/boy1.png',
        'Tim'
      );
    }

  } catch (e) {
    // ignore
  }
});

function showChatBubble(text = '', duration = 4000, imageSrc = 'images/boy1.png', speaker = 'Birthday Boy') {
  const bubble = chatBubbleElement;
  
  if (!bubble) return;
  const safeText = String(text);
  bubble.innerHTML = `
    <div class="chat-avatar-wrap"><img class="chat-avatar" src="${imageSrc}" alt="${speaker}" /></div>
    <div class="chat-body">
      <h3 class="chat-name">${speaker}</h3>
      <div class="chat-divider" aria-hidden="true"></div>
      <div class="chat-text">${safeText}</div>
      <p class="chat-continue"><span class="chat-key">Press E</span><span>to continue</span></p>
    </div>
  `;
  bubble.classList.remove('hidden');
  clearTimeout(bubble._hideTO);
  if (duration > 0) bubble._hideTO = setTimeout(() => bubble.classList.add('hidden'), duration);
}

// Resize handling
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Simple animation loop
const clock = new THREE.Clock();
const introOrbitState = {
  angle: 0,
  radius: 32,
  center: new THREE.Vector3(0, 0, 4)
};
let shadowSyncAccumulator = 0;
let streetLightShadowSyncAccumulator = 0;

function introIsVisible() {
  return Boolean(blocker && !blocker.classList.contains('hidden') && !hasJoinedOnce);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  if (introIsVisible()) {
    introOrbitState.angle += dt * 0.24;
    const yWave = 21 + Math.sin(elapsed * 0.75) * 1.8;
    const desiredPos = new THREE.Vector3(
      introOrbitState.center.x + Math.cos(introOrbitState.angle) * introOrbitState.radius,
      yWave,
      introOrbitState.center.z + Math.sin(introOrbitState.angle) * introOrbitState.radius
    );
    camera.position.lerp(desiredPos, 0.06);
    camera.lookAt(introOrbitState.center);
  }

  // update movement & first-person controls
  if (typeof updateMovement === 'function') updateMovement(dt);
  if (beachZone && typeof beachZone.update === 'function') beachZone.update(elapsed, dt);

  // Keep new async objects shadow-enabled without doing full-scene updates every frame.
  shadowSyncAccumulator += dt;
  if (shadowSyncAccumulator >= 0.25) {
    shadowSyncAccumulator = 0;
    syncSceneMeshShadows(renderer.shadowMap.enabled);
  }

  // Refresh collision volumes periodically so async-loaded objects become collidable.
  collisionRebuildAccumulator += dt;
  if (collisionRebuildAccumulator >= 1.0) {
    collisionRebuildAccumulator = 0;
    rebuildWorldCollisionBoxes();
  }

  streetLightShadowSyncAccumulator += dt;
  if (streetLightShadowSyncAccumulator >= 0.2) {
    streetLightShadowSyncAccumulator = 0;
    updateNightStreetlightShadowCasters(false);
  }

  // proximity check for interact hint
  try {
    if (actor && controls && controls.getObject) {
      const actorPos = new THREE.Vector3();
      actor.getWorldPosition(actorPos);
      const playerPos = controls.getObject().position;
      const d = actorPos.distanceTo(playerPos);
      // only show hint when close AND facing the NPC
      if (interactHint) {
        const camObj = controls.getObject();
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camObj.quaternion).setY(0).normalize();
        const toActor = actorPos.clone().sub(playerPos).setY(0).normalize();
        const dot = forward.dot(toActor);
        if (d <= INTERACT_DISTANCE && dot >= FACING_DOT_THRESHOLD) interactHint.classList.remove('hidden'); else interactHint.classList.add('hidden');
      }
    }
  } catch (e) { /* ignore */ }
  renderer.render(scene, camera);
}
animate();

// Weather UI (Sunny/Night unlocked, others locked in UI)
(() => {
  let currentWeather = 'sunny';

  function applyDayNight(day) {
    // expose current day/night state for zones that create lights later
    scene.userData.isDay = Boolean(day);
    
    // Atmospheric setup - create distinct day/night appearance
    if (scene.fog) {
      if (day) {
        scene.fog.color.set(0xcde6ff);
        scene.fog.density = 0.00075;
      } else {
        // Stronger fog at night for atmosphere and light visibility
        scene.fog.color.set(0x02030a);
        scene.fog.density = 0.004;
      }
    }
    
    // Adjust clear color for sky gradient
    renderer.setClearColor(day ? 0xa6d8ff : 0x02030a);

    // Directional light and shadows are intentionally different between day and night.
    if (day) {
      dir.color.set(0xfff1d6);
      dir.intensity = 0.78;
      dir.position.copy(DAY_LIGHT_POS);
      dir.shadow.mapSize.set(4096, 4096);
      dir.shadow.bias = -0.00022;
      dir.shadow.normalBias = 0.014;
      dir.shadow.radius = 1.2;
      dir.shadow.blurSamples = 6;
      dir.shadow.camera.near = 0.5;
      dir.shadow.camera.far = 170;
      dir.shadow.camera.left = -DAY_SHADOW_BOUNDS;
      dir.shadow.camera.right = DAY_SHADOW_BOUNDS;
      dir.shadow.camera.top = DAY_SHADOW_BOUNDS;
      dir.shadow.camera.bottom = -DAY_SHADOW_BOUNDS;
      sun.visible = true;
      moon.visible = false;
    } else {
      dir.color.set(0x90a9e6);
      dir.intensity = 0.26;
      dir.position.copy(NIGHT_LIGHT_POS);
      dir.shadow.mapSize.set(4096, 4096);
      dir.shadow.bias = -0.001;
      dir.shadow.normalBias = 0.03;
      dir.shadow.radius = 4;
      dir.shadow.blurSamples = 8;
      dir.shadow.camera.near = 0.5;
      dir.shadow.camera.far = 140;
      dir.shadow.camera.left = -NIGHT_SHADOW_BOUNDS;
      dir.shadow.camera.right = NIGHT_SHADOW_BOUNDS;
      dir.shadow.camera.top = NIGHT_SHADOW_BOUNDS;
      dir.shadow.camera.bottom = -NIGHT_SHADOW_BOUNDS;
      sun.visible = false;
      moon.visible = true;
    }
    dir.target.position.copy(SHADOW_TARGET_POS);
    dir.target.updateMatrixWorld(true);
    dir.shadow.camera.updateProjectionMatrix();
    dir.shadow.needsUpdate = true;
    updateNightStreetlightShadowCasters(true);

    // Hemisphere light (sky/ground ambient)
    if (day) {
      hemi.color.set(0xffffff);        // White sky
      hemi.groundColor.set(0xcfd6e6);  // Light ground reflection
      hemi.intensity = 0.26;
    } else {
      hemi.color.set(0x0a1b2e);        // Dark night sky
      hemi.groundColor.set(0x02040a);  // Very dark ground
      hemi.intensity = 0.05;
    }

    // Ambient lights - provide overall illumination
    const ambs = [];
    scene.traverse((o) => { if (o.isAmbientLight) ambs.push(o); });
    for (const a of ambs) {
      a.intensity = day ? 0.24 : 0.035;
    }

    // Adjust emissive materials throughout the scene
    // During day: dim emissive (bulbs not lit)
    // During night: full emissive (bulbs lit)
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material;
        if (m.emissive !== undefined) {
          // For streetlight bulbs, turn off completely during day
          // For other emissive materials, dim slightly
          const isStreetlightBulb = o.userData && o.userData._origEmissiveIntensity !== undefined;
          if (day) {
            m.emissiveIntensity = 0;
          } else {
            m.emissiveIntensity = isStreetlightBulb ? 1.2 : 0.8;
          }
        }
      }
    });

    // Toggle streetlight SpotLights and lamp/bulb emissives registered by zones
    // This ensures all lights are properly controlled
    try {
      const sLights = (scene.userData && scene.userData.streetLights) ? scene.userData.streetLights : [];
      for (const sl of sLights) {
        try {
          if (day) {
            sl.intensity = 0;  // Turn off during day
          } else {
            // Restore original intensity at night
            if (sl.userData && typeof sl.userData._origIntensity === 'number') {
              sl.intensity = sl.userData._origIntensity;
            } else {
              sl.intensity = 2.0;  // Fallback intensity
            }
          }
          // Keep lights in scene at all times for efficient toggling
          sl.visible = true;
        } catch (e) {}
      }

      // Toggle emissive materials on bulbs and fixtures
      const sMeshes = (scene.userData && scene.userData.streetLightMeshes) ? scene.userData.streetLightMeshes : [];
      for (const m of sMeshes) {
        try {
          m.visible = true;  // Keep meshes visible
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            if (mat && mat.emissive !== undefined) {
              if (day) {
                mat.emissiveIntensity = 0;  // Dim at day
              } else {
                // Restore original at night
                mat.emissiveIntensity = (m.userData && typeof m.userData._origEmissiveIntensity === 'number') 
                  ? m.userData._origEmissiveIntensity 
                  : 1;
              }
            }
          }
        } catch (e) {}
      }

      // Toggle visual light cones (decorative visualization of light spread)
      try {
        const cones = (scene.userData && scene.userData.streetLightCones) ? scene.userData.streetLightCones : [];
        for (const c of cones) {
          try {
            c.visible = !day;  // Hide cones during day
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            for (const mat of mats) {
              if (mat && typeof mat.opacity === 'number') {
                if (day) {
                  mat.opacity = 0;  // Transparent during day
                } else {
                  // Restore original opacity at night
                  const orig = (c.userData && typeof c.userData._origOpacity === 'number') 
                    ? c.userData._origOpacity 
                    : 0.04;
                  mat.opacity = orig;
                }
                mat.transparent = (mat.opacity < 1);
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {
      // Silently ignore toggling errors
    }
  }

  const weatherOptions = Array.from(document.querySelectorAll('.weather-option[data-weather]'));

  function markActiveWeather(name) {
    weatherOptions.forEach((btn) => {
      const active = btn.dataset.weather === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyWeather(name) {
    currentWeather = name;
    if (name === 'night') applyDayNight(false);
    else applyDayNight(true);
    markActiveWeather(name);
  }

  weatherOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const requested = btn.dataset.weather;
      if (!requested) return;
      applyWeather(requested);
    });
  });

  // initialize weather to sunny
  applyWeather(currentWeather);
})();
