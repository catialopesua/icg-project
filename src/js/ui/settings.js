import { renderer } from '../core/engine.js';
import { syncSceneMeshShadows, updateNightStreetlightShadowCasters } from '../core/lighting.js';

/**
 * @typedef {Object} SettingsOptions
 * @property {HTMLInputElement|null} settingShadows
 * @property {HTMLButtonElement|null} saveSettingsButton
 * @property {() => import('../core/controls.js').PointerLockControls|null} getControls
 * @property {() => import('../core/controls.js').PointerLockControls|null} getPlayerObj
 *   A getter for the current player object used for shadow distance sorting.
 * @property {HTMLInputElement|null} settingParticles - handled by weather, referenced here for init
 */

/**
 * Wires up the shadow toggle, save-settings button feedback, and particles checkbox.
 * Audio / sensitivity settings are handled by core/audio.js (setupAudioSettings /
 * setupSensitivitySettings) — call those separately from main.js.
 *
 * @param {SettingsOptions} opts
 */
export function initSettings(opts) {
  const { settingShadows, saveSettingsButton, getPlayerObj } = opts;

  // Shadow toggle
  if (settingShadows) {
    settingShadows.checked = true;
    renderer.shadowMap.enabled = true;
    syncSceneMeshShadows(true);
    updateNightStreetlightShadowCasters(true, getPlayerObj?.(), settingShadows);

    settingShadows.addEventListener('change', () => {
      renderer.shadowMap.enabled = settingShadows.checked;
      syncSceneMeshShadows(settingShadows.checked);
      updateNightStreetlightShadowCasters(true, getPlayerObj?.(), settingShadows);
    });
  }

  // Save-settings button feedback
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', () => {
      saveSettingsButton.textContent = 'Saved!';
      window.setTimeout(() => {
        saveSettingsButton.textContent = 'Save Settings';
      }, 900);
    });
  }
}
