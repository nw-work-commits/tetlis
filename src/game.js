// Game state, loop, scoring, movement.
window.Game = class Game {
  constructor(handicap, mode, cols) {
    this.handicap = handicap || { startLines: 0, gravityMult: 1, attackMult: 1, defenseMult: 1, targetWeight: 1 };
    this.mode = mode || 'item'; // pure|item|super_item|sprint|ultra|tromino|pentomino|random|cascade|blind
    this.cols = cols || CFG.COLS;
    this.reset();
  }

  setHandicap(h) {
    this.handicap = { startLines: 0, gravityMult: 1, attackMult: 1, defenseMult: 1, targetWeight: 1, ...h };
  }

  _pieceTypesForMode() {
    if (this.mode === 'tromino' && typeof TRIOMINO_TYPES !== 'undefined') return TRIOMINO_TYPES;
    if (this.mode === 'pentomino' && typeof PENTOMINO_TYPES !== 'undefined') return PENTOMINO_TYPES;
    if (this.mode === 'random') {
      // Mixed bag of 3/4/5-cell pieces for chaotic variety.
      const tri = (typeof TRIOMINO_TYPES !== 'undefined') ? TRIOMINO_TYPES : [];
      const pen = (typeof PENTOMINO_TYPES !== 'undefined') ? PENTOMINO_TYPES : [];
      return [...tri, ...PIECE_TYPES, ...pen];
    }
    return PIECE_TYPES;
  }

  reset() {
    this._pieceIdCounter = 0;
    this._gameOverReason = null;
    this._gameOverDetails = null;
    this.field = new Field(this.cols);
    this.bag = new Bag(this._pieceTypesForMode());
    // Pre-fill starting garbage rows for handicap.
    const startLines = this.handicap?.startLines || 0;
    if (startLines > 0) this.field.addGarbageLines(startLines);
    this.current = null;
    this.hold = null;
    this.holdLocked = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.b2b = 0;
    this.combo = -1;
    this.softDrop = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.onGround = false;
    this.lastMoveWasRotation = false;
    this.gameOver = false;
    this.paused = false;
    // Attack state
    this.targetIndex = -1;            // who I attack
    this.pendingGarbage = 0;          // garbage to receive on next spawn
    this.forcedSpawn = [];            // queue of forced (weird) piece types
    this.speedBuffMs = 0;             // remaining speed-up time
    this.flashMs = 0;                 // visual flash duration
    // Juice / feedback
    this.popupText = '';              // floating text like "TETRIS!"
    this.popupMs = 0;
    this.shakeMs = 0;                 // board shake duration
    // Sprint
    this.elapsedMs = 0;
    this.finished = false;            // sprint goal reached
    this.finishMs = 0;
    // Character reaction sequences (bumped on attack sent / hit received)
    this._attackSeq = 0;
    this._hitSeq = 0;
    // Special move gauge (0..100) and blind (ink) state
    this.gauge = 0;
    this.blindMs = 0;
    // Callback set by Match; called with (attackerGame, attackList) on each line clear.
    this.onAttacks = null;
    this._spawn();
  }

  _popup(text, ms) {
    this.popupText = text;
    this.popupMs = ms || 900;
  }

  // Returns the queue of upcoming piece types (forced first, then bag).
  peekQueue(n) {
    const out = this.forcedSpawn.slice(0, n);
    if (out.length < n) out.push(...this.bag.peek(n - out.length));
    return out;
  }

  _spawn(type) {
    // Apply pending garbage one batch at a time (max GARBAGE_PER_SPAWN).
    // Excess stays queued so the player has time to react.
    if (this.pendingGarbage > 0) {
      const batch = Math.min(this.pendingGarbage, CFG.GARBAGE_PER_SPAWN);
      const ok = this.field.addGarbageLines(batch);
      this.pendingGarbage -= batch;
      if (!ok) {
        this._gameOverReason = 'garbage-overflow';
        this._gameOverDetails = { stack: this.field.stackHeight() };
        this.gameOver = true;
        this.current = null;
        return;
      }
    }
    let fromFreshBag = false;
    if (!type) {
      if (this.forcedSpawn.length > 0) {
        type = this.forcedSpawn.shift();
        if (window.audioFX && type.startsWith('X')) audioFX.play('weird');
      } else {
        type = this.bag.next();
        fromFreshBag = true;
      }
    }
    const p = createPiece(type);
    p.x = Math.max(0, Math.floor((this.cols - 4) / 2)); // center spawn for wide boards
    p.y = CFG.HIDDEN_ROWS - 2;
    if (p.y < 0) p.y = 0;
    p.pieceId = ++this._pieceIdCounter;
    // Super-item mode: 25% chance the piece carries a special item.
    // Held / forced / weird pieces don't get items.
    if (this.mode === 'super_item' && fromFreshBag && !type.startsWith('X') && Math.random() < 0.25) {
      const items = ['bomb','thunder','scramble','flip','random'];
      p.itemType = items[(Math.random() * items.length) | 0];
    }
    this.current = p;
    this.holdLocked = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.onGround = false;
    this.lastMoveWasRotation = false;
    if (this.field.collides(this.current)) {
      this._gameOverReason = 'spawn-collision';
      this._gameOverDetails = { type, stack: this.field.stackHeight() };
      this.gameOver = true;
      this.current = null;
    }
  }

  action(act, phase) {
    if (this.gameOver) {
      if (act === 'restart' && phase === 'down') this.reset();
      return;
    }
    if (act === 'pause' && phase === 'down') {
      this.paused = !this.paused;
      if (window.audioFX) audioFX.play('pause');
      return;
    }
    if (this.paused) return;
    if (!this.current) return;
    if (phase === 'up') {
      if (act === 'softDown') this.softDrop = false;
      return;
    }
    switch (act) {
      case 'left':   this._move(-1, 0); break;
      case 'right':  this._move(+1, 0); break;
      case 'softDown':
        if (phase === 'down') this.softDrop = true;
        break;
      case 'rotCW':  this._rotate(+1); break;
      case 'rotCCW': this._rotate(-1); break;
      case 'hardDrop': if (phase === 'down') this._hardDrop(); break;
      case 'hold':     if (phase === 'down') this._hold(); break;
      case 'restart':  if (phase === 'down') this.reset(); break;
    }
  }

  _move(dx, dy) {
    const test = { ...this.current, x: this.current.x + dx, y: this.current.y + dy };
    if (!this.field.collides(test)) {
      this.current = test;
      this.lastMoveWasRotation = false;
      this._resetLockIfGrounded();
      if (dx !== 0 && window.audioFX) audioFX.play('move');
      return true;
    }
    return false;
  }

  _rotate(dir) {
    if (this.current.type === 'O') return;
    const from = this.current.rot;
    const to = (from + (dir > 0 ? 1 : 3)) % 4;
    const kicks = getKickTable(this.current.type, from, to);
    for (const [kx, ky] of kicks) {
      const test = { ...this.current, rot: to, x: this.current.x + kx, y: this.current.y + ky };
      if (!this.field.collides(test)) {
        test.lastKick = [kx, ky];
        this.current = test;
        this.lastMoveWasRotation = true;
        this._resetLockIfGrounded();
        if (window.audioFX) audioFX.play('rotate');
        return true;
      }
    }
    return false;
  }

  _hardDrop() {
    const startY = this.current.y;
    const gy = this.field.ghostY(this.current);
    this.current.y = gy;
    this.score += 2 * (gy - startY);
    if (window.audioFX) audioFX.play('harddrop');
    this._lock();
  }

  _hold() {
    if (this.holdLocked) return;
    const prevType = this.current.type;
    if (prevType && prevType.startsWith('X')) return;
    if (this.hold) {
      this._spawn(this.hold);
    } else {
      this._spawn();
    }
    this.hold = prevType;
    this.holdLocked = true;
    if (window.audioFX) audioFX.play('hold');
  }

  _resetLockIfGrounded() {
    if (!this.onGround) return;
    if (this.lockResets >= CFG.LOCK_RESET_LIMIT) return;
    this.lockTimer = 0;
    this.lockResets++;
  }

  _lock() {
    const cascade = this.mode === 'cascade';
    const tspin = this.field.detectTSpin(this.current, this.lastMoveWasRotation);
    this.field.lock(this.current);
    const result = cascade ? this.field.clearLinesCascade() : this.field.clearLines();
    const cleared = result.lines;
    const triggered = result.triggered;
    const prevB2B = this.b2b;
    const prevLevel = this.level;
    this._awardScore(cleared, tspin);
    // Special-move gauge fills on clears (bigger clears fill faster).
    if (cleared > 0) {
      let gain = cleared * 9;
      if (tspin) gain += 14;
      if (cleared === 4) gain += 10;
      this.gauge = Math.min(300, this.gauge + gain); // 3 tiers (100 each)
    }
    // Sound effects
    if (window.audioFX) {
      if (cleared > 0) {
        if (tspin === 'full' || tspin === 'mini') audioFX.play('tspin');
        else if (cleared === 4) audioFX.play('tetris');
        else if (cleared === 3) audioFX.play('line3');
        else if (cleared === 2) audioFX.play('line2');
        else audioFX.play('line1');
        if (this.combo >= 2) setTimeout(() => audioFX.play('combo'), 60);
      } else {
        audioFX.play('lock');
      }
      if (this.level > prevLevel) setTimeout(() => audioFX.play('levelup'), 250);
    }
    // Perfect clear (all-clear): board completely empty after clearing lines.
    const perfectClear = cleared > 0 && this.field.isEmpty();
    if (perfectClear) {
      this.score += 3000 * this.level;
      this.shakeMs = Math.max(this.shakeMs, 500);
      this.gauge = Math.min(300, this.gauge + 40);
    }
    // Juice popup text
    if (cleared > 0) {
      let label = '';
      if (perfectClear) label = 'PERFECT CLEAR!';
      else if (tspin === 'full') label = 'T-SPIN ' + ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared];
      else if (tspin === 'mini') label = 'T-SPIN MINI';
      else if (cleared === 4) label = 'TETRIS!';
      else if (this.combo >= 2) label = 'COMBO x' + this.combo;
      if (label) this._popup(label);
      // Screen shake on big clears
      if (perfectClear || cleared === 4 || tspin === 'full') {
        this.shakeMs = Math.max(this.shakeMs, 350);
      }
    }

    // Build the outgoing attack list (line-clear attacks + super-item bonuses + perfect-clear bonus).
    let outgoing = [];
    if (cleared > 0 && this.mode !== 'pure' && this.mode !== 'sprint'
        && typeof computeAttacks === 'function') {
      outgoing = computeAttacks(cleared, tspin, prevB2B, Math.max(0, this.combo));
    }
    if (this.mode === 'super_item' && triggered.length > 0) {
      for (const item of triggered) {
        const atk = this._itemToAttack(item);
        if (atk) outgoing.push(atk);
      }
      if (triggered.length > 0) this.flashMs = Math.max(this.flashMs, 600);
    }
    if (perfectClear && this.mode !== 'pure' && this.mode !== 'sprint') {
      outgoing.push({ type: 'garbage', amount: CFG.PERFECT_CLEAR_ATTACK });
    }

    // ===== Garbage cancellation (counter) =====
    // Outgoing garbage first neutralizes my own pending garbage; only the
    // surplus is actually sent to the target.
    if (this.pendingGarbage > 0) {
      let totalGarbage = 0;
      for (const a of outgoing) if (a.type === 'garbage') totalGarbage += a.amount;
      if (totalGarbage > 0) {
        const cancel = Math.min(this.pendingGarbage, totalGarbage);
        this.pendingGarbage -= cancel;
        let remaining = cancel;
        // Subtract the cancelled amount from outgoing garbage attacks.
        for (const a of outgoing) {
          if (remaining <= 0) break;
          if (a.type === 'garbage') {
            const take = Math.min(a.amount, remaining);
            a.amount -= take;
            remaining -= take;
          }
        }
        outgoing = outgoing.filter(a => a.type !== 'garbage' || a.amount > 0);
        if (cancel > 0) this._popup('COUNTER ' + cancel, 700);
      }
    }

    if (outgoing.length > 0 && this.onAttacks) {
      this.onAttacks(this, outgoing);
      this._attackSeq++;
      if (window.audioFX && (this.mode === 'super_item' || perfectClear)) audioFX.play('outgoing');
    }

    // Sprint goal check
    if (this.mode === 'sprint' && !this.finished && this.lines >= CFG.SPRINT_LINES) {
      this.finished = true;
      this.finishMs = this.elapsedMs;
      this._popup('FINISH!', 3000);
      this.shakeMs = Math.max(this.shakeMs, 400);
      this.current = null;
      return;
    }

    // Cascade gravity may have pulled the piece down after lock, so the
    // lock-out check would be wrong; rely on spawn-collision top-out instead.
    const allHidden = !cascade && pieceCells(this.current).every(([, y]) => y < CFG.HIDDEN_ROWS);
    if (allHidden) {
      this._gameOverReason = 'lock-in-hidden';
      this._gameOverDetails = { type: this.current.type, stack: this.field.stackHeight() };
      this.gameOver = true;
      this.current = null;
      if (window.audioFX) audioFX.play('gameover');
      return;
    }
    this.current = null;
    this._spawn();
  }

  _itemToAttack(item) {
    switch (item) {
      case 'bomb':     return { type: 'garbage', amount: 4 };
      case 'thunder':  return { type: 'speed',   amount: 1 };
      case 'scramble': return { type: 'shuffle', amount: 1 };
      case 'flip':     return { type: 'flipV',   amount: 1 };
      case 'random': {
        const pool = ['weird','mirror','holes','shuffle','speed','flipV'];
        return { type: pool[(Math.random() * pool.length) | 0], amount: 1 };
      }
    }
    return null;
  }

  _awardScore(cleared, tspin) {
    const lvl = this.level;
    let base = 0;
    let difficult = false;
    if (tspin === 'mini') {
      if (cleared === 0) base = 100;
      else if (cleared === 1) { base = 200; difficult = true; }
      else if (cleared === 2) { base = 400; difficult = true; }
    } else if (tspin === 'full') {
      if (cleared === 0) base = 400;
      else if (cleared === 1) { base = 800; difficult = true; }
      else if (cleared === 2) { base = 1200; difficult = true; }
      else if (cleared === 3) { base = 1600; difficult = true; }
    } else {
      if (cleared === 1) base = 100;
      else if (cleared === 2) base = 300;
      else if (cleared === 3) base = 500;
      else if (cleared === 4) { base = 800; difficult = true; }
    }
    let gain = base * lvl;
    if (difficult && this.b2b > 0) gain = Math.floor(gain * 1.5);
    if (cleared > 0) {
      this.combo++;
      gain += 50 * this.combo * lvl;
    } else {
      this.combo = -1;
    }
    this.score += gain;
    if (cleared > 0) {
      if (difficult) this.b2b++;
      else this.b2b = 0;
      this.lines += cleared;
      const newLevel = Math.min(CFG.MAX_LEVEL, 1 + Math.floor(this.lines / CFG.LINES_PER_LEVEL));
      if (newLevel > this.level) this.level = newLevel;
    }
  }

  tick(dt) {
    if (this.gameOver || this.paused || this.finished) return;
    if (this.speedBuffMs > 0) this.speedBuffMs = Math.max(0, this.speedBuffMs - dt);
    if (this.flashMs > 0) this.flashMs = Math.max(0, this.flashMs - dt);
    if (this.popupMs > 0) this.popupMs = Math.max(0, this.popupMs - dt);
    if (this.shakeMs > 0) this.shakeMs = Math.max(0, this.shakeMs - dt);
    if (this.blindMs > 0) this.blindMs = Math.max(0, this.blindMs - dt);
    if (this.mode === 'sprint' || this.mode === 'ultra') this.elapsedMs += dt;
    if (this.mode === 'ultra' && !this.finished && this.elapsedMs >= CFG.ULTRA_MS) {
      this.finished = true;
      this.finishMs = this.elapsedMs;
      this._popup('TIME UP!', 3000);
      this.shakeMs = Math.max(this.shakeMs, 400);
      this.current = null;
      return;
    }
    if (!this.current) return;
    let g = gravityMs(this.level);
    if (this.speedBuffMs > 0) g = g / 3;
    if (this.handicap?.gravityMult) g = g / Math.max(0.1, this.handicap.gravityMult);
    const stepMs = this.softDrop ? Math.max(g / CFG.SOFT_DROP_MULT, 1) : g;
    this.gravityAcc += dt;
    while (this.gravityAcc >= stepMs) {
      this.gravityAcc -= stepMs;
      const moved = this._move(0, 1);
      if (moved && this.softDrop) this.score += 1;
      if (!moved) break;
    }
    const below = { ...this.current, y: this.current.y + 1 };
    const grounded = this.field.collides(below);
    if (grounded) {
      if (!this.onGround) {
        this.onGround = true;
        this.lockTimer = 0;
      }
      this.lockTimer += dt;
      if (this.lockTimer >= CFG.LOCK_DELAY_MS) {
        this._lock();
      }
    } else {
      this.onGround = false;
      this.lockTimer = 0;
    }
  }
};
