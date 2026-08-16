// Tetromino shape data and SRS kick tables.
// Each piece has 4 rotation states. Cells are [x, y] within the piece's local box.

window.PIECES = {
  I: {
    color: '#22d3ee',
    box: 4,
    states: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
  },
  O: {
    color: '#fbbf24',
    box: 3,
    states: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
    ],
  },
  T: {
    color: '#a855f7',
    box: 3,
    states: [
      [[1,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[1,2]],
    ],
  },
  S: {
    color: '#22c55e',
    box: 3,
    states: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]],
    ],
  },
  Z: {
    color: '#ef4444',
    box: 3,
    states: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]],
    ],
  },
  J: {
    color: '#3b82f6',
    box: 3,
    states: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]],
    ],
  },
  L: {
    color: '#f97316',
    box: 3,
    states: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]],
    ],
  },
};

// SRS kick tables — y-axis is positive downward.
// Keys: "from->to" where rotation states are 0,R,2,L (indices 0,1,2,3).
window.KICKS = {
  JLSTZ: {
    '0->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1->0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1->2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3->2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3->0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  },
  I: {
    '0->1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1->0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1->2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2->1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2->3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3->2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3->0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0->3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  },
};

window.PIECE_TYPES = ['I','O','T','S','Z','J','L'];

// Weird (異質) pieces injected by attacks. Not part of the 7-bag.
// All states share one shape (no rotation) for simplicity.
window.WEIRD_PIECES = {
  X1: { // single block
    color: '#ffffff',
    box: 3,
    states: [
      [[1,1]], [[1,1]], [[1,1]], [[1,1]],
    ],
  },
  XPLUS: { // plus sign (5 cells)
    color: '#ff66ff',
    box: 3,
    states: [
      [[1,0],[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[2,1],[1,2]],
    ],
  },
  XU: { // U shape (5 cells)
    color: '#ff66ff',
    box: 3,
    states: [
      [[0,0],[2,0],[0,1],[1,1],[2,1]],
      [[0,0],[1,0],[0,1],[0,2],[1,2]],
      [[0,1],[1,1],[2,1],[0,2],[2,2]],
      [[1,0],[2,0],[2,1],[1,2],[2,2]],
    ],
  },
  XS5: { // S-pentomino (5 cells)
    color: '#ff66ff',
    box: 3,
    states: [
      [[1,0],[2,0],[1,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[2,0],[1,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2],[2,2]],
    ],
  },
  XL5: { // L-pentomino (5 cells)
    color: '#ff66ff',
    box: 3,
    states: [
      [[0,0],[0,1],[0,2],[1,2],[2,2]],
      [[0,0],[1,0],[2,0],[0,1],[0,2]],
      [[0,0],[1,0],[2,0],[2,1],[2,2]],
      [[2,0],[2,1],[0,2],[1,2],[2,2]],
    ],
  },
};
// Merge weird pieces into PIECES so collision/rendering use the same code path.
for (const k of Object.keys(WEIRD_PIECES)) {
  PIECES[k] = WEIRD_PIECES[k];
}
window.WEIRD_TYPES = Object.keys(WEIRD_PIECES);

// === Triominoes (3-cell pieces) — for ミノ3 mode ===
// Includes disconnected shapes for more variety.
window.TRIOMINOES = {
  TI: { // 3 in a line
    color: '#22d3ee', box: 3,
    states: [
      [[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2]],
    ],
  },
  TL: { // L corner
    color: '#fbbf24', box: 3,
    states: [
      [[0,0],[0,1],[1,1]],
      [[0,0],[1,0],[0,1]],
      [[0,0],[1,0],[1,1]],
      [[1,0],[0,1],[1,1]],
    ],
  },
  TV: { // V shape — 3 corners, cells NOT adjacent
    // ■ . ■
    // . ■ .
    color: '#a855f7', box: 3,
    states: [
      [[0,0],[2,0],[1,1]],
      // . ■
      // ■ .
      // . ■
      [[1,0],[0,1],[1,2]],
      // . ■ .
      // ■ . ■
      [[1,0],[0,1],[2,1]],
      // ■ .
      // . ■
      // ■ .
      [[0,0],[1,1],[0,2]],
    ],
  },
  TD: { // two adjacent + diagonal jump
    // ■ ■ .
    // . . ■
    color: '#22c55e', box: 3,
    states: [
      [[0,0],[1,0],[2,1]],
      // . ■
      // ■ .
      // ■ .
      [[1,0],[0,1],[0,2]],
      // ■ . .
      // . ■ ■
      [[0,0],[1,1],[2,1]],
      // . ■
      // . ■
      // ■ .
      [[1,0],[1,1],[0,2]],
    ],
  },
  TS: { // diagonal stair
    // ■ . .
    // . ■ .
    // . . ■
    color: '#ef4444', box: 3,
    states: [
      [[0,0],[1,1],[2,2]],
      // . . ■
      // . ■ .
      // ■ . .
      [[2,0],[1,1],[0,2]],
      [[0,0],[1,1],[2,2]],
      [[2,0],[1,1],[0,2]],
    ],
  },
};
window.TRIOMINO_TYPES = ['TI','TL','TV','TD','TS'];

// === Pentominoes (5-cell pieces) — for ミノ5 mode (7 distinct shapes) ===
window.PENTOMINOES = {
  PI: { color: '#22d3ee', box: 5, states: [
    [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[2,0],[2,1],[2,2],[2,3],[2,4]],
    [[0,2],[1,2],[2,2],[3,2],[4,2]],
    [[2,0],[2,1],[2,2],[2,3],[2,4]],
  ]},
  PL: { color: '#f97316', box: 4, states: [
    // X . . .
    // X . . .
    // X . . .
    // X X . .
    [[0,0],[0,1],[0,2],[0,3],[1,3]],
    // X X X X
    // X . . .
    [[0,0],[1,0],[2,0],[3,0],[0,1]],
    // X X . .
    // . X . .
    // . X . .
    // . X . .
    [[0,0],[1,0],[1,1],[1,2],[1,3]],
    // . . . X
    // X X X X
    [[3,0],[0,1],[1,1],[2,1],[3,1]],
  ]},
  PJ: { color: '#3b82f6', box: 4, states: [
    // . X
    // . X
    // . X
    // X X
    [[1,0],[1,1],[1,2],[0,3],[1,3]],
    // X . . .
    // X X X X
    [[0,0],[0,1],[1,1],[2,1],[3,1]],
    // X X
    // X .
    // X .
    // X .
    [[0,0],[1,0],[0,1],[0,2],[0,3]],
    // X X X X
    // . . . X
    [[0,0],[1,0],[2,0],[3,0],[3,1]],
  ]},
  PT: { color: '#a855f7', box: 3, states: [
    // X X X
    // . X .
    // . X .
    [[0,0],[1,0],[2,0],[1,1],[1,2]],
    // . . X
    // X X X
    // . . X
    [[2,0],[0,1],[1,1],[2,1],[2,2]],
    // . X .
    // . X .
    // X X X
    [[1,0],[1,1],[0,2],[1,2],[2,2]],
    // X . .
    // X X X
    // X . .
    [[0,0],[0,1],[1,1],[2,1],[0,2]],
  ]},
  PU: { color: '#fde047', box: 3, states: [
    // X . X
    // X X X
    [[0,0],[2,0],[0,1],[1,1],[2,1]],
    // X X
    // X .
    // X X
    [[0,0],[1,0],[0,1],[0,2],[1,2]],
    // X X X
    // X . X
    [[0,0],[1,0],[2,0],[0,1],[2,1]],
    // X X
    // . X
    // X X
    [[0,0],[1,0],[1,1],[0,2],[1,2]],
  ]},
  PV: { color: '#22c55e', box: 3, states: [
    // X . .
    // X . .
    // X X X
    [[0,0],[0,1],[0,2],[1,2],[2,2]],
    // X X X
    // X . .
    // X . .
    [[0,0],[1,0],[2,0],[0,1],[0,2]],
    // X X X
    // . . X
    // . . X
    [[0,0],[1,0],[2,0],[2,1],[2,2]],
    // . . X
    // . . X
    // X X X
    [[2,0],[2,1],[0,2],[1,2],[2,2]],
  ]},
  PW: { color: '#ef4444', box: 3, states: [
    // X . .
    // X X .
    // . X X
    [[0,0],[0,1],[1,1],[1,2],[2,2]],
    // . X X
    // X X .
    // X . .
    [[1,0],[2,0],[0,1],[1,1],[0,2]],
    // X X .
    // . X X
    // . . X
    [[0,0],[1,0],[1,1],[2,1],[2,2]],
    // . . X
    // . X X
    // X X .
    [[2,0],[1,1],[2,1],[0,2],[1,2]],
  ]},
};
window.PENTOMINO_TYPES = ['PI','PL','PJ','PT','PU','PV','PW'];

for (const k of Object.keys(TRIOMINOES))  PIECES[k] = TRIOMINOES[k];
for (const k of Object.keys(PENTOMINOES)) PIECES[k] = PENTOMINOES[k];

const STANDARD_TETROMINOES = new Set(['I','O','T','S','Z','J','L']);
window.isStandardTetromino = (type) => STANDARD_TETROMINOES.has(type);

window.createPiece = function (type) {
  return {
    type,
    rot: 0,
    x: 3,
    y: 0,
    lastKick: null, // remembers last successful kick offset (for T-spin classification)
  };
};

window.pieceCells = function (piece) {
  return PIECES[piece.type].states[piece.rot].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
};

window.getKickTable = function (type, fromRot, toRot) {
  // SRS kicks only apply to standard tetrominoes. Other pieces rotate in place.
  if (!STANDARD_TETROMINOES.has(type)) return [[0,0]];
  const set = type === 'I' ? KICKS.I : type === 'O' ? null : KICKS.JLSTZ;
  if (!set) return [[0,0]];
  return set[`${fromRot}->${toRot}`] || [[0,0]];
};
