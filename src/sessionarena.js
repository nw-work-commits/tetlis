// SessionArena — N boards, each 2D or 3D, in one match with cross-dimension garbage.
// Generalises SessionVS: supports 2D vs 3D, 3D vs 3D, and any 2-4 board mix.
// Pure-2D matches keep using Match (full items/specials); solo 3D uses Session3D.
window.SessionArena = class SessionArena {
  constructor(fieldsEl, opts) {
    this.onMenu = opts.onMenu || (() => {});
    this.onRestart = null;                       // set by main.js (rebuild)
    this.dims = opts.dims || [];                 // ['2d'|'3d', ...]
    this.types = opts.types || [];               // ['human'|'cpu:..', ...]
    this.chars = opts.characters || [];
    this.mode = opts.mode || 'item';             // 2D rules
    this.widths = opts.widths || [];
    this.mode3d = opts.mode3d || 'line';
    this.autoDepth = !!opts.autoDepth;
    this.speedMul = opts.speedMul || 1;
    this.touchPlayer = (opts.touchPlayer == null) ? -1 : opts.touchPlayer;
    this.n = this.dims.length;
    this.ROWS_PER_LAYER = 4;   // incoming 2D-rows -> one 3D garbage layer
    this.POWER_PER_ROW = 3;    // 3D clear power -> one 2D garbage row
    this.decided = false;
    this.boards = [];
    this.ais = [];
    this.pads3d = [];
    this._accPower = [];

    T3D.setDepth(opts.depth || 10);

    fieldsEl.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'arena-wrap';
    fieldsEl.appendChild(wrap);

    const cell2d = this._compute2DCell(fieldsEl);
    for (let i = 0; i < this.n; i++) {
      this.boards.push(this.dims[i] === '3d' ? this._build3D(i, wrap) : this._build2D(i, wrap, cell2d));
    }

    // ---- attack wiring (every board funnels into a common "rows" currency) ----
    for (let i = 0; i < this.n; i++) {
      const b = this.boards[i];
      if (b.dim === '2d') {
        b.game.onAttacks = (g, list) => {
          let rows = 0;
          for (const a of list) rows += (a.type === 'garbage') ? a.amount : 1;
          if (rows > 0) this._send(i, rows);
        };
      } else {
        this._accPower[i] = 0;
        b.game.onAttack = (power) => {
          this._accPower[i] += power;
          while (this._accPower[i] >= this.POWER_PER_ROW) { this._send(i, 1); this._accPower[i] -= this.POWER_PER_ROW; }
        };
      }
    }

    // ---- AIs (2D -> CpuAI, 3D -> T3D.AI3D) ----
    for (let i = 0; i < this.n; i++) {
      const t = this.types[i] || 'human';
      if (!t.startsWith('cpu:')) continue;
      const lvl = t.slice(4);
      const b = this.boards[i];
      const ai = (b.dim === '3d') ? new T3D.AI3D(b.game, lvl) : new CpuAI(b.game, lvl);
      this.ais.push(ai);
    }

    // ---- input ----
    // 2D boards (+ globals + touch) go through the standard InputManager.
    this.inputs = new InputManager(
      this.n, this._touchTarget(),
      (idx) => { const b = this.boards[idx]; return b && b.dim === '2d' ? b.view.root : null; },
      (player, action, phase) => this._onAction(player, action, phase)
    );
    // 3D human boards: a gamepad each (pad index = board index).
    for (let i = 0; i < this.n; i++) {
      if (this.boards[i].dim === '3d' && (this.types[i] || 'human') === 'human') {
        this.pads3d.push(new T3D.Pad3D(this.boards[i].game, i));
      }
    }
    // 3D keyboard (arrow cluster) is given to the first 3D human board, but only
    // when the arrow cluster isn't already claimed by a 2D human at P1.
    this.kbd3d = -1;
    const p1IsHuman2d = this.dims[0] === '2d' && (this.types[0] || 'human') === 'human';
    if (!p1IsHuman2d) {
      for (let i = 0; i < this.n; i++) {
        if (this.boards[i].dim === '3d' && (this.types[i] || 'human') === 'human') { this.kbd3d = i; break; }
      }
    }
    this._kd = e => this._key3d(e);
    this._ku = e => this._key3dUp(e);
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);

    window.audioFX?.play('start');
    window.music?.start();
  }

  _typeLabel(t) {
    if (t === 'human') return '人間';
    const m = { 'cpu:easy': 'CPU弱', 'cpu:normal': 'CPU普通', 'cpu:hard': 'CPU強', 'cpu:expert': 'CPU最強' };
    return m[t] || t;
  }

  _compute2DCell(fieldsEl) {
    let totalCols = 0, count2d = 0, count3d = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.dims[i] === '2d') { totalCols += CFG.COLS * (this.widths[i] || 1); count2d++; }
      else count3d++;
    }
    if (count2d === 0) return CFG.CELL;
    const per2dOverhead = 26, gap = 8, sideMargin = 24, threeDWidth = 270;
    const availW = (fieldsEl.clientWidth || window.innerWidth) - sideMargin;
    const widthBudget = availW - threeDWidth * count3d - per2dOverhead * count2d - gap * (this.n - 1);
    const widthCell = Math.floor(widthBudget / Math.max(1, totalCols));
    const availH = (fieldsEl.clientHeight || window.innerHeight) - 200;
    const heightCell = Math.floor(availH / CFG.ROWS);
    return Math.max(8, Math.min(CFG.CELL, widthCell, heightCell));
  }

  _build2D(i, wrap, cell) {
    const el = document.createElement('div');
    el.className = 'player';
    wrap.appendChild(el);
    const base = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
    const label = `${base} (${this._typeLabel(this.types[i] || 'human')})`;
    const cols = CFG.COLS * (this.widths[i] || 1);
    const view = new PlayerView(el, label, cols, cell, this.chars[i]);
    const game = new Game(null, this.mode, cols);
    game.targetIndex = -1;
    return {
      dim: '2d', type: this.types[i] || 'human', game, view, el, charEl: view.charEl, char: this.chars[i],
      recv(rows) { this.game.pendingGarbage = Math.min(CFG.PENDING_GARBAGE_CAP, this.game.pendingGarbage + Math.round(rows)); },
      isOver() { return this.game.gameOver; },
      paused() { return this.game.paused; },
      setPaused(p) { if (!this.game.gameOver) this.game.paused = p; },
      tick(dt) { this.game.tick(dt); },
      draw() { this.view.draw(this.game, 0, [this.game]); },
    };
  }

  _build3D(i, wrap) {
    const CELL3D = 11;
    const emoji = (typeof charEmoji === 'function') ? charEmoji(this.chars[i]) : '👾';
    const base = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
    const label = `${base} 3D (${this._typeLabel(this.types[i] || 'human')})`;
    const el = document.createElement('div');
    el.className = 'player t3d-player';
    el.innerHTML = `
      <div class="pname"><span class="pname-text">${label}</span></div>
      <div class="pchar"><span class="pchar-emoji">${emoji}</span></div>
      <div class="t3d-grid">
        <div class="t3d-view"><h3>上</h3><canvas data-c="top"></canvas></div>
        <div class="t3d-view"><h3>NEXT</h3><canvas data-c="next"></canvas></div>
        <div class="t3d-view"><h3>正面</h3><canvas data-c="front"></canvas></div>
        <div class="t3d-view"><h3>横</h3><canvas data-c="side"></canvas></div>
        <div class="t3d-view t3d-iso"><h3>立体</h3><canvas data-c="iso"></canvas></div>
      </div>
      <div class="pstats t3d-stats3">
        <div class="stat"><span class="lbl">スコア</span><span class="val" data-k="sc">0</span></div>
        <div class="stat"><span class="lbl">消去</span><span class="val" data-k="cl">0</span></div>
        <div class="stat"><span class="lbl">受け</span><span class="val" data-k="gb">0</span></div>
      </div>`;
    wrap.appendChild(el);
    const C = sel => el.querySelector(`canvas[data-c="${sel}"]`);
    const renderer = new T3D.Renderer3D(
      { front: C('front'), side: C('side'), top: C('top'), iso: C('iso'), next: C('next') },
      CELL3D, 2 * (T3D.W * CELL3D));
    const game = new T3D.Game3D(this.mode3d, { autoDepth: this.autoDepth, speedMul: this.speedMul });
    const statEls = {};
    el.querySelectorAll('.t3d-stats3 .val').forEach(v => statEls[v.dataset.k] = v);
    const ROWS_PER_LAYER = this.ROWS_PER_LAYER;
    return {
      dim: '3d', type: this.types[i] || 'human', game, renderer, el,
      charEl: el.querySelector('.pchar-emoji'), char: this.chars[i], statEls, _acc: 0,
      recv(rows) { this._acc += rows; while (this._acc >= ROWS_PER_LAYER) { this.game.addGarbage(1); this._acc -= ROWS_PER_LAYER; } },
      isOver() { return this.game.over; },
      paused() { return this.game.paused; },
      setPaused(p) { if (!this.game.over) this.game.paused = p; },
      tick(dt) { this.game.tick(dt); },
      draw() {
        this.renderer.draw(this.game);
        this.statEls.sc.textContent = this.game.score.toLocaleString();
        this.statEls.cl.textContent = this.game.cleared;
        this.statEls.gb.textContent = this.game.pendingGarbage;
      },
    };
  }

  _touchTarget() {
    const tp = this.touchPlayer;
    if (tp < 0 || tp >= this.n) return -1;
    return this.dims[tp] === '2d' ? tp : -1;   // touch UI only makes sense for a 2D board
  }

  _targetOf(i) {
    for (let s = 1; s <= this.n; s++) {
      const j = (i + s) % this.n;
      if (j !== i && !this.boards[j].isOver()) return j;
    }
    return -1;
  }

  _send(from, rows) {
    const t = this._targetOf(from);
    if (t < 0) return;
    this.boards[t].recv(rows);
    if (window.audioFX) { audioFX.play('outgoing'); setTimeout(() => audioFX.play('incoming'), 80); }
    this._fx(from, t);
  }

  _fx(from, to) {
    const a = this.boards[from], b = this.boards[to];
    if (window.audioFX && a.char) audioFX.voice(charVoice(a.char), 'attack');
    if (!window.FX || !a.charEl || !b.charEl) return;
    const ra = a.charEl.getBoundingClientRect(), rb = b.charEl.getBoundingClientRect();
    const x0 = ra.left + ra.width / 2, y0 = ra.top + ra.height / 2;
    const x1 = rb.left + rb.width / 2, y1 = rb.top + rb.height / 2;
    FX.emit(x0, y0, charColor(a.char), 10, { star: true, size: 3, speed: 2.6 });
    FX.projectile(x0, y0, x1, y1, charShot(a.char), (ex, ey) => {
      FX.emit(ex, ey, '#ff6b6b', 18, { star: true, size: 4, speed: 3 });
      if (window.audioFX && b.char) audioFX.voice(charVoice(b.char), 'hit');
    });
  }

  _onAction(player, action, phase) {
    if (player === -1) {
      if (action === 'pause' && phase === 'down') {
        const anyPaused = this.boards.some(b => b.paused());
        this.boards.forEach(b => b.setPaused(!anyPaused));
      } else if (action === 'restart' && phase === 'down') {
        this.onRestart && this.onRestart();
      }
      return;
    }
    const b = this.boards[player];
    if (!b || b.dim !== '2d' || b.type !== 'human') return;
    if (action === 'target' || action === 'special') return; // arena has no targeting/special UI
    b.game.action(action, phase);
  }

  _key3d(e) {
    if (this.kbd3d < 0) return;
    const g = this.boards[this.kbd3d].game;
    if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') { g.softDrop = true; return; }
    if (g.over || g.paused || !g.cur) return;
    switch (e.code) {
      case 'ArrowLeft':  e.preventDefault(); g.tryMove(-1, 0, 0); break;
      case 'ArrowRight': e.preventDefault(); g.tryMove(1, 0, 0); break;
      case 'ArrowUp':    e.preventDefault(); g.tryMove(0, -1, 0); break;
      case 'ArrowDown':  e.preventDefault(); g.tryMove(0, 1, 0); break;
      case 'KeyZ': g.tryRot('Y', -1); break;
      case 'KeyX': g.tryRot('Y', 1); break;
      case 'KeyC': g.tryRot('X', 1); break;
      case 'KeyV': g.tryRot('X', -1); break;
      case 'Enter': e.preventDefault(); g.hardDrop(); break;
    }
  }
  _key3dUp(e) {
    if (this.kbd3d < 0) return;
    if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') this.boards[this.kbd3d].game.softDrop = false;
  }

  tick(dt, now) {
    for (const ai of this.ais) ai.tick(now);
    for (const p of this.pads3d) p.poll(now);
    this.inputs.tick(now);
    for (const b of this.boards) b.tick(dt);
  }

  draw() { for (const b of this.boards) b.draw(); }

  status() {
    const alive = this.boards.filter(b => !b.isOver());
    if (alive.length <= 1 && this.n > 1) {
      this.decided = true;
      if (alive.length === 1) {
        const i = this.boards.indexOf(alive[0]);
        const base = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
        return `${base} の勝利！ (R でリスタート)`;
      }
      return '引き分け (R でリスタート)';
    }
    return `対戦中 — 生存 ${alive.length} 人`;
  }

  setPaused(p) { this.boards.forEach(b => b.setPaused(p)); }

  destroy() {
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    if (this.inputs) this.inputs.destroy();
    window.music?.stop();
  }
};
