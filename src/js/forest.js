import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const FOREST_LAYOUT_STORAGE_KEY = 'tim-birthday-forest-layout-v2';
export const FOREST_TREE_STORAGE_KEY = FOREST_LAYOUT_STORAGE_KEY;
const FOREST_TREE_LEGACY_STORAGE_KEY = 'tim-birthday-forest-layout-v1';
const FOREST_BROADCAST_CHANNEL = 'tim-birthday-forest-layout';

export const FOREST_ITEM_TYPES = Object.freeze(['tree', 'grass', 'rock1', 'rock2', 'rock3']);

const FOREST_ASSET_DEFS = Object.freeze({
  tree: {
    variantAssets: {
      default: './models/Forest/tree.glb',
      snowy: './models/Forest/snowytree.glb'
    },
    height: 6.4
  },
  grass: {
    asset: './models/Forest/grass.glb',
    height: 0.4
  },
  rock1: {
    asset: './models/Forest/rock1.glb',
    height: 0.6
  },
  rock2: {
    asset: './models/Forest/rock2.glb',
    height: 1.4
  },
  rock3: {
    asset: './models/Forest/rock3.glb',
    height: 0.8
  }
});

export const DEFAULT_FOREST_LAYOUT = Object.freeze([
  { type: 'tree', dx: -15.2, dz: -28.4, rotationY: Math.PI * 0.18 },
  { type: 'grass', dx: -16.8, dz: -26.7, rotationY: Math.PI * 0.34 },
  { type: 'tree', dx: -9.7, dz: -26.1, rotationY: Math.PI * 1.22 },
  { type: 'rock2', dx: -7.4, dz: -27.7, rotationY: Math.PI * 0.41 },
  { type: 'tree', dx: -21.4, dz: -23.6, rotationY: Math.PI * 0.64 },
  { type: 'tree', dx: -4.9, dz: -24.7, rotationY: Math.PI * 1.54 },
  { type: 'rock3', dx: -2.8, dz: -25.9, rotationY: Math.PI * 0.72 },
  { type: 'tree', dx: -18.6, dz: -10.8, rotationY: Math.PI * 0.41 },
  { type: 'grass', dx: -20.5, dz: -9.1, rotationY: Math.PI * 0.68 },
  { type: 'tree', dx: -24.2, dz: -5.1, rotationY: Math.PI * 1.81 },
  { type: 'tree', dx: -19.8, dz: 2.3, rotationY: Math.PI * 1.09 },
  { type: 'rock2', dx: -17.2, dz: 2.8, rotationY: Math.PI * 0.57 },
  { type: 'tree', dx: -25.4, dz: 6.7, rotationY: Math.PI * 0.73 },
  { type: 'tree', dx: -18.1, dz: 16.2, rotationY: Math.PI * 1.37 },
  { type: 'rock3', dx: -20.4, dz: 17.7, rotationY: Math.PI * 0.29 },
  { type: 'tree', dx: -10.4, dz: 20.5, rotationY: Math.PI * 0.92 },
  { type: 'tree', dx: -22.8, dz: 12.8, rotationY: Math.PI * 1.67 },
  { type: 'rock1', dx: -24.9, dz: 12.0, rotationY: Math.PI * 0.44 },
  { type: 'tree', dx: -6.7, dz: 24.1, rotationY: Math.PI * 0.28 },
  { type: 'grass', dx: -5.0, dz: 25.7, rotationY: Math.PI * 1.26 }
]);

export const DEFAULT_FOREST_TREE_LAYOUT = Object.freeze(
  DEFAULT_FOREST_LAYOUT.filter((item) => item.type === 'tree').map((item) => ({
    dx: item.dx,
    dz: item.dz,
    rotationY: item.rotationY
  }))
);

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
    return new window.BroadcastChannel(FOREST_BROADCAST_CHANNEL);
  } catch (e) {
    return null;
  }
}

function cloneLayout(layout = DEFAULT_FOREST_LAYOUT) {
  return layout.map((item) => ({
    type: FOREST_ITEM_TYPES.includes(item.type) ? item.type : 'tree',
    dx: Number(item.dx) || 0,
    dz: Number(item.dz) || 0,
    rotationY: Number(item.rotationY) || 0
  }));
}

export function normalizeForestLayout(layout) {
  if (!Array.isArray(layout)) return cloneLayout(DEFAULT_FOREST_LAYOUT);
  return layout
    .map((item) => {
      const type = item && FOREST_ITEM_TYPES.includes(item.type) ? item.type : 'tree';
      return {
        type,
        dx: Number(item && item.dx),
        dz: Number(item && item.dz),
        rotationY: Number(item && item.rotationY)
      };
    })
    .filter((item) => Number.isFinite(item.dx) && Number.isFinite(item.dz) && Number.isFinite(item.rotationY));
}

export function normalizeForestTreeLayout(layout) {
  return normalizeForestLayout(layout).filter((item) => item.type === 'tree').map((item) => ({
    dx: item.dx,
    dz: item.dz,
    rotationY: item.rotationY
  }));
}

function loadLegacyTreeLayout(storage) {
  try {
    const raw = storage.getItem(FOREST_TREE_LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const trees = normalizeForestTreeLayout(parsed);
    if (!trees.length) return null;
    return trees.map((item) => ({ type: 'tree', ...item }));
  } catch (e) {
    return null;
  }
}

export function loadForestLayout() {
  const storage = getStorage();
  if (!storage) return cloneLayout(DEFAULT_FOREST_LAYOUT);

  try {
    const raw = storage.getItem(FOREST_LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeForestLayout(parsed);
      if (normalized.length) return normalized;
    }
  } catch (e) {
    // fall through to legacy/default
  }

  const legacy = loadLegacyTreeLayout(storage);
  if (legacy && legacy.length) return legacy;
  return cloneLayout(DEFAULT_FOREST_LAYOUT);
}

export function loadForestTreeLayout() {
  return normalizeForestTreeLayout(loadForestLayout());
}

function broadcastLayout(layout) {
  const channel = getBroadcastChannel();
  if (!channel) return;
  try {
    channel.postMessage({ type: 'forest-layout-saved', layout });
    channel.close();
  } catch (e) {
    console.warn('Failed to broadcast forest layout', e);
  }
}

export function saveForestLayout(layout) {
  const storage = getStorage();
  const normalized = normalizeForestLayout(layout);
  if (!storage) return normalized;

  try {
    storage.setItem(FOREST_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.warn('Failed to save forest layout', e);
  }

  broadcastLayout(normalized);
  return normalized;
}

export function saveForestTreeLayout(layout) {
  const treesOnly = normalizeForestTreeLayout(layout).map((item) => ({ type: 'tree', ...item }));
  return saveForestLayout(treesOnly);
}

export function clearForestLayout() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(FOREST_LAYOUT_STORAGE_KEY);
    storage.removeItem(FOREST_TREE_LEGACY_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear forest layout', e);
  }
}

export function clearForestTreeLayout() {
  clearForestLayout();
}

export function layoutToCode(layout, indent = '  ') {
  const normalized = normalizeForestLayout(layout);
  return `const forestPlacements = [\n${normalized.map((item) => `${indent}{ type: '${item.type}', dx: ${item.dx.toFixed(1)}, dz: ${item.dz.toFixed(1)}, rotationY: ${item.rotationY.toFixed(4)} }`).join(',\n')}\n];`;
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

function tuneMaterials(model) {
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

function createPlacedItem(parent, baseModel, type, config = {}) {
  const assetDef = FOREST_ASSET_DEFS[type];
  if (!assetDef || !baseModel) return;
  const item = baseModel.clone(true);
  enableShadows(item);
  const box = scaleModelToHeight(item, assetDef.height);
  placeModelOnGround(item, box);
  item.position.set(Number(config.x) || 0, 0, Number(config.z) || 0);
  item.rotation.y = Number(config.rotationY) || 0;
  parent.add(item);
  return item;
}

export function buildForestPlacements(parkCx, parkCz, layout = DEFAULT_FOREST_LAYOUT) {
  return normalizeForestLayout(layout).map((item) => ({
    type: item.type,
    x: parkCx + item.dx,
    z: parkCz + item.dz,
    rotationY: item.rotationY
  }));
}

export function buildForestTreePlacements(parkCx, parkCz, layout = DEFAULT_FOREST_LAYOUT) {
  return buildForestPlacements(parkCx, parkCz, layout).filter((item) => item.type === 'tree');
}

export function createForestZone(scene, parkCx, parkCz, options = {}) {
  const group = new THREE.Group();
  group.name = 'forest-zone';
  scene.add(group);

  const loader = new GLTFLoader();
  const assetBases = new Map();
  let currentTreeVariant = options.variant === 'snowy' ? 'snowy' : 'default';
  let disposed = false;
  let currentLayout = normalizeForestLayout(
    options.layout || (options.preferStored === false ? DEFAULT_FOREST_LAYOUT : loadForestLayout())
  );
  const shouldSyncWithSavedLayout = options.syncWithSavedLayout !== false && options.preferStored !== false;

  const onStorageChange = (event) => {
    if (disposed) return;
    if (!event || event.key !== FOREST_LAYOUT_STORAGE_KEY) return;
    currentLayout = loadForestLayout();
    render();
  };

  const broadcastChannel = shouldSyncWithSavedLayout ? getBroadcastChannel() : null;
  const onBroadcastMessage = (event) => {
    if (disposed) return;
    const data = event && event.data;
    if (!data || data.type !== 'forest-layout-saved') return;
    currentLayout = normalizeForestLayout(data.layout);
    render();
  };

  if (shouldSyncWithSavedLayout && typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', onStorageChange);
  }
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onBroadcastMessage);
  }

  function assetKeyForType(type) {
    return type === 'tree' ? `tree:${currentTreeVariant}` : type;
  }

  function assetPathForKey(key) {
    if (key.startsWith('tree:')) {
      const variant = key.slice(5);
      return FOREST_ASSET_DEFS.tree.variantAssets[variant] || FOREST_ASSET_DEFS.tree.variantAssets.default;
    }
    return FOREST_ASSET_DEFS[key] && FOREST_ASSET_DEFS[key].asset;
  }

  function ensureAssetLoaded(key) {
    if (assetBases.has(key)) return assetBases.get(key);

    assetBases.set(key, null);
    const assetPath = assetPathForKey(key);
    if (!assetPath) return null;

    loader.load(assetPath, (gltf) => {
      if (disposed) return;
      const base = gltf.scene;
      smoothModelShading(base);
      tuneMaterials(base);
      assetBases.set(key, base);
      render();
    }, undefined, (err) => {
      console.warn(`Failed to load forest asset ${key}`, err);
    });

    return null;
  }

  function render() {
    group.clear();
    const placements = buildForestPlacements(parkCx, parkCz, currentLayout);
    placements.forEach((placement) => {
      const key = assetKeyForType(placement.type);
      const base = ensureAssetLoaded(key);
      if (!base) return;
      createPlacedItem(group, base, placement.type, placement);
    });
  }

  render();

  return {
    group,
    getLayout() {
      return cloneLayout(currentLayout);
    },
    setLayout(layout) {
      currentLayout = normalizeForestLayout(layout);
      render();
    },
    resetToDefault() {
      currentLayout = cloneLayout(DEFAULT_FOREST_LAYOUT);
      render();
    },
    save() {
      currentLayout = saveForestLayout(currentLayout);
      render();
      return cloneLayout(currentLayout);
    },
    clearSaved() {
      clearForestLayout();
    },
    toCode() {
      return layoutToCode(currentLayout);
    },
    setVariant(variantName) {
      currentTreeVariant = variantName === 'snowy' ? 'snowy' : 'default';
      ensureAssetLoaded(assetKeyForType('tree'));
      render();
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
