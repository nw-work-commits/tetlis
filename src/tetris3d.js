// Namespaced 3D Tetris engine + renderer + simple AI + cross-dimension garbage.
// Exposes window.T3D so it can coexist with the 2D engine globals.
(function () {
  const W = 10; let D = 10; const H = 16;   // D (depth) is adjustable for easy mode
  const COLORS = {
    I:'#22d3ee', O:'#fbbf24', T:'#a855f7', S:'#22c55e', Z:'#ef4444', J:'#3b82f6', L:'#f97316'
  };
  const GARBAGE_COLOR = '#5a6378';
  // Cells = [dx,dy,dz] from the CENTER cell (at 0,0,0). Flat front-facing sheets (dy=0). +z = down.
  const SHAPES = {
    I:[[-1,0,0],[0,0,0],[1,0,0],[2,0,0]],
    O:[[0,0,0],[1,0,0],[0,0,1],[1,0,1]],
    T:[[-1,0,0],[0,0,0],[1,0,0],[0,0,1]],
    S:[[0,0,-1],[1,0,-1],[-1,0,0],[0,0,0]],
    Z:[[-1,0,-1],[0,0,-1],[0,0,0],[1,0,0]],
    J:[[-1,0,-1],[-1,0,0],[0,0,0],[1,0,0]],
    L:[[1,0,-1],[-1,0,0],[0,0,0],[1,0,0]],
  };
  const TYPES = Object.keys(SHAPES);

  function emptyGrid(){
    const g = new Array(H);
    for(let z=0;z<H;z++){ g[z]=new Array(D); for(let y=0;y<D;y++){ g[z][y]=new Array(W).fill(null); } }
    return g;
  }
  class Bag3{
    constructor(){ this.q=[]; this._fill(); this._fill(); }
    _fill(){ const a=TYPES.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} this.q.push(...a); }
    next(){ if(this.q.length<=TYPES.length) this._fill(); return this.q.shift(); }
    peek(){ if(this.q.length<1) this._fill(); return this.q[0]; }
    peekN(n){ while(this.q.length<n) this._fill(); return this.q.slice(0,n); }
  }
  const rotY=(cells,dir)=>cells.map(([x,y,z])=> dir>0?[z,y,-x]:[-z,y,x]);
  const rotX=(cells,dir)=>cells.map(([x,y,z])=> dir>0?[x,-z,y]:[x,z,-y]);

  class Game3D{
    constructor(mode, opts){ this.mode = mode || 'line'; opts=opts||{};
      this.autoDepth = !!opts.autoDepth;   // game auto-picks the depth (2D-like play)
      this.speedMul = opts.speedMul || 1;  // gravity multiplier (>1 slower, <1 faster)
      this.onAttack=null; this.reset(); }
    reset(){
      this.grid=emptyGrid(); this.bag=new Bag3();
      this.score=0; this.cleared=0; this.level=1;
      this.over=false; this.paused=false; this.softDrop=false; this.gravAcc=0;
      this.pendingGarbage=0; // garbage layers waiting to be added on next spawn
      this.spawn();
    }
    spawn(type){
      if(this.pendingGarbage>0){
        const ok=this._addGarbageLayers(this.pendingGarbage); this.pendingGarbage=0;
        if(!ok){ this.over=true; this.cur=null; return; }
      }
      type=type||this.bag.next();
      this.cur={ type, cells:SHAPES[type].map(c=>c.slice()), x:Math.floor(W/2)-1, y:Math.floor(D/2), z:1 };
      if(this.collides(this.cur)){ this.over=true; this.cur=null; return; }
      if(this.autoDepth) this._autoBestY();
    }
    // Auto-depth: shift the piece to the depth (Y) where it would land deepest,
    // so the player can ignore depth and play 2D-style.
    _autoBestY(){
      if(!this.cur) return;
      let bestY=this.cur.y, bestZ=-1;
      for(let y=0;y<D;y++){
        const t={...this.cur,y};
        if(this.collides(t)) continue;            // can't even sit at the top here
        let z=t.z; while(true){ const c={...t,z:z+1}; if(this.collides(c)) break; z++; }
        if(z>bestZ){ bestZ=z; bestY=y; }
      }
      this.cur.y=bestY;
    }
    cellsAbs(p){ return p.cells.map(([dx,dy,dz])=>[p.x+dx,p.y+dy,p.z+dz]); }
    collides(p){
      for(const [x,y,z] of this.cellsAbs(p)){
        if(x<0||x>=W||y<0||y>=D||z>=H) return true;
        if(z<0) continue;
        if(this.grid[z][y][x]) return true;
      }
      return false;
    }
    tryMove(dx,dy,dz){
      if(this.autoDepth && dy!==0 && dz===0) return false;   // depth is automatic
      const t={...this.cur,x:this.cur.x+dx,y:this.cur.y+dy,z:this.cur.z+dz};
      if(!this.collides(t)){ this.cur=t; if(this.autoDepth && dx!==0) this._autoBestY(); return true; }
      return false; }
    tryRot(axis,dir){
      const rotated = axis==='Y'?rotY(this.cur.cells,dir):rotX(this.cur.cells,dir);
      const kicks=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,-1]];
      for(const [kx,ky,kz] of kicks){ const t={...this.cur,cells:rotated,x:this.cur.x+kx,y:this.cur.y+ky,z:this.cur.z+kz};
        if(!this.collides(t)){ this.cur=t; if(this.autoDepth) this._autoBestY(); return true; } }
      return false;
    }
    ghostZ(){ let z=this.cur.z; while(true){ const c={...this.cur,z:z+1}; if(this.collides(c)) break; z++; } return z; }
    hardDrop(){ let n=0; while(this.tryMove(0,0,1)) n++; this.score+=n*2; this.lock(); }
    lock(){
      const col=COLORS[this.cur.type];
      for(const [x,y,z] of this.cellsAbs(this.cur)) if(z>=0&&z<H&&y>=0&&y<D&&x>=0&&x<W) this.grid[z][y][x]={color:col};
      const allHidden=this.cellsAbs(this.cur).every(([,,z])=>z<0);
      const n = this.mode==='plane'?this._clearPlanes():this._clearLines();
      if(n>0){
        this.cleared+=n;
        const base=this.mode==='plane'?1000:100;
        this.score+=base*n*n*this.level;
        this.level=1+Math.floor(this.cleared/(this.mode==='plane'?2:10));
        if(this.onAttack){
          // attack "power": plane clears hit much harder than line clears.
          const power = this.mode==='plane' ? n*8 : n;
          this.onAttack(power);
        }
      }
      if(allHidden){ this.over=true; this.cur=null; return; }
      this.cur=null; this.spawn();
    }
    _clearPlanes(){
      let kept=[];
      for(let z=0;z<H;z++){ let full=true;
        for(let y=0;y<D&&full;y++) for(let x=0;x<W;x++) if(!this.grid[z][y][x]){full=false;break;}
        if(!full) kept.push(this.grid[z]); }
      const cleared=H-kept.length;
      if(cleared>0){ const ng=[];
        for(let i=0;i<cleared;i++){ const layer=new Array(D); for(let y=0;y<D;y++) layer[y]=new Array(W).fill(null); ng.push(layer); }
        this.grid=ng.concat(kept); }
      return cleared;
    }
    _clearLines(){
      const toClear=new Set(); const key=(x,y,z)=>z*W*D+y*W+x;
      for(let z=0;z<H;z++) for(let y=0;y<D;y++){ let full=true; for(let x=0;x<W;x++) if(!this.grid[z][y][x]){full=false;break;} if(full) for(let x=0;x<W;x++) toClear.add(key(x,y,z)); }
      for(let z=0;z<H;z++) for(let x=0;x<W;x++){ let full=true; for(let y=0;y<D;y++) if(!this.grid[z][y][x]){full=false;break;} if(full) for(let y=0;y<D;y++) toClear.add(key(x,y,z)); }
      if(toClear.size===0) return 0;
      for(let z=0;z<H;z++) for(let y=0;y<D;y++) for(let x=0;x<W;x++) if(toClear.has(key(x,y,z))) this.grid[z][y][x]=null;
      for(let x=0;x<W;x++) for(let y=0;y<D;y++){ const stack=[]; for(let z=0;z<H;z++) if(this.grid[z][y][x]) stack.push(this.grid[z][y][x]);
        for(let z=0;z<H;z++) this.grid[z][y][x]=(z<H-stack.length)?null:stack[z-(H-stack.length)]; }
      return Math.round(toClear.size/W);
    }
    // Add N garbage layers at the bottom (pushing the stack up). Returns false on overflow.
    _addGarbageLayers(n){
      for(let k=0;k<n;k++){
        // overflow check: top plane must be empty to push
        let topUsed=false; for(let y=0;y<D&&!topUsed;y++) for(let x=0;x<W;x++) if(this.grid[0][y][x]){topUsed=true;break;}
        if(topUsed) return false;
        this.grid.shift();
        // build a garbage layer: filled with a permutation of holes (guarantees no full line),
        // then extra random holes so it stays diggable (~55% filled).
        const layer=new Array(D); for(let y=0;y<D;y++) layer[y]=new Array(W).fill(null);
        for(let y=0;y<D;y++) for(let x=0;x<W;x++) layer[y][x]={color:GARBAGE_COLOR};
        const perm=[...Array(W).keys()]; for(let i=perm.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[perm[i],perm[j]]=[perm[j],perm[i]];}
        for(let x=0;x<W;x++) layer[perm[x]][x]=null;            // one hole per row & column
        // punch extra holes down to ~55% fill
        let filled=0; for(let y=0;y<D;y++) for(let x=0;x<W;x++) if(layer[y][x]) filled++;
        const target=Math.floor(W*D*0.55);
        while(filled>target){ const x=Math.random()*W|0,y=Math.random()*D|0; if(layer[y][x]){layer[y][x]=null;filled--;} }
        this.grid.push(layer);
      }
      return true;
    }
    addGarbage(layers){ this.pendingGarbage+=Math.max(0,layers|0); }
    gravityMs(){ const base=Math.max(80, 700-(this.level-1)*55); return base * this.speedMul; }
    tick(dt){
      if(this.over||this.paused||!this.cur) return;
      const step=this.softDrop?Math.max(this.gravityMs()/12,16):this.gravityMs();
      this.gravAcc+=dt;
      while(this.gravAcc>=step){ this.gravAcc-=step; if(!this.tryMove(0,0,1)){ this.lock(); break; } else if(this.softDrop) this.score+=1; }
    }
    stackHeight(){ for(let z=0;z<H;z++){ for(let y=0;y<D;y++) for(let x=0;x<W;x++) if(this.grid[z][y][x]) return H-z; } return 0; }
  }

  // ---------------- Renderer ----------------
  class Renderer3D{
    constructor(canvases, cell, isoW){
      this.cv=canvases; this.cell=cell||18;
      const C=this.cell;
      canvases.front.width=W*C; canvases.front.height=H*C;
      canvases.side.width=D*C;  canvases.side.height=H*C;
      canvases.top.width=W*C;   canvases.top.height=D*C;
      // Isometric view: fit a target width (default derived from cell).
      const targetW = isoW || Math.ceil((W+D)*C*0.6);
      const tw = targetW/(W+D);
      const th = tw*0.5;
      const tz = tw*0.55;
      this.iso={ tw, th, tz, ox:0, oy:Math.round(tw) };
      if(canvases.iso){
        canvases.iso.width = Math.ceil((W+D)*tw) + 10;
        canvases.iso.height = Math.ceil((W+D)*th + H*tz) + 14;
        this.iso.ox = canvases.iso.width/2;
      }
      if(canvases.next){
        const ntw=C*0.45, nth=C*0.25, ntz=C*0.42;
        this.nextM={ tw:ntw, th:nth, tz:ntz };
        canvases.next.width = Math.ceil(C*7.5);
        canvases.next.height = Math.ceil(D*C);  // match the 上 view height (fills the gap)
      }
    }
    _shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
      r=Math.min(255,r*f|0); g=Math.min(255,g*f|0); b=Math.min(255,b*f|0); return `rgb(${r},${g},${b})`; }
    _grid(ctx,cols,rows){ const C=this.cell; ctx.strokeStyle='#1f2742'; ctx.lineWidth=1;
      for(let x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(x*C+.5,0);ctx.lineTo(x*C+.5,rows*C);ctx.stroke();}
      for(let y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(0,y*C+.5);ctx.lineTo(cols*C,y*C+.5);ctx.stroke();} }
    _cell(ctx,cx,cy,color,opts){ const C=this.cell; opts=opts||{};
      const x=cx*C, y=cy*C;
      if(opts.ghost){ // landing preview: translucent fill + bold glowing outline
        ctx.globalAlpha=0.3; ctx.fillStyle=color; ctx.fillRect(x+1,y+1,C-2,C-2); ctx.globalAlpha=1;
        ctx.strokeStyle=color; ctx.lineWidth=2; ctx.strokeRect(x+2,y+2,C-4,C-4);
        ctx.globalAlpha=0.5; ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(x+3,y+3,C-6,C-6); ctx.globalAlpha=1;
        return;
      }
      ctx.fillStyle=color; ctx.fillRect(x+1,y+1,C-2,C-2);
      ctx.fillStyle='rgba(255,255,255,.18)'; ctx.fillRect(x+1,y+1,C-2,3);
      if(opts.center){ ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x+C/2,y+C/2,3,0,7); ctx.fill(); } }
    draw(g){
      this._front(g); this._side(g); this._top(g); if(this.cv.iso) this._iso(g); if(this.cv.next) this._next(g);
    }
    _front(g){ const ctx=this.cv.front.getContext('2d'); ctx.fillStyle='#0d1224'; ctx.fillRect(0,0,this.cv.front.width,this.cv.front.height); this._grid(ctx,W,H);
      for(let z=0;z<H;z++) for(let x=0;x<W;x++){ for(let y=0;y<D;y++){ if(g.grid[z][y][x]){ this._cell(ctx,x,z,this._shade(g.grid[z][y][x].color,1-(y/D)*0.55)); break; } } }
      if(g.cur){ const gz=g.ghostZ();
        for(const [dx,dy,dz] of g.cur.cells){ const x=g.cur.x+dx,z=gz+dz; if(z>=0) this._cell(ctx,x,z,COLORS[g.cur.type],{ghost:true}); }
        for(const [dx,dy,dz] of g.cur.cells){ const x=g.cur.x+dx,z=g.cur.z+dz; if(z>=0) this._cell(ctx,x,z,this._shade(COLORS[g.cur.type],1-((g.cur.y+dy)/D)*0.4),{center:dx===0&&dy===0&&dz===0}); } } }
    _side(g){ const ctx=this.cv.side.getContext('2d'); ctx.fillStyle='#0d1224'; ctx.fillRect(0,0,this.cv.side.width,this.cv.side.height); this._grid(ctx,D,H);
      for(let z=0;z<H;z++) for(let y=0;y<D;y++){ for(let x=0;x<W;x++){ if(g.grid[z][y][x]){ this._cell(ctx,y,z,this._shade(g.grid[z][y][x].color,1-(x/W)*0.55)); break; } } }
      if(g.cur){ const gz=g.ghostZ();
        for(const [dx,dy,dz] of g.cur.cells){ const y=g.cur.y+dy,z=gz+dz; if(z>=0) this._cell(ctx,y,z,COLORS[g.cur.type],{ghost:true}); }
        for(const [dx,dy,dz] of g.cur.cells){ const y=g.cur.y+dy,z=g.cur.z+dz; if(z>=0) this._cell(ctx,y,z,this._shade(COLORS[g.cur.type],1-((g.cur.x+dx)/W)*0.4),{center:dx===0&&dy===0&&dz===0}); } } }
    _top(g){ const ctx=this.cv.top.getContext('2d'); ctx.fillStyle='#0d1224'; ctx.fillRect(0,0,this.cv.top.width,this.cv.top.height); this._grid(ctx,W,D);
      for(let y=0;y<D;y++) for(let x=0;x<W;x++){ for(let z=0;z<H;z++){ if(g.grid[z][y][x]){ this._cell(ctx,x,y,this._shade(g.grid[z][y][x].color,1-(z/H)*0.5)); break; } } }
      if(g.cur) for(const [dx,dy,dz] of g.cur.cells){ const x=g.cur.x+dx,y=g.cur.y+dy; this._cell(ctx,x,y,COLORS[g.cur.type],{center:dx===0&&dy===0&&dz===0}); } }
    _iso(g){
      const ctx=this.cv.iso.getContext('2d');
      ctx.fillStyle='#0d1224'; ctx.fillRect(0,0,this.cv.iso.width,this.cv.iso.height);
      const tw=this.iso.tw, th=this.iso.th, tz=this.iso.tz, ox=this.iso.ox, oy=this.iso.oy;
      const shade=this._shade.bind(this);
      // Slow auto-rotation about the vertical axis (turntable). Fixed angle for tests.
      const ang = (this.isoFixedAngle != null) ? this.isoFixedAngle
                : (performance.now() % 14000) / 14000 * Math.PI * 2;
      const ca=Math.cos(ang), sa=Math.sin(ang);
      const cx=W/2, cy=D/2;
      const rot=(x,y)=>{ const dx=x-cx,dy=y-cy; return [cx+dx*ca-dy*sa, cy+dx*sa+dy*ca]; };
      const proj=(x,y,z)=>{ const r=rot(x,y); return [ox+(r[0]-r[1])*tw, oy+(r[0]+r[1])*th+z*tz]; };
      const depth=(x,y,z)=>{ const r=rot(x,y); return r[0]+r[1]+z; };
      const lineTo=(a,b)=>{ ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); };
      // Face visibility from view dir (1,1,1) rotated by -ang: only camera-facing faces drawn.
      const fx=ca+sa, fy=ca-sa; // sign of +x / +y face dot-product with view
      const poly=(verts,fill,alpha,stroke)=>{
        ctx.globalAlpha = alpha==null?1:alpha;
        ctx.fillStyle=fill;
        ctx.beginPath(); ctx.moveTo(verts[0][0],verts[0][1]);
        for(let i=1;i<verts.length;i++) ctx.lineTo(verts[i][0],verts[i][1]);
        ctx.closePath(); ctx.fill();
        if(stroke){ ctx.strokeStyle=stroke; ctx.stroke(); }
        ctx.globalAlpha=1;
      };
      const cube=(x,y,z,color,alpha,bright)=>{
        bright=bright||1;
        // top always visible; sides only if facing camera (dot<0).
        poly([proj(x,y,z),proj(x+1,y,z),proj(x+1,y+1,z),proj(x,y+1,z)], shade(color,1.2*bright), alpha);
        if(fx>0) poly([proj(x+1,y,z),proj(x+1,y+1,z),proj(x+1,y+1,z+1),proj(x+1,y,z+1)], shade(color,0.9*bright), alpha);
        else     poly([proj(x,y,z),proj(x,y+1,z),proj(x,y+1,z+1),proj(x,y,z+1)], shade(color,0.72*bright), alpha);
        if(fy>0) poly([proj(x,y+1,z),proj(x+1,y+1,z),proj(x+1,y+1,z+1),proj(x,y+1,z+1)], shade(color,0.72*bright), alpha);
        else     poly([proj(x,y,z),proj(x+1,y,z),proj(x+1,y,z+1),proj(x,y,z+1)], shade(color,0.9*bright), alpha);
      };
      // --- reference room: floor grid ---
      ctx.lineWidth=1; ctx.strokeStyle='rgba(130,150,210,0.16)';
      for(let x=0;x<=W;x++) lineTo(proj(x,0,H), proj(x,D,H));
      for(let y=0;y<=D;y++) lineTo(proj(0,y,H), proj(W,y,H));
      // --- active piece projections: floor (X-Y) + two walls (height vs X / depth) ---
      if(g.cur){
        const col=COLORS[g.cur.type];
        const cells=g.cellsAbs(g.cur);
        const foot=new Map();
        for(const [x,y,z] of cells){ const k=x+','+y; if(!foot.has(k)||z>foot.get(k)) foot.set(k,z); }
        foot.forEach((lz,k)=>{ const [x,y]=k.split(',').map(Number);
          poly([proj(x,y,H),proj(x+1,y,H),proj(x+1,y+1,H),proj(x,y+1,H)], col, 0.18, col);
          ctx.setLineDash([3,3]); ctx.globalAlpha=0.4; ctx.strokeStyle=col;
          lineTo(proj(x+0.5,y+0.5,Math.max(0,lz)+1), proj(x+0.5,y+0.5,H));
          ctx.setLineDash([]); ctx.globalAlpha=1;
        });
        const sXZ=new Set(), sYZ=new Set();
        for(const [x,y,z] of cells){ if(z<0) continue;
          const kx=x+','+z; if(!sXZ.has(kx)){ sXZ.add(kx); poly([proj(x,0,z),proj(x+1,0,z),proj(x+1,0,z+1),proj(x,0,z+1)], col, 0.12); }
          const ky=y+','+z; if(!sYZ.has(ky)){ sYZ.add(ky); poly([proj(0,y,z),proj(0,y+1,z),proj(0,y+1,z+1),proj(0,y,z+1)], col, 0.12); }
        }
      }
      // --- solid cells + landing ghost + active, painter-sorted ---
      const list=[];
      for(let z=0;z<H;z++) for(let y=0;y<D;y++) for(let x=0;x<W;x++) if(g.grid[z][y][x]) list.push({x,y,z,color:g.grid[z][y][x].color});
      if(g.cur){
        const gz=g.ghostZ();
        for(const [dx,dy,dz] of g.cur.cells){ const x=g.cur.x+dx,y=g.cur.y+dy,z=gz+dz; if(z>=0) list.push({x,y,z,color:COLORS[g.cur.type],ghost:true}); }
        for(const [dx,dy,dz] of g.cur.cells){ const x=g.cur.x+dx,y=g.cur.y+dy,z=g.cur.z+dz; if(z>=0) list.push({x,y,z,color:COLORS[g.cur.type],active:true,center:dx===0&&dy===0&&dz===0}); }
      }
      list.sort((a,b)=>depth(a.x,a.y,a.z)-depth(b.x,b.y,b.z));
      for(const c of list){
        if(c.ghost){ cube(c.x,c.y,c.z,c.color,0.22,1.3); }
        else {
          cube(c.x,c.y,c.z,c.color,null,c.active?1.25:1.0);
          if(c.center){ const p=proj(c.x+0.5,c.y+0.5,c.z); ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,7);ctx.fill(); }
        }
      }
    }
    _next(g){
      const ctx=this.cv.next.getContext('2d');
      const W2=this.cv.next.width, H2=this.cv.next.height;
      ctx.fillStyle='#0d1224'; ctx.fillRect(0,0,W2,H2);
      const shade=this._shade.bind(this);
      const types = g.bag.peekN ? g.bag.peekN(3) : [g.bag.peek()];
      const n=types.length, slotH=H2/n;
      types.forEach((type,i)=>{
        const sc = i===0 ? 1 : 0.78;       // first (immediate next) is bigger
        const al = i===0 ? 1 : 0.7;        // later ones faded
        const tw=this.nextM.tw*sc, th=this.nextM.th*sc, tz=this.nextM.tz*sc;
        const ox=W2/2, oy=slotH*i + slotH*0.5 - tz*0.4;
        const proj=(x,y,z)=>[ox+(x-y)*tw, oy+(x+y)*th+z*tz];
        if(i>0){ ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.beginPath();ctx.moveTo(6,slotH*i+0.5);ctx.lineTo(W2-6,slotH*i+0.5);ctx.stroke(); }
        const list=SHAPES[type].map(([x,y,z])=>({x,y,z})).sort((a,b)=>(a.x+a.y+a.z)-(b.x+b.y+b.z));
        for(const c of list){ const [sx,sy]=proj(c.x,c.y,c.z);
          ctx.globalAlpha=al;
          ctx.fillStyle=shade(COLORS[type],1.1); ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+tw,sy+th);ctx.lineTo(sx,sy+2*th);ctx.lineTo(sx-tw,sy+th);ctx.closePath();ctx.fill();
          ctx.fillStyle=shade(COLORS[type],0.7); ctx.beginPath();ctx.moveTo(sx-tw,sy+th);ctx.lineTo(sx,sy+2*th);ctx.lineTo(sx,sy+2*th+tz);ctx.lineTo(sx-tw,sy+th+tz);ctx.closePath();ctx.fill();
          ctx.fillStyle=shade(COLORS[type],0.55); ctx.beginPath();ctx.moveTo(sx+tw,sy+th);ctx.lineTo(sx,sy+2*th);ctx.lineTo(sx,sy+2*th+tz);ctx.lineTo(sx+tw,sy+th+tz);ctx.closePath();ctx.fill();
          ctx.globalAlpha=1;
        }
      });
    }
  }

  // ---------------- Simple 3D AI ----------------
  // Greedy: tries Y-rotations × all (x,y) drop spots, scores by landing depth + flatness,
  // moves the piece there, then hard-drops. Keeps pieces upright (no X rolls) for simplicity.
  class AI3D{
    constructor(game, level){ this.game=game; this.level=level||'normal';
      const cfg={easy:{think:700,move:160},normal:{think:380,move:80},hard:{think:160,move:35},expert:{think:90,move:20}};
      this.cfg=cfg[level]||cfg.normal; this.plan=null; this.lastThink=0; this.lastMove=0; }
    tick(now){
      const g=this.game; if(!g||g.over||g.paused||!g.cur){ this.plan=null; return; }
      if(!this.plan || this.plan.t!==g.cur.type){ if(now-this.lastThink<this.cfg.think) return; this.lastThink=now; this.plan=this._think(); this.lastMove=now; return; }
      if(now-this.lastMove<this.cfg.move) return; this.lastMove=now;
      // execute: match rotation count, then x, then y, then drop
      if(this.plan.rot>0){ g.tryRot('Y',1); this.plan.rot--; return; }
      if(g.cur.x<this.plan.x){ g.tryMove(1,0,0); return; }
      if(g.cur.x>this.plan.x){ g.tryMove(-1,0,0); return; }
      if(g.cur.y<this.plan.y){ g.tryMove(0,1,0); return; }
      if(g.cur.y>this.plan.y){ g.tryMove(0,-1,0); return; }
      g.hardDrop(); this.plan=null;
    }
    _think(){
      const g=this.game; const base=g.cur.cells.map(c=>c.slice());
      let best=null;
      let cells=base;
      for(let rot=0;rot<4;rot++){
        if(rot>0) cells=rotY(cells,1);
        for(let x=0;x<W;x++) for(let y=0;y<D;y++){
          const p={type:g.cur.type,cells,x,y,z:1};
          if(g.collides(p)) continue;
          // drop
          let z=p.z; while(true){ const c={...p,z:z+1}; if(g.collides(c)) break; z++; }
          const pp={...p,z};
          // score: prefer deep landing (large z), penalize spread height
          let sumZ=0,maxz=0; for(const [dx,dy,dz] of cells){ const cz=z+dz; sumZ+=cz; if(cz>maxz)maxz=cz; }
          const score = sumZ - (H-maxz)*0.1;
          if(!best||score>best.score) best={score,rot,x,y};
        }
      }
      if(!best) return {t:g.cur.type,rot:0,x:g.cur.x,y:g.cur.y};
      return {t:g.cur.type,rot:best.rot,x:best.x,y:best.y};
    }
  }

  // ---------------- Gamepad input for a 3D game ----------------
  // Standard mapping: A=正面CW, B=正面CCW, X=前回転, Y=後ろ回転,
  // RB=ハードドロップ, RT=ソフト(押しっぱ), D-pad/左スティック=移動, Start=一時停止.
  class Pad3D{
    constructor(game, padIndex){ this.game=game; this.idx=padIndex||0; this.prev={};
      this.das={dir:0,downAt:0,last:0}; this.dasY={dir:0,downAt:0,last:0}; }
    setGame(g){ this.game=g; }
    poll(now){
      if(!navigator.getGamepads) return;
      const pads=navigator.getGamepads(); const p=pads[this.idx]; if(!p) return;
      const g=this.game; if(!g) return;
      const cur={}; const nb=Math.min(p.buttons.length,17);
      for(let i=0;i<nb;i++) cur[i]=!!(p.buttons[i]&&p.buttons[i].pressed);
      const edge=i=>cur[i]&&!this.prev[i];
      if(edge(9) && !g.over) g.paused=!g.paused;          // Start = pause
      if(!(g.over||g.paused) && g.cur){
        if(edge(0)) g.tryRot('Y',1);
        if(edge(1)) g.tryRot('Y',-1);
        if(edge(2)) g.tryRot('X',1);
        if(edge(3)) g.tryRot('X',-1);
        if(edge(5)) g.hardDrop();                          // RB
        g.softDrop = !!cur[7];                             // RT held
        const ax=p.axes[0]||0, ay=p.axes[1]||0, dz=0.5;
        const dx=(cur[14]||ax<-dz)?-1:(cur[15]||ax>dz)?1:0;
        const dy=(cur[12]||ay<-dz)?-1:(cur[13]||ay>dz)?1:0;
        this._das(now,this.das,dx,d=>g.tryMove(d,0,0));
        this._das(now,this.dasY,dy,d=>g.tryMove(0,d,0));
      } else { g.softDrop=false; }
      this.prev=cur;
    }
    _das(now,st,dir,fn){
      if(dir!==st.dir){ st.dir=dir; st.downAt=now; st.last=0; if(dir!==0) fn(dir); }
      else if(dir!==0 && now-st.downAt>=160 && now-st.last>=60){ st.last=now; fn(dir); }
    }
  }

  window.T3D = { W, H, COLORS, SHAPES, Game3D, Renderer3D, AI3D, Pad3D,
    get D(){ return D; },
    setDepth(d){ D = Math.max(2, Math.min(10, d|0)); } };
})();
