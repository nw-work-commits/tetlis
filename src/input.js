// Multi-player keyboard input router.
// Each held key sends repeated 'repeat' events after DAS/ARR for movement.
// emit(playerIndex, action, phase) where phase is 'down' | 'repeat' | 'up'.
// Global actions: emit(-1, action, 'down').

window.KeyboardInput = class KeyboardInput {
  constructor(numPlayers, onAction) {
    this.numPlayers = numPlayers;
    this.onAction = onAction;
    // codeIndex: KeyCode -> { player: idx | -1, action }
    this.codeIndex = new Map();
    for (let p = 0; p < numPlayers; p++) {
      const keys = PLAYER_KEYS[p].keys;
      for (const code of Object.keys(keys)) {
        this.codeIndex.set(code, { player: p, action: keys[code] });
      }
    }
    for (const code of Object.keys(GLOBAL_KEYS)) {
      this.codeIndex.set(code, { player: -1, action: GLOBAL_KEYS[code] });
    }
    this.held = new Map(); // code -> { player, action, downAt, lastRepeatAt }
    this._onDown = (e) => this._down(e);
    this._onUp = (e) => this._up(e);
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
  }

  destroy() {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup', this._onUp);
    this.held.clear();
  }

  _down(e) {
    const entry = this.codeIndex.get(e.code);
    if (!entry) return;
    e.preventDefault();
    if (e.repeat) return;
    if (this.held.has(e.code)) return;
    this.held.set(e.code, {
      player: entry.player, action: entry.action,
      downAt: performance.now(), lastRepeatAt: 0,
    });
    this.onAction(entry.player, entry.action, 'down');
  }

  _up(e) {
    const entry = this.codeIndex.get(e.code);
    if (!entry) return;
    if (this.held.has(e.code)) {
      this.held.delete(e.code);
      this.onAction(entry.player, entry.action, 'up');
    }
  }

  tick(now) {
    for (const state of this.held.values()) {
      const act = state.action;
      if (act !== 'left' && act !== 'right') continue;
      const heldFor = now - state.downAt;
      if (heldFor < CFG.DAS_MS) continue;
      if (now - state.lastRepeatAt >= CFG.ARR_MS) {
        state.lastRepeatAt = now;
        this.onAction(state.player, act, 'repeat');
      }
    }
  }
};
