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
const settingParticles = document.getElementById('setting-particles');
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

const QUEST_FIND_BIRTHDAY_BOY = 'Find the Birthday Boy';
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

const daySkyTexture = new THREE.TextureLoader().load(
  './models/environment/DaySkyHDRI063B_2K/DaySkyHDRI063B_2K_TONEMAPPED.jpg'
);
daySkyTexture.mapping = THREE.EquirectangularReflectionMapping;
daySkyTexture.colorSpace = THREE.SRGBColorSpace;
daySkyTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const nightSkyTexture = new THREE.TextureLoader().load(
  './models/environment/NightSkyHDRI003_4K/NightSkyHDRI003_4K_TONEMAPPED.jpg'
);
nightSkyTexture.mapping = THREE.EquirectangularReflectionMapping;
nightSkyTexture.colorSpace = THREE.SRGBColorSpace;
nightSkyTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const northernLightsSkyTexture = new THREE.TextureLoader().load(
  './models/environment/NightSkyHDRI007_4K/NightSkyHDRI007_4K_TONEMAPPED.jpg'
);
northernLightsSkyTexture.mapping = THREE.EquirectangularReflectionMapping;
northernLightsSkyTexture.colorSpace = THREE.SRGBColorSpace;
northernLightsSkyTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

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

const sun = makeCelestialBody(0xfffbf0, 0xfff2dc, 2.2, 1.8, 0.24);
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

// Terrain texture sets loaded from models/textures for the global terrain.
function makeTerrainTextureSet(textureBasePath, repeat = 30) {
  const loader = new THREE.TextureLoader();

  function setup(tex, isColor = false) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const map = setup(loader.load(`${textureBasePath}_Color.jpg`), true);
  const normal = setup(loader.load(`${textureBasePath}_NormalGL.jpg`));
  const roughness = setup(loader.load(`${textureBasePath}_Roughness.jpg`));
  const bump = setup(loader.load(`${textureBasePath}_Displacement.jpg`));
  const ao = setup(loader.load(`${textureBasePath}_AmbientOcclusion.jpg`));

  return { map, normal, roughness, bump, ao };
}

const grassGroundTex = makeTerrainTextureSet('./models/textures/Grass002_2K-JPG/Grass002_2K-JPG', 30);
const snowGroundTex = makeTerrainTextureSet('./models/textures/Snow015_2K-JPG/Snow015_2K-JPG', 12);

const groundGeo = new THREE.PlaneGeometry(80, 80);
if (groundGeo.attributes.uv && !groundGeo.attributes.uv2) {
  groundGeo.setAttribute('uv2', new THREE.BufferAttribute(new Float32Array(groundGeo.attributes.uv.array), 2));
}
const groundMat = new THREE.MeshStandardMaterial({
  map: grassGroundTex.map,
  normalMap: grassGroundTex.normal,
  roughnessMap: grassGroundTex.roughness,
  bumpMap: grassGroundTex.bump,
  aoMap: grassGroundTex.ao,
  roughness: 0.95,
  metalness: 0.01
});
groundMat.bumpScale = 0.02;
groundMat.normalScale.set(0.8, 0.8);
groundMat.aoMapIntensity = 0.65;
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

loader.load('./models/Friends/birthday_boy.glb', (gltf) => {
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

  if (typeof scene.userData.updateWeatherEffects === 'function') {
    scene.userData.updateWeatherEffects(elapsed, dt);
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

// Weather UI and weather simulation (all weathers unlocked for testing).
(() => {
  let currentWeather = 'sunny';
  let particlesEnabled = !settingParticles || settingParticles.checked;

  const weatherRoot = new THREE.Group();
  weatherRoot.name = 'weather-effects-root';
  weatherRoot.userData.noCollision = true;
  weatherRoot.userData.noAutoShadow = true;
  scene.add(weatherRoot);

  const ambientLights = [];
  scene.traverse((o) => { if (o.isAmbientLight) ambientLights.push(o); });

  const groundDefaults = {
    bumpScale: groundMat.bumpScale,
    normalScale: groundMat.normalScale.clone(),
    aoMapIntensity: groundMat.aoMapIntensity,
    roughness: groundMat.roughness,
    metalness: groundMat.metalness
  };

  let gradientSky = null;
  let nightStars = null;
  let rainSystem = null;
  let snowSystem = null;
  let auroraGroup = null;
  let rainbowGroup = null;
  let sunsetClouds = null;
  const rainDummy = new THREE.Object3D();

  function createGradientSky() {
    const uniforms = {
      topColor: { value: new THREE.Color(0x7ec8ff) },
      middleColor: { value: new THREE.Color(0x9fdaff) },
      bottomColor: { value: new THREE.Color(0xe5f6ff) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 middleColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = clamp(normalize(vWorldPosition).y * 0.5 + 0.5, 0.0, 1.0);
          vec3 lower = mix(bottomColor, middleColor, smoothstep(0.0, 0.55, h));
          vec3 upper = mix(middleColor, topColor, smoothstep(0.42, 1.0, h));
          vec3 skyColor = mix(lower, upper, smoothstep(0.28, 0.78, h));
          gl_FragColor = vec4(skyColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
    mesh.userData.noAutoShadow = true;
    mesh.userData.noCollision = true;
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  function ensureGradientSky() {
    if (!gradientSky) {
      gradientSky = createGradientSky();
      weatherRoot.add(gradientSky);
    }
    return gradientSky;
  }

  function setGradientSky(topColor, middleColor, bottomColor) {
    const sky = ensureGradientSky();
    sky.material.uniforms.topColor.value.set(topColor);
    sky.material.uniforms.middleColor.value.set(middleColor);
    sky.material.uniforms.bottomColor.value.set(bottomColor);
  }

  function setAmbientIntensity(intensity) {
    for (const ambient of ambientLights) ambient.intensity = intensity;
  }

  function applyGroundTextureSet(textureSet, useSnowProfile = false) {
    groundMat.map = textureSet.map;
    groundMat.normalMap = textureSet.normal;
    groundMat.roughnessMap = textureSet.roughness;
    groundMat.bumpMap = textureSet.bump;
    groundMat.aoMap = textureSet.ao;
    if (useSnowProfile) {
      groundMat.bumpScale = 0.01;
      groundMat.normalScale.set(0.55, 0.55);
      groundMat.aoMapIntensity = 0.5;
      groundMat.roughness = 0.92;
      groundMat.metalness = 0.0;
    } else {
      groundMat.bumpScale = groundDefaults.bumpScale;
      groundMat.normalScale.copy(groundDefaults.normalScale);
      groundMat.aoMapIntensity = groundDefaults.aoMapIntensity;
      groundMat.roughness = groundDefaults.roughness;
      groundMat.metalness = groundDefaults.metalness;
    }
    groundMat.needsUpdate = true;
  }

  function makeStarLayer(count, size, opacity) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.52;
      const radius = 260 + Math.random() * 380;
      positions[idx] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[idx + 1] = 70 + Math.cos(phi) * radius * 0.7;
      positions[idx + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xf5f7ff,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, material);
    points.userData.noAutoShadow = true;
    points.userData.noCollision = true;
    points.frustumCulled = false;
    return { points, material, baseOpacity: opacity, pulseOffset: Math.random() * Math.PI * 2, pulseSpeed: 0.35 + Math.random() * 0.6 };
  }

  function createNightStars() {
    const group = new THREE.Group();
    group.name = 'night-star-field';
    group.visible = false;
    group.userData.noAutoShadow = true;
    group.userData.noCollision = true;

    const layerA = makeStarLayer(1300, 1.25, 0.72);
    const layerB = makeStarLayer(700, 1.8, 0.45);
    group.add(layerA.points);
    group.add(layerB.points);
    group.userData.layers = [layerA, layerB];
    return group;
  }

  function ensureNightStars() {
    if (!nightStars) {
      nightStars = createNightStars();
      weatherRoot.add(nightStars);
    }
    return nightStars;
  }

  function createSnowParticleSystem({
    count,
    width,
    depth,
    height,
    color,
    size,
    baseSpeed,
    speedVariance,
    windX,
    windZ
  }) {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sway = new Float32Array(count);
    const phase = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * width;
      positions[idx + 1] = Math.random() * height;
      positions[idx + 2] = (Math.random() - 0.5) * depth;
      speeds[i] = baseSpeed + Math.random() * speedVariance;
      sway[i] = 0.25 + Math.random() * 0.85;
      phase[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttr);

    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: true,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geometry, material);
    points.visible = false;
    points.userData = {
      kind: 'snow',
      width,
      depth,
      height,
      speeds,
      sway,
      phase,
      windX,
      windZ
    };
    points.userData.noAutoShadow = true;
    points.userData.noCollision = true;
    points.frustumCulled = false;
    weatherRoot.add(points);
    return points;
  }

  function createRainStreakSystem({
    count,
    width,
    depth,
    height,
    baseSpeed,
    speedVariance,
    windX,
    windZ
  }) {
    const dropGeometry = new THREE.BoxGeometry(0.03, 1.42, 0.03);
    const dropMaterial = new THREE.MeshBasicMaterial({
      color: 0xbfd8f5,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      fog: true
    });

    const mesh = new THREE.InstancedMesh(dropGeometry, dropMaterial, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;

    const offsets = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phase = new Float32Array(count);
    const tilts = new Float32Array(count * 2);
    const scales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      offsets[idx] = (Math.random() - 0.5) * width;
      offsets[idx + 1] = Math.random() * height;
      offsets[idx + 2] = (Math.random() - 0.5) * depth;
      speeds[i] = baseSpeed + Math.random() * speedVariance;
      phase[i] = Math.random() * Math.PI * 2;
      tilts[i * 2] = THREE.MathUtils.degToRad(8 + Math.random() * 9);
      tilts[i * 2 + 1] = THREE.MathUtils.degToRad(-7 + Math.random() * 14);
      scales[i] = 0.85 + Math.random() * 0.75;

      rainDummy.position.set(offsets[idx], offsets[idx + 1], offsets[idx + 2]);
      rainDummy.rotation.set(tilts[i * 2], 0, tilts[i * 2 + 1]);
      rainDummy.scale.set(1, scales[i], 1);
      rainDummy.updateMatrix();
      mesh.setMatrixAt(i, rainDummy.matrix);
    }

    mesh.userData = {
      kind: 'rain-streaks',
      width,
      depth,
      height,
      windX,
      windZ,
      offsets,
      speeds,
      phase,
      tilts,
      scales
    };
    mesh.userData.noAutoShadow = true;
    mesh.userData.noCollision = true;
    weatherRoot.add(mesh);
    return mesh;
  }

  function ensureRainSystem() {
    if (!rainSystem) {
      rainSystem = createRainStreakSystem({
        count: 1750,
        width: 135,
        depth: 135,
        height: 44,
        baseSpeed: 30,
        speedVariance: 20,
        windX: 2.6,
        windZ: 0.95
      });
    }
    return rainSystem;
  }

  function ensureSnowSystem() {
    if (!snowSystem) {
      snowSystem = createSnowParticleSystem({
        count: 2600,
        width: 135,
        depth: 135,
        height: 34,
        color: 0xf6fbff,
        size: 0.19,
        baseSpeed: 1.4,
        speedVariance: 2.4,
        windX: 0.4,
        windZ: 0.18
      });
    }
    return snowSystem;
  }

  function updateRainStreaks(system, elapsed, dt, followPos) {
    if (!system || !system.visible) return;

    system.position.set(followPos.x, Math.max(0, followPos.y - 1.25), followPos.z);

    const data = system.userData;
    const halfW = data.width * 0.5;
    const halfD = data.depth * 0.5;
    const count = data.speeds.length;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const drift = Math.sin(elapsed * 3.1 + data.phase[i]) * 0.28;

      data.offsets[idx] += (data.windX + drift) * dt;
      data.offsets[idx + 2] += data.windZ * dt;
      data.offsets[idx + 1] -= data.speeds[i] * dt;

      if (data.offsets[idx] > halfW) data.offsets[idx] -= data.width;
      if (data.offsets[idx] < -halfW) data.offsets[idx] += data.width;
      if (data.offsets[idx + 2] > halfD) data.offsets[idx + 2] -= data.depth;
      if (data.offsets[idx + 2] < -halfD) data.offsets[idx + 2] += data.depth;

      if (data.offsets[idx + 1] < 0) {
        data.offsets[idx + 1] = data.height;
        data.offsets[idx] = (Math.random() - 0.5) * data.width;
        data.offsets[idx + 2] = (Math.random() - 0.5) * data.depth;
        data.phase[i] = Math.random() * Math.PI * 2;
      }

      rainDummy.position.set(data.offsets[idx], data.offsets[idx + 1], data.offsets[idx + 2]);
      rainDummy.rotation.set(
        data.tilts[i * 2],
        0,
        data.tilts[i * 2 + 1] + Math.sin(elapsed * 2.1 + data.phase[i]) * 0.045
      );
      rainDummy.scale.set(1, data.scales[i], 1);
      rainDummy.updateMatrix();
      system.setMatrixAt(i, rainDummy.matrix);
    }

    system.instanceMatrix.needsUpdate = true;
  }

  function updateSnowParticles(system, elapsed, dt, followPos) {
    if (!system || !system.visible) return;

    system.position.set(followPos.x, Math.max(0, followPos.y - 1.2), followPos.z);
    const data = system.userData;
    const positions = system.geometry.attributes.position.array;
    const halfW = data.width * 0.5;
    const halfD = data.depth * 0.5;
    const count = data.speeds.length;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const drift = Math.sin(elapsed * 0.9 + data.phase[i]) * data.sway[i];
      const driftZ = Math.cos(elapsed * 0.65 + data.phase[i]) * data.sway[i] * 0.4;

      positions[idx] += (data.windX + drift) * dt;
      positions[idx + 2] += (data.windZ + driftZ) * dt;
      positions[idx + 1] -= data.speeds[i] * dt;

      if (positions[idx] > halfW) positions[idx] -= data.width;
      if (positions[idx] < -halfW) positions[idx] += data.width;
      if (positions[idx + 2] > halfD) positions[idx + 2] -= data.depth;
      if (positions[idx + 2] < -halfD) positions[idx + 2] += data.depth;

      if (positions[idx + 1] < 0) {
        positions[idx + 1] = data.height;
        positions[idx] = (Math.random() - 0.5) * data.width;
        positions[idx + 2] = (Math.random() - 0.5) * data.depth;
        data.phase[i] = Math.random() * Math.PI * 2;
      }
    }

    system.geometry.attributes.position.needsUpdate = true;
  }

  function createAuroraRibbonMaterial(phase, opacityBase) {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        phase: { value: phase },
        opacity: { value: opacityBase },
        colorA: { value: new THREE.Color(0x8ef8db) },
        colorB: { value: new THREE.Color(0x83dfff) },
        colorC: { value: new THREE.Color(0xaa9cff) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float time;
        uniform float phase;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float waveA = sin((position.x * 0.045) + time * 0.85 + phase) * 1.6;
          float waveB = sin((position.x * 0.09) - time * 0.50 + phase * 1.8) * 0.9;
          float wave = waveA + waveB;
          pos.z += wave;
          pos.y += sin((position.x * 0.03) + time * 0.32 + phase) * 0.55;
          vWave = wave;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vWave;
        uniform float opacity;
        uniform vec3 colorA;
        uniform vec3 colorB;
        uniform vec3 colorC;

        float softEdge(float v) {
          return smoothstep(0.04, 0.2, v) * smoothstep(0.04, 0.2, 1.0 - v);
        }

        void main() {
          float edgeX = softEdge(vUv.x);
          float edgeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.92, 1.0 - vUv.y);
          float band = 0.58 + 0.42 * sin(vUv.x * 18.0 + vUv.y * 7.0 + vWave * 0.55);
          float veil = 0.5 + 0.5 * sin(vUv.x * 5.0 + vWave * 0.35);
          float alpha = edgeX * edgeY * band * veil * opacity;
          if (alpha < 0.01) discard;

          vec3 col = mix(colorA, colorB, clamp(vUv.y + vWave * 0.035, 0.0, 1.0));
          col = mix(col, colorC, smoothstep(0.45, 1.0, vUv.y));
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
  }

  function createAuroraGroup() {
    const group = new THREE.Group();
    group.name = 'northern-lights-ribbons';
    group.visible = false;
    group.userData.noAutoShadow = true;
    group.userData.noCollision = true;
    group.userData.ribbons = [];

    for (let i = 0; i < 6; i++) {
      const geometry = new THREE.PlaneGeometry(220, 38, 120, 1);
      const phase = Math.random() * Math.PI * 2;
      const opacityBase = 0.16 + i * 0.025;
      const material = createAuroraRibbonMaterial(phase, opacityBase);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set((i - 2.5) * 34, 57 + i * 2.0, -182 + i * 18);
      mesh.rotation.x = -0.18;
      mesh.rotation.y = (i - 2.5) * 0.08;
      mesh.userData.phase = phase;
      mesh.userData.opacityBase = opacityBase;
      mesh.userData.baseX = mesh.position.x;
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.baseZ = mesh.position.z;
      mesh.userData.noAutoShadow = true;
      mesh.userData.noCollision = true;
      group.userData.ribbons.push(mesh);
      group.add(mesh);
    }

    return group;
  }

  function ensureAuroraGroup() {
    if (!auroraGroup) {
      auroraGroup = createAuroraGroup();
      weatherRoot.add(auroraGroup);
    }
    return auroraGroup;
  }

  function updateAurora(elapsed, followPos) {
    if (!auroraGroup || !auroraGroup.visible) return;
    auroraGroup.position.set(followPos.x, 0, followPos.z + 16);

    for (let i = 0; i < auroraGroup.userData.ribbons.length; i++) {
      const ribbon = auroraGroup.userData.ribbons[i];
      const phase = ribbon.userData.phase;

      ribbon.position.x = ribbon.userData.baseX + Math.sin(elapsed * 0.16 + phase) * 3.6;
      ribbon.position.y = ribbon.userData.baseY + Math.sin(elapsed * 0.22 + phase) * 0.68;
      ribbon.rotation.z = Math.sin(elapsed * 0.12 + phase) * 0.04;

      ribbon.material.uniforms.time.value = elapsed * (0.92 + i * 0.03);
      ribbon.material.uniforms.opacity.value = ribbon.userData.opacityBase + Math.sin(elapsed * 0.45 + phase) * 0.05;
    }
  }

  function makeCloudPuff(x, y, z, {
    color = 0xf8fbff,
    opacity = 0.92,
    roughness = 0.9,
    metalness = 0.0,
    scale = 1
  } = {}) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const cloudMat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      transparent: true,
      opacity
    });
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry((4 + Math.random() * 2.4) * scale, 18, 14),
        cloudMat
      );
      puff.position.set((i - 1.5) * 2.6 * scale, Math.random() * 1.5 * scale, (Math.random() - 0.5) * 2.2 * scale);
      puff.userData.noAutoShadow = true;
      puff.userData.noCollision = true;
      group.add(puff);
    }
    return group;
  }

  function createSunsetClouds() {
    const group = new THREE.Group();
    group.name = 'sunset-cloud-layer';
    group.visible = false;
    group.userData.noAutoShadow = true;
    group.userData.noCollision = true;
    group.userData.clouds = [];

    const palette = [0xffc08f, 0xff9f85, 0xd994cd, 0xffd6aa, 0xf38aa6];

    for (let i = 0; i < 15; i++) {
      const cloud = makeCloudPuff(
        -240 + Math.random() * 480,
        15 + Math.random() * 17,
        -170 - Math.random() * 120,
        {
          color: palette[i % palette.length],
          opacity: 0.34 + Math.random() * 0.18,
          roughness: 0.72,
          metalness: 0.0,
          scale: 1.6 + Math.random() * 1.4
        }
      );
      cloud.userData.baseX = cloud.position.x;
      cloud.userData.baseY = cloud.position.y;
      cloud.userData.baseZ = cloud.position.z;
      cloud.userData.phase = Math.random() * Math.PI * 2;
      cloud.userData.driftSpeed = 0.35 + Math.random() * 0.75;
      cloud.userData.noAutoShadow = true;
      cloud.userData.noCollision = true;
      group.userData.clouds.push(cloud);
      group.add(cloud);
    }

    return group;
  }

  function ensureSunsetClouds() {
    if (!sunsetClouds) {
      sunsetClouds = createSunsetClouds();
      weatherRoot.add(sunsetClouds);
    }
    return sunsetClouds;
  }

  function updateSunsetClouds(elapsed, followPos) {
    if (!sunsetClouds || !sunsetClouds.visible) return;
    sunsetClouds.position.set(followPos.x, 0, followPos.z);

    for (const cloud of sunsetClouds.userData.clouds) {
      const phase = cloud.userData.phase;
      const drift = cloud.userData.driftSpeed;
      cloud.position.x = cloud.userData.baseX + Math.sin(elapsed * 0.045 * drift + phase) * (12 + drift * 7);
      cloud.position.y = cloud.userData.baseY + Math.sin(elapsed * 0.2 + phase) * 0.75;
      cloud.position.z = cloud.userData.baseZ + Math.cos(elapsed * 0.05 * drift + phase) * 3.5;
    }
  }

  function createRainbowBand(radius, tubeRadius, color) {
    const points = [];
    for (let i = 0; i <= 72; i++) {
      const t = i / 72;
      const angle = Math.PI - t * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.66;
      points.push(new THREE.Vector3(x, y, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    const geometry = new THREE.TubeGeometry(curve, 120, tubeRadius, 12, false);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.16,
      roughness: 0.28,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95
    });
    const band = new THREE.Mesh(geometry, material);
    band.userData.noAutoShadow = true;
    band.userData.noCollision = true;
    return band;
  }

  function createRainbowGlow(radius, tubeRadius, color) {
    const points = [];
    for (let i = 0; i <= 72; i++) {
      const t = i / 72;
      const angle = Math.PI - t * Math.PI;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.66;
      points.push(new THREE.Vector3(x, y, 0));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
    const geometry = new THREE.TubeGeometry(curve, 90, tubeRadius * 1.9, 10, false);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    const glow = new THREE.Mesh(geometry, material);
    glow.userData.noAutoShadow = true;
    glow.userData.noCollision = true;
    return glow;
  }

  function createRainbowGroup() {
    const group = new THREE.Group();
    group.name = 'rainbow-arc';
    group.visible = false;
    group.position.set(0, 0, 0);
    group.userData.noAutoShadow = true;
    group.userData.noCollision = true;
    group.userData.bands = [];
    group.userData.glows = [];

    const colors = [
      0xff3a2f,
      0xff8c2f,
      0xffd440,
      0x59d85f,
      0x4fc8ff,
      0x3c6dff,
      0x8a56ff
    ];

    for (let i = 0; i < colors.length; i++) {
      const band = createRainbowBand(62 - i * 1.55, 0.74, colors[i]);
      const glow = createRainbowGlow(62 - i * 1.55, 0.7, colors[i]);

      band.position.set(0, 14.5, -150);
      band.rotation.y = -0.03;
      glow.position.copy(band.position);
      glow.rotation.copy(band.rotation);

      band.userData.baseY = band.position.y;
      band.userData.phase = Math.random() * Math.PI * 2;
      band.userData.noAutoShadow = true;
      band.userData.noCollision = true;
      glow.userData.baseY = glow.position.y;
      glow.userData.phase = band.userData.phase;
      glow.userData.baseOpacity = glow.material.opacity;
      group.add(band);
      group.add(glow);
      group.userData.bands.push(band);
      group.userData.glows.push(glow);
    }

    group.add(makeCloudPuff(-63, 9, -150, { scale: 1.35, opacity: 0.9 }));
    group.add(makeCloudPuff(63, 9, -150, { scale: 1.35, opacity: 0.9 }));
    return group;
  }

  function ensureRainbowGroup() {
    if (!rainbowGroup) {
      rainbowGroup = createRainbowGroup();
      weatherRoot.add(rainbowGroup);
    }
    return rainbowGroup;
  }

  function updateRainbow(elapsed) {
    if (!rainbowGroup || !rainbowGroup.visible) return;

    for (let i = 0; i < rainbowGroup.userData.bands.length; i++) {
      const band = rainbowGroup.userData.bands[i];
      band.position.y = band.userData.baseY + Math.sin(elapsed * 0.55 + band.userData.phase) * 0.08;
      band.material.emissiveIntensity = 0.14 + Math.sin(elapsed * 0.75 + band.userData.phase) * 0.035;

      const glow = rainbowGroup.userData.glows[i];
      if (glow) {
        glow.position.y = glow.userData.baseY + Math.sin(elapsed * 0.55 + glow.userData.phase) * 0.08;
        glow.material.opacity = glow.userData.baseOpacity + Math.sin(elapsed * 0.75 + glow.userData.phase) * 0.05;
      }
    }
  }

  function hideSpecialEffects() {
    if (gradientSky) gradientSky.visible = false;
    if (nightStars) nightStars.visible = false;
    if (rainSystem) rainSystem.visible = false;
    if (snowSystem) snowSystem.visible = false;
    if (sunsetClouds) sunsetClouds.visible = false;
    if (auroraGroup) auroraGroup.visible = false;
    if (rainbowGroup) rainbowGroup.visible = false;
  }

  function applyDayNight(day) {
    scene.userData.isDay = Boolean(day);

    if (scene.fog) {
      if (day) {
        scene.fog.color.set(0xcde6ff);
        scene.fog.density = 0.00075;
      } else {
        scene.fog.color.set(0x02030a);
        scene.fog.density = 0.004;
      }
    }

    renderer.setClearColor(day ? 0xa6d8ff : 0x02030a);

    if (day) {
      scene.background = daySkyTexture;
      scene.environment = daySkyTexture;
    } else {
      scene.background = nightSkyTexture;
      scene.environment = nightSkyTexture;
    }

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
      dir.shadow.camera.far = 110;
      dir.shadow.camera.left = -DAY_SHADOW_BOUNDS;
      dir.shadow.camera.right = DAY_SHADOW_BOUNDS;
      dir.shadow.camera.top = DAY_SHADOW_BOUNDS;
      dir.shadow.camera.bottom = -DAY_SHADOW_BOUNDS;
      sun.visible = true;
      moon.visible = false;
      sun.position.copy(dir.position);
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

    if (day) {
      hemi.color.set(0xffffff);
      hemi.groundColor.set(0xcfd6e6);
      hemi.intensity = 0.26;
      setAmbientIntensity(0.24);
    } else {
      hemi.color.set(0x0a1b2e);
      hemi.groundColor.set(0x02040a);
      hemi.intensity = 0.05;
      setAmbientIntensity(0.035);
    }

    scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (!mat || mat.emissive === undefined) continue;
        const isStreetlightBulb = o.userData && o.userData._origEmissiveIntensity !== undefined;
        if (day) mat.emissiveIntensity = 0;
        else mat.emissiveIntensity = isStreetlightBulb ? (o.userData._origEmissiveIntensity || 1.2) : 0.8;
      }
    });

    try {
      const sLights = (scene.userData && scene.userData.streetLights) ? scene.userData.streetLights : [];
      for (const sl of sLights) {
        try {
          if (day) sl.intensity = 0;
          else if (sl.userData && typeof sl.userData._origIntensity === 'number') sl.intensity = sl.userData._origIntensity;
          else sl.intensity = 2.0;
          sl.visible = true;
        } catch (e) {}
      }

      const sMeshes = (scene.userData && scene.userData.streetLightMeshes) ? scene.userData.streetLightMeshes : [];
      for (const mesh of sMeshes) {
        try {
          mesh.visible = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat && mat.emissive !== undefined) {
              if (day) mat.emissiveIntensity = 0;
              else mat.emissiveIntensity = (mesh.userData && typeof mesh.userData._origEmissiveIntensity === 'number') ? mesh.userData._origEmissiveIntensity : 1;
            }
          }
        } catch (e) {}
      }

      const cones = (scene.userData && scene.userData.streetLightCones) ? scene.userData.streetLightCones : [];
      for (const cone of cones) {
        try {
          cone.visible = !day;
          const mats = Array.isArray(cone.material) ? cone.material : [cone.material];
          for (const mat of mats) {
            if (!mat || typeof mat.opacity !== 'number') continue;
            mat.opacity = day ? 0 : ((cone.userData && typeof cone.userData._origOpacity === 'number') ? cone.userData._origOpacity : 0.04);
            mat.transparent = mat.opacity < 1;
          }
        } catch (e) {}
      }
    } catch (e) {
      // keep game running even if one light entry is malformed
    }
  }

  function syncParticleDrivenEffects() {
    if (nightStars) nightStars.visible = currentWeather === 'night' && particlesEnabled;
    if (rainSystem) rainSystem.visible = currentWeather === 'rainy' && particlesEnabled;
    if (snowSystem) snowSystem.visible = currentWeather === 'snowy' && particlesEnabled;
    if (auroraGroup) auroraGroup.visible = currentWeather === 'northern-lights' && particlesEnabled;
    if (rainbowGroup) rainbowGroup.visible = currentWeather === 'rainbow' && particlesEnabled;
  }

  function applyWeather(name) {
    const allowedWeather = new Set(['sunny', 'night', 'sunset', 'rainy', 'northern-lights', 'rainbow', 'snowy']);
    currentWeather = allowedWeather.has(name) ? name : 'sunny';

    hideSpecialEffects();
    applyGroundTextureSet(grassGroundTex, false);

    switch (currentWeather) {
      case 'night': {
        applyDayNight(false);
        scene.background = null;
        scene.environment = null;
        renderer.setClearColor(0x01030c);
        if (scene.fog) {
          scene.fog.color.set(0x030512);
          scene.fog.density = 0.0038;
        }
        setGradientSky(0x0d1a34, 0x070b18, 0x010106);
        ensureGradientSky().visible = true;
        ensureNightStars();
        break;
      }
      case 'sunset': {
        applyDayNight(true);
        scene.background = null;
        scene.environment = daySkyTexture;
        renderer.setClearColor(0xf59b5e);
        if (scene.fog) {
          scene.fog.color.set(0xf2a577);
          scene.fog.density = 0.00145;
        }
        setGradientSky(0x3f5da8, 0xff8f4f, 0xffcd8f);
        ensureGradientSky().visible = true;
        dir.color.set(0xffb36a);
        dir.intensity = 0.56;
        dir.position.set(42, 14, -33);
        dir.target.position.copy(SHADOW_TARGET_POS);
        dir.target.updateMatrixWorld(true);
        dir.shadow.camera.updateProjectionMatrix();
        dir.shadow.needsUpdate = true;
        sun.visible = true;
        sun.position.copy(dir.position);
        moon.visible = false;
        hemi.color.set(0xffcfaa);
        hemi.groundColor.set(0x6f4f37);
        hemi.intensity = 0.25;
        setAmbientIntensity(0.21);
        ensureSunsetClouds().visible = true;
        break;
      }
      case 'rainy': {
        applyDayNight(true);
        scene.background = null;
        scene.environment = daySkyTexture;
        renderer.setClearColor(0x8599aa);
        if (scene.fog) {
          scene.fog.color.set(0x8ca0af);
          scene.fog.density = 0.0026;
        }
        setGradientSky(0x465d73, 0x72889a, 0xb8c7d2);
        ensureGradientSky().visible = true;
        dir.color.set(0xdde6ef);
        dir.intensity = 0.54;
        sun.visible = false;
        moon.visible = false;
        hemi.color.set(0xdce6ee);
        hemi.groundColor.set(0x5f6a74);
        hemi.intensity = 0.19;
        setAmbientIntensity(0.18);
        ensureRainSystem();
        break;
      }
      case 'northern-lights': {
        applyDayNight(false);
        scene.background = northernLightsSkyTexture;
        scene.environment = northernLightsSkyTexture;
        renderer.setClearColor(0x051020);
        if (scene.fog) {
          scene.fog.color.set(0x061625);
          scene.fog.density = 0.0032;
        }
        dir.color.set(0x95b1f2);
        dir.intensity = 0.24;
        hemi.color.set(0x9ed7e5);
        hemi.groundColor.set(0x07131d);
        hemi.intensity = 0.08;
        setAmbientIntensity(0.05);
        ensureAuroraGroup();
        break;
      }
      case 'rainbow': {
        applyDayNight(true);
        scene.background = null;
        scene.environment = null;
        renderer.setClearColor(0x96dcff);
        if (scene.fog) {
          scene.fog.color.set(0xd5ecfa);
          scene.fog.density = 0.00085;
        }
        setGradientSky(0x6bc6ff, 0x95ddff, 0xeaf8ff);
        ensureGradientSky().visible = true;
        dir.color.set(0xfff2cf);
        dir.intensity = 0.8;
        sun.visible = true;
        moon.visible = false;
        hemi.color.set(0xf4fbff);
        hemi.groundColor.set(0xc7d8e3);
        hemi.intensity = 0.28;
        setAmbientIntensity(0.25);
        ensureRainbowGroup().visible = true;
        break;
      }
      case 'snowy': {
        applyDayNight(true);
        scene.background = null;
        scene.environment = null;
        renderer.setClearColor(0xd8e4ef);
        if (scene.fog) {
          scene.fog.color.set(0xc8d7e6);
          scene.fog.density = 0.0042;
        }
        setGradientSky(0xb0bfd0, 0xd4e0ea, 0xf5f9ff);
        ensureGradientSky().visible = true;
        dir.color.set(0xf4f8ff);
        dir.intensity = 0.56;
        sun.visible = false;
        moon.visible = false;
        hemi.color.set(0xe8f3ff);
        hemi.groundColor.set(0xbfccd8);
        hemi.intensity = 0.24;
        setAmbientIntensity(0.2);
        applyGroundTextureSet(snowGroundTex, true);
        ensureSnowSystem();
        break;
      }
      case 'sunny':
      default: {
        applyDayNight(true);
        scene.background = daySkyTexture;
        scene.environment = daySkyTexture;
        renderer.setClearColor(0xa6d8ff);
        if (scene.fog) {
          scene.fog.color.set(0xcde6ff);
          scene.fog.density = 0.00075;
        }
        applyGroundTextureSet(grassGroundTex, false);
        break;
      }
    }

    syncParticleDrivenEffects();
    scene.userData.currentWeather = currentWeather;
    markActiveWeather(currentWeather);
  }

  function markActiveWeather(name) {
    weatherOptions.forEach((btn) => {
      const active = btn.dataset.weather === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  const weatherOptions = Array.from(document.querySelectorAll('.weather-option[data-weather]'));
  weatherOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const requested = btn.dataset.weather;
      if (!requested) return;
      applyWeather(requested);
    });
  });

  if (settingParticles) {
    settingParticles.checked = true;
    particlesEnabled = settingParticles.checked;
    settingParticles.addEventListener('change', () => {
      particlesEnabled = settingParticles.checked;
      syncParticleDrivenEffects();
    });
  }

  scene.userData.updateWeatherEffects = (elapsed, dt) => {
    const followPos = (controls && controls.getObject) ? controls.getObject().position : camera.position;

    if (gradientSky && gradientSky.visible) {
      gradientSky.position.copy(followPos);
    }

    if (nightStars && nightStars.visible) {
      nightStars.position.set(followPos.x, 0, followPos.z);
      const layers = nightStars.userData.layers || [];
      for (const layer of layers) {
        layer.material.opacity = layer.baseOpacity + Math.sin(elapsed * layer.pulseSpeed + layer.pulseOffset) * 0.16;
      }
    }

    if (rainSystem && rainSystem.visible && particlesEnabled) updateRainStreaks(rainSystem, elapsed, dt, followPos);
    if (snowSystem && snowSystem.visible && particlesEnabled) updateSnowParticles(snowSystem, elapsed, dt, followPos);
    if (sunsetClouds && sunsetClouds.visible) updateSunsetClouds(elapsed, followPos);
    if (auroraGroup && auroraGroup.visible && particlesEnabled) updateAurora(elapsed, followPos);
    if (rainbowGroup && rainbowGroup.visible) updateRainbow(elapsed);
  };

  applyWeather(currentWeather);
})();
