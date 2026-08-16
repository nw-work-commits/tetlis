// SessionVS — 2D board vs 3D board, hosted inside #fields. Cross-dimension garbage.
window.SessionVS = class SessionVS {
  constructor(fieldsEl, opts) {
    this.onMenu = opts.onMenu || (()=>{});
    this.type2d = opts.vs2d || 'human';
    this.type3d = opts.vs3d || 'cpu:normal';
    this.mode3d = opts.mode3d || 'line';
    this.ROWS_PER_LAYER = 4;   // 2D garbage rows -> one 3D garbage layer (gentle)
    this.POWER_PER_ROW  = 3;   // 3D clear power -> one 2D garbage row (gentle)
    this.decided = false;
    this.char2d = opts.char2d || (typeof CHARACTERS !== 'undefined' ? CHARACTERS[0].id : 'robot');
    this.char3d = opts.char3d || (typeof CHARACTERS !== 'undefined' ? CHARACTERS[1].id : 'alien');
    this.autoDepth3d = !!opts.autoDepth;
    this.speedMul3d = opts.speedMul || 1;
    T3D.setDepth(opts.depth || 10);
    const CELL3D = 11;
    const emoji3d = (typeof charEmoji === 'function') ? charEmoji(this.char3d) : '👾';

    fieldsEl.innerHTML = `
      <div class="vs-wrap">
        <div id="vsBoard2d"></div>
        <div class="player t3d-player">
          <div class="pname"><span class="pname-text" id="vsLab3d">3D</span></div>
          <div class="pchar"><span class="pchar-emoji" data-k="char3d">${emoji3d}</span></div>
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
          </div>
        </div>
      </div>`;

    // 2D
    this.game2d = new Game(null, 'item', 10);
    this.game2d.targetIndex = -1;
    const playerEl = document.createElement('div'); playerEl.className='player';
    fieldsEl.querySelector('#vsBoard2d').appendChild(playerEl);
    this.view2d = new PlayerView(playerEl, this._lab(this.type2d,'2D'), 10, 24, this.char2d);
    // 3D
    const C = sel => fieldsEl.querySelector(`canvas[data-c="${sel}"]`);
    this.game3d = new T3D.Game3D(this.mode3d, { autoDepth:this.autoDepth3d, speedMul:this.speedMul3d });
    this.renderer3d = new T3D.Renderer3D(
      { front:C('front'), side:C('side'), top:C('top'), iso:C('iso'), next:C('next') },
      CELL3D, 2 * (T3D.W * CELL3D));
    this.stat3d = {}; fieldsEl.querySelectorAll('.t3d-stats3 .val').forEach(el=>this.stat3d[el.dataset.k]=el);
    fieldsEl.querySelector('#vsLab3d').textContent=this._lab(this.type3d,'3D');

    // attack wiring
    let acc2to3=0, acc3to2=0;
    this.game2d.onAttacks = (g,list)=>{
      let rows=0; for(const a of list) if(a.type==='garbage') rows+=a.amount;
      if(rows<=0) return; acc2to3+=rows;
      while(acc2to3>=this.ROWS_PER_LAYER){ this.game3d.addGarbage(1); acc2to3-=this.ROWS_PER_LAYER; }
    };
    this.game3d.onAttack = (power)=>{
      acc3to2+=power;
      while(acc3to2>=this.POWER_PER_ROW){ this.game2d.pendingGarbage=Math.min(CFG.PENDING_GARBAGE_CAP,this.game2d.pendingGarbage+1); acc3to2-=this.POWER_PER_ROW; }
    };

    // AIs
    this.ai2d = this.type2d.startsWith('cpu:') ? new CpuAI(this.game2d, this.type2d.slice(4)) : null;
    this.ai3d = this.type3d.startsWith('cpu:') ? new T3D.AI3D(this.game3d, this.type3d.slice(4)) : null;

    // Gamepads — assign pad indices in order to the human side(s).
    // (2D human gets the first pad, 3D human the next.)
    let padCursor = 0;
    if (this.type2d === 'human') {
      const idx = padCursor++;
      this.gp2d = new GamepadInput(idx + 1, (player, action, phase) => {
        if (player === idx && action !== 'target') this.game2d.action(action, phase);
      });
    }
    if (this.type3d === 'human') {
      this.pad3d = new T3D.Pad3D(this.game3d, padCursor++);
    }

    this.keys2d = { KeyA:'left',KeyD:'right',KeyS:'softDown',KeyW:'rotCW',KeyQ:'rotCCW',Space:'hardDrop',KeyE:'hold' };
    this._kd=e=>this._key(e); this._ku=e=>this._keyup(e);
    window.addEventListener('keydown',this._kd); window.addEventListener('keyup',this._ku);
    window.audioFX?.play('start'); window.music?.start();
  }
  _lab(t,dim){ if(t==='human') return dim+' (人間)'; const m={'cpu:easy':'CPU弱','cpu:normal':'CPU普通','cpu:hard':'CPU強'}; return dim+' ('+(m[t]||t)+')'; }
  _key(e){
    if(e.code==='KeyP'){ const p=!this.game2d.paused; this.game2d.paused=p; this.game3d.paused=p; return; }
    if(e.code==='KeyR'){ this.onRestart && this.onRestart(); return; }
    if(this.type2d==='human' && this.keys2d[e.code]){ e.preventDefault(); this.game2d.action(this.keys2d[e.code],'down'); }
    if(this.type3d==='human'){
      const g=this.game3d; if(g.over||g.paused) return;
      switch(e.code){
        case 'ArrowLeft': e.preventDefault(); g.tryMove(-1,0,0); break;
        case 'ArrowRight': e.preventDefault(); g.tryMove(1,0,0); break;
        case 'ArrowUp': e.preventDefault(); g.tryMove(0,-1,0); break;
        case 'ArrowDown': e.preventDefault(); g.tryMove(0,1,0); break;
        case 'KeyZ': g.tryRot('Y',-1); break;
        case 'KeyX': g.tryRot('Y',1); break;
        case 'KeyC': g.tryRot('X',1); break;
        case 'KeyV': g.tryRot('X',-1); break;
        case 'ShiftRight': g.softDrop=true; break;
        case 'Enter': g.hardDrop(); break;
      }
    }
  }
  _keyup(e){
    if(this.type2d==='human' && e.code==='KeyS') this.game2d.action('softDown','up');
    if(this.type3d==='human' && e.code==='ShiftRight') this.game3d.softDrop=false;
  }
  tick(dt, now){
    if(this.ai2d) this.ai2d.tick(now);
    if(this.ai3d) this.ai3d.tick(now);
    if(this.gp2d) this.gp2d.tick(now);
    if(this.pad3d) this.pad3d.poll(now);
    this.game2d.tick(dt); this.game3d.tick(dt);
  }
  draw(){
    this.view2d.draw(this.game2d, 0, [this.game2d]);
    this.renderer3d.draw(this.game3d);
    this.stat3d.sc.textContent=this.game3d.score.toLocaleString();
    this.stat3d.cl.textContent=this.game3d.cleared;
    this.stat3d.gb.textContent=this.game3d.pendingGarbage;
  }
  status(){
    if(!this.decided){
      if(this.game2d.gameOver){ this.decided=true; return '3D の勝利！ (Rでリスタート)'; }
      if(this.game3d.over){ this.decided=true; return '2D の勝利！ (Rでリスタート)'; }
      return '対戦中';
    }
    return this.game2d.gameOver ? '3D の勝利！ (Rでリスタート)' : '2D の勝利！ (Rでリスタート)';
  }
  setPaused(p){ if(!this.game2d.gameOver) this.game2d.paused=p; if(!this.game3d.over) this.game3d.paused=p; }
  destroy(){ window.removeEventListener('keydown',this._kd); window.removeEventListener('keyup',this._ku); if(this.gp2d) this.gp2d.destroy(); window.music?.stop(); }
};
