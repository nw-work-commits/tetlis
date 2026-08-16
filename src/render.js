// Per-player canvas renderer.
// Layout (vertical):
//   [HOLD | NEXT (5 horizontal)]
//   [BOARD]
//   [STATS row]
window.PlayerView = class PlayerView {
  constructor(rootEl, label, cols, cell, charId) {
    this.root = rootEl;
    this.charId = charId || (typeof CHARACTERS !== 'undefined' ? CHARACTERS[0].id : null);
    this.cols = cols || CFG.COLS;
    // Cell size is decided uniformly by Match so every player's square is identical.
    this.cell = cell || CFG.CELL;
    const boardW = this.cols * this.cell;
    const boardH = CFG.ROWS * this.cell;
    const miniCell = 9;
    const slotW = 40;                  // per-piece slot width in mini canvases
    const slotH = 30;                  // mini canvas height
    const holdW = slotW;
    const nextW = slotW * CFG.NEXT_COUNT;

    const emoji = (typeof charEmoji === 'function') ? charEmoji(this.charId) : '🤖';
    this.root.innerHTML = `
      <div class="pname"><span class="pname-text">${label}</span><span class="ptarget" data-k="target">→ —</span></div>
      <div class="pchar" data-k="charbox">
        <div class="pchar-aura"></div>
        <div class="pchar-burst"></div>
        <div class="pchar-emoji">${emoji}</div>
        <div class="pchar-shadow"></div>
      </div>
      <div class="ptop" style="width:${boardW}px">
        <div class="slot hold-slot">
          <div class="mini-label">ホールド</div>
          <canvas class="phold" width="${holdW}" height="${slotH}"></canvas>
        </div>
        <div class="slot next-slot">
          <div class="mini-label">ネクスト</div>
          <canvas class="pnext" width="${nextW}" height="${slotH}"></canvas>
        </div>
      </div>
      <div class="pboard">
        <div class="pgarbage-bar"><div class="pgb-fill" data-k="garbageBar"></div></div>
        <canvas class="pmain" width="${boardW}" height="${boardH}"></canvas>
        <div class="pflash hidden" data-k="flash"></div>
        <div class="ptargeted hidden" data-k="targeted">被ターゲット</div>
        <div class="ptimer hidden" data-k="timer">0.00</div>
        <div class="ppopup" data-k="popup"></div>
        <div class="poverlay hidden"><div class="ptext">READY</div><div class="psub"></div></div>
      </div>
      <div class="pgauge" style="width:${boardW}px">
        <div class="pgauge-fill" data-k="gauge"></div>
        <div class="pgauge-div" style="left:33.33%"></div>
        <div class="pgauge-div" style="left:66.66%"></div>
        <span class="pgauge-label" data-k="gaugelabel">必殺技</span>
      </div>
      <div class="pstats" style="width:${boardW}px">
        <div class="stat"><span class="lbl">スコア</span><span class="val" data-k="score">0</span></div>
        <div class="stat"><span class="lbl">ライン</span><span class="val" data-k="lines">0</span></div>
        <div class="stat"><span class="lbl">レベル</span><span class="val" data-k="level">1</span></div>
        <div class="stat"><span class="lbl">B2B</span><span class="val" data-k="b2b">0</span></div>
        <div class="stat"><span class="lbl">コンボ</span><span class="val" data-k="combo">0</span></div>
      </div>
    `;
    this.board = this.root.querySelector('.pmain');
    this.bctx = this.board.getContext('2d');
    this.hold = this.root.querySelector('.phold');
    this.hctx = this.hold.getContext('2d');
    this.next = this.root.querySelector('.pnext');
    this.nctx = this.next.getContext('2d');
    this.overlay = this.root.querySelector('.poverlay');
    this.overlayText = this.overlay.querySelector('.ptext');
    this.overlaySub = this.overlay.querySelector('.psub');
    this.statVals = {};
    this.root.querySelectorAll('.pstats .val').forEach(el => {
      this.statVals[el.dataset.k] = el;
    });
    this.targetLabel = this.root.querySelector('.ptarget');
    this.garbageBar = this.root.querySelector('[data-k="garbageBar"]');
    this.flashEl = this.root.querySelector('[data-k="flash"]');
    this.targetedEl = this.root.querySelector('[data-k="targeted"]');
    this.timerEl = this.root.querySelector('[data-k="timer"]');
    this.popupEl = this.root.querySelector('[data-k="popup"]');
    this.charEl = this.root.querySelector('[data-k="charbox"]');
    this.gaugeFill = this.root.querySelector('[data-k="gauge"]');
    this.gaugeLabel = this.root.querySelector('[data-k="gaugelabel"]');
    this._seenA = 0; this._seenH = 0; this._wonShown = false;
    this.miniCell = miniCell;
    this.slotW = slotW;
    this.slotH = slotH;
  }

  draw(state, selfIndex, allGames) {
    this._drawBoard(state);
    this._drawHold(state);
    this._drawNext(state);
    this._updateStats(state);
    this._updateAttackUi(state, selfIndex, allGames);
    this._updateJuice(state);
    this._updateChar(state, allGames);
    if (state.gameOver) this.showOverlay('ゲームオーバー');
    else if (state.finished) this.showOverlay('FINISH', this._fmtTime(state.finishMs));
    else if (state.paused) this.showOverlay('一時停止');
    else this.hideOverlay();
    this.root.classList.toggle('dead', !!(state.gameOver || state.finished));
  }

  _fmtTime(ms) {
    return (ms / 1000).toFixed(2) + '秒';
  }

  _charFx(name, dur) {
    const el = this.charEl; if (!el) return;
    el.classList.remove('fx-attack', 'fx-hit', 'fx-win');
    void el.offsetWidth; // reflow so the same animation can retrigger
    el.classList.add('fx-' + name);
    clearTimeout(this._charTimer);
    this._charTimer = setTimeout(() => el.classList.remove('fx-' + name), dur || 600);
  }

  _updateChar(state, allGames) {
    // Special-move gauge (3 tiers, 0..300)
    if (this.gaugeFill) {
      const raw = Math.max(0, Math.min(300, state.gauge || 0));
      this.gaugeFill.style.width = (raw / 3) + '%';
      const tier = Math.min(3, Math.floor(raw / 100));
      this.gaugeFill.classList.toggle('t1', tier === 1);
      this.gaugeFill.classList.toggle('t2', tier === 2);
      this.gaugeFill.classList.toggle('t3', tier === 3);
      this.gaugeFill.classList.toggle('ready', tier >= 1);
      if (this.gaugeLabel) {
        this.gaugeLabel.textContent =
          tier >= 3 ? 'ファイナル必殺!' :
          tier === 2 ? 'スーパー必殺!' :
          tier === 1 ? '必殺技OK!' : '必殺技';
      }
    }
    const el = this.charEl; if (!el) return;
    if (state.gameOver) { el.classList.add('fx-dead'); return; }
    el.classList.remove('fx-dead');
    const aSeq = state._attackSeq || 0;
    const hSeq = state._hitSeq || 0;
    if (aSeq !== this._seenA) { this._seenA = aSeq; this._charFx('attack', 480); }
    if (hSeq !== this._seenH) { this._seenH = hSeq; this._charFx('hit', 540); }
    // Win pose (sole survivor in a multi-player match) — fire once.
    if (allGames && allGames.length > 1 && !this._wonShown) {
      const alive = allGames.filter(g => !g.gameOver);
      if (alive.length === 1 && alive[0] === state) { this._wonShown = true; this._charFx('win', 1000); }
    }
  }

  _updateJuice(state) {
    if (this.popupEl) {
      if (state.popupMs > 0 && state.popupText) {
        this.popupEl.textContent = state.popupText;
        this.popupEl.style.opacity = Math.min(1, state.popupMs / 300);
        this.popupEl.classList.add('show');
      } else {
        this.popupEl.classList.remove('show');
      }
    }
    if (this.board) {
      if (state.shakeMs > 0) {
        const m = Math.min(6, state.shakeMs / 50);
        const dx = (Math.random() * 2 - 1) * m;
        const dy = (Math.random() * 2 - 1) * m;
        this.board.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (this.board.style.transform) {
        this.board.style.transform = '';
      }
    }
    if (this.timerEl) {
      if (state.mode === 'sprint') {
        this.timerEl.classList.remove('hidden');
        const ms = state.finished ? state.finishMs : state.elapsedMs;
        this.timerEl.textContent = `${(ms / 1000).toFixed(2)}秒 · ${state.lines}/${CFG.SPRINT_LINES}`;
      } else {
        this.timerEl.classList.add('hidden');
      }
    }
  }

  _updateAttackUi(state, selfIndex, allGames) {
    // Target label
    if (this.targetLabel) {
      if (state.targetIndex >= 0 && allGames && allGames[state.targetIndex]) {
        const lbl = PLAYER_KEYS[state.targetIndex].label.replace(/\s*\(.+\)/, '');
        this.targetLabel.textContent = `→ ${lbl}`;
        this.targetLabel.classList.remove('inactive');
      } else {
        this.targetLabel.textContent = '→ —';
        this.targetLabel.classList.add('inactive');
      }
    }
    // Garbage warning bar (red, height proportional to pending lines)
    if (this.garbageBar) {
      const max = CFG.ROWS;
      const ratio = Math.min(1, state.pendingGarbage / max);
      this.garbageBar.style.height = `${ratio * 100}%`;
    }
    // Flash overlay on field manipulation / speed buff
    if (this.flashEl) {
      this.flashEl.classList.toggle('hidden', state.flashMs <= 0);
    }
    // "I'm being targeted" indicator (any other player targets me)
    if (this.targetedEl && allGames) {
      let targetedBy = -1;
      for (let j = 0; j < allGames.length; j++) {
        if (j === selfIndex) continue;
        if (allGames[j].gameOver) continue;
        if (allGames[j].targetIndex === selfIndex) { targetedBy = j; break; }
      }
      if (targetedBy >= 0) {
        const lbl = PLAYER_KEYS[targetedBy].label.replace(/\s*\(.+\)/, '');
        this.targetedEl.textContent = `◀ ${lbl}`;
        this.targetedEl.classList.remove('hidden');
      } else {
        this.targetedEl.classList.add('hidden');
      }
    }
  }

  _readBoardBg() {
    return getComputedStyle(document.documentElement).getPropertyValue('--board-bg').trim()
      || '#0d1224';
  }
  _readGridColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--grid').trim()
      || '#1f2742';
  }

  _drawBoard(state) {
    const ctx = this.bctx;
    const w = this.board.width;
    const h = this.board.height;
    ctx.fillStyle = this._readBoardBg();
    ctx.fillRect(0, 0, w, h);
    this._drawGrid(ctx, w, h);

    const offY = CFG.HIDDEN_ROWS;
    // Blind mode: the locked stack is invisible (memory challenge). The active
    // piece and its ghost are still drawn below so you can keep placing pieces.
    if (state.mode !== 'blind') {
      for (let y = offY; y < state.field.rows; y++) {
        for (let x = 0; x < state.field.cols; x++) {
          const c = state.field.grid[y][x];
          if (c) this._drawCell(ctx, x, y - offY, c.color, c.itemType);
        }
      }
    }

    if (state.current) {
      const ghostY = state.field.ghostY(state.current);
      const ghostPiece = { ...state.current, y: ghostY };
      const color = PIECES[state.current.type].color;
      for (const [x, y] of pieceCells(ghostPiece)) {
        if (y - offY < 0) continue;
        this._drawCellOutline(ctx, x, y - offY, color);
      }
      for (const [x, y] of pieceCells(state.current)) {
        if (y - offY < 0) continue;
        this._drawCell(ctx, x, y - offY, color, state.current.itemType);
      }
    }

    // Blind (ink) overlay — covers the board so the player can't see well.
    if (state.blindMs > 0) {
      const a = Math.min(0.88, state.blindMs / 4500 * 0.9 + 0.2);
      ctx.fillStyle = `rgba(8,4,16,${a})`;
      ctx.fillRect(0, 0, w, h);
      // a few ink blobs
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const seed = Math.floor(state.blindMs / 200);
      for (let i = 0; i < 5; i++) {
        const bx = ((seed * 53 + i * 97) % 100) / 100 * w;
        const by = ((seed * 31 + i * 61) % 100) / 100 * h;
        ctx.beginPath(); ctx.arc(bx, by, 18 + (i * 7) % 22, 0, 7); ctx.fill();
      }
    }
  }

  _drawGrid(ctx, w, h) {
    ctx.strokeStyle = this._readGridColor();
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.cell + 0.5, 0);
      ctx.lineTo(x * this.cell + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y <= CFG.ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.cell + 0.5);
      ctx.lineTo(w, y * this.cell + 0.5);
      ctx.stroke();
    }
  }

  _drawCell(ctx, gx, gy, color, itemType) {
    const x = gx * this.cell, y = gy * this.cell, s = this.cell;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 1, y + 1, s - 2, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 1, y + s - 4, s - 2, 3);
    if (itemType) {
      // Bright inner border + star icon
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5);
      ctx.fillStyle = 'rgba(255,255,180,0.95)';
      ctx.font = `bold ${Math.floor(s * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x + s / 2, y + s / 2 + 1);
    }
  }

  _drawCellOutline(ctx, gx, gy, color) {
    const x = gx * this.cell, y = gy * this.cell, s = this.cell;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    ctx.globalAlpha = 1;
  }

  // Draws a tetromino centered in a `slotW × slotH` slot starting at (ox, oy).
  _drawMiniPiece(ctx, type, ox, oy) {
    const data = PIECES[type];
    const cells = data.states[0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of cells) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const cs = this.miniCell;
    const w = (maxX - minX + 1) * cs;
    const h = (maxY - minY + 1) * cs;
    const px0 = ox + (this.slotW - w) / 2;
    const py0 = oy + (this.slotH - h) / 2;
    for (const [x, y] of cells) {
      const px = px0 + (x - minX) * cs;
      const py = py0 + (y - minY) * cs;
      ctx.fillStyle = data.color;
      ctx.fillRect(px + 1, py + 1, cs - 2, cs - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(px + 1, py + 1, cs - 2, 2);
    }
  }

  _drawHold(state) {
    const ctx = this.hctx;
    const w = this.hold.width, h = this.hold.height;
    ctx.fillStyle = this._readBoardBg();
    ctx.fillRect(0, 0, w, h);
    if (state.hold) {
      ctx.globalAlpha = state.holdLocked ? 0.4 : 1;
      this._drawMiniPiece(ctx, state.hold, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  _drawNext(state) {
    const ctx = this.nctx;
    const w = this.next.width, h = this.next.height;
    ctx.fillStyle = this._readBoardBg();
    ctx.fillRect(0, 0, w, h);
    // Use peekQueue so weird pieces forced by attacks are previewed.
    const queue = state.peekQueue ? state.peekQueue(CFG.NEXT_COUNT) : state.bag.peek(CFG.NEXT_COUNT);
    queue.forEach((type, i) => {
      this._drawMiniPiece(ctx, type, i * this.slotW, 0);
    });
  }

  _updateStats(state) {
    this.statVals.score.textContent = state.score.toLocaleString();
    this.statVals.lines.textContent = state.lines;
    this.statVals.level.textContent = state.level;
    this.statVals.b2b.textContent = state.b2b;
    this.statVals.combo.textContent = state.combo >= 0 ? state.combo : 0;
  }

  showOverlay(text, sub) {
    this.overlayText.textContent = text;
    this.overlaySub.textContent = sub || '';
    this.overlay.classList.remove('hidden');
  }
  hideOverlay() { this.overlay.classList.add('hidden'); }
};
