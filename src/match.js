// Match: manages N Game instances, routes attacks, dispatches actions and AI ticks.
window.Match = class Match {
  constructor(numPlayers, rootEl, handicaps, playerTypes, mode, widths, characters) {
    this.numPlayers = numPlayers;
    this.games = [];
    this.views = [];
    this.ais = [];                              // [{ index, ai }]
    this.handicaps = handicaps || [];
    this.types = playerTypes || [];             // 'human' | 'cpu:easy' | ...
    this.mode = mode || 'item';                 // 'pure' | 'item' | 'tromino' | 'pentomino'
    this.widths = widths || [];                 // column multipliers (1..4) per player
    this.characters = characters || [];         // character id per player
    this._overSeen = [];                         // lose-voice announced flags
    this._winSeen = false;                       // win-voice announced flag
    rootEl.innerHTML = '';
    const uniformCell = this._computeUniformCell(numPlayers, rootEl);
    for (let i = 0; i < numPlayers; i++) {
      const el = document.createElement('div');
      el.className = 'player';
      rootEl.appendChild(el);
      const baseLabel = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      const t = this.types[i] || 'human';
      const label = this._labelFor(baseLabel, t, i);
      const cols = CFG.COLS * (this.widths[i] || 1);
      const view = new PlayerView(el, label, cols, uniformCell, this.characters[i]);
      const game = new Game(this.handicaps[i], this.mode, cols);
      game.onAttacks = (atkGame, atkList) => this._routeAttacks(i, atkList);
      this.games.push(game);
      this.views.push(view);
      if (t.startsWith('cpu:')) {
        const lvl = t.slice(4);
        this.ais.push({ index: i, ai: new CpuAI(game, lvl) });
      }
    }
    this._autoTargetAll();
  }

  // Pick the largest cell size that fits ALL players' boards on screen at once,
  // so every player's square is identical. Constrained by both width and height.
  _computeUniformCell(numPlayers, rootEl) {
    let totalCols = 0;
    for (let i = 0; i < numPlayers; i++) totalCols += CFG.COLS * (this.widths[i] || 1);

    const perPlayerOverhead = 26;   // player padding + borders + board padding
    const gap = 8;                  // gap between players
    const sideMargin = 24;
    const availW = (rootEl.clientWidth || window.innerWidth) - sideMargin;
    const widthBudget = availW - (perPlayerOverhead * numPlayers + gap * (numPlayers - 1));
    const widthCell = Math.floor(widthBudget / Math.max(1, totalCols));

    // Vertical: HUD + name + hold/next row + stats + paddings ≈ 200px
    const vOverhead = 200;
    const availH = (rootEl.clientHeight || window.innerHeight) - vOverhead;
    const heightCell = Math.floor(availH / CFG.ROWS);

    return Math.max(8, Math.min(CFG.CELL, widthCell, heightCell));
  }

  _labelFor(baseLabel, type, idx) {
    if (type === 'human') return `${baseLabel} (${PLAYER_KEYS[idx].label.replace(/^P\d\s*\((.+)\)$/, '$1')})`;
    if (type.startsWith('cpu:')) {
      const map = { easy: '弱', normal: '普通', hard: '強', expert: '最強' };
      const lvlKey = type.slice(4);
      return `${baseLabel} (CPU ${map[lvlKey] || lvlKey})`;
    }
    return baseLabel;
  }

  _autoTargetAll() {
    for (let i = 0; i < this.numPlayers; i++) {
      this.games[i].targetIndex = this._defaultTarget(i);
    }
  }

  _defaultTarget(playerIndex) {
    if (this.numPlayers < 2) return -1;
    // Weighted random target picking. Three factors:
    //   - stackHeight + 1: tall stacks are more tempting (strategic)
    //   - targetWeight handicap: per-player "how often I get targeted" multiplier
    //   - pile-on penalty: opponents already targeted by others are deprioritised
    const opts = [];
    for (let j = 0; j < this.numPlayers; j++) {
      if (j === playerIndex) continue;
      if (this.games[j].gameOver) continue;
      const stack = this.games[j].field.stackHeight();
      const tw = this.games[j].handicap?.targetWeight ?? 1.0;
      // Count how many OTHER live players are already targeting j.
      let attackers = 0;
      for (let k = 0; k < this.numPlayers; k++) {
        if (k === j || k === playerIndex) continue;
        if (this.games[k].gameOver) continue;
        if (this.games[k].targetIndex === j) attackers++;
      }
      const weight = (stack + 1) * tw / (1 + attackers * 1.5);
      opts.push({ j, weight: Math.max(0.001, weight) });
    }
    if (opts.length === 0) return -1;
    const total = opts.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    for (const o of opts) {
      r -= o.weight;
      if (r <= 0) return o.j;
    }
    return opts[opts.length - 1].j;
  }

  cycleTarget(playerIndex) {
    if (this.numPlayers < 2) return;
    const cur = this.games[playerIndex].targetIndex;
    for (let step = 1; step <= this.numPlayers; step++) {
      const j = (cur + step) % this.numPlayers;
      if (j === playerIndex) continue;
      if (!this.games[j].gameOver) {
        this.games[playerIndex].targetIndex = j;
        return;
      }
    }
  }

  _routeAttacks(attackerIndex, atkList) {
    const targetIdx = this.games[attackerIndex].targetIndex;
    if (targetIdx < 0 || targetIdx === attackerIndex) return;
    const target = this.games[targetIdx];
    if (!target || target.gameOver) {
      this.games[attackerIndex].targetIndex = this._defaultTarget(attackerIndex);
      return;
    }
    const atkMult = this.games[attackerIndex].handicap?.attackMult ?? 1;
    const defMult = target.handicap?.defenseMult ?? 1;
    const mult = atkMult / Math.max(0.1, defMult);
    for (const atk of atkList) applyAttack(target, atk, mult);
    if (window.audioFX) {
      audioFX.play('outgoing');
      setTimeout(() => audioFX.play('incoming'), 80);
    }
    this._fxAttack(attackerIndex, targetIdx);
  }

  // Signature projectile + particles + voices for an attack.
  _fxAttack(fromIdx, toIdx) {
    const fromEl = this.views[fromIdx] && this.views[fromIdx].charEl;
    const toEl = this.views[toIdx] && this.views[toIdx].charEl;
    const fromChar = this.characters[fromIdx];
    const toChar = this.characters[toIdx];
    if (window.audioFX) audioFX.voice(charVoice(fromChar), 'attack');
    if (window.FX && fromEl && toEl) {
      const a = fromEl.getBoundingClientRect();
      const b = toEl.getBoundingClientRect();
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      FX.emit(x0, y0, charColor(fromChar), 10, { star: true, size: 3, speed: 2.6 });
      FX.projectile(x0, y0, x1, y1, charShot(fromChar), (ex, ey) => {
        FX.emit(ex, ey, '#ff6b6b', 20, { star: true, size: 4, speed: 3.2 });
        FX.emit(ex, ey, charColor(toChar), 12, { size: 3, speed: 2 });
        if (window.audioFX) audioFX.voice(charVoice(toChar), 'hit');
      });
    }
  }

  dispatch(playerIndex, action, phase) {
    if (playerIndex === -1) {
      if (action === 'pause' && phase === 'down') {
        const anyPaused = this.games.some(g => g.paused);
        this.games.forEach(g => { if (!g.gameOver) g.paused = !anyPaused; });
      } else if (action === 'restart' && phase === 'down') {
        this.games.forEach(g => g.reset());
        this._autoTargetAll();
        this._overSeen = [];
        this._winSeen = false;
        if (window.FX) { FX.clearVictory(); FX.clear(); }
      }
      return;
    }
    if (playerIndex >= this.numPlayers) return;
    // Block human input on CPU slots.
    if (this.types[playerIndex] && this.types[playerIndex] !== 'human') return;
    if (action === 'target' && phase === 'down') {
      this.cycleTarget(playerIndex);
      return;
    }
    if (action === 'special' && phase === 'down') {
      this._trySpecial(playerIndex);
      return;
    }
    this.games[playerIndex].action(action, phase);
  }

  _trySpecial(idx) {
    const g = this.games[idx];
    if (!g || g.gameOver || g.finished) return;
    const tier = Math.min(3, Math.floor(g.gauge / 100)); // 1=通常, 2=スーパー, 3=ファイナル
    if (tier < 1) return;
    g.gauge = 0;
    this._runSpecial(idx, tier);
  }

  _runSpecial(idx, tier) {
    const g = this.games[idx];
    const cid = this.characters[idx];
    const spec = (typeof charSpecial === 'function') ? charSpecial(cid) : null;
    if (!spec) return;
    let tIdx = g.targetIndex;
    if (tIdx < 0 || tIdx === idx || !this.games[tIdx] || this.games[tIdx].gameOver) {
      tIdx = this._defaultTarget(idx);
    }
    const target = (tIdx >= 0) ? this.games[tIdx] : null;
    const hit = (atk) => { if (target) applyAttack(target, atk, 1); };
    // Effects scale with tier.
    const gm = tier === 3 ? 2.6 : tier === 2 ? 1.7 : 1;
    const gAmt = b => Math.max(1, Math.round(b * gm));
    switch (spec.id) {
      case 'firebreath': hit({ type:'garbage', amount:gAmt(6) }); break;
      case 'maul':       hit({ type:'garbage', amount:gAmt(5) }); break;
      case 'catrush':    hit({ type:'garbage', amount:gAmt(3) }); hit({ type:'weird', amount:1 }); if (tier>=2) hit({ type:'weird', amount:1 }); break;
      case 'shuriken':   { const n = tier + 2; for (let i=0;i<n;i++) hit({ type:'weird', amount:1 }); } break;
      case 'poltergeist':if (target) { target.field.flipV(); target._hitSeq++; } hit({ type:'garbage', amount:gAmt(2) }); if (tier>=3 && target) target.field.flipV(); break;
      case 'abduction':  if (target) { target.field.shuffleBottomRows(tier>=3?12:8); target._hitSeq++; } hit({ type:'garbage', amount:gAmt(2) }); break;
      case 'trick':      if (target) { target.field.randomizeHoles(); target._hitSeq++; } hit({ type:'garbage', amount:gAmt(2) }); if (tier>=3) hit({ type:'speed', amount:1 }); break;
      case 'blizzard':   hit({ type:'speed', amount:1 }); hit({ type:'garbage', amount:gAmt(2) }); break;
      case 'ink':        if (target) { target.blindMs = Math.max(target.blindMs, tier===3?8000:tier===2?6000:4500); target._hitSeq++; } hit({ type:'garbage', amount:gAmt(2) }); break;
      case 'heal':       g.pendingGarbage = 0; if (g.field.clearBottomRows) g.field.clearBottomRows(tier*3); g.score += 1500 * g.level * tier; break;
      case 'overclock':  g.pendingGarbage = 0; hit({ type:'garbage', amount:gAmt(2) }); break;
      case 'mirror':     g.pendingGarbage = 0; g.field.mirrorH(); if (tier>=3 && target) { target.field.mirrorH(); target._hitSeq++; } break;
    }
    // Voice + own-area particles.
    if (window.audioFX) { audioFX.play('outgoing'); audioFX.voice(charVoice(cid), 'attack'); }
    const view = this.views[idx];
    const color = charColor(cid);
    if (window.FX && view && view.charEl) {
      const r = view.charEl.getBoundingClientRect();
      FX.emit(r.left + r.width/2, r.top + r.height/2, color, 24 + tier*12, { star:true, size:4+tier, speed:3 + tier, life:800 });
    }
    // Escalating cut-in by tier.
    if (window.FX) {
      if (tier >= 3) {
        FX.cutin({ level:3, emoji:charEmoji(cid), name:spec.name, telop:spec.telop, color });
        g.shakeMs = Math.max(g.shakeMs, 600);
        if (target) target.shakeMs = Math.max(target.shakeMs, 600);
      } else if (tier === 2) {
        const rect = view ? view.root.getBoundingClientRect() : null;
        FX.cutin({ level:2, rect, emoji:charEmoji(cid), name:spec.name, telop:spec.telop, color });
        g.shakeMs = Math.max(g.shakeMs, 350);
      } else {
        FX.telop(spec.telop, color, charEmoji(cid));
      }
    }
    g._attackSeq++; // attack pose
  }

  tick(dt) {
    for (const g of this.games) g.tick(dt);
    const now = performance.now();
    for (const { ai } of this.ais) ai.tick(now);
    // Refresh dead targets immediately.
    for (let i = 0; i < this.numPlayers; i++) {
      const g = this.games[i];
      if (g.gameOver) continue;
      const t = g.targetIndex;
      if (t < 0 || t >= this.numPlayers || this.games[t].gameOver) {
        g.targetIndex = this._defaultTarget(i);
      }
    }
    // Every 3 seconds, re-evaluate CPU targets so they don't lock onto one
    // victim forever. Humans keep their chosen target.
    if (this._lastReeval == null) this._lastReeval = now;
    if (now - this._lastReeval > 3000) {
      this._lastReeval = now;
      for (const { index } of this.ais) {
        const g = this.games[index];
        if (g.gameOver) continue;
        g.targetIndex = this._defaultTarget(index);
      }
    }
    // CPU players fire their special: always at max tier, otherwise sometimes
    // (so they occasionally save up for スーパー/ファイナル).
    for (const { index } of this.ais) {
      const g = this.games[index];
      if (g.gameOver || g.finished) continue;
      if (g.gauge >= 300) this._trySpecial(index);
      else if (g.gauge >= 100 && Math.random() < 0.012) this._trySpecial(index);
    }
    // Win/lose character voices (each fires once).
    for (let i = 0; i < this.numPlayers; i++) {
      if (this.games[i].gameOver && !this._overSeen[i]) {
        this._overSeen[i] = true;
        if (window.audioFX) audioFX.voice(charVoice(this.characters[i]), 'lose');
      }
    }
    if (this.numPlayers > 1 && !this._winSeen) {
      const alive = this.games.filter(g => !g.gameOver);
      if (alive.length === 1) {
        this._winSeen = true;
        const idx = this.games.indexOf(alive[0]);
        const cid = this.characters[idx];
        if (window.audioFX) audioFX.voice(charVoice(cid), 'win');
        const spec = (typeof charSpecial === 'function') ? charSpecial(cid) : null;
        if (window.FX) FX.victory(charEmoji(cid), charName(cid), spec ? spec.telop : 'やった！', charColor(cid));
      }
    }
  }

  draw() {
    for (let i = 0; i < this.numPlayers; i++) {
      this.views[i].draw(this.games[i], i, this.games);
    }
  }

  status() {
    // Ultra mode: 2-minute score attack.
    if (this.mode === 'ultra') {
      const g0 = this.games[0];
      const remain = Math.max(0, Math.ceil((CFG.ULTRA_MS - g0.elapsedMs) / 1000));
      if (this.numPlayers === 1) {
        if (g0.finished) return `タイムアップ！ スコア ${g0.score.toLocaleString()}`;
        if (g0.gameOver) return 'ゲームオーバー — R でリスタート';
        return `ウルトラ 残り ${remain}秒 · ${g0.score.toLocaleString()}`;
      }
      const allDone = this.games.every(g => g.finished || g.gameOver);
      if (allDone) {
        let bi = 0;
        for (let i = 1; i < this.numPlayers; i++) if (this.games[i].score > this.games[bi].score) bi = i;
        return `${PLAYER_KEYS[bi].label} の勝利！ (${this.games[bi].score.toLocaleString()})`;
      }
      return `ウルトラ 残り ${remain}秒`;
    }
    // Sprint mode: race to clear the goal line count.
    if (this.mode === 'sprint') {
      const finished = this.games
        .map((g, i) => ({ i, g }))
        .filter(o => o.g.finished)
        .sort((a, b) => a.g.finishMs - b.g.finishMs);
      if (this.numPlayers === 1) {
        const g = this.games[0];
        if (g.finished) return `クリア！ ${(g.finishMs / 1000).toFixed(2)}秒`;
        if (g.gameOver) return 'ゲームオーバー — R でリスタート';
        return `スプリント ${g.lines}/${CFG.SPRINT_LINES}`;
      }
      if (finished.length > 0) {
        const w = finished[0];
        return `${PLAYER_KEYS[w.i].label} クリア ${(w.g.finishMs / 1000).toFixed(2)}秒！`;
      }
      const live = this.games.filter(g => !g.gameOver && !g.finished).length;
      return `スプリント — 残り ${live} 人`;
    }
    if (this.numPlayers === 1) {
      return this.games[0].gameOver ? 'ゲームオーバー — R でリスタート' : '進行中';
    }
    const alive = this.games.filter(g => !g.gameOver);
    if (alive.length === 1 && this.games.length > 1) {
      const idx = this.games.indexOf(alive[0]);
      return `${PLAYER_KEYS[idx].label} の勝利！`;
    }
    if (alive.length === 0) return '引き分け';
    return `生存 ${alive.length} 人`;
  }
};
