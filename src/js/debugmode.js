import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGardenZone } from './environments/garden.js';
import { createCityZone } from './environments/city.js';
import { createBeachZone } from './environments/beach.js';
import {
  DEFAULT_FOREST_LAYOUT,
  FOREST_ITEM_TYPES,
  createForestZone,
  layoutToCode,
  loadForestLayout
} from './environments/forest.js';
import {
  FRIEND_DEFS,
  getDefaultFriendPlacements,
  getDefaultPlayerStart,
  getDefaultTimPlacement,
  loadFriendPlacements,
  loadPlayerStart,
  loadTimPlacement
} from './friends.js';
import {
  PARK_CENTER_X,
  PARK_CENTER_Z,
  PARTY_BALLOON_IDS,
  PARTY_ELEMENT_DEFS,
  getDefaultPartyLayout,
  getPartyElementDef,
  loadPartyLayout,
  partyLayoutToCode
} from './party.js';

const PAINT_SPACING = {
  tree: 2.8,
  grass: 1.4,
  rock1: 2.0,
  rock2: 2.0,
  rock3: 1.9,
  trafficcone: 1.2
};

const TYPE_LABELS = {
  tree: 'Tree',
  grass: 'Grass',
  rock1: 'Rock 1',
  rock2: 'Rock 2',
  rock3: 'Rock 3',
  trafficcone: 'Traffic Cone'
};

const TYPE_COLORS = {
  tree: 0x2e7a38,
  grass: 0x84bc4a,
  rock1: 0x8f8479,
  rock2: 0x7d7268,
  rock3: 0x999089,
  trafficcone: 0xff6a00
};

const FRIEND_SELECT_RADIUS = 3.2;
const FRIEND_COLORS = {
  friend1: 0x4f8cff,
  friend2: 0xff4fbd,
  friend3: 0xffa44f,
  friend4: 0x86e3ff,
  friend5: 0xa64fff
};
const TIM_COLOR = 0xffd34f;
const SPAWN_COLOR = 0x40b868;
const PARTY_SELECT_RADIUS = 2.6;
const PARTY_COLORS = {
  table: 0xf2539d,
  balloons: 0x63d7ff,
  participant: 0xffc247
};

const container = document.getElementById('canvas-container');
const statusEl = document.getElementById('debug-status');
const outputEl = document.getElementById('layout-output');
const copyButton = document.getElementById('copy-layout');
const deleteSelectedButton = document.getElementById('delete-selected');
const resetButton = document.getElementById('reset-layout');
const rotationStepInput = document.getElementById('rotation-step');
const rotationStepValue = document.getElementById('rotation-step-value');
const editForestButton = document.getElementById('edit-forest');
const editFriendsButton = document.getElementById('edit-friends');
const editTimButton = document.getElementById('edit-tim');
const editSpawnButton = document.getElementById('edit-spawn');
const editPartyButton = document.getElementById('edit-party');
const paintModeButton = document.getElementById('paint-mode');
const selectModeButton = document.getElementById('select-mode');
const paintPaletteElement = document.getElementById('paint-palette');
const friendPaletteElement = document.getElementById('friend-palette');
const partyPaletteElement = document.getElementById('party-palette');
const paletteButtons = Array.from(document.querySelectorAll('[data-item-type]'));
const friendPaletteButtons = Array.from(document.querySelectorAll('[data-friend-id]'));
const partyPaletteButtons = Array.from(document.querySelectorAll('[data-party-id]'));
const placementEditorElement = document.getElementById('placement-editor');
const placementTitleElement = document.getElementById('placement-title');
const placementXInput = document.getElementById('placement-x');
const placementYInput = document.getElementById('placement-y');
const placementZInput = document.getElementById('placement-z');
const placementRotationInput = document.getElementById('placement-rotation');
const placementScaleRow = document.getElementById('placement-scale-row');
const placementScaleInput = document.getElementById('placement-scale');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce9d9);
scene.fog = new THREE.Fog(0xdce9d9, 55, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(24, 38, 42);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(-10, 0, 8);
controls.minDistance = 14;
controls.maxDistance = 95;
controls.maxPolarAngle = Math.PI * 0.48;

const ambient = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(54, 62, -18);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 1;
dir.shadow.camera.far = 180;
dir.shadow.camera.left = -60;
dir.shadow.camera.right = 60;
dir.shadow.camera.top = 60;
dir.shadow.camera.bottom = -60;
dir.shadow.bias = -0.0008;
dir.shadow.normalBias = 0.03;
scene.add(dir);
scene.add(dir.target);
dir.target.position.set(0, 0, 10);

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

const grassGroundTex = makeTerrainTextureSet('./textures/Grass002_2K-JPG/Grass002_2K-JPG', 30);
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

const editorPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
);
editorPlane.rotation.x = -Math.PI / 2;
editorPlane.position.y = 0.06;
scene.add(editorPlane);

createGardenZone(scene, PARK_CENTER_X, PARK_CENTER_Z);
createCityZone(scene, 22, -4);
createBeachZone(scene, 0, 12);

const parkOutlineMat = new THREE.LineBasicMaterial({ color: 0x1f5d2c });
const parkOutlinePoints = [
  new THREE.Vector3(PARK_CENTER_X - 5.8, 0.1, PARK_CENTER_Z - 20.5),
  new THREE.Vector3(PARK_CENTER_X + 5.8, 0.1, PARK_CENTER_Z - 20.5),
  new THREE.Vector3(PARK_CENTER_X + 5.8, 0.1, PARK_CENTER_Z + 5.5),
  new THREE.Vector3(PARK_CENTER_X - 5.8, 0.1, PARK_CENTER_Z + 5.5),
  new THREE.Vector3(PARK_CENTER_X - 5.8, 0.1, PARK_CENTER_Z - 20.5)
];
scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(parkOutlinePoints), parkOutlineMat));

let editTarget = 'forest';

let layout = loadForestLayout();
let friendLayout = loadFriendPlacements();
let timPlacement = loadTimPlacement();
let playerStart = loadPlayerStart();
let partyLayout = loadPartyLayout();

let selectedIndex = -1;
let selectedFriendIndex = -1;
let selectedPartyIndex = -1;
let editorMode = 'paint';
let paintType = 'tree';
let paintFriendId = FRIEND_DEFS[0] ? FRIEND_DEFS[0].id : 'friend1';
let paintPartyId = PARTY_ELEMENT_DEFS[0] ? PARTY_ELEMENT_DEFS[0].id : 'table';
let isPainting = false;
let lastPaintPoint = null;
let pointerDown = null;
let syncingPlacementInputs = false;

const forestController = createForestZone(scene, PARK_CENTER_X, PARK_CENTER_Z, {
  layout,
  preferStored: false
});

const markerGroup = new THREE.Group();
markerGroup.name = 'forest-editor-markers';
scene.add(markerGroup);

const friendModelsById = new Map();
const friendLoader = new GLTFLoader();
let timModel = null;
let partyPreviewGroup = null;
let partyCakePreview = null;
let partyCakePreviewLoadStarted = false;
const partyOffsetVector = new THREE.Vector3();
const partyUpAxis = new THREE.Vector3(0, 1, 0);

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
      // ignore
    }
  });
}

function getPlacementScale(placement) {
  return Math.max(0.2, Number(placement && placement.scale) || 1);
}

function getModelBaseScale(model) {
  return Number(model && model.userData && model.userData.baseScale) || Number(model && model.scale && model.scale.x) || 1;
}

function getPartyPlacementById(partyId) {
  return partyLayout.find((placement) => placement && placement.id === partyId) || null;
}

function getEditablePartyIndex() {
  if (selectedPartyIndex >= 0 && partyLayout[selectedPartyIndex]) return selectedPartyIndex;
  const paintIndex = partyLayout.findIndex((placement) => placement && placement.id === paintPartyId);
  return paintIndex >= 0 ? paintIndex : -1;
}

function setRelativePartyPosition(object, placement, localX, localY, localZ) {
  partyOffsetVector.set(localX, 0, localZ).applyAxisAngle(partyUpAxis, Number(placement.rotationY) || 0);
  object.position.set(
    Number(placement.x) + partyOffsetVector.x,
    Number(placement.y) + localY,
    Number(placement.z) + partyOffsetVector.z
  );
}



function attachPartyCakePreview() {
  if (!partyPreviewGroup || !partyCakePreview) return;
  if (partyCakePreview.parent !== partyPreviewGroup) partyPreviewGroup.add(partyCakePreview);
  updatePartyPreview();
}

function loadPartyCakePreview() {
  if (partyCakePreviewLoadStarted) return;
  partyCakePreviewLoadStarted = true;

  friendLoader.load('./models/Blender/cake.glb', (gltf) => {
    partyCakePreview = gltf.scene;
    partyCakePreview.name = 'debug-party-cake';
    enableShadows(partyCakePreview);
    const box = scaleModelToHeight(partyCakePreview, 0.72);
    partyCakePreview.userData.baseScale = partyCakePreview.scale.x;
    placeModelOnGround(partyCakePreview, box);
    smoothModelShading(partyCakePreview);
    attachPartyCakePreview();
  }, undefined, (err) => {
    console.error('Failed to load cake.glb in debugmode', err);
  });
}

function ensurePartyPreview() {
  if (partyPreviewGroup) return partyPreviewGroup;

  partyPreviewGroup = new THREE.Group();
  partyPreviewGroup.name = 'party-preview';
  scene.add(partyPreviewGroup);

  const balloonColors = [0xff4f9d, 0xffcf42, 0x63d7ff, 0x7fe06f, 0xb26cff, 0xff7b54];
  const stringMat = new THREE.MeshStandardMaterial({ color: 0xf7e8c7, roughness: 0.9, metalness: 0.01 });
  PARTY_BALLOON_IDS.forEach((id, cluster) => {
    for (let j = 0; j < 3; j++) {
      const balloon = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 16),
        new THREE.MeshStandardMaterial({ color: balloonColors[(cluster + j) % balloonColors.length], roughness: 0.38, metalness: 0.02 })
      );
      balloon.name = `${id}-balloon-${j}`;
      balloon.castShadow = true;
      partyPreviewGroup.add(balloon);

      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 6), stringMat);
      string.name = `${id}-string-${j}`;
      partyPreviewGroup.add(string);
    }
  });

  const partyLight = new THREE.PointLight(0xffd69a, 1.2, 12, 1.7);
  partyLight.name = 'party-preview-light';
  partyPreviewGroup.add(partyLight);

  loadPartyCakePreview();
  return partyPreviewGroup;
}

function updatePartyPreview() {
  const preview = ensurePartyPreview();
  const tablePlacement = getPartyPlacementById('table');
  if (!tablePlacement) return;

  const tableScale = getPlacementScale(tablePlacement);

  PARTY_BALLOON_IDS.forEach((id, cluster) => {
    const placement = getPartyPlacementById(id);
    if (!placement) return;
    const scale = getPlacementScale(placement);
    for (let j = 0; j < 3; j++) {
      const balloon = preview.getObjectByName(`${id}-balloon-${j}`);
      const string = preview.getObjectByName(`${id}-string-${j}`);
      const x = placement.x + (j - 1) * 0.18 * scale;
      const y = placement.y + (2.25 + j * 0.18) * scale;
      const z = placement.z + Math.sin(j * 1.7) * 0.16 * scale;
      if (balloon) {
        balloon.position.set(x, y, z);
        balloon.rotation.y = Number(placement.rotationY) || 0;
        balloon.scale.set(scale, 1.18 * scale, scale);
      }
      if (string) {
        string.position.set(x, y - 0.74 * scale, z);
        string.scale.setScalar(scale);
      }
    }
  });

  const partyLight = preview.getObjectByName('party-preview-light');
  if (partyLight) {
    partyLight.position.set(tablePlacement.x, tablePlacement.y + 3.3 * tableScale, tablePlacement.z + 0.8 * tableScale);
  }

  if (partyCakePreview) {
    const baseScale = getModelBaseScale(partyCakePreview);
    partyCakePreview.position.set(tablePlacement.x, tablePlacement.y, tablePlacement.z);
    partyCakePreview.rotation.y = (Number(tablePlacement.rotationY) || 0) + Math.PI * 0.12;
    partyCakePreview.scale.setScalar(baseScale * tableScale);
  }
}

function applyPartyPreviewToModels() {
  if (timModel) {
    const placement = getPartyPlacementById('tim');
    if (placement) {
      const baseY = Number.isFinite(timModel.userData.groundY) ? timModel.userData.groundY : 0;
      const baseScale = getModelBaseScale(timModel);
      timModel.position.set(placement.x, baseY + (Number(placement.y) || 0), placement.z);
      timModel.rotation.y = Number(placement.rotationY) || 0;
      timModel.scale.setScalar(baseScale * getPlacementScale(placement));
    }
  }

  FRIEND_DEFS.forEach((def) => {
    const model = friendModelsById.get(def.id);
    const placement = getPartyPlacementById(def.id);
    if (!model || !placement) return;
    const baseY = Number.isFinite(model.userData.groundY) ? model.userData.groundY : 0;
    const baseScale = getModelBaseScale(model);
    model.position.set(placement.x, baseY + (Number(placement.y) || 0), placement.z);
    model.rotation.y = Number(placement.rotationY) || 0;
    model.scale.setScalar(baseScale * getPlacementScale(placement));
  });
}

function setPartyPreviewVisible(visible) {
  ensurePartyPreview().visible = visible;
}

function applyFriendPlacementToModel(friendId) {
  const model = friendModelsById.get(friendId);
  const placement = friendLayout.find((p) => p && p.id === friendId);
  if (!model || !placement) return;

  const baseY = Number.isFinite(model.userData.groundY) ? model.userData.groundY : 0;
  model.position.set(placement.x, baseY + (Number(placement.y) || 0), placement.z);
  model.rotation.y = placement.rotationY || 0;
  model.scale.setScalar(getModelBaseScale(model));
}

function applyFriendPlacementsToModels() {
  FRIEND_DEFS.forEach((def) => applyFriendPlacementToModel(def.id));
}

function applyTimPlacementToModel() {
  if (!timModel || !timPlacement) return;
  const baseY = Number.isFinite(timModel.userData.groundY) ? timModel.userData.groundY : 0;
  timModel.position.set(
    Number(timPlacement.x) || 0,
    baseY + (Number(timPlacement.y) || 0),
    Number(timPlacement.z) || 0
  );
  timModel.rotation.y = Number(timPlacement.rotationY) || 0;
  timModel.scale.setScalar(getModelBaseScale(timModel));
}

function loadFriendModels() {
  FRIEND_DEFS.forEach((def) => {
    friendLoader.load(`./models/Blender/Friends/${def.fileName}`, (gltf) => {
      const friend = gltf.scene;
      friend.name = def.id;
      friend.userData.friendId = def.id;
      enableShadows(friend);
      const box = scaleModelToHeight(friend, def.desiredHeight);
      friend.userData.baseScale = friend.scale.x;
      placeModelOnGround(friend, box);
      friend.userData.groundY = friend.position.y;
      smoothModelShading(friend);
      friendModelsById.set(def.id, friend);
      scene.add(friend);
      applyFriendPlacementToModel(def.id);
      if (editTarget === 'party') applyPartyPreviewToModels();
    }, undefined, (err) => {
      console.warn(`Failed to load ${def.fileName}`, err);
    });
  });
}

function loadTimModel() {
  friendLoader.load('./models/Blender/Friends/birthday_boy.glb', (gltf) => {
    timModel = gltf.scene;
    timModel.name = 'tim';
    timModel.userData.tim = true;
    enableShadows(timModel);
    const box = scaleModelToHeight(timModel, 1.2);
    timModel.userData.baseScale = timModel.scale.x;
    placeModelOnGround(timModel, box);
    timModel.userData.groundY = timModel.position.y;
    smoothModelShading(timModel);
    scene.add(timModel);
    applyTimPlacementToModel();
    if (editTarget === 'party') applyPartyPreviewToModels();
  }, undefined, (err) => {
    console.warn('Failed to load birthday_boy.glb', err);
  });
}

loadFriendModels();
loadTimModel();

function cloneDefaultLayout() {
  return DEFAULT_FOREST_LAYOUT.map((item) => ({ ...item }));
}

function updateRotationLabel() {
  rotationStepValue.textContent = `${rotationStepInput.value} deg`;
}

function updateModeButtons() {
  paintModeButton.classList.toggle('active-mode', editorMode === 'paint');
  paintModeButton.classList.toggle('secondary', editorMode !== 'paint');
  selectModeButton.classList.toggle('active-mode', editorMode === 'select');
  selectModeButton.classList.toggle('secondary', editorMode !== 'select');
}

function updatePaletteButtons() {
  paletteButtons.forEach((button) => {
    const active = button.dataset.itemType === paintType;
    button.classList.toggle('active-mode', active);
    button.classList.toggle('secondary', !active);
  });
}

function updateFriendPaletteButtons() {
  friendPaletteButtons.forEach((button) => {
    const active = button.dataset.friendId === paintFriendId;
    button.classList.toggle('active-mode', active);
    button.classList.toggle('secondary', !active);
  });
}

function updatePartyPaletteButtons() {
  partyPaletteButtons.forEach((button) => {
    const active = button.dataset.partyId === paintPartyId;
    button.classList.toggle('active-mode', active);
    button.classList.toggle('secondary', !active);
  });
}

function updateTargetButtons() {
  if (editForestButton) {
    editForestButton.classList.toggle('active-mode', editTarget === 'forest');
    editForestButton.classList.toggle('secondary', editTarget !== 'forest');
  }
  if (editFriendsButton) {
    editFriendsButton.classList.toggle('active-mode', editTarget === 'friends');
    editFriendsButton.classList.toggle('secondary', editTarget !== 'friends');
  }
  if (editTimButton) {
    editTimButton.classList.toggle('active-mode', editTarget === 'tim');
    editTimButton.classList.toggle('secondary', editTarget !== 'tim');
  }
  if (editSpawnButton) {
    editSpawnButton.classList.toggle('active-mode', editTarget === 'spawn');
    editSpawnButton.classList.toggle('secondary', editTarget !== 'spawn');
  }
  if (editPartyButton) {
    editPartyButton.classList.toggle('active-mode', editTarget === 'party');
    editPartyButton.classList.toggle('secondary', editTarget !== 'party');
  }

  if (paintPaletteElement) paintPaletteElement.classList.toggle('hidden', editTarget !== 'forest');
  if (friendPaletteElement) friendPaletteElement.classList.toggle('hidden', editTarget !== 'friends');
  if (partyPaletteElement) partyPaletteElement.classList.toggle('hidden', editTarget !== 'party');
  if (placementEditorElement) placementEditorElement.classList.toggle('hidden', editTarget === 'forest');
  if (placementScaleRow) placementScaleRow.classList.toggle('hidden', editTarget !== 'party');
  setPartyPreviewVisible(editTarget === 'party');
}

function worldFromLayout(item) {
  return {
    x: PARK_CENTER_X + item.dx,
    z: PARK_CENTER_Z + item.dz
  };
}

function updateOutput() {
  if (editTarget === 'friends') {
    outputEl.value = friendLayoutToCode(friendLayout);
  } else if (editTarget === 'tim') {
    outputEl.value = worldPlacementToCode('TIM_PLACEMENT', timPlacement);
  } else if (editTarget === 'spawn') {
    outputEl.value = worldPlacementToCode('PLAYER_START', playerStart);
  } else if (editTarget === 'party') {
    outputEl.value = partyLayoutToCode(partyLayout);
  } else {
    outputEl.value = layoutToCode(layout);
  }
}

function friendLayoutToCode(currentLayout) {
  const safeLayout = Array.isArray(currentLayout) ? currentLayout : [];
  return `const FRIEND_PLACEMENTS = ${JSON.stringify(safeLayout, null, 2)};`;
}

function worldPlacementToCode(name, placement) {
  return `const ${name} = ${JSON.stringify(placement || {}, null, 2)};`;
}



function setStatus(message) {
  statusEl.textContent = message;
}

function formatInputNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(2))) : '0';
}

function getEditableFriendIndex() {
  if (selectedFriendIndex >= 0 && friendLayout[selectedFriendIndex]) return selectedFriendIndex;
  const paintIndex = friendLayout.findIndex((p) => p && p.id === paintFriendId);
  return paintIndex >= 0 ? paintIndex : -1;
}

function getActivePlacementInfo() {
  if (editTarget === 'friends') {
    const index = getEditableFriendIndex();
    const placement = index >= 0 ? friendLayout[index] : null;
    const def = placement ? FRIEND_DEFS.find((d) => d.id === placement.id) : null;
    return {
      placement,
      label: def ? `${def.name} placement` : 'Friend placement'
    };
  }

  if (editTarget === 'tim') {
    return { placement: timPlacement, label: 'Tim placement' };
  }

  if (editTarget === 'spawn') {
    return { placement: playerStart, label: 'First spawn placement' };
  }

  if (editTarget === 'party') {
    const index = getEditablePartyIndex();
    const placement = index >= 0 ? partyLayout[index] : null;
    const def = placement ? getPartyElementDef(placement.id) : null;
    return {
      placement,
      label: def ? `${def.label} party placement` : 'Party placement'
    };
  }

  return { placement: null, label: 'Placement' };
}

function syncPlacementInputs() {
  if (!placementEditorElement || editTarget === 'forest') return;
  const { placement, label } = getActivePlacementInfo();
  if (!placement) return;

  syncingPlacementInputs = true;
  if (placementTitleElement) placementTitleElement.textContent = label;
  if (placementXInput) placementXInput.value = formatInputNumber(placement.x);
  if (placementYInput) placementYInput.value = formatInputNumber(placement.y);
  if (placementZInput) placementZInput.value = formatInputNumber(placement.z);
  if (placementRotationInput) {
    const degrees = THREE.MathUtils.radToDeg(Number(placement.rotationY) || 0);
    placementRotationInput.value = formatInputNumber(degrees);
  }
  if (placementScaleInput) placementScaleInput.value = formatInputNumber(placement.scale || 1);
  syncingPlacementInputs = false;
}

function readPlacementInputs(fallback) {
  const rotationDegrees = Number(placementRotationInput && placementRotationInput.value);
  const scaleValue = Number(placementScaleInput && placementScaleInput.value);
  return {
    x: Number.isFinite(Number(placementXInput && placementXInput.value)) ? Number(placementXInput.value) : Number(fallback.x) || 0,
    y: Number.isFinite(Number(placementYInput && placementYInput.value)) ? Number(placementYInput.value) : Number(fallback.y) || 0,
    z: Number.isFinite(Number(placementZInput && placementZInput.value)) ? Number(placementZInput.value) : Number(fallback.z) || 0,
    rotationY: Number.isFinite(rotationDegrees) ? THREE.MathUtils.degToRad(rotationDegrees) : Number(fallback.rotationY) || 0,
    scale: Number.isFinite(scaleValue) ? Math.max(0.2, scaleValue) : Number(fallback.scale) || 1
  };
}

function applyPlacementInputValues() {
  if (syncingPlacementInputs || editTarget === 'forest') return;
  const { placement } = getActivePlacementInfo();
  if (!placement) return;

  const next = readPlacementInputs(placement);
  next.x = Number(next.x.toFixed(1));
  next.y = Number(next.y.toFixed(1));
  next.z = Number(next.z.toFixed(1));
  next.rotationY = Number(next.rotationY.toFixed(4));
  next.scale = Number((next.scale || 1).toFixed(2));
  const worldNext = {
    x: next.x,
    y: next.y,
    z: next.z,
    rotationY: next.rotationY
  };

  if (editTarget === 'friends') {
    const index = getEditableFriendIndex();
    if (index < 0 || !friendLayout[index]) return;
    friendLayout[index] = { ...friendLayout[index], ...worldNext };
    selectedFriendIndex = index;
  } else if (editTarget === 'tim') {
    timPlacement = { ...timPlacement, ...worldNext };
  } else if (editTarget === 'spawn') {
    playerStart = { ...playerStart, ...worldNext };
  } else if (editTarget === 'party') {
    const index = getEditablePartyIndex();
    if (index < 0 || !partyLayout[index]) return;
    partyLayout[index] = { ...partyLayout[index], ...next };
    selectedPartyIndex = index;
  }

  syncEditor();
}

function refreshMarkers() {
  markerGroup.clear();

  function addPlacementMarker(x, y, z, color, rotationY = null) {
    const markerY = Number(y) || 0;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 28),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, markerY + 0.12, z);
    markerGroup.add(ring);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 1.4, 10),
      new THREE.MeshBasicMaterial({ color })
    );
    pole.position.set(x, markerY + 0.75, z);
    markerGroup.add(pole);

    if (rotationY !== null) {
      const direction = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Number(rotationY) || 0)
        .normalize();
      const arrow = new THREE.ArrowHelper(
        direction,
        new THREE.Vector3(x, markerY + 1.65, z),
        2.4,
        color,
        0.55,
        0.34
      );
      markerGroup.add(arrow);
    }
  }

  if (editTarget === 'tim') {
    addPlacementMarker(
      Number(timPlacement.x) || 0,
      Number(timPlacement.y) || 0,
      Number(timPlacement.z) || 0,
      TIM_COLOR,
      Number(timPlacement.rotationY) || 0
    );
    return;
  }

  if (editTarget === 'spawn') {
    addPlacementMarker(
      Number(playerStart.x) || 0,
      Number(playerStart.y) || 0,
      Number(playerStart.z) || 0,
      SPAWN_COLOR,
      Number(playerStart.rotationY) || 0
    );
    return;
  }

  if (editTarget === 'party') {
    partyLayout.forEach((placement, index) => {
      if (!placement) return;
      const def = getPartyElementDef(placement.id);
      const kind = def ? def.kind : 'participant';
      const color = PARTY_COLORS[kind] || 0xffc247;
      const selected = index === selectedPartyIndex;
      const x = Number(placement.x) || 0;
      const y = Number(placement.y) || 0;
      const z = Number(placement.z) || 0;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(selected ? 1.15 : 0.86, selected ? 1.52 : 1.18, 28),
        new THREE.MeshBasicMaterial({
          color: selected ? 0xffffff : color,
          transparent: true,
          opacity: selected ? 0.95 : 0.78,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.14, z);
      markerGroup.add(ring);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(selected ? 0.13 : 0.09, selected ? 0.13 : 0.09, selected ? 1.65 : 1.22, 10),
        new THREE.MeshBasicMaterial({ color: selected ? 0xffffff : color })
      );
      pole.position.set(x, y + (selected ? 0.9 : 0.68), z);
      markerGroup.add(pole);

      const direction = new THREE.Vector3(0, 0, -1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), Number(placement.rotationY) || 0)
        .normalize();
      const arrow = new THREE.ArrowHelper(
        direction,
        new THREE.Vector3(x, y + 1.75, z),
        1.9 * getPlacementScale(placement),
        selected ? 0xffffff : color,
        0.45,
        0.28
      );
      markerGroup.add(arrow);
    });
    return;
  }

  if (editTarget === 'friends') {
    friendLayout.forEach((placement, index) => {
      if (!placement) return;
      const x = placement.x;
      const y = Number(placement.y) || 0;
      const z = placement.z;
      const color = FRIEND_COLORS[placement.id] || 0x2e7a38;
      const selected = index === selectedFriendIndex;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(selected ? 1.05 : 0.8, selected ? 1.4 : 1.12, 28),
        new THREE.MeshBasicMaterial({
          color: selected ? 0xffc247 : color,
          transparent: true,
          opacity: selected ? 0.95 : 0.78,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, y + 0.12, z);
      markerGroup.add(ring);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(selected ? 0.13 : 0.09, selected ? 0.13 : 0.09, selected ? 1.6 : 1.15, 10),
        new THREE.MeshBasicMaterial({ color: selected ? 0xffc247 : color })
      );
      pole.position.set(x, y + (selected ? 0.85 : 0.65), z);
      markerGroup.add(pole);
    });
    return;
  }

  layout.forEach((item, index) => {
    const { x, z } = worldFromLayout(item);
    const color = TYPE_COLORS[item.type] || 0x2e7a38;
    const selected = index === selectedIndex;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(selected ? 0.9 : 0.65, selected ? 1.2 : 0.95, 28),
      new THREE.MeshBasicMaterial({
        color: selected ? 0xffc247 : color,
        transparent: true,
        opacity: selected ? 0.95 : 0.75,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.12, z);
    markerGroup.add(ring);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(selected ? 0.12 : 0.08, selected ? 0.12 : 0.08, selected ? 1.4 : 1.0, 10),
      new THREE.MeshBasicMaterial({ color: selected ? 0xffc247 : color })
    );
    pole.position.set(x, selected ? 0.78 : 0.58, z);
    markerGroup.add(pole);
  });
}

function syncForest(statusOverride = '') {
  forestController.setLayout(layout);
  updateOutput();
  refreshMarkers();

  if (statusOverride) {
    setStatus(statusOverride);
    return;
  }

  if (selectedIndex >= 0 && layout[selectedIndex]) {
    const item = layout[selectedIndex];
    setStatus(`Select mode. ${TYPE_LABELS[item.type]} ${selectedIndex + 1} at dx ${item.dx.toFixed(1)}, dz ${item.dz.toFixed(1)}, rot ${item.rotationY.toFixed(2)}.`);
  } else if (editorMode === 'paint') {
    setStatus(`Paint mode. ${layout.length} items in layout. Painting ${TYPE_LABELS[paintType]}.`);
  } else {
    setStatus(`Select mode. ${layout.length} items in layout. Click near an item to move or remove it.`);
  }
}

function syncFriends(statusOverride = '') {
  applyFriendPlacementsToModels();
  updateOutput();
  refreshMarkers();
  syncPlacementInputs();

  if (statusOverride) {
    setStatus(statusOverride);
    return;
  }

  if (selectedFriendIndex >= 0 && friendLayout[selectedFriendIndex]) {
    const placement = friendLayout[selectedFriendIndex];
    const def = FRIEND_DEFS.find((d) => d.id === placement.id);
    const label = def ? def.name : placement.id;
    setStatus(`Select mode. ${label} at x ${placement.x.toFixed(1)}, y ${Number(placement.y || 0).toFixed(1)}, z ${placement.z.toFixed(1)}, rot ${Number(placement.rotationY || 0).toFixed(2)}.`);
  } else if (editorMode === 'paint') {
    const def = FRIEND_DEFS.find((d) => d.id === paintFriendId);
    const label = def ? def.name : paintFriendId;
    const placement = friendLayout.find((p) => p && p.id === paintFriendId);
    const y = placement ? Number(placement.y || 0).toFixed(1) : '0.0';
    setStatus(`Paint mode. Drag to position ${label}. Use the Y field for height (${y}).`);
  } else {
    setStatus('Select mode. Click near a friend to select it, then click elsewhere to move it.');
  }
}

function syncTim(statusOverride = '') {
  applyTimPlacementToModel();
  updateOutput();
  refreshMarkers();
  syncPlacementInputs();

  if (statusOverride) {
    setStatus(statusOverride);
    return;
  }

  setStatus(`Tim at x ${Number(timPlacement.x || 0).toFixed(1)}, y ${Number(timPlacement.y || 0).toFixed(1)}, z ${Number(timPlacement.z || 0).toFixed(1)}. Click the map to move him.`);
}

function syncSpawn(statusOverride = '') {
  updateOutput();
  refreshMarkers();
  syncPlacementInputs();

  if (statusOverride) {
    setStatus(statusOverride);
    return;
  }

  setStatus(`First spawn at x ${Number(playerStart.x || 0).toFixed(1)}, y ${Number(playerStart.y || 0).toFixed(1)}, z ${Number(playerStart.z || 0).toFixed(1)}. Click the map to move it.`);
}

function syncParty(statusOverride = '') {
  updatePartyPreview();
  applyPartyPreviewToModels();
  updateOutput();
  refreshMarkers();
  syncPlacementInputs();

  if (statusOverride) {
    setStatus(statusOverride);
    return;
  }

  const index = getEditablePartyIndex();
  const placement = index >= 0 ? partyLayout[index] : null;
  const def = placement ? getPartyElementDef(placement.id) : null;
  const label = def ? def.label : 'Party item';
  if (placement) {
    setStatus(`${label} at x ${Number(placement.x || 0).toFixed(1)}, y ${Number(placement.y || 0).toFixed(1)}, z ${Number(placement.z || 0).toFixed(1)}, rot ${Number(placement.rotationY || 0).toFixed(2)}, scale ${Number(placement.scale || 1).toFixed(2)}.`);
  } else {
    setStatus('Party mode. Pick a party item, then click or drag it into place.');
  }
}

function syncEditor(statusOverride = '') {
  if (editTarget === 'friends') syncFriends(statusOverride);
  else if (editTarget === 'tim') syncTim(statusOverride);
  else if (editTarget === 'spawn') syncSpawn(statusOverride);
  else if (editTarget === 'party') syncParty(statusOverride);
  else syncForest(statusOverride);
}

function findNearestItemIndex(worldX, worldZ) {
  let nearestIndex = -1;
  let nearestDistSq = Infinity;

  layout.forEach((item, index) => {
    const { x, z } = worldFromLayout(item);

    const dx = worldX - x;
    const dz = worldZ - z;
    const distSq = dx * dx + dz * dz;

    // Use spacing as selection radius per type
    const baseSpacing = PAINT_SPACING[item.type] || 2;
    const radius = baseSpacing * 1.1; // tweakable (1.0–1.3 feels good)
    const radiusSq = radius * radius;

    if (distSq <= radiusSq && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function addItemAt(type, worldX, worldZ) {
  const minSpacing = PAINT_SPACING[type] || 2;
  if (findNearestItemIndex(worldX, worldZ) >= 0) return false;

  layout.push({
    type,
    dx: Number((worldX - PARK_CENTER_X).toFixed(1)),
    dz: Number((worldZ - PARK_CENTER_Z).toFixed(1)),
    rotationY: 0
  });

  selectedIndex = editorMode === 'select' ? layout.length - 1 : -1;
  syncEditor();
  return true;
}

function moveSelectedItem(worldX, worldZ) {
  if (selectedIndex < 0 || !layout[selectedIndex]) return;
  layout[selectedIndex] = {
    ...layout[selectedIndex],
    dx: Number((worldX - PARK_CENTER_X).toFixed(1)),
    dz: Number((worldZ - PARK_CENTER_Z).toFixed(1))
  };
  syncEditor();
}

function removeItemAt(index) {
  if (index < 0 || index >= layout.length) return;
  layout.splice(index, 1);
  if (selectedIndex === index) selectedIndex = -1;
  else if (selectedIndex > index) selectedIndex -= 1;
  syncEditor('Item removed.');
}

function rotateSelectedItem() {
  if (selectedIndex < 0 || !layout[selectedIndex]) return;
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  layout[selectedIndex] = {
    ...layout[selectedIndex],
    rotationY: Number((layout[selectedIndex].rotationY + rotationStep).toFixed(4))
  };
  syncEditor();
}

function setEditorMode(mode) {
  editorMode = mode === 'select' ? 'select' : 'paint';
  if (editorMode === 'paint') {
    if (editTarget === 'friends') selectedFriendIndex = -1;
    else if (editTarget === 'party') selectedPartyIndex = -1;
    else selectedIndex = -1;
  }
  updateModeButtons();
  syncEditor();
}

function setPaintType(type) {
  paintType = FOREST_ITEM_TYPES.includes(type) ? type : 'tree';
  updatePaletteButtons();
  syncEditor();
}

function setPaintFriendId(friendId) {
  const id = String(friendId || '');
  if (!FRIEND_DEFS.some((def) => def.id === id)) return;
  paintFriendId = id;
  updateFriendPaletteButtons();
  syncEditor();
}

function setPaintPartyId(partyId) {
  const id = String(partyId || '');
  if (!PARTY_ELEMENT_DEFS.some((def) => def.id === id)) return;
  paintPartyId = id;
  selectedPartyIndex = partyLayout.findIndex((placement) => placement && placement.id === id);
  updatePartyPaletteButtons();
  syncEditor();
}

function setEditTarget(target) {
  const previousTarget = editTarget;
  if (target === 'friends' || target === 'tim' || target === 'spawn' || target === 'party') editTarget = target;
  else editTarget = 'forest';
  isPainting = false;
  lastPaintPoint = null;
  pointerDown = null;
  if (previousTarget === 'party' && editTarget !== 'party') {
    applyFriendPlacementsToModels();
    applyTimPlacementToModel();
  }
  updateTargetButtons();
  syncEditor();
}

function findNearestFriendIndex(worldX, worldZ) {
  let nearestIndex = -1;
  let nearestDistSq = Infinity;

  friendLayout.forEach((placement, index) => {
    if (!placement) return;
    const dx = worldX - placement.x;
    const dz = worldZ - placement.z;
    const distSq = dx * dx + dz * dz;
    const radiusSq = FRIEND_SELECT_RADIUS * FRIEND_SELECT_RADIUS;
    if (distSq <= radiusSq && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function setFriendAtIndex(index, worldX, worldZ) {
  if (index < 0 || index >= friendLayout.length || !friendLayout[index]) return;
  friendLayout[index] = {
    ...friendLayout[index],
    x: Number(worldX.toFixed(1)),
    z: Number(worldZ.toFixed(1))
  };
  syncEditor();
}

function setFriendById(friendId, worldX, worldZ) {
  const index = friendLayout.findIndex((p) => p && p.id === friendId);
  if (index < 0) return;
  setFriendAtIndex(index, worldX, worldZ);
}

function moveSelectedFriend(worldX, worldZ) {
  if (selectedFriendIndex < 0) return;
  setFriendAtIndex(selectedFriendIndex, worldX, worldZ);
}

function resetFriendAtIndex(index) {
  if (index < 0 || index >= friendLayout.length || !friendLayout[index]) return;
  const defaults = getDefaultFriendPlacements();
  const id = friendLayout[index].id;
  const fallback = defaults.find((p) => p.id === id);
  if (!fallback) return;
  friendLayout[index] = { ...fallback };
  syncEditor('Friend reset to default placement.');
}

function rotateSelectedFriend() {
  if (selectedFriendIndex < 0 || !friendLayout[selectedFriendIndex]) return;
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  friendLayout[selectedFriendIndex] = {
    ...friendLayout[selectedFriendIndex],
    rotationY: Number(((friendLayout[selectedFriendIndex].rotationY || 0) + rotationStep).toFixed(4))
  };
  syncEditor();
}

function setTimAt(worldX, worldZ) {
  timPlacement = {
    ...timPlacement,
    x: Number(worldX.toFixed(1)),
    z: Number(worldZ.toFixed(1))
  };
  syncEditor();
}

function setPlayerStartAt(worldX, worldZ) {
  playerStart = {
    ...playerStart,
    x: Number(worldX.toFixed(1)),
    z: Number(worldZ.toFixed(1))
  };
  syncEditor();
}

function rotateTim() {
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  timPlacement = {
    ...timPlacement,
    rotationY: Number(((timPlacement.rotationY || 0) + rotationStep).toFixed(4))
  };
  syncEditor();
}

function rotatePlayerStart() {
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  playerStart = {
    ...playerStart,
    rotationY: Number(((playerStart.rotationY || 0) + rotationStep).toFixed(4))
  };
  syncEditor();
}

function findNearestPartyIndex(worldX, worldZ) {
  let nearestIndex = -1;
  let nearestDistSq = Infinity;

  partyLayout.forEach((placement, index) => {
    if (!placement) return;
    const dx = worldX - placement.x;
    const dz = worldZ - placement.z;
    const distSq = dx * dx + dz * dz;
    const radius = PARTY_SELECT_RADIUS * getPlacementScale(placement);
    const radiusSq = radius * radius;
    if (distSq <= radiusSq && distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function setPartyAtIndex(index, worldX, worldZ) {
  if (index < 0 || index >= partyLayout.length || !partyLayout[index]) return;
  partyLayout[index] = {
    ...partyLayout[index],
    x: Number(worldX.toFixed(1)),
    z: Number(worldZ.toFixed(1))
  };
  syncEditor();
}

function setPartyById(partyId, worldX, worldZ) {
  const index = partyLayout.findIndex((placement) => placement && placement.id === partyId);
  if (index < 0) return;
  selectedPartyIndex = index;
  setPartyAtIndex(index, worldX, worldZ);
}

function moveSelectedParty(worldX, worldZ) {
  if (selectedPartyIndex < 0) return;
  setPartyAtIndex(selectedPartyIndex, worldX, worldZ);
}

function resetPartyAtIndex(index) {
  if (index < 0 || index >= partyLayout.length || !partyLayout[index]) return;
  const defaults = getDefaultPartyLayout();
  const id = partyLayout[index].id;
  const fallback = defaults.find((placement) => placement.id === id);
  if (!fallback) return;
  partyLayout[index] = { ...fallback };
  selectedPartyIndex = index;
  syncEditor('Party item reset to default placement.');
}

function rotateSelectedParty() {
  const index = getEditablePartyIndex();
  if (index < 0 || !partyLayout[index]) return;
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  partyLayout[index] = {
    ...partyLayout[index],
    rotationY: Number(((partyLayout[index].rotationY || 0) + rotationStep).toFixed(4))
  };
  selectedPartyIndex = index;
  syncEditor();
}

function maybePaintFriend(point) {
  if (!point) return;
  const index = friendLayout.findIndex((p) => p && p.id === paintFriendId);
  if (index >= 0) selectedFriendIndex = index;
  setFriendById(paintFriendId, point.x, point.z);
}

function maybePaintParty(point) {
  if (!point) return;
  setPartyById(paintPartyId, point.x, point.z);
}

function maybePaintSingletonPlacement(point) {
  if (!point) return;
  if (editTarget === 'tim') setTimAt(point.x, point.z);
  else if (editTarget === 'spawn') setPlayerStartAt(point.x, point.z);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function intersectGround(event) {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(editorPlane, false);
  return hits.length ? hits[0].point : null;
}

function maybePaintItem(point) {
  if (!point) return;
  const minSpacing = PAINT_SPACING[paintType] || 2;
  if (lastPaintPoint && lastPaintPoint.distanceTo(point) < minSpacing) return;
  if (addItemAt(paintType, point.x, point.z)) lastPaintPoint = point.clone();
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };

  if (editorMode !== 'paint' || event.button !== 0) return;
  isPainting = true;
  lastPaintPoint = null;
  const point = intersectGround(event);
  if (editTarget === 'friends') {
    maybePaintFriend(point);
  } else if (editTarget === 'party') {
    maybePaintParty(point);
  } else if (editTarget === 'tim' || editTarget === 'spawn') {
    maybePaintSingletonPlacement(point);
  } else {
    maybePaintItem(point);
  }
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isPainting || editorMode !== 'paint') return;
  const point = intersectGround(event);
  if (editTarget === 'friends') {
    maybePaintFriend(point);
  } else if (editTarget === 'party') {
    maybePaintParty(point);
  } else if (editTarget === 'tim' || editTarget === 'spawn') {
    maybePaintSingletonPlacement(point);
  } else {
    maybePaintItem(point);
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (editorMode === 'paint') {
    isPainting = false;
    lastPaintPoint = null;
    pointerDown = null;
    syncEditor();
    return;
  }

  if (!pointerDown) return;
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 6) return;

  const point = intersectGround(event);
  if (!point) return;

  if (editTarget === 'tim' || editTarget === 'spawn') {
    maybePaintSingletonPlacement(point);
    return;
  }

  if (editTarget === 'friends') {
    const nearestFriendIndex = findNearestFriendIndex(point.x, point.z);

    if (event.shiftKey) {
      if (nearestFriendIndex >= 0) resetFriendAtIndex(nearestFriendIndex);
      return;
    }

    if (nearestFriendIndex >= 0) {
      selectedFriendIndex = nearestFriendIndex;
      syncEditor();
      return;
    }

    if (selectedFriendIndex >= 0) {
      moveSelectedFriend(point.x, point.z);
      return;
    }

    setStatus('Select a friend first, then click elsewhere to move it.');
    return;
  }

  if (editTarget === 'party') {
    const nearestPartyIndex = findNearestPartyIndex(point.x, point.z);

    if (event.shiftKey) {
      if (nearestPartyIndex >= 0) resetPartyAtIndex(nearestPartyIndex);
      return;
    }

    if (nearestPartyIndex >= 0) {
      selectedPartyIndex = nearestPartyIndex;
      const placement = partyLayout[selectedPartyIndex];
      if (placement) paintPartyId = placement.id;
      updatePartyPaletteButtons();
      syncEditor();
      return;
    }

    if (selectedPartyIndex >= 0) {
      moveSelectedParty(point.x, point.z);
      return;
    }

    setStatus('Select a party item first, then click elsewhere to move it.');
    return;
  }

  const nearestIndex = findNearestItemIndex(point.x, point.z);

  if (event.shiftKey) {
    if (nearestIndex >= 0) removeItemAt(nearestIndex);
    return;
  }

  if (nearestIndex >= 0) {
    selectedIndex = nearestIndex;
    syncEditor();
    return;
  }

  if (selectedIndex >= 0) {
    moveSelectedItem(point.x, point.z);
    return;
  }

  addItemAt(paintType, point.x, point.z);
});

renderer.domElement.addEventListener('pointerleave', () => {
  isPainting = false;
  lastPaintPoint = null;
  pointerDown = null;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') {
    if (editTarget === 'friends') rotateSelectedFriend();
    else if (editTarget === 'tim') rotateTim();
    else if (editTarget === 'spawn') rotatePlayerStart();
    else if (editTarget === 'party') rotateSelectedParty();
    else rotateSelectedItem();
  } else if (event.code === 'Escape') {
    if (editTarget === 'friends') selectedFriendIndex = -1;
    else if (editTarget === 'party') selectedPartyIndex = -1;
    else selectedIndex = -1;
    syncEditor();
  } else if (event.code === 'KeyP') {
    setEditorMode('paint');
  } else if (event.code === 'KeyM') {
    setEditorMode('select');
  }
});

rotationStepInput.addEventListener('input', updateRotationLabel);
if (editForestButton) editForestButton.addEventListener('click', () => setEditTarget('forest'));
if (editFriendsButton) editFriendsButton.addEventListener('click', () => setEditTarget('friends'));
if (editTimButton) editTimButton.addEventListener('click', () => setEditTarget('tim'));
if (editSpawnButton) editSpawnButton.addEventListener('click', () => setEditTarget('spawn'));
if (editPartyButton) editPartyButton.addEventListener('click', () => setEditTarget('party'));
paintModeButton.addEventListener('click', () => setEditorMode('paint'));
selectModeButton.addEventListener('click', () => setEditorMode('select'));
paletteButtons.forEach((button) => {
  button.addEventListener('click', () => setPaintType(button.dataset.itemType || 'tree'));
});
friendPaletteButtons.forEach((button) => {
  button.addEventListener('click', () => setPaintFriendId(button.dataset.friendId || 'friend1'));
});
partyPaletteButtons.forEach((button) => {
  button.addEventListener('click', () => setPaintPartyId(button.dataset.partyId || 'table'));
});
[placementXInput, placementYInput, placementZInput, placementRotationInput, placementScaleInput].forEach((input) => {
  if (!input) return;
  input.addEventListener('input', applyPlacementInputValues);
});


copyButton.addEventListener('click', async () => {
  const text = editTarget === 'friends'
    ? friendLayoutToCode(friendLayout)
    : editTarget === 'tim'
      ? worldPlacementToCode('TIM_PLACEMENT', timPlacement)
      : editTarget === 'spawn'
        ? worldPlacementToCode('PLAYER_START', playerStart)
        : editTarget === 'party'
          ? partyLayoutToCode(partyLayout)
          : layoutToCode(layout);
  try {
    await navigator.clipboard.writeText(text);
    setStatus(editTarget === 'friends'
      ? 'Friend placement code copied to clipboard.'
      : editTarget === 'tim'
        ? 'Tim placement code copied to clipboard.'
        : editTarget === 'spawn'
          ? 'First spawn code copied to clipboard.'
          : editTarget === 'party'
            ? 'Party layout code copied to clipboard.'
            : 'Forest layout code copied to clipboard.');
  } catch (e) {
    outputEl.focus();
    outputEl.select();
    setStatus('Clipboard access was blocked, so the code has been selected for manual copy.');
  }
});

deleteSelectedButton.addEventListener('click', () => {
  if (editTarget === 'friends') {
    if (selectedFriendIndex < 0 || !friendLayout[selectedFriendIndex]) {
      setStatus('Select a friend first, then use Delete Selected to reset it.');
      return;
    }
    resetFriendAtIndex(selectedFriendIndex);
    return;
  }

  if (editTarget === 'tim') {
    timPlacement = getDefaultTimPlacement();
    applyTimPlacementToModel();
    syncEditor('Tim reset to default placement.');
    return;
  }

  if (editTarget === 'spawn') {
    playerStart = getDefaultPlayerStart();
    syncEditor('First spawn reset to default placement.');
    return;
  }

  if (editTarget === 'party') {
    const index = getEditablePartyIndex();
    if (index < 0 || !partyLayout[index]) {
      setStatus('Select a party item first, then use Delete Selected to reset it.');
      return;
    }
    resetPartyAtIndex(index);
    return;
  }

  if (selectedIndex < 0 || !layout[selectedIndex]) {
    setStatus('Select an item first, then use Delete Selected.');
    return;
  }
  removeItemAt(selectedIndex);
});

resetButton.addEventListener('click', () => {
  if (editTarget === 'friends') {
    friendLayout = getDefaultFriendPlacements();
    selectedFriendIndex = -1;
    applyFriendPlacementsToModels();
    syncEditor('Reset to the default friend placements.');
    return;
  }

  if (editTarget === 'tim') {
    timPlacement = getDefaultTimPlacement();
    applyTimPlacementToModel();
    syncEditor('Reset to the default Tim placement.');
    return;
  }

  if (editTarget === 'spawn') {
    playerStart = getDefaultPlayerStart();
    syncEditor('Reset to the default first spawn.');
    return;
  }

  if (editTarget === 'party') {
    partyLayout = getDefaultPartyLayout();
    selectedPartyIndex = -1;
    syncEditor('Reset to the default party layout.');
    return;
  }

  layout = cloneDefaultLayout();
  selectedIndex = -1;
  syncEditor('Reset to the default forest layout.');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  controls.update(dt);
  renderer.render(scene, camera);
}

updateRotationLabel();
updateModeButtons();
updatePaletteButtons();
updateFriendPaletteButtons();
updatePartyPaletteButtons();
updateTargetButtons();
setEditTarget('forest');
animate();
