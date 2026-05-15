import * as THREE from 'three';

// Storage keys
export const MUSIC_VOLUME_STORAGE_KEY = 'tim-birthday-music-volume';
export const SFX_VOLUME_STORAGE_KEY = 'tim-birthday-sfx-volume';
export const SENSITIVITY_STORAGE_KEY = 'tim-birthday-look-sensitivity';

// Audio elements
export const buttonClickAudio = new Audio('./audio/button-click.mp3');
buttonClickAudio.preload = 'auto';

export const newQuestAudio = new Audio('./audio/new-quest.mp3');
newQuestAudio.preload = 'auto';

export const chatContinueAudio = new Audio('./audio/chat-continue.mp3');
chatContinueAudio.preload = 'auto';

// Spatial audio
let audioListener = null;
export let partyMusic = null; // Will be created when listener is initialized
let partyMusicLoaded = false;
let partyMusicRequested = false;

// Initialize audio listener and spatial audio
export function initAudioListener(camera) {
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // create positional audio with listener
  partyMusic = new THREE.PositionalAudio(audioListener);

  const audioLoader = new THREE.AudioLoader();
  audioLoader.load('./audio/happy_bday.mp3',
    (buffer) => {
      if (!partyMusic) return;
      partyMusic.setBuffer(buffer);
      partyMusic.setLoop(true);
      partyMusic.setRefDistance(25);
      partyMusic.setVolume(0.7);
      partyMusicLoaded = true;
      if (partyMusicRequested) playPartyMusic();
    },
    undefined,
    (err) => console.error('Error loading happy_bday.mp3:', err)
  );
}

// Utility functions
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function applyMusicVolume(percentage) {
  const normalized = clamp01(Number(percentage) / 100);
  if (partyMusic) partyMusic.setVolume(normalized);
  return Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
}

export function applySoundEffectsVolume(percentage) {
  const normalized = clamp01(Number(percentage) / 100);
  buttonClickAudio.volume = clamp01(normalized * 0.75);
  newQuestAudio.volume = clamp01(normalized * 0.95);
  chatContinueAudio.volume = clamp01(normalized * 0.9);
}

export function playButtonClickSound() {
  try {
    buttonClickAudio.currentTime = 0;
    buttonClickAudio.play().catch(() => { });
  } catch (e) {
    // ignore audio playback failures
  }
}

export function playNewQuestSound() {
  try {
    newQuestAudio.currentTime = 0;
    newQuestAudio.play().catch(() => { });
  } catch (e) {
    // ignore audio playback failures
  }
}

export function playChatContinueSound() {
  try {
    chatContinueAudio.currentTime = 0;
    chatContinueAudio.play().catch(() => { });
  } catch (e) {
    // ignore audio playback failures
  }
}

export function playPartyMusic() {
  partyMusicRequested = true;
  if (partyMusicLoaded && !partyMusic.isPlaying) {
    partyMusic.play();
  }
}

// Storage helpers
export function loadSavedPercentage(storageKey) {
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

export function savePercentage(storageKey, percentage) {
  try {
    window.localStorage.setItem(storageKey, String(percentage));
  } catch (e) {
    // Ignore persistence failures (private mode or blocked storage).
  }
}

// Sensitivity
let lookSensitivity = 1;

export function applyLookSensitivity(percentage, controls) {
  const normalized = Math.max(0.2, Math.min(3, Number(percentage) / 100));
  lookSensitivity = normalized;
  if (controls) controls.pointerSpeed = normalized;
}

export function getLookSensitivity() {
  return lookSensitivity;
}

// Setup audio settings UI
export function setupAudioSettings(settingMusicVolume, musicVolumeValue, settingSfxVolume, sfxVolumeValue) {
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
}

export function setupSensitivitySettings(settingSensitivity, sensitivityValue, getControls) {
  if (settingSensitivity && sensitivityValue) {
    const savedSensitivity = loadSavedPercentage(SENSITIVITY_STORAGE_KEY);
    if (savedSensitivity !== null) settingSensitivity.value = String(savedSensitivity);

    const syncSensitivity = () => {
      const value = Number(settingSensitivity.value);
      const multiplier = Math.max(0.2, Math.min(3, value / 100));
      sensitivityValue.textContent = `${multiplier.toFixed(2)}x`;
      const controls = typeof getControls === 'function' ? getControls() : null;
      applyLookSensitivity(value, controls);
      savePercentage(SENSITIVITY_STORAGE_KEY, value);
    };
    settingSensitivity.addEventListener('input', syncSensitivity);
    syncSensitivity();
  } else {
    const controls = typeof getControls === 'function' ? getControls() : null;
    applyLookSensitivity(100, controls);
  }
}
