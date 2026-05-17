import * as THREE from 'three';
import { isMobile } from './mobileControls.js';

// ---------------------------------------------------------------------------
// Panel registry
// ---------------------------------------------------------------------------
/** @type {Record<string, HTMLElement|null>} */
let _panelById = {};
/** @type {HTMLElement|null} */
let _chatBubble = null;
/** @type {HTMLElement|null} */
let _questText = null;
/** @type {HTMLElement|null} */
let _pauseOverlay = null;
/** @type {HTMLElement|null} */
let _blocker = null;
/** @type {HTMLElement|null} */
let _interactHint = null;
/** @type {HTMLElement|null} */
let _weatherUnlockToast = null;
/** @type {HTMLElement|null} */
let _weatherUnlockedCount = null;
/** @type {HTMLElement|null} */
let _friendsList = null;
/** @type {HTMLElement|null} */
let _friendsFoundCount = null;

/** Whether a panel was opened while pointer-lock was active. */
let _panelOpenedFromPointerLock = false;
/** Whether dialogue was opened while pointer-lock was active. */
let _dialogueOpenedFromPointerLock = false;

/** Callback to request re-lock (provided by main.js). */
let _requestRelock = null;
/** Callback to unlock controls. */
let _requestUnlock = null;

// ---------------------------------------------------------------------------
// Public init
// ---------------------------------------------------------------------------
/**
 * @typedef {Object} MenusOptions
 * @property {Record<string, HTMLElement|null>} panelById
 * @property {HTMLElement|null} chatBubble
 * @property {HTMLElement|null} questText
 * @property {HTMLElement|null} pauseOverlay
 * @property {HTMLElement|null} blocker
 * @property {HTMLElement|null} interactHint
 * @property {HTMLElement|null} weatherUnlockToast
 * @property {HTMLElement|null} weatherUnlockedCount
 * @property {HTMLElement|null} friendsList
 * @property {HTMLElement|null} friendsFoundCount
 * @property {HTMLButtonElement|null} weatherToggleButton
 * @property {HTMLButtonElement|null} friendsToggleButton
 * @property {HTMLButtonElement|null} settingsToggleButton
 * @property {HTMLButtonElement|null} helpToggleButton
 * @property {HTMLButtonElement[]} closePanelButtons
 * @property {() => void} requestRelock
 * @property {() => void} requestUnlock
 * @property {() => boolean} hasJoinedOnce
 */

/**
 * Wires up all menu panel event listeners. Call once during init.
 * @param {MenusOptions} opts
 */
export function initMenus(opts) {
  _panelById = opts.panelById;
  _chatBubble = opts.chatBubble;
  _questText = opts.questText;
  _pauseOverlay = opts.pauseOverlay;
  _blocker = opts.blocker;
  _interactHint = opts.interactHint;
  _weatherUnlockToast = opts.weatherUnlockToast;
  _weatherUnlockedCount = opts.weatherUnlockedCount;
  _friendsList = opts.friendsList;
  _friendsFoundCount = opts.friendsFoundCount;
  _requestRelock = opts.requestRelock;
  _requestUnlock = opts.requestUnlock;

  // Toggle buttons
  const { weatherToggleButton, friendsToggleButton, settingsToggleButton, helpToggleButton } = opts;
  if (weatherToggleButton) weatherToggleButton.addEventListener('click', () => togglePanel('weather-panel'));
  if (friendsToggleButton) friendsToggleButton.addEventListener('click', () => togglePanel('friends-panel'));
  if (settingsToggleButton) settingsToggleButton.addEventListener('click', () => togglePanel('settings-panel'));
  if (helpToggleButton) helpToggleButton.addEventListener('click', () => togglePanel('help-panel'));

  // Close buttons
  (opts.closePanelButtons || []).forEach((btn) => {
    btn.addEventListener('click', closePanelsAndRelockIfNeeded);
  });

  // Click-outside to close
  document.addEventListener('click', (event) => {
    const activePanel = Object.values(_panelById).find(
      (p) => p && !p.classList.contains('hidden')
    );
    if (!activePanel) return;
    if (activePanel.contains(event.target)) return;
    if (event.target.closest?.('[aria-controls]')) return;
    closePanelsAndRelockIfNeeded();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (!opts.hasJoinedOnce?.()) return;
    if (event.repeat) return;
    const map = {
      KeyC: 'weather-panel',
      KeyV: 'friends-panel',
      KeyB: 'settings-panel',
      KeyN: 'help-panel'
    };
    if (map[event.code]) {
      togglePanel(map[event.code]);
      return;
    }
    if (event.code === 'Escape') {
      const hasOpen = Object.values(_panelById).some((p) => p && !p.classList.contains('hidden'));
      if (hasOpen) closePanelsAndRelockIfNeeded();
    }
  });
}

// ---------------------------------------------------------------------------
// Panel helpers
// ---------------------------------------------------------------------------
/** Closes every panel and resets aria-expanded. */
export function closeAllPanels() {
  Object.entries(_panelById).forEach(([id, panel]) => {
    if (!panel) return;
    panel.classList.add('hidden');
    const toggle = document.querySelector(`[aria-controls="${id}"]`);
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });
}

/** Closes all panels and re-locks pointer if it was locked when the panel opened. */
export function closePanelsAndRelockIfNeeded() {
  closeAllPanels();
  if (_panelOpenedFromPointerLock) {
    _panelOpenedFromPointerLock = false;
    _requestRelock?.();
  }
}

/** Opens a specific panel (closes others first). */
export function openPanel(panelId) {
  closeAllPanels();
  const panel = _panelById[panelId];
  if (!panel) return;
  panel.classList.remove('hidden');
  const toggle = document.querySelector(`[aria-controls="${panelId}"]`);
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
}

/** Toggles a panel open/closed. Unlocks pointer when opening from a locked state. */
export function togglePanel(panelId) {
  const panel = _panelById[panelId];
  if (!panel) return;
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    closePanelsAndRelockIfNeeded();
    return;
  }
  // Track whether we need to re-lock on close
  // We ask main.js via the injected callback to check controls.isLocked
  const wasLocked = opts_isLocked?.();
  if (wasLocked) {
    _panelOpenedFromPointerLock = true;
    _requestUnlock?.();
  }
  if (_blocker) _blocker.classList.add('hidden');
  openPanel(panelId);
}

// Closure to let togglePanel check pointer-lock state without importing controls
let opts_isLocked = null;
/**
 * Provides the current pointer-lock status checker.
 * Call once after initMenus with `() => controls.isLocked`.
 * @param {() => boolean} fn
 */
export function setIsLockedChecker(fn) {
  opts_isLocked = fn;
}

/** Returns true if a panel or dialogue is blocking input. */
export function isAnyPanelOpen() {
  return Object.values(_panelById).some((p) => p && !p.classList.contains('hidden'));
}

// Panel-opened-from-lock accessors (used by controls module via main.js)
export function isPanelOpenedFromPointerLock() { return _panelOpenedFromPointerLock; }
export function isDialogueOpenedFromPointerLock() { return _dialogueOpenedFromPointerLock; }
export function setDialogueOpenedFromPointerLock(v) { _dialogueOpenedFromPointerLock = Boolean(v); }
export function clearPanelOpenedFromPointerLock() { _panelOpenedFromPointerLock = false; }

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------
/** Shows the intro/pause blocker overlay. */
export function showIntroOverlay() {
  if (_blocker) _blocker.classList.remove('hidden');
}

/** Shows the in-game pause overlay. */
export function showPauseOverlay() {
  if (!_pauseOverlay) return;
  _pauseOverlay.classList.remove('hidden');
  _pauseOverlay.setAttribute('aria-hidden', 'false');
}

/** Hides the in-game pause overlay. */
export function hidePauseOverlay() {
  if (!_pauseOverlay) return;
  _pauseOverlay.classList.add('hidden');
  _pauseOverlay.setAttribute('aria-hidden', 'true');
}

// ---------------------------------------------------------------------------
// Quest
// ---------------------------------------------------------------------------
let _currentQuest = '';

/**
 * Updates the quest text in the HUD. No-ops if text is the same as current.
 * @param {string} text
 * @param {() => void} [onNewQuest] - called when a new quest is set (plays sound)
 */
export function setQuestText(text, onNewQuest) {
  if (!text || text === _currentQuest) return;
  _currentQuest = text;
  if (_questText) _questText.textContent = text;
  onNewQuest?.();
}

export function getCurrentQuest() { return _currentQuest; }

// ---------------------------------------------------------------------------
// Chat bubble
// ---------------------------------------------------------------------------
/**
 * Renders and shows the NPC chat bubble.
 * @param {string} [text]
 * @param {number} [duration] - 0 = no auto-hide
 * @param {string} [imageSrc]
 * @param {string} [speaker]
 */
export function showChatBubble(
  text = '',
  duration = 4000,
  imageSrc = 'images/boy1.png',
  speaker = 'Birthday Boy'
) {
  if (!_chatBubble) return;

  // On touch devices render a tappable button instead of the keyboard hint.
  // The button dispatches a synthetic KeyE event so all existing game logic
  // (interaction.js) continues to work without modification.
  const continueHint = isMobile()
    ? `<button class="chat-continue-btn" id="chat-continue-tap" type="button">👆 Tap to continue</button>`
    : `<p class="chat-continue"><span class="chat-key">Press E</span><span>to continue</span></p>`;

  _chatBubble.innerHTML = `
    <div class="chat-avatar-wrap"><img class="chat-avatar" src="${imageSrc}" alt="${speaker}" /></div>
    <div class="chat-body">
      <h3 class="chat-name">${speaker}</h3>
      <div class="chat-divider" aria-hidden="true"></div>
      <div class="chat-text">${String(text)}</div>
      ${continueHint}
    </div>
  `;

  // Wire up the mobile tap button after inserting it into the DOM
  if (isMobile()) {
    const tapBtn = _chatBubble.querySelector('#chat-continue-tap');
    if (tapBtn) {
      tapBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
      }, { passive: false });
      tapBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
      }, { passive: false });
    }
  }

  _chatBubble.classList.remove('hidden');
  clearTimeout(_chatBubble._hideTO);
  if (duration > 0) {
    _chatBubble._hideTO = setTimeout(() => _chatBubble.classList.add('hidden'), duration);
  }
}

/** Hides the chat bubble immediately. */
export function hideChatBubble() {
  if (!_chatBubble) return;
  _chatBubble.classList.add('hidden');
  _chatBubble.innerHTML = '';
}

export function isChatBubbleVisible() {
  return _chatBubble ? !_chatBubble.classList.contains('hidden') : false;
}

// ---------------------------------------------------------------------------
// Friends panel
// ---------------------------------------------------------------------------
/**
 * Re-renders the friends list panel.
 * @param {Array<{id:string, name:string, description:string, weather:string, image:string, unlocked:boolean}>} friendsState
 */
export function renderFriendsPanel(friendsState) {
  if (!_friendsList) return;
  const foundCount = friendsState.filter((f) => f.unlocked).length;
  if (_friendsFoundCount) {
    _friendsFoundCount.textContent = `Found ${foundCount} of ${friendsState.length} friends`;
  }

  _friendsList.innerHTML = friendsState
    .map((friend) => {
      const cardClass = friend.unlocked ? 'friend-card' : 'friend-card locked';
      const imageMarkup = friend.unlocked
        ? `<img class="friend-avatar" src="${friend.image}" alt="${friend.name}" />`
        : '<div class="friend-avatar" aria-hidden="true">🔒</div>';
      const weatherClass = friend.unlocked ? 'friend-weather' : 'friend-weather locked';
      return `
        <article class="${cardClass}">
          ${imageMarkup}
          <div>
            <h3 class="friend-name">${friend.name}</h3>
            <p class="friend-desc">${friend.description}</p>
            <span class="${weatherClass}">${friend.weather}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Weather unlock UI
// ---------------------------------------------------------------------------
/**
 * Updates locked/unlocked state of weather-option buttons.
 * @param {Set<string>} unlockedWeatherIds
 */
export function syncWeatherUnlockUI(unlockedWeatherIds) {
  const weatherOptions = Array.from(document.querySelectorAll('.weather-option[data-weather]'));
  let unlockedCount = 0;

  weatherOptions.forEach((btn) => {
    const id = btn.dataset.weather;
    const unlocked = Boolean(id && unlockedWeatherIds.has(id));
    btn.classList.toggle('locked', !unlocked);
    btn.disabled = !unlocked;
    btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    if (unlocked) unlockedCount++;
    const small = btn.querySelector('small');
    if (small) small.textContent = unlocked ? (isMobile() ? 'Tap to activate' : 'Click to activate') : '🔒 Locked';
  });

  if (_weatherUnlockedCount) {
    _weatherUnlockedCount.textContent = `Unlocked ${unlockedCount} of ${weatherOptions.length} weather effects`;
  }
}

/**
 * Shows the animated weather-unlocked toast for a short duration.
 * @param {string} weatherLabel
 */
export function showWeatherUnlockToast(weatherLabel) {
  if (!_weatherUnlockToast) return;
  const label = String(weatherLabel || '').trim();
  if (!label) return;
  _weatherUnlockToast.innerHTML = `<strong>New weather unlocked!</strong><span>${label}</span>`;
  _weatherUnlockToast.classList.remove('hidden');
  clearTimeout(_weatherUnlockToast._hideTO);
  _weatherUnlockToast._hideTO = window.setTimeout(() => {
    _weatherUnlockToast.classList.add('hidden');
  }, 2600);
}

// ---------------------------------------------------------------------------
// Interact hint
// ---------------------------------------------------------------------------
export function showInteractHint() {
  if (_interactHint) _interactHint.classList.remove('hidden');
}
export function hideInteractHint() {
  if (_interactHint) _interactHint.classList.add('hidden');
}
