// CPU AI: greedy placement search with classic Dellacherie-style heuristic.
// Per-level parameters control noise (suboptimal play) and reaction speed.
window.CPU_LEVELS = [
  { id: 'easy',   label: 'Easy',   short: 'E' },
  { id: 'normal', label: 'Normal', short: 'N' },
  { id: 'hard',   label: 'Hard',   short: 'H' },
  { id: 'expert', label: 'Expert', short: 'X' },
];

const LEVEL_CFG = {
  easy:   { noise: 0.40, thinkMs: 700, moveMs: 220, useHold: false, lookahead: 0 },
  normal: { noise: 0.12, thinkMs: 350, moveMs: 90,  useHold: false, lookahead: 0 },
  hard:   { noise: 0.0,  thinkMs: 150, moveMs: 40,  useHold: true,  lookahead: 1 },
  expert: { noise: 0.0,  thinkMs: 80,  moveMs: 22,  useHold: true,  lookahead: 1 },
};

window.CpuAI = class CpuAI {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.cfg = LEVEL_CFG[level] || LEVEL_CFG.normal;
    this.plan = null;          // { rot, x, useHold, pieceType }
    this.lastThink = 0;
    this.lastMove = 0;
    this.stuckMs = 0;
  }

  tick(now) {
    const g = this.game;
    if (!g || g.gameOver || g.paused || g.finished || !g.current) {
      this.plan = null;
      return;
    }
    // (Re)plan if we don't have one for the current piece.
    const needsPlan = !this.plan || this.plan.pieceType !== g.current.type;
    if (needsPlan) {
      if (now - this.lastThink < this.cfg.thinkMs) return;
      this.lastThink = now;
      this.plan = this._think(g);
      this.lastMove = now;
      this.stuckMs = 0;
      // Optional hold swap
      if (this.cfg.useHold && this.plan?.useHold && !g.holdLocked) {
        g.action('hold', 'down');
        this.plan = null;        // will replan after hold swap
        return;
      }
    }
    if (!this.plan) return;
    if (now - this.lastMove < this.cfg.moveMs) return;
    this.lastMove = now;
    this._executeStep(g);
  }

  _executeStep(g) {
    const cur = g.current;
    if (!cur) return;
    if (cur.rot !== this.plan.rot) {
      const before = cur.rot;
      g.action('rotCW', 'down');
      if (g.current && g.current.rot === before) {
        // rotation failed (blocked); try CCW once before giving up
        g.action('rotCCW', 'down');
        if (g.current && g.current.rot === before) {
          this.stuckMs += this.cfg.moveMs;
          if (this.stuckMs > 600) { g.action('hardDrop', 'down'); this.plan = null; }
        }
      }
      return;
    }
    if (cur.x < this.plan.x) { g.action('right', 'down'); return; }
    if (cur.x > this.plan.x) { g.action('left', 'down'); return; }
    g.action('hardDrop', 'down');
    this.plan = null;
  }

  _think(g) {
    const piece = g.current;
    const best = this._bestPlacement(g.field, piece.type);
    // Lookahead: consider swapping with hold piece (or next bag head).
    // Skip when garbage is pending — the field will mutate on the next spawn
    // (which is what hold triggers), and our evaluation would be off.
    if (this.cfg.useHold && !g.holdLocked && g.pendingGarbage === 0) {
      const altType = g.hold ? g.hold : (g.peekQueue(1)[0]);
      if (altType && altType !== piece.type && !altType.startsWith('X')) {
        const alt = this._bestPlacement(g.field, altType);
        // Require a clear margin so we don't flip-flop on marginal gains.
        if (alt && alt.score > (best?.score ?? -Infinity) + 1.5) {
          return { rot: 0, x: 0, useHold: true, pieceType: piece.type, score: alt.score };
        }
      }
    }
    if (!best) return { rot: piece.rot, x: piece.x, pieceType: piece.type, score: 0 };
    // Suboptimal noise: occasionally pick a random valid placement instead.
    if (Math.random() < this.cfg.noise) {
      const alt = this._randomPlacement(g.field, piece.type);
      if (alt) return { ...alt, pieceType: piece.type };
    }
    return { rot: best.rot, x: best.x, pieceType: piece.type, score: best.score };
  }

  _bestPlacement(field, type) {
    let best = null;
    for (let rot = 0; rot < 4; rot++) {
      const cells = PIECES[type].states[rot];
      let minCx = Infinity, maxCx = -Infinity;
      for (const [cx] of cells) {
        if (cx < minCx) minCx = cx;
        if (cx > maxCx) maxCx = cx;
      }
      const minX = -minCx;
      const maxX = field.cols - 1 - maxCx;
      for (let x = minX; x <= maxX; x++) {
        const piece = { type, rot, x, y: 0, lastKick: null };
        if (field.collides(piece)) continue;
        const gy = field.ghostY(piece);
        piece.y = gy;
        const score = this._evaluate(field, piece);
        if (!best || score > best.score) best = { rot, x, score };
      }
    }
    return best;
  }

  _randomPlacement(field, type) {
    const options = [];
    for (let rot = 0; rot < 4; rot++) {
      const cells = PIECES[type].states[rot];
      let minCx = Infinity, maxCx = -Infinity;
      for (const [cx] of cells) {
        if (cx < minCx) minCx = cx;
        if (cx > maxCx) maxCx = cx;
      }
      const minX = -minCx;
      const maxX = field.cols - 1 - maxCx;
      for (let x = minX; x <= maxX; x++) {
        const test = { type, rot, x, y: 0, lastKick: null };
        if (!field.collides(test)) options.push({ rot, x, score: 0 });
      }
    }
    return options.length ? options[(Math.random() * options.length) | 0] : null;
  }

  _evaluate(field, piece) {
    // Clone grid and apply piece in place; cleared lines are not removed
    // (we just count them as bonus).
    const cols = field.cols;
    const rows = field.rows;
    const grid = new Array(rows);
    for (let y = 0; y < rows; y++) grid[y] = field.grid[y].slice();
    for (const [x, y] of pieceCells(piece)) {
      if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y][x] = { v: 1 };
    }
    let lines = 0;
    for (let y = 0; y < rows; y++) if (grid[y].every(c => c)) lines++;

    const heights = new Array(cols).fill(0);
    const holes = new Array(cols).fill(0);
    for (let x = 0; x < cols; x++) {
      let topY = -1;
      for (let y = 0; y < rows; y++) { if (grid[y][x]) { topY = y; break; } }
      heights[x] = topY === -1 ? 0 : rows - topY;
      if (topY !== -1) {
        for (let y = topY + 1; y < rows; y++) if (!grid[y][x]) holes[x]++;
      }
    }
    const aggregateHeight = heights.reduce((a, b) => a + b, 0);
    const maxHeight = Math.max(...heights);
    const totalHoles = holes.reduce((a, b) => a + b, 0);
    let bumpiness = 0;
    for (let x = 0; x < cols - 1; x++) bumpiness += Math.abs(heights[x] - heights[x + 1]);
    // Wells (depth of vertical gaps relative to neighbours)
    let wells = 0;
    for (let x = 0; x < cols; x++) {
      const left = x === 0 ? rows : heights[x - 1];
      const right = x === cols - 1 ? rows : heights[x + 1];
      const minN = Math.min(left, right);
      if (heights[x] < minN) wells += (minN - heights[x]);
    }
    // Weighted sum (positive lines, negative cost terms)
    return lines * 1.6
         - aggregateHeight * 0.51
         - totalHoles * 1.10
         - bumpiness * 0.18
         - maxHeight * 0.25
         - wells * 0.20;
  }
};
