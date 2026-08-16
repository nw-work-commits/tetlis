// Session3D — a single 3D Tetris board (human or CPU) hosted inside #fields.
// Used by the unified menu when game kind = "3d".
window.Session3D = class Session3D {
  constructor(fieldsEl, opts) {
    this.onMenu = opts.onMenu || (()=>{});
    this.mode = opts.mode3d || 'line';
    this.type = opts.type3d || 'human';
    this.charId = opts.char || (typeof CHARACTERS !== 'undefined' ? CHARACTERS[0].id : 'robot');
    this.autoDepth = !!opts.autoDepth;
    this.speedMul = opts.speedMul || 1;
    T3D.setDepth(opts.depth || 10);   // adjustable depth (set before building renderer/game)
    const CELL = 11;
    const emoji = (typeof charEmoji === 'function') ? charEmoji(this.charId) : '🤖';
    // Layout: width = 2 front views. front|side, top|NEXT, then big iso. Char top, score bottom (like 2D).
    fieldsEl.innerHTML = `
      <div class="player t3d-player">
        <div class="pname"><span class="pname-text">3D ${this._typeLabel()}</span></div>
        <div class="pchar"><span class="pchar-emoji" data-k="char">${emoji}</span></div>
        <div class="t3d-grid">
          <div class="t3d-view"><h3>上</h3><canvas data-c="top"></canvas></div>
          <div class="t3d-view"><h3>NEXT</h3><canvas data-c="next"></canvas></div>
          <div class="t3d-view"><h3>正面</h3><canvas data-c="front"></canvas></div>
          <div class="t3d-view"><h3>横</h3><canvas data-c="side"></canvas></div>
          <div class="t3d-view t3d-iso"><h3>立体</h3><canvas data-c="iso"></canvas></div>
        </div>
        <div class="pstats t3d-stats3">
          <div class="stat"><span class="lbl">スコア</span><span class="val" data-k="score">0</span></div>
          <div class="stat"><span class="lbl">消去</span><span class="val" data-k="cleared">0</span></div>
          <div class="stat"><span class="lbl">レベル</span><span class="val" data-k="level">1</span></div>
        </div>
        <div class="kind-keys t3d-keys">${this.autoDepth
          ? '←→移動 · Z/X 回転 · Space ハード · Shift ソフト（奥行きは自動！2D感覚で遊べます）'
          : '←→↑↓移動 · Z/X 正面回転 · C/V 前後回転 · Shift ソフト · Space ハード'}</div>
      </div>`;
    const C = sel => fieldsEl.querySelector(`canvas[data-c="${sel}"]`);
    this.renderer = new T3D.Renderer3D(
      { front:C('front'), side:C('side'), top:C('top'), iso:C('iso'), next:C('next') },
      CELL, 2 * (T3D.W * CELL));   // iso spans 2 front widths
    this.game = new T3D.Game3D(this.mode, { autoDepth:this.autoDepth, speedMul:this.speedMul });
    this.ai = this.type.startsWith('cpu:') ? new T3D.AI3D(this.game, this.type.slice(4)) : null;
    this.pad = this.type==='human' ? new T3D.Pad3D(this.game, 0) : null;
    this.statEls = {};
    fieldsEl.querySelectorAll('.t3d-stats3 .val').forEach(el => this.statEls[el.dataset.k]=el);

    this._kd = e => this._key(e);
    this._ku = e => this._keyup(e);
    window.addEventListener('keydown', this._kd);
    window.addEventListener('keyup', this._ku);
    window.music?.start();
  }
  _typeLabel(){
    if(this.type==='human') return '(人間)';
    const m={'cpu:easy':'(CPU弱)','cpu:normal':'(CPU普通)','cpu:hard':'(CPU強)'}; return m[this.type]||'';
  }
  _key(e){
    if(e.code==='KeyP'){ if(!this.game.over) this.game.paused=!this.game.paused; return; }
    if(e.code==='KeyR'){ this.game = new T3D.Game3D(this.mode, { autoDepth:this.autoDepth, speedMul:this.speedMul }); if(this.ai) this.ai=new T3D.AI3D(this.game,this.type.slice(4)); if(this.pad) this.pad.setGame(this.game); return; }
    if(this.type!=='human') return;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){ this.game.softDrop=true; e.preventDefault(); return; }
    if(this.game.over||this.game.paused) return;
    const g=this.game;
    switch(e.code){
      case 'ArrowLeft': e.preventDefault(); g.tryMove(-1,0,0); break;
      case 'ArrowRight': e.preventDefault(); g.tryMove(1,0,0); break;
      case 'ArrowUp': e.preventDefault(); g.tryMove(0,-1,0); break;
      case 'ArrowDown': e.preventDefault(); g.tryMove(0,1,0); break;
      case 'KeyZ': g.tryRot('Y',-1); break;
      case 'KeyX': g.tryRot('Y',1); break;
      case 'KeyC': g.tryRot('X',1); break;
      case 'KeyV': g.tryRot('X',-1); break;
      case 'Space': e.preventDefault(); g.hardDrop(); break;
    }
  }
  _keyup(e){ if(e.code==='ShiftLeft'||e.code==='ShiftRight') this.game.softDrop=false; }
  tick(dt, now){ if(this.ai) this.ai.tick(now); if(this.pad) this.pad.poll(now); this.game.tick(dt); }
  draw(){
    this.renderer.draw(this.game);
    this.statEls.score.textContent=this.game.score.toLocaleString();
    this.statEls.cleared.textContent=this.game.cleared;
    this.statEls.level.textContent=this.game.level;
  }
  status(){ return this.game.over ? 'ゲームオーバー — R でリスタート' : (this.game.paused?'一時停止':('消去 '+this.game.cleared)); }
  setPaused(p){ if(!this.game.over) this.game.paused=p; }
  destroy(){
    window.removeEventListener('keydown', this._kd);
    window.removeEventListener('keyup', this._ku);
    window.music?.stop();
  }
};
