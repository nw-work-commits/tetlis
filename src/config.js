// Global configuration constants for Tetlis.
window.CFG = {
  COLS: 10,
  ROWS: 20,
  HIDDEN_ROWS: 2,
  CELL: 24,              // board cell size in px
  NEXT_COUNT: 5,
  DAS_MS: 150,
  ARR_MS: 33,
  SOFT_DROP_MULT: 20,
  LOCK_DELAY_MS: 500,
  LOCK_RESET_LIMIT: 15,
  LINES_PER_LEVEL: 10,
  MAX_LEVEL: 20,
  PENDING_GARBAGE_CAP: 12,    // max pending garbage accumulation
  GARBAGE_PER_SPAWN: 4,       // max garbage rows applied per piece spawn
  SPRINT_LINES: 40,           // sprint mode goal
  ULTRA_MS: 120000,           // ultra mode time limit (2 min score attack)
  PERFECT_CLEAR_ATTACK: 8,    // bonus garbage for an all-clear
};

// Player key maps. Each entry maps KeyboardEvent.code -> action.
// Actions: left, right, softDown, rotCW, rotCCW, hardDrop, hold.
// Global keys (pause, restart) are handled separately and shared across players.
window.PLAYER_KEYS = [
  // P1 — right hand (arrows + numpad block)
  {
    label: 'P1 (矢印)',
    keys: {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDown',
      ArrowUp: 'rotCW', 'ControlRight': 'rotCCW',
      'Enter': 'hardDrop', 'ShiftRight': 'hold',
      'Slash': 'target', 'Backslash': 'special',
    },
    desc: '←→↓ 移動 · ↑ 右回転 · 右Ctrl 左回転 · Enter 落下 · 右Shift ホールド · / 標的 · \\ 必殺',
  },
  // P2 — left hand (WASD cluster)
  {
    label: 'P2 (WASD)',
    keys: {
      KeyA: 'left', KeyD: 'right', KeyS: 'softDown',
      KeyW: 'rotCW', KeyQ: 'rotCCW',
      Space: 'hardDrop', Tab: 'hold',
      KeyF: 'target', KeyG: 'special',
    },
    desc: 'WASD 移動 · Q 左回転 · Space 落下 · Tab ホールド · F 標的 · G 必殺',
  },
  // P3 — right home row (IJKL cluster)
  {
    label: 'P3 (IJKL)',
    keys: {
      KeyJ: 'left', KeyL: 'right', KeyK: 'softDown',
      KeyI: 'rotCW', KeyU: 'rotCCW',
      KeyO: 'hardDrop', KeyN: 'hold',
      KeyM: 'target', Comma: 'special',
    },
    desc: 'IJKL 移動 · U 左回転 · O 落下 · N ホールド · M 標的 · , 必殺',
  },
  // P4 — numpad
  {
    label: 'P4 (テンキー)',
    keys: {
      Numpad4: 'left', Numpad6: 'right', Numpad5: 'softDown',
      Numpad8: 'rotCW', Numpad7: 'rotCCW',
      Numpad9: 'hardDrop', Numpad0: 'hold',
      NumpadDecimal: 'target', NumpadAdd: 'special',
    },
    desc: 'テンキー 4/6 移動 · 5 落下加速 · 8/7 回転 · 9 落下 · 0 ホールド · . 標的 · + 必殺',
  },
];

// Global keys shared by all players.
window.GLOBAL_KEYS = {
  KeyP: 'pause',
  KeyR: 'restart',
  Escape: 'menu',
};

// Gravity table (ms per cell) following modern guideline curve.
window.gravityMs = function (level) {
  const lvl = Math.max(1, Math.min(level, CFG.MAX_LEVEL));
  const sec = Math.pow(0.8 - (lvl - 1) * 0.007, lvl - 1);
  return sec * 1000;
};
