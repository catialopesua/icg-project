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
// set a dark clear color for night testing
renderer.setClearColor(0x02030a);
container.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 2.0, 5);
// global player height (camera eye height above ground)
let PLAYER_HEIGHT = 1.6;

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
    settingShadows.addEventListener('change', () => {
      renderer.shadowMap.enabled = settingShadows.checked;
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = settingShadows.checked;
          obj.receiveShadow = settingShadows.checked;
        }
      });
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
          velocity.y += 6.5;
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
    velocity.y -= 9.8 * delta;

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
      controls.getObject().translateX(velocity.x * delta);
      controls.getObject().translateZ(velocity.z * delta);
      controls.getObject().position.y += velocity.y * delta;

      // basic ground collision
      if (controls.getObject().position.y < PLAYER_HEIGHT) {
        velocity.y = 0;
        controls.getObject().position.y = PLAYER_HEIGHT;
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

// Lights (night mode)
scene.add(new THREE.AmbientLight(0xffffff, 0.06));
const dir = new THREE.DirectionalLight(0x99bbff, 0.25);
dir.position.set(5, 10, 2);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 0.5;
dir.shadow.bias = -0.005;
dir.shadow.camera.far = 50;
dir.shadow.camera.left = -10;
dir.shadow.camera.right = 10;
dir.shadow.camera.top = 10;
dir.shadow.camera.bottom = -10;
scene.add(dir);

// subtle hemisphere for small ambient contrast (night sky/ground)
const hemi = new THREE.HemisphereLight(0x081c2b, 0x04040a, 0.08);
scene.add(hemi);

// darker fog for night ambiance
scene.fog = new THREE.FogExp2(0x02030a, 0.003);

// Simple ground with procedurally generated grass-like texture
function makeGrassTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  // base
  ctx.fillStyle = '#4a8b3b';
  ctx.fillRect(0, 0, size, size);
  // stripes / variation
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = Math.random() * 2 + 0.5;
    ctx.fillStyle = `rgba(${60 + Math.random()*40},${110 + Math.random()*40},${40 + Math.random()*30},${0.06 + Math.random()*0.12})`;
    ctx.fillRect(x, y, w, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const groundGeo = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// create zones placed around the map
createGardenZone(scene, -18, 12);

createCityZone(scene, 22, -4);
const beachZone = createBeachZone(scene, 0, 12);

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
    if (scene.fog) {
      scene.fog.color.set(day ? 0xcde6ff : 0x02030a);
      scene.fog.density = day ? 0.0009 : 0.003;
    }
    renderer.setClearColor(day ? 0xa6d8ff : 0x02030a);

    // directional sunlight
    dir.color.set(day ? 0xfff1d6 : 0x99bbff);
    dir.intensity = day ? 0.5 : 0.25;

    // hemisphere
    hemi.color.set(day ? 0xffffff : 0x081c2b);
    hemi.groundColor.set(day ? 0xcfd6e6 : 0x04040a);
    hemi.intensity = day ? 0.28 : 0.08;

    // ambient lights (may be multiple) - brighten for day
    const ambs = [];
    scene.traverse((o) => { if (o.isAmbientLight) ambs.push(o); });
    for (const a of ambs) a.intensity = day ? 0.35 : 0.06;

    // adjust emissive intensity for emissive materials slightly
    scene.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material;
        if (m.emissive !== undefined) {
          m.emissiveIntensity = day ? 0.18 : 1.0;
        }
      }
    });

    // Toggle streetlight SpotLights and lamp/bulb emissives registered by zones
    try {
      const sLights = (scene.userData && scene.userData.streetLights) ? scene.userData.streetLights : [];
      for (const sl of sLights) {
        try {
          // keep the lamp object visible but disable its emitted light during daytime
          if (day) {
            sl.intensity = 0;
          } else {
            if (sl.userData && typeof sl.userData._origIntensity === 'number') sl.intensity = sl.userData._origIntensity;
          }
          // ensure the SpotLight object remains in the scene so lamp models stay visible
          sl.visible = true;
        } catch (e) {}
      }

      const sMeshes = (scene.userData && scene.userData.streetLightMeshes) ? scene.userData.streetLightMeshes : [];
      for (const m of sMeshes) {
        try {
          // keep the lamp meshes visible but turn off emissive during day; do NOT change mesh opacity so poles remain visible
          m.visible = true;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          for (const mat of mats) {
            if (mat && mat.emissive !== undefined) {
              mat.emissiveIntensity = day ? 0 : ((m.userData && typeof m.userData._origEmissiveIntensity === 'number') ? m.userData._origEmissiveIntensity : 1);
            }
          }
        } catch (e) {}
      }
      // Explicitly toggle light cones' visibility: keep lamp posts visible, but hide/show cones at day/night
      try {
        const cones = (scene.userData && scene.userData.streetLightCones) ? scene.userData.streetLightCones : [];
        for (const c of cones) {
          try {
            c.visible = !day;
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            for (const mat of mats) {
              if (mat && typeof mat.opacity === 'number') {
                const orig = (c.userData && typeof c.userData._origOpacity === 'number') ? c.userData._origOpacity : mat.opacity;
                mat.opacity = day ? 0 : orig;
                mat.transparent = (mat.opacity < 1);
              }
            }
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {
      // ignore toggling errors
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
