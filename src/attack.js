// Attack system: computes attacks from a line clear and applies them to a target.
window.ATTACK_TYPES = {
  GARBAGE:  { key: 'garbage',  label: 'GARBAGE', icon: '🧱' },
  WEIRD:    { key: 'weird',    label: 'WEIRD',   icon: '🌀' },
  SPEED:    { key: 'speed',    label: 'SPEED',   icon: '⚡' },
  SHUFFLE:  { key: 'shuffle',  label: 'SHUFFLE', icon: '🔀' },
  MIRROR:   { key: 'mirror',   label: 'MIRROR',  icon: '🔃' },
  HOLES:    { key: 'holes',    label: 'HOLES',   icon: '🕳' },
  FLIPV:    { key: 'flipV',    label: 'FLIP V',  icon: '🔻' },
};

const SPECIAL_TYPES = ['weird','speed','shuffle','mirror','holes','flipV'];

// Compute attacks generated when `attacker` clears `cleared` lines.
// Returns an array of {type, amount}. Empty when no attack.
window.computeAttacks = function (cleared, tspin, b2bPrev, combo) {
  const out = [];
  let garbageLines = 0;
  let specialChance = 0;

  if (tspin === 'full') {
    if (cleared === 1) { garbageLines = 2; specialChance = 0; }
    else if (cleared === 2) { garbageLines = 4; specialChance = 1; }
    else if (cleared === 3) { garbageLines = 6; specialChance = 1; }
  } else if (tspin === 'mini') {
    // mini T-spin: light pressure
    if (cleared === 1) garbageLines = 1;
    else if (cleared === 2) garbageLines = 2;
  } else {
    if (cleared === 1) garbageLines = 0;
    else if (cleared === 2) { garbageLines = 1; specialChance = 0.25; }
    else if (cleared === 3) { garbageLines = 2; specialChance = 0.5; }
    else if (cleared === 4) { garbageLines = 4; specialChance = 1.0; } // Tetris
  }
  // B2B bonus: chance bump
  if (b2bPrev > 0) specialChance = Math.min(1, specialChance + 0.25);
  // Combo: +1 line per 2 combo
  if (combo > 0) garbageLines += Math.floor(combo / 2);

  if (garbageLines > 0) out.push({ type: 'garbage', amount: garbageLines });
  if (specialChance > 0 && Math.random() < specialChance) {
    const t = SPECIAL_TYPES[(Math.random() * SPECIAL_TYPES.length) | 0];
    out.push({ type: t, amount: 1 });
  }
  return out;
};

// Apply a single attack to a target Game instance. Mutates target.
// Optional `mult` lets Match scale the attack by attacker×defender multipliers.
window.applyAttack = function (target, attack, mult) {
  if (!target || target.gameOver) return;
  const m = mult == null ? 1 : mult;
  target._hitSeq = (target._hitSeq || 0) + 1; // character "hit" reaction
  target.gauge = Math.min(300, (target.gauge || 0) + 4); // taking hits charges the gauge too
  switch (attack.type) {
    case 'garbage': {
      const lines = Math.max(0, Math.round(attack.amount * m));
      if (lines > 0) {
        // Cap accumulation so a burst of attacks can't insta-kill.
        target.pendingGarbage = Math.min(CFG.PENDING_GARBAGE_CAP,
                                         target.pendingGarbage + lines);
      }
      break;
    }
    case 'weird': {
      const t = WEIRD_TYPES[(Math.random() * WEIRD_TYPES.length) | 0];
      target.forcedSpawn.push(t);
      break;
    }
    case 'speed': {
      target.speedBuffMs = Math.max(target.speedBuffMs, 5000);
      target.flashMs = Math.max(target.flashMs, 400);
      break;
    }
    case 'shuffle': {
      target.field.shuffleBottomRows(6);
      target.flashMs = Math.max(target.flashMs, 400);
      break;
    }
    case 'mirror': {
      target.field.mirrorH();
      target.flashMs = Math.max(target.flashMs, 400);
      break;
    }
    case 'holes': {
      target.field.randomizeHoles();
      target.flashMs = Math.max(target.flashMs, 400);
      break;
    }
    case 'flipV': {
      target.field.flipV();
      target.flashMs = Math.max(target.flashMs, 400);
      break;
    }
  }
};
