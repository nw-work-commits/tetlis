// Menu: player count, theme, touch player, gamepad status, per-player handicaps, key help.
const DEFAULT_HANDICAP = { startLines: 0, gravityMult: 1.0, attackMult: 1.0, defenseMult: 1.0, targetWeight: 1.0 };

// One-line rule explanation per game mode (shown under the mode cards).
const MODE_INFO = {
  item:       { name: 'アイテム',   desc: 'ライン消去でガベージや妨害効果（反転・シャッフル等）を相手に送る、標準の対戦モード。' },
  super_item: { name: 'スーパー',   desc: 'ミノにアイテムが宿り、それを含むラインを消すと爆弾・雷などの強力効果が発動する派手な対戦。' },
  pure:       { name: '純粋',       desc: 'アイテムも攻撃もなし。ひたすら積んで消す、腕試しの基本ルール。' },
  sprint:     { name: 'スプリント', desc: '40ライン消すまでのタイムアタック。とにかく速さを競う。' },
  tromino:    { name: 'ミノ3',      desc: '3マスの小さなミノだけが落ちてくる。離れた形もあり配置がカギ。' },
  pentomino:  { name: 'ミノ5',      desc: '5マスの大きく複雑なミノが落ちてくる、歯ごたえのあるモード。' },
  random:     { name: 'ランダム',   desc: '3・4・5マスのミノがごちゃ混ぜで落ちてくるカオスモード。' },
  cascade:    { name: 'カスケード', desc: 'ラインを消すと宙に浮いたブロックが下へ落下。連鎖でまとめて消えるとお得。' },
  blind:      { name: 'ブラインド', desc: '置いたブロックが見えなくなる記憶モード。頼りは落下中のミノとゴーストだけ。' },
  ultra:      { name: 'ウルトラ',   desc: '制限時間2分で、どれだけスコアを稼げるかに挑戦する。' },
};

window.Menu = class Menu {
  constructor(onStart) {
    this.onStart = onStart;
    this.playerCount = 2;
    this.touchPlayer = -1;
    this.theme = loadSavedTheme();
    this.handicaps = this._loadHandicaps();
    this.playerTypes = this._loadTypes();
    this.playerWidths = this._loadWidths();
    this.playerChars = this._loadChars();
    this.mode = this._loadMode();
    this.playerDims = this._loadDims();  // per-player '2d' | '3d'
    this.mode3d = 'line';             // 3D clear mode (shared by all 3D boards)
    this.depth3d = 5;                 // 3D board depth (3/5/7/10)
    this.autoDepth3d = true;          // depth auto-assist on/off
    this.speed3d = 'normal';          // 'slow' | 'normal' | 'fast'

    this.menuEl = document.getElementById('menu');
    this.matchEl = document.getElementById('match');
    this.keyHelpEl = document.getElementById('keyHelp');
    this.padStatusEl = document.getElementById('padStatus');
    this.handicapRowsEl = document.getElementById('handicapRows');
    this.typeRowsEl = document.getElementById('typeRows');
    this.widthRowsEl = document.getElementById('widthRows');
    this.charRowsEl = document.getElementById('charRows');
    this.dimRowsEl = document.getElementById('dimRows');

    this._wireModeButtons();
    this._wireCountButtons();
    this._wireThemeButtons();
    this._wireTouchButtons();
    this._wireKindButtons();
    this._setMode(this.mode);
    this._setTheme(this.theme);
    this._setCount(this.playerCount);
    this._setTouch(-1);

    this.onBack = null; // set by main.js to tear down the running match
    document.getElementById('startBtn').addEventListener('click', () => this._start());
    document.getElementById('backBtn').addEventListener('click', () => {
      if (this.onBack) this.onBack();
      else this.show();
    });
    document.getElementById('fsBtn').addEventListener('click', toggleFullscreen);
    document.getElementById('fsBtnMenu').addEventListener('click', toggleFullscreen);

    this._wireAudioControls();
    this._wireBgmControls();
    this._initWizard();

    window.addEventListener('gamepadconnected', () => this._refreshPadStatus());
    window.addEventListener('gamepaddisconnected', () => this._refreshPadStatus());
    this._padPollId = setInterval(() => this._refreshPadStatus(), 1000);
  }

  _loadHandicaps() {
    try {
      const raw = localStorage.getItem('tetlis_handicaps');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.map(h => ({ ...DEFAULT_HANDICAP, ...h }));
        }
      }
    } catch (e) {}
    return [0,1,2,3].map(() => ({ ...DEFAULT_HANDICAP }));
  }
  _saveHandicaps() {
    try { localStorage.setItem('tetlis_handicaps', JSON.stringify(this.handicaps)); } catch (e) {}
  }

  _loadTypes() {
    try {
      const raw = localStorage.getItem('tetlis_types');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.slice(0, 4);
      }
    } catch (e) {}
    return ['human','human','cpu:normal','cpu:normal'];
  }
  _saveTypes() {
    try { localStorage.setItem('tetlis_types', JSON.stringify(this.playerTypes)); } catch (e) {}
  }

  _loadWidths() {
    try {
      const raw = localStorage.getItem('tetlis_widths');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.slice(0, 4).map(n => Math.max(1, Math.min(4, n | 0)));
      }
    } catch (e) {}
    return [1, 1, 1, 1];
  }
  _saveWidths() {
    try { localStorage.setItem('tetlis_widths', JSON.stringify(this.playerWidths)); } catch (e) {}
  }

  _loadChars() {
    const def = (typeof CHARACTERS !== 'undefined')
      ? [CHARACTERS[0].id, CHARACTERS[1].id, CHARACTERS[2].id, CHARACTERS[3].id]
      : ['robot','alien','cat','fox'];
    try {
      const raw = localStorage.getItem('tetlis_chars');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const out = def.slice();
          for (let i = 0; i < 4 && i < arr.length; i++) if (CHAR_BY_ID[arr[i]]) out[i] = arr[i];
          return out;
        }
      }
    } catch (e) {}
    return def;
  }
  _saveChars() {
    try { localStorage.setItem('tetlis_chars', JSON.stringify(this.playerChars)); } catch (e) {}
  }

  _loadDims() {
    try {
      const raw = localStorage.getItem('tetlis_dims');
      if (raw) {
        const a = JSON.parse(raw);
        if (Array.isArray(a)) return a.slice(0, 4).map(d => d === '3d' ? '3d' : '2d');
      }
    } catch (e) {}
    return ['2d', '2d', '2d', '2d'];
  }
  _saveDims() {
    try { localStorage.setItem('tetlis_dims', JSON.stringify(this.playerDims)); } catch (e) {}
  }

  _loadMode() {
    try {
      const m = localStorage.getItem('tetlis_mode');
      if (m && ['item','super_item','pure','sprint','tromino','pentomino'].includes(m)) return m;
    } catch (e) {}
    return 'item';
  }
  _saveMode() {
    try { localStorage.setItem('tetlis_mode', this.mode); } catch (e) {}
  }

  _wireKindButtons() {
    this._segPick('mode3dBtns', b => this.mode3d = b.dataset.m);
    this._segPick('depth3dBtns',  b => this.depth3d = Number(b.dataset.depth));
    this._segPick('assist3dBtns', b => this.autoDepth3d = b.dataset.auto === '1');
    this._segPick('speed3dBtns',  b => this.speed3d = b.dataset.speed);
  }

  // Per-player 2D/3D selector (replaces the old single "形式" choice).
  _renderDims() {
    if (!this.dimRowsEl) return;
    const choices = [{ v: '2d', label: '2D' }, { v: '3d', label: '3D' }];
    const rows = [];
    for (let i = 0; i < this.playerCount; i++) {
      const cur = this.playerDims[i] || '2d';
      const btns = choices.map(c => `<button data-dim="${c.v}" class="${c.v === cur ? 'active' : ''}">${c.label}</button>`).join('');
      const label = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      rows.push(`<div class="type-row" data-p="${i}"><span class="hc-label">${label}</span><div class="seg seg-type">${btns}</div></div>`);
    }
    this.dimRowsEl.innerHTML = rows.join('');
    this.dimRowsEl.querySelectorAll('.type-row').forEach(row => {
      const p = Number(row.dataset.p);
      row.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        this.playerDims[p] = btn.dataset.dim;
        row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
        this._saveDims();
        this._onDimsChanged();
      }));
    });
  }
  _onDimsChanged() {
    this._syncGameRows();
    this._renderWidths();   // widths only apply to 2D boards
    this._renderChars();
    this._renderHandicaps();
    if (this._wizReady) {
      this._renderSteps();
      const steps = this._steps();
      if (!steps.includes(this.step)) this.step = steps[steps.length - 1];
      this._goStep(this.step);
    }
  }
  // Show 2D rules when any board is 2D, 3D detail when any board is 3D.
  _syncGameRows() {
    const dims = this.playerDims.slice(0, this.playerCount);
    const any2d = dims.some(d => d === '2d');
    const any3d = dims.some(d => d === '3d');
    const show = (id, on) => { const e = document.getElementById(id); if (e) e.classList.toggle('hidden', !on); };
    show('row-mode', any2d);
    show('row-modedesc', any2d);
    show('row-3ddepth', any3d);
    show('row-3dassist', any3d);
    show('row-3dspeed', any3d);
    show('row-3dmode', any3d);
    show('row-widths', any2d);
    show('row-touch', any2d);
    show('row-keys', any2d);
  }
  _segPick(id, set) {
    document.querySelectorAll('#'+id+' button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#'+id+' button').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); set(b);
    }));
  }
  _wireModeButtons() {
    document.querySelectorAll('#modeBtns button').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
      // Hover previews that mode's rule; leaving reverts to the selected one.
      btn.addEventListener('mouseenter', () => this._showModeDesc(btn.dataset.mode));
      btn.addEventListener('mouseleave', () => this._showModeDesc(this.mode));
    });
  }
  _showModeDesc(m) {
    const el = document.getElementById('modeDesc');
    if (!el) return;
    const info = MODE_INFO[m] || MODE_INFO[this.mode];
    if (info) el.innerHTML = `<b>${info.name}</b> — ${info.desc}`;
  }
  _setMode(m) {
    this.mode = m;
    document.querySelectorAll('#modeBtns button').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    this._showModeDesc(m);
    this._saveMode();
    if (this._wizReady) this._updateNav();
  }

  _wireCountButtons() {
    document.querySelectorAll('#playerCountBtns button').forEach(btn => {
      btn.addEventListener('click', () => this._setCount(Number(btn.dataset.n)));
    });
  }
  _wireThemeButtons() {
    document.querySelectorAll('#themeBtns button').forEach(btn => {
      btn.addEventListener('click', () => this._setTheme(btn.dataset.theme));
    });
  }
  _wireTouchButtons() {
    document.querySelectorAll('#touchBtns button').forEach(btn => {
      btn.addEventListener('click', () => this._setTouch(Number(btn.dataset.touch)));
    });
  }

  _setCount(n) {
    this.playerCount = n;
    document.querySelectorAll('#playerCountBtns button').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.n) === n);
    });
    document.querySelectorAll('#touchBtns button').forEach(b => {
      const idx = Number(b.dataset.touch);
      b.disabled = idx >= n;
      b.classList.toggle('disabled', idx >= n);
    });
    if (this.touchPlayer >= n) this._setTouch(-1);
    this._renderKeyHelp();
    this._renderHandicaps();
    this._renderTypes();
    this._renderDims();
    this._renderWidths();
    this._renderChars();
    this._syncGameRows();
    if (this._wizReady) { this._renderSteps(); this._updateNav(); }
  }
  _setTheme(t) {
    this.theme = t;
    applyTheme(t);
    document.querySelectorAll('#themeBtns button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === t);
    });
    if (this._wizReady) this._updateNav();
  }
  _setTouch(idx) {
    this.touchPlayer = idx;
    document.querySelectorAll('#touchBtns button').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.touch) === idx);
    });
  }

  _renderKeyHelp() {
    const rows = [];
    for (let i = 0; i < this.playerCount; i++) {
      const meta = PLAYER_KEYS[i];
      rows.push(`<span class="kh-player">${meta.label}</span><span>${meta.desc}</span>`);
    }
    this.keyHelpEl.innerHTML = rows.join('');
  }

  _renderTypes() {
    const choices = [
      { id: 'human',      label: '人間' },
      { id: 'cpu:easy',   label: 'CPU 弱' },
      { id: 'cpu:normal', label: 'CPU 普通' },
      { id: 'cpu:hard',   label: 'CPU 強' },
      { id: 'cpu:expert', label: 'CPU 最強' },
    ];
    const rows = [];
    for (let i = 0; i < this.playerCount; i++) {
      const cur = this.playerTypes[i] || 'human';
      const btns = choices.map(c =>
        `<button data-type="${c.id}" class="${c.id === cur ? 'active' : ''}">${c.label}</button>`
      ).join('');
      const label = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      rows.push(`
        <div class="type-row" data-p="${i}">
          <span class="hc-label">${label}</span>
          <div class="seg seg-type">${btns}</div>
        </div>
      `);
    }
    this.typeRowsEl.innerHTML = rows.join('');
    this.typeRowsEl.querySelectorAll('.type-row').forEach(row => {
      const p = Number(row.dataset.p);
      row.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          this.playerTypes[p] = btn.dataset.type;
          row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
          this._saveTypes();
        });
      });
    });
  }

  _renderWidths() {
    const choices = [
      { v: 1, label: '標準' },
      { v: 2, label: 'ワイド' },
      { v: 3, label: 'ワイド＋' },
      { v: 4, label: 'メガ' },
    ];
    const rows = [];
    for (let i = 0; i < this.playerCount; i++) {
      if ((this.playerDims[i] || '2d') !== '2d') continue;   // width applies to 2D boards only
      const cur = this.playerWidths[i] || 1;
      const btns = choices.map(c =>
        `<button data-w="${c.v}" class="${c.v === cur ? 'active' : ''}">${c.label}</button>`
      ).join('');
      const label = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      rows.push(`
        <div class="type-row" data-p="${i}">
          <span class="hc-label">${label}</span>
          <div class="seg seg-type">${btns}</div>
        </div>
      `);
    }
    this.widthRowsEl.innerHTML = rows.join('');
    this.widthRowsEl.querySelectorAll('.type-row').forEach(row => {
      const p = Number(row.dataset.p);
      row.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          this.playerWidths[p] = Number(btn.dataset.w);
          row.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
          this._saveWidths();
        });
      });
    });
  }

  // One character slot per player; label notes the chosen dimension.
  _charSlots() {
    const out = [];
    for (let i = 0; i < this.playerCount; i++) {
      const base = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      const tag = (this.playerDims[i] || '2d') === '3d' ? ' · 3D' : '';
      out.push({ i, label: base + tag });
    }
    return out;
  }
  _renderChars() {
    if (!this.charRowsEl) return;
    const tiles = cur => CHARACTERS.map(c =>
      `<button class="char-tile${c.id === cur ? ' active' : ''}" data-id="${c.id}" title="${c.name}">
         <span class="ct-emoji">${c.emoji}</span><span class="ct-name">${c.name}</span>
       </button>`).join('');
    this.charRowsEl.innerHTML = this._charSlots().map(s =>
      `<div class="char-player" data-slot="${s.i}">
         <span class="char-player-label">${s.label}</span>
         <div class="char-tiles">${tiles(this.playerChars[s.i] || CHARACTERS[0].id)}</div>
       </div>`).join('');
    this.charRowsEl.querySelectorAll('.char-player').forEach(block => {
      const slot = Number(block.dataset.slot);
      block.querySelectorAll('.char-tile').forEach(tile => {
        tile.addEventListener('click', () => {
          this.playerChars[slot] = tile.dataset.id;
          block.querySelectorAll('.char-tile').forEach(t => t.classList.toggle('active', t === tile));
          this._saveChars();
        });
      });
    });
  }

  _renderHandicaps() {
    const rows = [];
    for (let i = 0; i < this.playerCount; i++) {
      const h = this.handicaps[i] || (this.handicaps[i] = { ...DEFAULT_HANDICAP });
      const label = PLAYER_KEYS[i].label.replace(/\s*\(.+\)/, '');
      rows.push(`
        <div class="hc-row" data-p="${i}">
          <span class="hc-label">${label}</span>
          <label>初期段 <input type="number" min="0" max="15" step="1" value="${h.startLines}" data-k="startLines"></label>
          <label>速度 <input type="number" min="0.3" max="3" step="0.1" value="${h.gravityMult}" data-k="gravityMult">×</label>
          <label>攻 <input type="number" min="0.2" max="3" step="0.1" value="${h.attackMult}" data-k="attackMult">×</label>
          <label>防 <input type="number" min="0.2" max="3" step="0.1" value="${h.defenseMult}" data-k="defenseMult">×</label>
          <label>狙われ <input type="number" min="0.1" max="2" step="0.1" value="${h.targetWeight}" data-k="targetWeight">×</label>
        </div>
      `);
    }
    this.handicapRowsEl.innerHTML = rows.join('');
    this.handicapRowsEl.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('change', () => {
        const row = inp.closest('.hc-row');
        const p = Number(row.dataset.p);
        const key = inp.dataset.k;
        const num = Number(inp.value);
        if (!isFinite(num)) return;
        this.handicaps[p][key] = num;
        this._saveHandicaps();
      });
    });
  }

  _wireAudioControls() {
    const range = document.getElementById('volumeRange');
    const valEl = document.getElementById('volumeVal');
    const muteMenu = document.getElementById('muteBtnMenu');
    const muteHud = document.getElementById('muteBtn');
    const sync = () => {
      const pct = Math.round((window.audioFX?.volume ?? 0.4) * 100);
      if (range) range.value = String(pct);
      if (valEl) valEl.textContent = pct + '%';
      const muted = !!window.audioFX?.muted;
      const ic = muted ? '🔇' : '🔊';
      if (muteMenu) muteMenu.textContent = ic;
      if (muteHud) muteHud.textContent = ic;
    };
    if (range) {
      range.addEventListener('input', () => {
        const v = Number(range.value) / 100;
        window.audioFX?.setVolume(v);
        if (valEl) valEl.textContent = Math.round(v * 100) + '%';
      });
    }
    const toggleMute = () => { window.audioFX?.toggleMuted(); sync(); };
    if (muteMenu) muteMenu.addEventListener('click', toggleMute);
    if (muteHud) muteHud.addEventListener('click', toggleMute);
    sync();
  }

  _wireBgmControls() {
    const btns = document.querySelectorAll('#bgmBtns button');
    const sync = () => {
      const cur = window.music?.current || 'off';
      btns.forEach(b => b.classList.toggle('active', b.dataset.bgm === cur));
      const vr = document.getElementById('bgmVolRange');
      if (vr) vr.value = String(Math.round((window.music?.volume ?? 0.5) * 100));
    };
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.music?.setTrack(btn.dataset.bgm);
        // Preview the track briefly on the menu so user can hear before starting
        if (btn.dataset.bgm !== 'off') window.music?.start();
        else window.music?.stop();
        sync();
      });
    });
    const vr = document.getElementById('bgmVolRange');
    if (vr) {
      vr.addEventListener('input', () => {
        window.music?.setVolume(Number(vr.value) / 100);
      });
    }
    sync();
  }

  _refreshPadStatus() {
    if (!this.padStatusEl) return;
    const pads = GamepadInput.listConnected();
    if (pads.length === 0) {
      this.padStatusEl.textContent = 'ゲームパッド未接続（接続後、何かボタンを押してください）';
    } else {
      this.padStatusEl.innerHTML = pads.map(p =>
        `<span class="pad-chip">パッド${p.index} → P${p.index + 1}: ${p.id.slice(0, 36)}</span>`
      ).join('');
    }
  }

  // ===== Step wizard =====
  _initWizard() {
    this.step = 'look';
    document.getElementById('wizPrev').addEventListener('click', () => this._navStep(-1));
    document.getElementById('wizNext').addEventListener('click', () => this._navStep(1));
    document.getElementById('wizQuick').addEventListener('click', () => this._start());
    this._wizReady = true;
    this._renderDims();
    this._syncGameRows();
    this._renderSteps();
    this._goStep('look');
  }
  // Ordered list of currently-relevant steps.
  _steps() {
    const dims = this.playerDims.slice(0, this.playerCount);
    const all2d = dims.every(d => d === '2d');
    const arr = ['look', 'count', 'game', 'player', 'char'];
    if (all2d && this.playerCount >= 2) arr.push('handicap');   // handicap = pure-2D Match only
    return arr;
  }
  _renderSteps() {
    const meta = { look: '見た目', count: '人数', game: 'ゲーム', player: '操作', char: 'キャラ', handicap: 'ハンデ' };
    const steps = this._steps();
    const ol = document.getElementById('wizardSteps');
    if (!ol) return;
    ol.innerHTML = steps.map((s, idx) =>
      `<li class="wstep-dot${s === this.step ? ' active' : ''}" data-go="${s}"><b>${idx + 1}</b><span>${meta[s]}</span></li>`
    ).join('');
    ol.querySelectorAll('.wstep-dot').forEach(d => d.addEventListener('click', () => this._goStep(d.dataset.go)));
  }
  _goStep(key) {
    const steps = this._steps();
    if (!steps.includes(key)) key = steps[steps.length - 1];
    this.step = key;
    document.querySelectorAll('#wizardBody .wstep').forEach(sec =>
      sec.classList.toggle('active', sec.dataset.step === key));
    this._renderSteps();
    this._updateNav();
    const body = document.getElementById('wizardBody');
    if (body) body.scrollTop = 0;
    if (key === 'player') this._refreshPadStatus();
  }
  _navStep(dir) {
    const steps = this._steps();
    let idx = steps.indexOf(this.step);
    if (idx < 0) idx = 0;
    idx = Math.max(0, Math.min(steps.length - 1, idx + dir));
    this._goStep(steps[idx]);
  }
  _updateNav() {
    const steps = this._steps();
    const idx = Math.max(0, steps.indexOf(this.step));
    const isFirst = idx <= 0, isLast = idx === steps.length - 1;
    const set = (id, hidden) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', hidden); };
    set('wizPrev', isFirst);
    set('wizNext', isLast);
    set('startBtn', !isLast);
    set('wizQuick', isFirst || isLast);   // quick-start shortcut on the middle steps
    const sum = document.getElementById('wizSummary');
    if (sum) sum.textContent = this._summary();
  }
  _summary() {
    const modeLabel = { item: 'アイテム', super_item: 'スーパー', pure: '純粋', sprint: 'スプリント', tromino: 'ミノ3', pentomino: 'ミノ5', random: 'ランダム', cascade: 'カスケード', blind: 'ブラインド', ultra: 'ウルトラ' }[this.mode] || '';
    const themeLabel = (document.querySelector(`#themeBtns button[data-theme="${this.theme}"]`)?.textContent || '').trim();
    const dims = this.playerDims.slice(0, this.playerCount);
    const all2d = dims.every(d => d === '2d');
    const all3d = dims.every(d => d === '3d');
    const parts = [];
    parts.push(this.playerCount > 1 ? `${this.playerCount}人` : '1人');
    parts.push(all2d ? '2D' : all3d ? '3D' : '2D+3D');
    if (dims.some(d => d === '2d')) parts.push(modeLabel);
    if (themeLabel) parts.push(themeLabel);
    return parts.filter(Boolean).join(' · ');
  }

  _start() {
    this.menuEl.classList.add('hidden');
    this.matchEl.classList.remove('hidden');
    applyTheme(this.theme);
    const usedHandicaps = this.handicaps.slice(0, this.playerCount);
    const usedTypes = this.playerTypes.slice(0, this.playerCount);
    const usedWidths = this.playerWidths.slice(0, this.playerCount);
    const usedChars = this.playerChars.slice(0, this.playerCount);
    const usedDims = this.playerDims.slice(0, this.playerCount);
    let touch = this.touchPlayer;
    if (touch >= 0 && (usedTypes[touch] !== 'human' || usedDims[touch] !== '2d')) touch = -1;
    // 3D settings are chosen independently (depth / depth-assist / fall speed).
    const speedMul = this.speed3d === 'slow' ? 1.7 : this.speed3d === 'fast' ? 0.6 : 1.0;
    this.onStart({
      // Per-player dimension drives the engine (2D Match / 3D / mixed Arena).
      dims: usedDims,
      numPlayers: this.playerCount, theme: this.theme, touchPlayer: touch,
      handicaps: usedHandicaps, types: usedTypes, mode: this.mode, widths: usedWidths,
      characters: usedChars,
      // 3D settings (shared by all 3D boards)
      mode3d: this.mode3d, depth3d: this.depth3d, autoDepth3d: this.autoDepth3d, speedMul3d: speedMul,
    });
  }
  show() {
    this.matchEl.classList.add('hidden');
    this.menuEl.classList.remove('hidden');
    this._refreshPadStatus();
    window.music?.stop();
  }
};

window.toggleFullscreen = function () {
  const root = document.documentElement;
  if (!document.fullscreenElement) {
    if (root.requestFullscreen) root.requestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
};
