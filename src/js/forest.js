import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const FOREST_TREE_STORAGE_KEY = 'tim-birthday-forest-layout-v1';
export const FOREST_TREE_HEIGHT = 6.4;
const FOREST_TREE_BROADCAST_CHANNEL = 'tim-birthday-forest-layout';

export const DEFAULT_FOREST_TREE_LAYOUT = Object.freeze([
  { dx: -15.2, dz: -28.4, rotationY: Math.PI * 0.18 },
  { dx: -9.7, dz: -26.1, rotationY: Math.PI * 1.22 },
  { dx: -21.4, dz: -23.6, rotationY: Math.PI * 0.64 },
  { dx: -4.9, dz: -24.7, rotationY: Math.PI * 1.54 },
  { dx: -18.6, dz: -10.8, rotationY: Math.PI * 0.41 },
  { dx: -24.2, dz: -5.1, rotationY: Math.PI * 1.81 },
  { dx: -19.8, dz: 2.3, rotationY: Math.PI * 1.09 },
  { dx: -25.4, dz: 6.7, rotationY: Math.PI * 0.73 },
  { dx: -18.1, dz: 16.2, rotationY: Math.PI * 1.37 },
  { dx: -10.4, dz: 20.5, rotationY: Math.PI * 0.92 },
  { dx: -22.8, dz: 12.8, rotationY: Math.PI * 1.67 },
  { dx: -6.7, dz: 24.1, rotationY: Math.PI * 0.28 }
]);

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

function getBroadcastChannel() {
  try {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') return null;
    return new window.BroadcastChannel(FOREST_TREE_BROADCAST_CHANNEL);
  } catch (e) {
    return null;
  }
}

function cloneLayout(layout = DEFAULT_FOREST_TREE_LAYOUT) {
  return layout.map((item) => ({
    dx: Number(item.dx) || 0,
    dz: Number(item.dz) || 0,
    rotationY: Number(item.rotationY) || 0
  }));
}

export function normalizeForestTreeLayout(layout) {
  if (!Array.isArray(layout)) return cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);
  return layout
    .map((item) => ({
      dx: Number(item && item.dx),
      dz: Number(item && item.dz),
      rotationY: Number(item && item.rotationY)
    }))
    .filter((item) => Number.isFinite(item.dx) && Number.isFinite(item.dz) && Number.isFinite(item.rotationY));
}

export function loadForestTreeLayout() {
  const storage = getStorage();
  if (!storage) return cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);

  try {
    const raw = storage.getItem(FOREST_TREE_STORAGE_KEY);
    if (!raw) return cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);
    const parsed = JSON.parse(raw);
    const normalized = normalizeForestTreeLayout(parsed);
    return normalized.length ? normalized : cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);
  } catch (e) {
    return cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);
  }
}

export function saveForestTreeLayout(layout) {
  const storage = getStorage();
  const normalized = normalizeForestTreeLayout(layout);
  if (!storage) return normalized;

  try {
    storage.setItem(FOREST_TREE_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Failed to save forest tree layout', e);
  }

  const channel = getBroadcastChannel();
  if (channel) {
    try {
      channel.postMessage({ type: 'forest-layout-saved', layout: normalized });
      channel.close();
    } catch (e) {
      console.warn('Failed to broadcast forest tree layout', e);
    }
  }

  return normalized;
}

export function clearForestTreeLayout() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(FOREST_TREE_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear forest tree layout', e);
  }
}

export function layoutToCode(layout, indent = '  ') {
  const normalized = normalizeForestTreeLayout(layout);
  return `const treePlacements = [\n${normalized.map((item) => `${indent}{ dx: ${item.dx.toFixed(1)}, dz: ${item.dz.toFixed(1)}, rotationY: ${item.rotationY.toFixed(4)} }`).join(',\n')}\n];`;
}

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
      console.warn('Smoothing attempt failed on forest mesh', node, e);
    }
  });
}

function tuneTreeMaterials(model) {
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      material.vertexColors = false;
      material.side = THREE.DoubleSide;
      material.transparent = false;
      if (material.emissive) material.emissive.set(0x000000);
      material.needsUpdate = true;
    });
  });
}

function createPlacedTree(parent, baseTree, config = {}) {
  const tree = baseTree.clone(true);
  enableShadows(tree);
  const box = scaleModelToHeight(tree, FOREST_TREE_HEIGHT);
  placeModelOnGround(tree, box);
  tree.position.set(Number(config.x) || 0, 0, Number(config.z) || 0);
  tree.rotation.y = Number(config.rotationY) || 0;
  parent.add(tree);
  return tree;
}

export function buildForestTreePlacements(parkCx, parkCz, layout = DEFAULT_FOREST_TREE_LAYOUT) {
  return normalizeForestTreeLayout(layout).map((item) => ({
    x: parkCx + item.dx,
    z: parkCz + item.dz,
    rotationY: item.rotationY
  }));
}

export function createForestZone(scene, parkCx, parkCz, options = {}) {
  const group = new THREE.Group();
  group.name = 'forest-zone';
  scene.add(group);

  const loader = new GLTFLoader();
  let treeBase = null;
  let disposed = false;
  let currentLayout = normalizeForestTreeLayout(
    options.layout || (options.preferStored === false ? DEFAULT_FOREST_TREE_LAYOUT : loadForestTreeLayout())
  );
  const shouldSyncWithSavedLayout = options.syncWithSavedLayout !== false && options.preferStored !== false;

  const onStorageChange = (event) => {
    if (disposed) return;
    if (!event || event.key !== FOREST_TREE_STORAGE_KEY) return;
    currentLayout = loadForestTreeLayout();
    render();
  };

  const broadcastChannel = shouldSyncWithSavedLayout ? getBroadcastChannel() : null;
  const onBroadcastMessage = (event) => {
    if (disposed) return;
    const data = event && event.data;
    if (!data || data.type !== 'forest-layout-saved') return;
    currentLayout = normalizeForestTreeLayout(data.layout);
    render();
  };

  if (shouldSyncWithSavedLayout && typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', onStorageChange);
  }
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onBroadcastMessage);
  }

  function render() {
    group.clear();
    if (!treeBase) return;

    const placements = buildForestTreePlacements(parkCx, parkCz, currentLayout);
    placements.forEach((placement) => {
      createPlacedTree(group, treeBase, placement);
    });
  }

  loader.load('./models/Forest/tree.glb', (gltf) => {
    treeBase = gltf.scene;
    smoothModelShading(treeBase);
    tuneTreeMaterials(treeBase);
    render();
  }, undefined, (err) => {
    console.warn('Failed to load forest tree.glb', err);
  });

  return {
    group,
    getLayout() {
      return cloneLayout(currentLayout);
    },
    setLayout(layout) {
      currentLayout = normalizeForestTreeLayout(layout);
      render();
    },
    resetToDefault() {
      currentLayout = cloneLayout(DEFAULT_FOREST_TREE_LAYOUT);
      render();
    },
    save() {
      currentLayout = saveForestTreeLayout(currentLayout);
      render();
      return cloneLayout(currentLayout);
    },
    clearSaved() {
      clearForestTreeLayout();
    },
    toCode() {
      return layoutToCode(currentLayout);
    },
    dispose() {
      disposed = true;
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('storage', onStorageChange);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', onBroadcastMessage);
        broadcastChannel.close();
      }
    }
  };
}
