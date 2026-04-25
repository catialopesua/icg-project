import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGardenZone } from './garden.js';
import { createCityZone } from './city.js';
import { createBeachZone } from './beach.js';
import {
  DEFAULT_FOREST_TREE_LAYOUT,
  createForestZone,
  clearForestTreeLayout,
  layoutToCode,
  loadForestTreeLayout,
  saveForestTreeLayout
} from './forest.js';

const PARK_CENTER_X = -18;
const PARK_CENTER_Z = 12;
const TREE_SELECT_RADIUS = 2.35;
const TREE_PAINT_SPACING = 2.8;

const container = document.getElementById('canvas-container');
const statusEl = document.getElementById('debug-status');
const outputEl = document.getElementById('layout-output');
const saveButton = document.getElementById('save-layout');
const copyButton = document.getElementById('copy-layout');
const resetButton = document.getElementById('reset-layout');
const clearSavedButton = document.getElementById('clear-saved');
const rotationStepInput = document.getElementById('rotation-step');
const rotationStepValue = document.getElementById('rotation-step-value');
const paintModeButton = document.getElementById('paint-mode');
const selectModeButton = document.getElementById('select-mode');
const autosaveToggle = document.getElementById('autosave-toggle');

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

let layout = loadForestTreeLayout();
let selectedIndex = -1;
let editorMode = 'paint';
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
  return DEFAULT_FOREST_TREE_LAYOUT.map((item) => ({ ...item }));
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
  layout = saveForestTreeLayout(layout);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function refreshMarkers() {
  markerGroup.clear();

  layout.forEach((item, index) => {
    const { x, z } = worldFromLayout(item);
    const selected = index === selectedIndex;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(selected ? 0.9 : 0.65, selected ? 1.2 : 0.95, 28),
      new THREE.MeshBasicMaterial({
        color: selected ? 0xffc247 : 0x2e7a38,
        transparent: true,
        opacity: selected ? 0.95 : 0.68,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.12, z);
    markerGroup.add(ring);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(selected ? 0.12 : 0.08, selected ? 0.12 : 0.08, selected ? 1.4 : 1.0, 10),
      new THREE.MeshBasicMaterial({ color: selected ? 0xffc247 : 0x285d2f })
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
    setStatus(`Select mode. Tree ${selectedIndex + 1} at dx ${item.dx.toFixed(1)}, dz ${item.dz.toFixed(1)}, rot ${item.rotationY.toFixed(2)}.`);
  } else if (editorMode === 'paint') {
    setStatus(`Paint mode. ${layout.length} trees in layout. Click or drag to add many trees.`);
  } else {
    setStatus(`Select mode. ${layout.length} trees in layout. Click near a tree to move or remove it.`);
  }
}

function findNearestTreeIndex(worldX, worldZ, maxDistance = TREE_SELECT_RADIUS) {
  let nearestIndex = -1;
  let nearestDistSq = maxDistance * maxDistance;

  layout.forEach((item, index) => {
    const { x, z } = worldFromLayout(item);
    const dx = worldX - x;
    const dz = worldZ - z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= nearestDistSq) {
      nearestDistSq = distSq;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function addTreeAt(worldX, worldZ) {
  if (findNearestTreeIndex(worldX, worldZ, TREE_PAINT_SPACING * 0.8) >= 0) return false;

  layout.push({
    dx: Number((worldX - PARK_CENTER_X).toFixed(1)),
    dz: Number((worldZ - PARK_CENTER_Z).toFixed(1)),
    rotationY: 0
  });

  selectedIndex = editorMode === 'select' ? layout.length - 1 : -1;
  syncForest();
  return true;
}

function moveSelectedTree(worldX, worldZ) {
  if (selectedIndex < 0 || !layout[selectedIndex]) return;
  layout[selectedIndex] = {
    ...layout[selectedIndex],
    dx: Number((worldX - PARK_CENTER_X).toFixed(1)),
    dz: Number((worldZ - PARK_CENTER_Z).toFixed(1))
  };
  syncForest();
}

function removeTreeAt(index) {
  if (index < 0 || index >= layout.length) return;
  layout.splice(index, 1);
  if (selectedIndex === index) selectedIndex = -1;
  else if (selectedIndex > index) selectedIndex -= 1;
  syncForest('Tree removed.');
}

function rotateSelectedTree() {
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

function maybePaintTree(point) {
  if (!point) return;
  if (lastPaintPoint && lastPaintPoint.distanceTo(point) < TREE_PAINT_SPACING) return;
  if (addTreeAt(point.x, point.z)) lastPaintPoint = point.clone();
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = { x: event.clientX, y: event.clientY };

  if (editorMode !== 'paint' || event.button !== 0) return;
  isPainting = true;
  lastPaintPoint = null;
  maybePaintTree(intersectGround(event));
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!isPainting || editorMode !== 'paint') return;
  maybePaintTree(intersectGround(event));
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

  const nearestIndex = findNearestTreeIndex(point.x, point.z);

  if (event.shiftKey) {
    if (nearestIndex >= 0) removeTreeAt(nearestIndex);
    return;
  }

  if (nearestIndex >= 0) {
    selectedIndex = nearestIndex;
    syncForest();
    return;
  }

  if (selectedIndex >= 0) {
    moveSelectedTree(point.x, point.z);
    return;
  }

  addTreeAt(point.x, point.z);
});

renderer.domElement.addEventListener('pointerleave', () => {
  isPainting = false;
  lastPaintPoint = null;
  pointerDown = null;
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR') {
    rotateSelectedTree();
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

autosaveToggle.addEventListener('change', () => {
  if (autosaveToggle.checked) {
    layout = saveForestTreeLayout(layout);
    setStatus('Auto-save is on. New edits will update the map live.');
  } else {
    setStatus('Auto-save is off. Use Save To Map when you want to push changes.');
  }
});

saveButton.addEventListener('click', () => {
  layout = saveForestTreeLayout(layout);
  forestController.setLayout(layout);
  updateOutput();
  setStatus('Saved to the map. You can keep placing trees right away.');
});

copyButton.addEventListener('click', async () => {
  const text = layoutToCode(layout);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Tree layout code copied to clipboard.');
  } catch (e) {
    outputEl.focus();
    outputEl.select();
    setStatus('Clipboard access was blocked, so the code has been selected for manual copy.');
  }
});

resetButton.addEventListener('click', () => {
  layout = cloneDefaultLayout();
  selectedIndex = -1;
  syncForest('Reset to the default forest layout.');
});

clearSavedButton.addEventListener('click', () => {
  clearForestTreeLayout();
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
syncForest();
animate();
