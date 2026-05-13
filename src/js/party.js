import { FRIEND_DEFS } from './friends.js';

export const PARTY_LAYOUT_STORAGE_KEY = 'tim-birthday-party-layout-v1';

export const PARK_CENTER_X = -18;
export const PARK_CENTER_Z = 12;
export const PARTY_CENTER_X = PARK_CENTER_X;
export const PARTY_CENTER_Z = PARK_CENTER_Z - 29;

export const PARTY_BALLOON_IDS = Object.freeze([
  'balloons1',
  'balloons2',
  'balloons3',
  'balloons4',
  'balloons5'
]);

function round(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
}

function makePlacement(id, label, kind, x, y, z, rotationY = 0, scale = 1) {
  return {
    id,
    label,
    kind,
    defaultPlacement: {
      id,
      x: round(x),
      y: round(y),
      z: round(z),
      rotationY: round(rotationY, 4),
      scale: round(scale, 2)
    }
  };
}

const FIXED_PARTY_LAYOUT = Object.freeze([
  {
    id: "table",
    x: -17.5,
    y: 0.5,
    z: -17.3,
    rotationY: 7.4351,
    scale: 1.65
  },
  {
    id: 'balloons1',
    x: -15.2,
    y: 0,
    z: -18,
    rotationY: 0.3,
    scale: 1
  },
  {
    id: 'balloons2',
    x: -18.8,
    y: 0,
    z: -21.9,
    rotationY: 1.5567,
    scale: 1
  },
  {
    id: 'balloons3',
    x: -15.7,
    y: 0,
    z: -21.3,
    rotationY: 2.8133,
    scale: 1
  },
  {
    id: 'balloons4',
    x: -20.8,
    y: 0,
    z: -19.1,
    rotationY: 4.0699,
    scale: 1
  },
  {
    id: 'balloons5',
    x: -20.8,
    y: 0,
    z: -15,
    rotationY: 5.3265,
    scale: 1
  },
  {
    id: 'tim',
    x: -18,
    y: 0,
    z: -19,
    rotationY: 10.9956,
    scale: 1
  },
  {
    id: 'friend1',
    x: -17.2,
    y: 0,
    z: -19.5,
    rotationY: 4.4855,
    scale: 1
  },
  {
    id: 'friend2',
    x: -18.4,
    y: 0,
    z: -20.1,
    rotationY: 4.7124,
    scale: 1
  },
  {
    id: 'friend3',
    x: -19,
    y: 0,
    z: -19,
    rotationY: 4.9916,
    scale: 1
  },
  {
    id: 'friend4',
    x: -16.7,
    y: 0,
    z: -20.4,
    rotationY: 10.7338,
    scale: 1
  },
  {
    id: 'friend5',
    x: -17.6,
    y: 0,
    z: -19.8,
    rotationY: 17.5406,
    scale: 1
  }
]);

function getPartyElementMeta(id) {
  if (id === 'table') return { label: 'Cake Table', kind: 'table' };
  const balloonIndex = PARTY_BALLOON_IDS.indexOf(id);
  if (balloonIndex >= 0) return { label: `Balloons ${balloonIndex + 1}`, kind: 'balloons' };
  if (id === 'tim') return { label: 'Party Tim', kind: 'participant' };
  const friend = FRIEND_DEFS.find((def) => def.id === id);
  if (friend) return { label: friend.name, kind: 'participant' };
  return { label: id, kind: 'participant' };
}

export const PARTY_ELEMENT_DEFS = Object.freeze(
  FIXED_PARTY_LAYOUT.map((placement) => {
    const meta = getPartyElementMeta(placement.id);
    return makePlacement(
      placement.id,
      meta.label,
      meta.kind,
      placement.x,
      placement.y,
      placement.z,
      placement.rotationY,
      placement.scale
    );
  })
);

const PARTY_DEF_BY_ID = new Map(PARTY_ELEMENT_DEFS.map((def) => [def.id, def]));

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (e) {
    return null;
  }
}

function numberOrFallback(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePartyPlacement(entry, fallback) {
  const source = entry && typeof entry === 'object' ? entry : {};
  return {
    id: fallback.id,
    x: numberOrFallback(source.x, fallback.x),
    y: numberOrFallback(source.y, fallback.y),
    z: numberOrFallback(source.z, fallback.z),
    rotationY: numberOrFallback(source.rotationY, fallback.rotationY),
    scale: Math.max(0.2, numberOrFallback(source.scale, fallback.scale || 1))
  };
}

export function getDefaultPartyLayout() {
  return PARTY_ELEMENT_DEFS.map((def) => ({ ...def.defaultPlacement }));
}

export function normalizePartyLayout(rawLayout) {
  const resolved = new Map();
  const list = Array.isArray(rawLayout)
    ? rawLayout
    : (rawLayout && typeof rawLayout === 'object')
      ? Object.values(rawLayout)
      : [];

  for (const entry of list) {
    const id = String(entry && entry.id || '');
    const def = PARTY_DEF_BY_ID.get(id);
    if (!def) continue;
    resolved.set(id, normalizePartyPlacement(entry, def.defaultPlacement));
  }

  return PARTY_ELEMENT_DEFS.map((def) => (
    resolved.get(def.id) || { ...def.defaultPlacement }
  ));
}

export function loadPartyLayout() {
  const storage = getStorage();
  if (!storage) return getDefaultPartyLayout();

  try {
    const raw = storage.getItem(PARTY_LAYOUT_STORAGE_KEY);
    if (!raw) return getDefaultPartyLayout();
    return normalizePartyLayout(JSON.parse(raw));
  } catch (e) {
    return getDefaultPartyLayout();
  }
}

export function savePartyLayout(layout) {
  const storage = getStorage();
  const normalized = normalizePartyLayout(layout);

  if (storage) {
    try {
      storage.setItem(PARTY_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      // ignore persistence failures
    }
  }

  return normalized;
}

export function clearPartyLayout() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(PARTY_LAYOUT_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function getPartyElementDef(id) {
  return PARTY_DEF_BY_ID.get(String(id || '')) || null;
}

export function getPartyPlacement(layout, id) {
  const normalized = normalizePartyLayout(layout);
  const key = String(id || '');
  return normalized.find((entry) => entry.id === key) || null;
}

export function partyLayoutToCode(layout) {
  return `const PARTY_LAYOUT = ${JSON.stringify(normalizePartyLayout(layout), null, 2)};`;
}
