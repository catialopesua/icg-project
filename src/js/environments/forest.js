import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const FOREST_LAYOUT_STORAGE_KEY = 'tim-birthday-forest-layout-v2';
export const FOREST_TREE_STORAGE_KEY = FOREST_LAYOUT_STORAGE_KEY;
const FOREST_TREE_LEGACY_STORAGE_KEY = 'tim-birthday-forest-layout-v1';
const FOREST_BROADCAST_CHANNEL = 'tim-birthday-forest-layout';

export const FOREST_ITEM_TYPES = Object.freeze(['tree', 'grass', 'rock1', 'rock2', 'rock3', 'trafficcone']);

const FOREST_ASSET_DEFS = Object.freeze({
  tree: {
    variantAssets: {
      default: './models/downloaded/Forest/tree.glb',
      snowy: './models/downloaded/Forest/snowytree.glb'
    },
    height: 6.4
  },
  grass: {
    asset: './models/downloaded/Forest/grass.glb',
    height: 0.4
  },
  rock1: {
    asset: './models/downloaded/Forest/rock1.glb',
    height: 0.6
  },
  rock2: {
    asset: './models/downloaded/Forest/rock2.glb',
    height: 1.4
  },
  rock3: {
    asset: './models/downloaded/Forest/rock3.glb',
    height: 0.8
  },
    trafficcone: {
    asset: './models/blender/City/streetcone.glb',
    height: 0.6
  }
});

export const DEFAULT_FOREST_LAYOUT = Object.freeze([
  { type: 'tree', dx: -3.0, dz: -39.1, rotationY: 0.0000 },
  { type: 'tree', dx: -16.5, dz: 0.8, rotationY: 0.0000 },
  { type: 'tree', dx: 19.7, dz: -18.7, rotationY: 0.0000 },
  { type: 'tree', dx: -12.4, dz: -4.8, rotationY: 0.0000 },
  { type: 'tree', dx: -19.4, dz: -8.4, rotationY: 0.0000 },
  { type: 'tree', dx: -19.0, dz: -46.5, rotationY: 0.0000 },
  { type: 'tree', dx: -11.9, dz: -50.7, rotationY: 0.0000 },
  { type: 'tree', dx: -10.5, dz: -38.6, rotationY: 0.0000 },
  { type: 'tree', dx: -17.3, dz: -30.2, rotationY: 0.0000 },
  { type: 'tree', dx: -11.2, dz: -30.3, rotationY: 0.0000 },
  { type: 'tree', dx: -19.1, dz: -20.6, rotationY: 0.0000 },
  { type: 'tree', dx: -11.3, dz: -17.6, rotationY: 0.0000 },
  { type: 'tree', dx: -13.6, dz: -10.9, rotationY: 0.0000 },
  { type: 'tree', dx: -8.8, dz: -24.6, rotationY: 0.0000 },
  { type: 'tree', dx: -7.6, dz: -8.7, rotationY: 0.0000 },
  { type: 'tree', dx: -4.7, dz: -21.0, rotationY: 0.0000 },
  { type: 'tree', dx: 4.5, dz: -24.8, rotationY: 0.0000 },
  { type: 'tree', dx: -4.6, dz: -32.6, rotationY: 0.0000 },
  { type: 'tree', dx: -0.9, dz: -45.8, rotationY: 0.0000 },
  { type: 'tree', dx: 11.0, dz: -48.8, rotationY: 0.0000 },
  { type: 'tree', dx: 14.4, dz: -38.3, rotationY: 0.0000 },
  { type: 'tree', dx: -9.7, dz: -45.7, rotationY: 0.0000 },
  { type: 'tree', dx: 5.8, dz: -38.1, rotationY: 0.0000 },
  { type: 'tree', dx: 55.6, dz: -46.7, rotationY: 0.0000 },
  { type: 'tree', dx: 49.8, dz: -50.7, rotationY: 0.0000 },
  { type: 'tree', dx: 42.2, dz: -46.4, rotationY: 0.0000 },
  { type: 'tree', dx: 34.4, dz: -50.4, rotationY: 0.0000 },
  { type: 'tree', dx: 24.5, dz: -46.5, rotationY: 0.0000 },
  { type: 'tree', dx: 19.7, dz: -50.7, rotationY: 0.0000 },
  { type: 'tree', dx: 57.8, dz: -51.4, rotationY: 0.0000 },
  { type: 'tree', dx: 3.8, dz: -50.2, rotationY: 0.0000 },
  { type: 'tree', dx: 8.7, dz: -41.8, rotationY: 0.0000 },
  { type: 'tree', dx: -19.3, dz: -37.1, rotationY: 0.0000 },
  { type: 'tree', dx: 18.1, dz: -42.6, rotationY: 0.0000 },
  { type: 'tree', dx: 19.4, dz: -32.0, rotationY: 0.0000 },
  { type: 'tree', dx: 9.8, dz: -29.1, rotationY: 0.0000 },
  { type: 'tree', dx: 19.3, dz: -24.1, rotationY: 0.0000 },
  { type: 'tree', dx: 11.8, dz: -19.0, rotationY: 0.0000 },
  { type: 'tree', dx: 14.0, dz: -27.1, rotationY: 0.0000 },
  { type: 'tree', dx: 10.3, dz: -35.9, rotationY: 0.0000 },
  { type: 'tree', dx: 19.8, dz: -13.8, rotationY: 0.0000 },
  { type: 'tree', dx: 9.7, dz: -8.4, rotationY: 0.0000 },
  { type: 'tree', dx: -14.5, dz: -41.4, rotationY: 0.0000 },
  { type: 'tree', dx: 11.2, dz: -13.8, rotationY: 0.0000 },
  { type: 'rock1', dx: 13.1, dz: -9.1, rotationY: 3.6651 },
  { type: 'rock2', dx: 15.8, dz: -15.1, rotationY: 2.4434 },
  { type: 'rock3', dx: 18.7, dz: -9.1, rotationY: 3.6651 },
  { type: 'rock1', dx: -20.9, dz: 8.0, rotationY: 0.0000 },
  { type: 'rock2', dx: -13.1, dz: 6.2, rotationY: 2.4434 },
  { type: 'rock2', dx: -18.9, dz: 2.8, rotationY: 2.4434 },
  { type: 'rock2', dx: -17.8, dz: -5.6, rotationY: 0.0000 },
  { type: 'rock1', dx: -16.6, dz: 4.4, rotationY: 4.8868 },
  { type: 'rock1', dx: -18.8, dz: -17.2, rotationY: 5.4978 },
  { type: 'rock1', dx: -14.2, dz: -22.4, rotationY: 2.2689 },
  { type: 'rock1', dx: 15.3, dz: -33.9, rotationY: 3.6651 },
  { type: 'rock1', dx: 11.2, dz: -22.9, rotationY: 0.0000 },
  { type: 'rock1', dx: -5.3, dz: -45.3, rotationY: 2.4434 },
  { type: 'rock2', dx: -16.8, dz: -38.9, rotationY: 3.6651 },
  { type: 'rock2', dx: -16.9, dz: -23.0, rotationY: 1.8327 },
  { type: 'rock2', dx: 15.6, dz: -47.7, rotationY: 3.6651 },
  { type: 'rock3', dx: 4.1, dz: -45.9, rotationY: 0.0000 },
  { type: 'rock3', dx: -17.6, dz: -51.0, rotationY: 0.0000 },
  { type: 'rock3', dx: -10.6, dz: -12.3, rotationY: 0.0000 },
  { type: 'rock1', dx: -1.4, dz: -50.5, rotationY: 0.0000 },
  { type: 'rock2', dx: -13.5, dz: -46.0, rotationY: 0.0000 },
  { type: 'rock2', dx: -8.3, dz: -50.4, rotationY: 6.1085 },
  { type: 'rock2', dx: 9.2, dz: -45.4, rotationY: 0.0000 },
  { type: 'rock2', dx: 0.1, dz: -40.3, rotationY: 3.6651 },
  { type: 'rock1', dx: -20.6, dz: -31.9, rotationY: 4.8868 },
  { type: 'rock1', dx: -14.2, dz: -34.3, rotationY: 2.4434 },
  { type: 'grass', dx: -20.5, dz: -15.6, rotationY: 0.0000 },
  { type: 'grass', dx: -15.5, dz: -18.0, rotationY: 0.0000 },
  { type: 'grass', dx: -17.0, dz: -12.4, rotationY: 0.0000 },
  { type: 'grass', dx: -14.9, dz: -7.6, rotationY: 4.8868 },
  { type: 'grass', dx: -19.2, dz: -2.8, rotationY: 2.4434 },
  { type: 'grass', dx: -21.4, dz: -1.2, rotationY: 0.0000 },
  { type: 'grass', dx: -12.7, dz: 2.2, rotationY: 2.4434 },
  { type: 'grass', dx: -9.5, dz: -1.0, rotationY: 2.4434 },
  { type: 'grass', dx: -8.1, dz: -18.6, rotationY: 0.0000 },
  { type: 'grass', dx: -14.3, dz: -27.6, rotationY: 0.0000 },
  { type: 'grass', dx: -19.6, dz: -26.8, rotationY: 0.0000 },
  { type: 'grass', dx: -21.0, dz: -42.3, rotationY: 0.0000 },
  { type: 'grass', dx: -20.8, dz: -50.0, rotationY: 3.6651 },
  { type: 'grass', dx: -6.0, dz: -49.8, rotationY: 0.0000 },
  { type: 'grass', dx: 31.9, dz: 0.0, rotationY: 4.8868 },
  { type: 'grass', dx: 7.6, dz: -26.2, rotationY: 0.0000 },
  { type: 'grass', dx: 15.9, dz: -19.4, rotationY: 3.6651 },
  { type: 'grass', dx: 14.5, dz: -12.3, rotationY: 4.8868 },
  { type: 'grass', dx: 8.1, dz: -12.6, rotationY: 0.0000 },
  { type: 'grass', dx: 8.6, dz: -16.8, rotationY: 1.2217 },
  { type: 'grass', dx: 8.3, dz: -20.9, rotationY: 3.6651 },
  { type: 'grass', dx: 18.1, dz: -38.1, rotationY: 0.0000 },
  { type: 'grass', dx: 7.3, dz: -33.0, rotationY: 0.0000 },
  { type: 'grass', dx: 12.8, dz: -43.1, rotationY: 2.4434 },
  { type: 'grass', dx: 15.1, dz: -44.9, rotationY: 4.8868 },
  { type: 'grass', dx: 4.9, dz: -43.0, rotationY: 2.4434 },
  { type: 'grass', dx: 1.0, dz: -43.1, rotationY: 3.6651 },
  { type: 'grass', dx: -7.0, dz: -37.0, rotationY: 0.0000 },
  { type: 'grass', dx: -8.9, dz: -33.4, rotationY: 0.0000 },
  { type: 'grass', dx: -14.6, dz: -48.1, rotationY: 0.0000 },
  { type: 'grass', dx: -8.8, dz: -2.8, rotationY: 3.6651 },
  { type: 'grass', dx: -8.6, dz: -14.9, rotationY: 0.0000 },
  { type: 'grass', dx: -11.1, dz: -8.5, rotationY: 0.0000 },
  { type: 'grass', dx: -10.3, dz: 5.0, rotationY: 4.8868 },
  { type: 'grass', dx: -6.5, dz: 2.5, rotationY: 2.4434 },
  { type: 'grass', dx: -6.7, dz: 5.6, rotationY: 0.0000 },
  { type: 'grass', dx: -4.9, dz: 7.6, rotationY: 0.0000 },
  { type: 'grass', dx: -3.4, dz: 5.5, rotationY: 0.0000 },
  { type: 'grass', dx: -5.3, dz: 3.5, rotationY: 2.4434 },
  { type: 'grass', dx: -3.4, dz: 3.4, rotationY: 0.0000 },
  { type: 'grass', dx: -9.5, dz: 0.6, rotationY: 1.2217 },
  { type: 'grass', dx: -9.2, dz: 7.3, rotationY: 0.0000 },
  { type: 'grass', dx: -21.2, dz: -25.0, rotationY: 3.6651 },
  { type: 'grass', dx: -16.1, dz: 8.1, rotationY: 2.4434 },
  { type: 'grass', dx: -18.4, dz: 7.2, rotationY: 2.4434 },
  { type: 'grass', dx: -20.1, dz: 5.4, rotationY: 3.6651 },
  { type: 'grass', dx: -13.1, dz: -0.6, rotationY: 2.4434 },
  { type: 'grass', dx: -16.0, dz: -4.3, rotationY: 2.4434 },
  { type: 'grass', dx: -19.0, dz: -11.7, rotationY: 0.0000 },
  { type: 'grass', dx: 18.7, dz: -27.8, rotationY: 3.6651 },
  { type: 'grass', dx: 33.2, dz: 2.6, rotationY: 0.0000 },
  { type: 'grass', dx: 34.6, dz: 0.2, rotationY: 0.0000 },
  { type: 'grass', dx: 29.8, dz: 0.4, rotationY: 0.0000 },
  { type: 'grass', dx: 27.9, dz: 1.4, rotationY: 0.0000 },
  { type: 'grass', dx: 3.7, dz: 2.0, rotationY: 0.0000 },
  { type: 'grass', dx: 8.0, dz: 1.7, rotationY: 0.0000 },
  { type: 'grass', dx: 7.0, dz: -1.7, rotationY: 0.0000 },
  { type: 'grass', dx: 11.4, dz: -2.7, rotationY: 0.0000 },
  { type: 'grass', dx: 13.4, dz: -6.4, rotationY: 0.0000 },
  { type: 'grass', dx: 16.1, dz: -0.8, rotationY: 0.0000 },
  { type: 'grass', dx: 19.9, dz: -3.9, rotationY: 0.0000 },
  { type: 'grass', dx: 18.8, dz: 1.8, rotationY: 0.0000 },
  { type: 'grass', dx: 4.2, dz: -5.5, rotationY: 0.0000 },
  { type: 'grass', dx: -4.3, dz: -5.2, rotationY: 0.0000 },
  { type: 'grass', dx: -4.7, dz: -14.6, rotationY: 0.0000 },
  { type: 'grass', dx: 4.2, dz: -17.9, rotationY: 0.0000 },
  { type: 'grass', dx: 0.8, dz: -34.2, rotationY: 0.0000 },
  { type: 'grass', dx: 4.2, dz: -33.6, rotationY: 0.0000 },
  { type: 'grass', dx: 3.9, dz: -30.6, rotationY: 0.0000 },
  { type: 'grass', dx: -4.3, dz: -1.2, rotationY: 0.0000 },
  { type: 'grass', dx: 13.1, dz: 1.5, rotationY: 0.0000 },
  { type: 'grass', dx: 23.7, dz: 0.1, rotationY: 0.0000 },
  { type: 'grass', dx: 46.5, dz: 1.2, rotationY: 0.0000 },
  { type: 'grass', dx: 45.0, dz: 3.5, rotationY: 0.0000 },
  { type: 'grass', dx: 45.2, dz: 6.9, rotationY: 0.0000 },
  { type: 'grass', dx: 55.3, dz: 7.0, rotationY: 0.0000 },
  { type: 'grass', dx: 54.1, dz: 2.3, rotationY: 0.0000 },
  { type: 'grass', dx: 49.8, dz: 4.5, rotationY: 0.0000 },
  { type: 'grass', dx: 56.1, dz: -0.1, rotationY: 0.0000 },
  { type: 'tree', dx: 51.2, dz: 0.4, rotationY: 0.0000 },
  { type: 'tree', dx: 46.9, dz: 4.6, rotationY: 0.0000 },
  { type: 'tree', dx: 52.3, dz: 6.0, rotationY: 0.0000 },
  { type: 'rock3', dx: 56.1, dz: 4.9, rotationY: 0.0000 },
  { type: 'rock1', dx: 44.3, dz: 0.7, rotationY: 0.0000 },
  { type: 'rock1', dx: 48.0, dz: -0.4, rotationY: 0.0000 },
  { type: 'grass', dx: 28.9, dz: -39.2, rotationY: 0.0000 },
  { type: 'grass', dx: 28.8, dz: -45.6, rotationY: 0.0000 },
  { type: 'grass', dx: 38.6, dz: -50.3, rotationY: 0.0000 },
  { type: 'grass', dx: 44.2, dz: -48.9, rotationY: 0.0000 },
  { type: 'grass', dx: 24.3, dz: -50.4, rotationY: 0.0000 },
  { type: 'grass', dx: 21.9, dz: -38.0, rotationY: 0.0000 },
  { type: 'grass', dx: 52.6, dz: -37.9, rotationY: 0.0000 },
  { type: 'grass', dx: 46.1, dz: -37.7, rotationY: 0.0000 },
  { type: 'grass', dx: 44.3, dz: -29.1, rotationY: 0.0000 },
  { type: 'grass', dx: 43.9, dz: -22.9, rotationY: 0.0000 },
  { type: 'grass', dx: 29.2, dz: -22.8, rotationY: 0.0000 },
  { type: 'grass', dx: 29.1, dz: -28.4, rotationY: 0.0000 },
  { type: 'grass', dx: 46.3, dz: -8.3, rotationY: 0.0000 },
  { type: 'grass', dx: 44.0, dz: -9.6, rotationY: 0.0000 },
  { type: 'grass', dx: 29.1, dz: -7.9, rotationY: 0.0000 },
  { type: 'grass', dx: 29.1, dz: -10.0, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 22.5, dz: -6.2, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 22.5, dz: -4.7, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 22.5, dz: -2.9, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 57.3, dz: -6.2, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 57.3, dz: -4.3, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 57.0, dz: -2.2, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 58.0, dz: -35.6, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 57.9, dz: -34.1, rotationY: 0.0000 },
  { type: 'trafficcone', dx: 57.7, dz: -32.3, rotationY: 0.0000 },
  { type: 'grass', dx: 49.2, dz: -46.8, rotationY: 0.0000 },
  { type: 'grass', dx: 51.9, dz: -46.6, rotationY: 0.0000 },
  { type: 'grass', dx: 37.7, dz: -48.0, rotationY: 0.0000 },
  { type: 'grass', dx: 36.0, dz: -46.2, rotationY: 0.0000 },
  { type: 'grass', dx: 31.2, dz: -46.9, rotationY: 0.0000 },
  { type: 'grass', dx: 29.1, dz: -51.2, rotationY: 0.0000 }
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
  // For small decorative flora/rocks, mark as non-collidable so players can walk through them
  try {
    if (type === 'grass' || /^rock/i.test(type)) {
      item.userData = item.userData || {};
      item.userData.noCollision = true;
      item.traverse((n) => { if (n.isMesh) { n.userData = n.userData || {}; n.userData.noCollision = true; } });
    }
  } catch (e) {}

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
