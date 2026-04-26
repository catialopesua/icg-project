import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGardenZone } from './garden.js';
import { createCityZone } from './city.js';
import { createBeachZone } from './beach.js';
import {
  DEFAULT_FOREST_LAYOUT,
  FOREST_ITEM_TYPES,
  clearForestLayout,
  createForestZone,
  layoutToCode,
  loadForestLayout,
  saveForestLayout
} from './forest.js';

const PARK_CENTER_X = -18;
const PARK_CENTER_Z = 12;
const ITEM_SELECT_RADIUS = 2.35;
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

const container = document.getElementById('canvas-container');
const statusEl = document.getElementById('debug-status');
const outputEl = document.getElementById('layout-output');
const saveButton = document.getElementById('save-layout');
const copyButton = document.getElementById('copy-layout');
const deleteSelectedButton = document.getElementById('delete-selected');
const resetButton = document.getElementById('reset-layout');
const clearSavedButton = document.getElementById('clear-saved');
const rotationStepInput = document.getElementById('rotation-step');
const rotationStepValue = document.getElementById('rotation-step-value');
const paintModeButton = document.getElementById('paint-mode');
const selectModeButton = document.getElementById('select-mode');
const autosaveToggle = document.getElementById('autosave-toggle');
const paletteButtons = Array.from(document.querySelectorAll('[data-item-type]'));

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

const grassGroundTex = makeTerrainTextureSet('./models/textures/Grass002_2K-JPG/Grass002_2K-JPG', 30);
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

let layout = loadForestLayout();
let selectedIndex = -1;
let editorMode = 'paint';
let paintType = 'tree';
let isPainting = false;
let lastPaintPoint = null;
let pointerDown = null;

const forestController = createForestZone(scene, PARK_CENTER_X, PARK_CENTER_Z, {
  layout,
  preferStored: false
});

const markerGroup = new THREE.Group();
markerGroup.name = 'forest-editor-markers';
scene.add(markerGroup);

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

function worldFromLayout(item) {
  return {
    x: PARK_CENTER_X + item.dx,
    z: PARK_CENTER_Z + item.dz
  };
}

function updateOutput() {
  outputEl.value = layoutToCode(layout);
}

function persistIfAutosave() {
  if (!autosaveToggle.checked) return;
  layout = saveForestLayout(layout);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function refreshMarkers() {
  markerGroup.clear();

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
  persistIfAutosave();
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
  syncForest();
  return true;
}

function moveSelectedItem(worldX, worldZ) {
  if (selectedIndex < 0 || !layout[selectedIndex]) return;
  layout[selectedIndex] = {
    ...layout[selectedIndex],
    dx: Number((worldX - PARK_CENTER_X).toFixed(1)),
    dz: Number((worldZ - PARK_CENTER_Z).toFixed(1))
  };
  syncForest();
}

function removeItemAt(index) {
  if (index < 0 || index >= layout.length) return;
  layout.splice(index, 1);
  if (selectedIndex === index) selectedIndex = -1;
  else if (selectedIndex > index) selectedIndex -= 1;
  syncForest('Item removed.');
}

function rotateSelectedItem() {
  if (selectedIndex < 0 || !layout[selectedIndex]) return;
  const rotationStep = THREE.MathUtils.degToRad(Number(rotationStepInput.value) || 15);
  layout[selectedIndex] = {
    ...layout[selectedIndex],
    rotationY: Number((layout[selectedIndex].rotationY + rotationStep).toFixed(4))
  };
  syncForest();
}

function setEditorMode(mode) {
  editorMode = mode === 'select' ? 'select' : 'paint';
  if (editorMode === 'paint') selectedIndex = -1;
  updateModeButtons();
  syncForest();
}

function setPaintType(type) {
  paintType = FOREST_ITEM_TYPES.includes(type) ? type : 'tree';
  updatePaletteButtons();
  syncForest();
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
  maybePaintItem(intersectGround(event));
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isPainting || editorMode !== 'paint') return;
  maybePaintItem(intersectGround(event));
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (editorMode === 'paint') {
    isPainting = false;
    lastPaintPoint = null;
    pointerDown = null;
    syncForest();
    return;
  }

  if (!pointerDown) return;
  const moved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 6) return;

  const point = intersectGround(event);
  if (!point) return;

  const nearestIndex = findNearestItemIndex(point.x, point.z);

  if (event.shiftKey) {
    if (nearestIndex >= 0) removeItemAt(nearestIndex);
    return;
  }

  if (nearestIndex >= 0) {
    selectedIndex = nearestIndex;
    syncForest();
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
    rotateSelectedItem();
  } else if (event.code === 'Escape') {
    selectedIndex = -1;
    syncForest();
  } else if (event.code === 'KeyP') {
    setEditorMode('paint');
  } else if (event.code === 'KeyM') {
    setEditorMode('select');
  }
});

rotationStepInput.addEventListener('input', updateRotationLabel);
paintModeButton.addEventListener('click', () => setEditorMode('paint'));
selectModeButton.addEventListener('click', () => setEditorMode('select'));
paletteButtons.forEach((button) => {
  button.addEventListener('click', () => setPaintType(button.dataset.itemType || 'tree'));
});

autosaveToggle.addEventListener('change', () => {
  if (autosaveToggle.checked) {
    layout = saveForestLayout(layout);
    setStatus('Auto-save is on. New edits will update the map live.');
  } else {
    setStatus('Auto-save is off. Use Save To Map when you want to push changes.');
  }
});

saveButton.addEventListener('click', () => {
  layout = saveForestLayout(layout);
  forestController.setLayout(layout);
  updateOutput();
  setStatus('Saved to the map. You can keep placing items right away.');
});

copyButton.addEventListener('click', async () => {
  const text = layoutToCode(layout);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Forest layout code copied to clipboard.');
  } catch (e) {
    outputEl.focus();
    outputEl.select();
    setStatus('Clipboard access was blocked, so the code has been selected for manual copy.');
  }
});

deleteSelectedButton.addEventListener('click', () => {
  if (selectedIndex < 0 || !layout[selectedIndex]) {
    setStatus('Select an item first, then use Delete Selected.');
    return;
  }
  removeItemAt(selectedIndex);
});

resetButton.addEventListener('click', () => {
  layout = cloneDefaultLayout();
  selectedIndex = -1;
  syncForest('Reset to the default forest layout.');
});

clearSavedButton.addEventListener('click', () => {
  clearForestLayout();
  setStatus('Saved override cleared. The live map will now fall back to the code layout.');
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
syncForest();
animate();
