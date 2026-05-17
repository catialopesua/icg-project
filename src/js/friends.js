// Friend definitions + persistence helpers shared by play mode and debug mode.

export const FRIEND_PLACEMENTS_STORAGE_KEY = 'tim-birthday-friend-placements-v1';
export const FRIEND_UNLOCKS_STORAGE_KEY = 'tim-birthday-friend-unlocks-v1';
export const TIM_PLACEMENT_STORAGE_KEY = 'tim-birthday-tim-placement-v1';
export const PLAYER_START_STORAGE_KEY = 'tim-birthday-player-start-v1';

const DEFAULT_TIM_PLACEMENT = Object.freeze({
  x: -16.3,
  y: 0,
  z: 13.7,
  rotationY: 4.7124
});

const DEFAULT_PLAYER_START = Object.freeze({
  x: -18,
  y: 0,
  z: 20,
  rotationY: 0
});

export const FRIEND_DEFS = Object.freeze([
  {
    id: 'friend1',
    fileName: 'friend1.glb',
    desiredHeight: 1.1,
    name: 'Hunter',
    description: "He’s quiet and a little reserved, with a subtle edge and an appreciation for the city’s energy",
    weatherId: 'rainy',
    weatherLabel: '🌧️ Rainy Day',
    image: 'images/friend1.png',
    dialogueLines: [
      'A party… at the park? Not really my thing...',
      'But for Tim… yeah, I’ll show up. Could be nice, I guess.'
    ],
    defaultPlacement: { x: 27.2, y: 0, z: -1.3, rotationY: 2.356194490192345 }
  },
  {
    id: 'friend2',
    fileName: 'friend2.glb',
    desiredHeight: 1.05,
    name: 'Allysa',
    description: "She’s upbeat and expressive, with a bright outlook and a soft spot for rainbows and anything colourful.",
    weatherId: 'rainbow',
    weatherLabel: '🌈 Rainbow Day',
    image: 'images/friend2.png',
    dialogueLines: [
      'A birthday party for Tim?! Oh my gosh, that sounds SO adorable!!',
      'I’m definitely coming!'
    ],
    defaultPlacement: { x: -10.8, y: 0, z: -33.7, rotationY: 11.205 }
  },
  {
    id: 'friend3',
    fileName: 'friend3.glb',
    desiredHeight: 1.08,
    name: 'Ben',
    description: "He’s playful and a bit goofy, with a carefree vibe and a love for long, sunny days at the beach.",
    weatherId: 'sunset',
    weatherLabel: '🌇 Sunset',
    image: 'images/friend3.png',
    dialogueLines: [
      'A birthday party at the park? Okay, that actually sounds awesome. I’m in!',
      'We better have snacks though, It’s not a real party otherwise.'
    ],
    defaultPlacement: { x: 17, y: 0, z: 36.7, rotationY: -1.0995574287564276 }
  },
  {
    id: 'friend4',
    fileName: 'friend4.glb',
    desiredHeight: 1.06,
    name: 'Evangeline',
    description: "She has a calm grace and a quiet fondness for snowy days and winter stillness.",
    weatherId: 'snowy',
    weatherLabel: '❄️ Snowy Day',
    image: 'images/friend4.png',
    dialogueLines: [
      'A birthday celebration in the park… how charming.',
      'There’s something quite special about open air and quiet surroundings. I would be more than happy to attend. It sounds like a lovely way to celebrate Tim.'
    ],
    defaultPlacement: { x: -33.1, y: 0, z: 2, rotationY: 4.782 }
  },
  {
    id: 'friend5',
    fileName: 'friend5.glb',
    desiredHeight: 1.02,
    name: 'Astro',
    description: "He’s chaotic and wildly unpredictable, running on pure impulse with zero filter and a dangerously low attention span, somehow turning every moment into loud, ridiculous energy.",
    // NOTE: you didn't specify Astro's weather unlock, so we default to Northern Lights.
    weatherId: 'northern-lights',
    weatherLabel: '🌌 Northern Lights',
    image: 'images/friend5.png',
    dialogueLines: [
      'A PARTY IN THE PARK?? wait wait wait that’s actually insane. like outside?? grass?? sky??',
      'bro I’m already going. I’m bringing chaos. I might climb something. I might yell. this is gonna be SO FUN'
    ],
    defaultPlacement: { x: 21, y: 14.4, z: -28.2, rotationY: 12.0952 }
  }
]);

const FRIEND_BY_ID = new Map(FRIEND_DEFS.map((def) => [def.id, def]));

function getStorage() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
}

export function getFriendDef(friendId) {
  return FRIEND_BY_ID.get(String(friendId || '')) || null;
}

export function getDefaultFriendPlacements() {
  return FRIEND_DEFS.map((def) => ({
    id: def.id,
    x: Number(def.defaultPlacement && def.defaultPlacement.x) || 0,
    y: Number(def.defaultPlacement && def.defaultPlacement.y) || 0,
    z: Number(def.defaultPlacement && def.defaultPlacement.z) || 0,
    rotationY: Number(def.defaultPlacement && def.defaultPlacement.rotationY) || 0
  }));
}

function numberOrFallback(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWorldPlacement(rawPlacement, fallbackPlacement) {
  const fallback = fallbackPlacement || {};
  const source = rawPlacement && typeof rawPlacement === 'object' ? rawPlacement : {};

  return {
    x: numberOrFallback(source.x, numberOrFallback(fallback.x, 0)),
    y: numberOrFallback(source.y, numberOrFallback(fallback.y, 0)),
    z: numberOrFallback(source.z, numberOrFallback(fallback.z, 0)),
    rotationY: numberOrFallback(source.rotationY, numberOrFallback(fallback.rotationY, 0))
  };
}

export function normalizeFriendPlacements(rawPlacements) {
  const resolved = new Map();

  const list = Array.isArray(rawPlacements)
    ? rawPlacements
    : (rawPlacements && typeof rawPlacements === 'object')
      ? Object.values(rawPlacements)
      : [];

  for (const entry of list) {
    const id = String(entry && entry.id || '');
    if (!FRIEND_BY_ID.has(id)) continue;
    const x = Number(entry && entry.x);
    const y = Number(entry && entry.y);
    const z = Number(entry && entry.z);
    const rotationY = Number(entry && entry.rotationY);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    resolved.set(id, {
      id,
      x,
      y: Number.isFinite(y) ? y : 0,
      z,
      rotationY: Number.isFinite(rotationY) ? rotationY : 0
    });
  }

  const defaults = getDefaultFriendPlacements();
  for (const d of defaults) {
    if (!resolved.has(d.id)) resolved.set(d.id, d);
  }

  return FRIEND_DEFS.map((def) => resolved.get(def.id));
}

export function loadFriendPlacements() {
  const storage = getStorage();
  if (!storage) return getDefaultFriendPlacements();

  try {
    const raw = storage.getItem(FRIEND_PLACEMENTS_STORAGE_KEY);
    if (!raw) return getDefaultFriendPlacements();
    const parsed = JSON.parse(raw);
    return normalizeFriendPlacements(parsed);
  } catch (e) {
    return getDefaultFriendPlacements();
  }
}

export function saveFriendPlacements(placements) {
  const storage = getStorage();
  const normalized = normalizeFriendPlacements(placements);

  if (storage) {
    try {
      storage.setItem(FRIEND_PLACEMENTS_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      // ignore persistence failures
    }
  }

  return normalized;
}

export function clearFriendPlacements() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(FRIEND_PLACEMENTS_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function getDefaultTimPlacement() {
  return normalizeWorldPlacement(DEFAULT_TIM_PLACEMENT, DEFAULT_TIM_PLACEMENT);
}

export function normalizeTimPlacement(placement) {
  return normalizeWorldPlacement(placement, DEFAULT_TIM_PLACEMENT);
}

export function loadTimPlacement() {
  const storage = getStorage();
  if (!storage) return getDefaultTimPlacement();

  try {
    const raw = storage.getItem(TIM_PLACEMENT_STORAGE_KEY);
    if (!raw) return getDefaultTimPlacement();
    return normalizeTimPlacement(JSON.parse(raw));
  } catch (e) {
    return getDefaultTimPlacement();
  }
}

export function saveTimPlacement(placement) {
  const storage = getStorage();
  const normalized = normalizeTimPlacement(placement);

  if (storage) {
    try {
      storage.setItem(TIM_PLACEMENT_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      // ignore persistence failures
    }
  }

  return normalized;
}

export function clearTimPlacement() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(TIM_PLACEMENT_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function getDefaultPlayerStart() {
  return normalizeWorldPlacement(DEFAULT_PLAYER_START, DEFAULT_PLAYER_START);
}

export function normalizePlayerStart(placement) {
  return normalizeWorldPlacement(placement, DEFAULT_PLAYER_START);
}

export function loadPlayerStart() {
  const storage = getStorage();
  if (!storage) return getDefaultPlayerStart();

  try {
    const raw = storage.getItem(PLAYER_START_STORAGE_KEY);
    if (!raw) return getDefaultPlayerStart();
    return normalizePlayerStart(JSON.parse(raw));
  } catch (e) {
    return getDefaultPlayerStart();
  }
}

export function savePlayerStart(placement) {
  const storage = getStorage();
  const normalized = normalizePlayerStart(placement);

  if (storage) {
    try {
      storage.setItem(PLAYER_START_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      // ignore persistence failures
    }
  }

  return normalized;
}

export function clearPlayerStart() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(PLAYER_START_STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

export function loadFriendUnlocks() {
  const storage = getStorage();
  const unlocked = new Set();
  if (!storage) return unlocked;

  try {
    const raw = storage.getItem(FRIEND_UNLOCKS_STORAGE_KEY);
    if (!raw) return unlocked;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object') ? Object.keys(parsed).filter((k) => parsed[k]) : [];
    for (const id of list) if (FRIEND_BY_ID.has(String(id))) unlocked.add(String(id));
  } catch (e) {
    // ignore
  }

  return unlocked;
}

export function saveFriendUnlocks(unlockedIds) {
  const storage = getStorage();
  const normalized = [];
  try {
    for (const id of unlockedIds || []) {
      const key = String(id);
      if (FRIEND_BY_ID.has(key)) normalized.push(key);
    }
  } catch (e) {}

  if (storage) {
    try {
      storage.setItem(FRIEND_UNLOCKS_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      // ignore
    }
  }

  return new Set(normalized);
}
