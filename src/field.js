// 10x20 playfield (+hidden buffer rows on top).
window.Field = class Field {
  constructor(cols) {
    this.cols = cols || CFG.COLS;
    this.rows = CFG.ROWS + CFG.HIDDEN_ROWS;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
  }

  inBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  cellAt(x, y) {
    if (x < 0 || x >= this.cols) return 'wall';
    if (y >= this.rows) return 'wall';
    if (y < 0) return null;
    return this.grid[y][x];
  }

  collides(piece) {
    const cells = pieceCells(piece);
    for (const [x, y] of cells) {
      if (x < 0 || x >= this.cols) return true;
      if (y >= this.rows) return true;
      if (y < 0) continue;
      if (this.grid[y][x]) return true;
    }
    return false;
  }

  lock(piece) {
    const color = PIECES[piece.type].color;
    for (const [x, y] of pieceCells(piece)) {
      if (y >= 0 && y < this.rows && x >= 0 && x < this.cols) {
        this.grid[y][x] = {
          color,
          type: piece.type,
          pieceId: piece.pieceId,
          itemType: piece.itemType,
        };
      }
    }
  }

  // Returns { lines, triggered } — `triggered` is a list of itemType strings
  // for item-pieces that were FULLY cleared by this line clear.
  clearLines() {
    const cleared = [];
    for (let y = this.rows - 1; y >= 0; y--) {
      if (this.grid[y].every(c => c)) cleared.push(y);
    }
    if (cleared.length === 0) return { lines: 0, triggered: [] };
    // Snapshot item-pieces that exist in the field right now.
    const itemByPieceId = new Map();
    for (let y = 0; y < this.rows; y++) {
      for (const c of this.grid[y]) {
        if (c && c.itemType && c.pieceId != null) {
          if (!itemByPieceId.has(c.pieceId)) itemByPieceId.set(c.pieceId, c.itemType);
        }
      }
    }
    // Remove cleared rows; prepend empties on top.
    for (const y of cleared) this.grid.splice(y, 1);
    for (let i = 0; i < cleared.length; i++) {
      this.grid.unshift(Array(this.cols).fill(null));
    }
    // Which item-pieces still have surviving cells?
    const survivors = new Set();
    for (let y = 0; y < this.rows; y++) {
      for (const c of this.grid[y]) {
        if (c && c.pieceId != null && itemByPieceId.has(c.pieceId)) {
          survivors.add(c.pieceId);
        }
      }
    }
    const triggered = [];
    for (const [pid, itemType] of itemByPieceId) {
      if (!survivors.has(pid)) triggered.push(itemType);
    }
    return { lines: cleared.length, triggered };
  }

  // Cascade gravity: settle overhangs, clear full rows, let floating cells fall,
  // and repeat until stable (chain reactions). Returns total {lines, triggered}.
  clearLinesCascade() {
    this._gravitate();                 // settle the just-locked piece's overhang
    let total = 0;
    const triggered = [];
    let guard = 0;
    while (guard++ < 80) {
      const r = this.clearLines();
      if (r.lines === 0) break;
      total += r.lines;
      for (const t of r.triggered) triggered.push(t);
      this._gravitate();               // floating cells drop, maybe forming new lines
    }
    return { lines: total, triggered };
  }

  // Drop piece to lowest valid y; returns the ghost y (piece's y when resting).
  ghostY(piece) {
    const test = { ...piece };
    while (true) {
      test.y++;
      if (this.collides(test)) {
        return test.y - 1;
      }
    }
  }

  // ===== Field manipulation (used by attacks) =====

  // Push N garbage rows up from the bottom. Each row has a single hole.
  // If the existing stack would overflow the top, returns false (no-op signal).
  addGarbageLines(count, holeCol) {
    if (count <= 0) return true;
    // If pushing would shove any filled cell out of the top, the receiver tops out.
    for (let n = 0; n < count; n++) {
      if (this.grid[0].some(c => c)) return false;
      this.grid.shift();
      const row = Array(this.cols).fill(null);
      const hole = (holeCol == null) ? (Math.random() * this.cols) | 0 : holeCol;
      for (let x = 0; x < this.cols; x++) {
        if (x !== hole) row[x] = { color: '#5a6378', type: 'G' };
      }
      this.grid.push(row);
    }
    return true;
  }

  // Shuffle blocks within each of the lowest N rows.
  shuffleBottomRows(rowCount) {
    const startY = Math.max(0, this.rows - rowCount);
    for (let y = startY; y < this.rows; y++) {
      const row = this.grid[y];
      for (let i = row.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [row[i], row[j]] = [row[j], row[i]];
      }
    }
  }

  // Mirror the whole stack horizontally. Safe — doesn't move cells vertically.
  mirrorH() {
    for (let y = 0; y < this.rows; y++) this.grid[y].reverse();
  }

  // Helper used by attacks that might leave the field in an "unsettled" state.
  settle() { this._gravitate(); }

  // Remove the lowest N filled rows (heal). Rows above drop down.
  clearBottomRows(n) {
    for (let k = 0; k < n; k++) {
      // find lowest non-empty row
      let y = -1;
      for (let r = this.rows - 1; r >= 0; r--) { if (this.grid[r].some(c => c)) { y = r; break; } }
      if (y < 0) break;
      this.grid.splice(y, 1);
      this.grid.unshift(Array(this.cols).fill(null));
    }
  }

  // Flip the stack vertically (within visible rows). Hidden buffer untouched.
  // After the flip, gravity-pack each column so cells settle at the bottom —
  // this prevents the originally-bottom (often-filled) row from sitting at the
  // very top of the visible area and instantly topping out the next spawn.
  flipV() {
    const top = CFG.HIDDEN_ROWS;
    const visible = this.grid.slice(top);
    visible.reverse();
    for (let i = 0; i < visible.length; i++) this.grid[top + i] = visible[i];
    this._gravitate();
  }

  // Per-column gravity: collapse cells to the bottom of each column.
  _gravitate() {
    for (let x = 0; x < this.cols; x++) {
      const stack = [];
      for (let y = 0; y < this.rows; y++) {
        if (this.grid[y][x]) stack.push(this.grid[y][x]);
      }
      const empties = this.rows - stack.length;
      for (let y = 0; y < empties; y++) this.grid[y][x] = null;
      for (let i = 0; i < stack.length; i++) this.grid[empties + i][x] = stack[i];
    }
  }

  // Per-row, keep the count of filled cells but randomize their positions.
  randomizeHoles() {
    for (let y = 0; y < this.rows; y++) {
      const row = this.grid[y];
      const filled = row.filter(c => c);
      if (filled.length === 0 || filled.length === this.cols) continue;
      const indices = Array.from({ length: this.cols }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const placed = indices.slice(0, filled.length);
      const newRow = Array(this.cols).fill(null);
      for (let i = 0; i < placed.length; i++) newRow[placed[i]] = filled[i];
      this.grid[y] = newRow;
    }
  }

  // True when the entire playfield is empty (used for perfect-clear detection).
  isEmpty() {
    for (let y = 0; y < this.rows; y++) {
      if (this.grid[y].some(c => c)) return false;
    }
    return true;
  }

  // Total height of the stack (highest filled row from top of visible area).
  stackHeight() {
    for (let y = 0; y < this.rows; y++) {
      if (this.grid[y].some(c => c)) return this.rows - y;
    }
    return 0;
  }

  // T-spin detection: 3 of the 4 corners around the T center are occupied.
  // center is at (piece.x + 1, piece.y + 1) for T piece.
  // Returns 'none' | 'mini' | 'full' for T pieces, 'none' otherwise.
  detectTSpin(piece, lastMoveWasRotation) {
    if (piece.type !== 'T' || !lastMoveWasRotation) return 'none';
    const cx = piece.x + 1;
    const cy = piece.y + 1;
    const corners = [
      [cx - 1, cy - 1], // TL
      [cx + 1, cy - 1], // TR
      [cx - 1, cy + 1], // BL
      [cx + 1, cy + 1], // BR
    ];
    let filled = 0;
    const filledMask = [false, false, false, false];
    corners.forEach(([x, y], i) => {
      const c = this.cellAt(x, y);
      if (c) { filled++; filledMask[i] = true; }
    });
    if (filled < 3) return 'none';
    // Determine front corners based on rotation.
    // rot 0: front = TL,TR  rot 1: TR,BR  rot 2: BL,BR  rot 3: TL,BL
    const frontPairs = [[0,1],[1,3],[2,3],[0,2]];
    const [fa, fb] = frontPairs[piece.rot];
    const frontFilled = (filledMask[fa] ? 1 : 0) + (filledMask[fb] ? 1 : 0);
    // Full T-spin if both front corners filled, else mini.
    if (frontFilled === 2) return 'full';
    return 'mini';
  }
};
