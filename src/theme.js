// Theme presets — palettes affect both CSS variables (via data-theme on .app)
// and the per-piece colors used by the canvas renderer.
window.THEMES = {
  classic: {
    label: 'Classic',
    pieces: {
      I:'#22d3ee', O:'#fbbf24', T:'#a855f7',
      S:'#22c55e', Z:'#ef4444', J:'#3b82f6', L:'#f97316',
    },
  },
  neon: {
    label: 'Neon',
    pieces: {
      I:'#00ffff', O:'#ffff00', T:'#ff00ff',
      S:'#39ff14', Z:'#ff073a', J:'#1f8fff', L:'#ff8c00',
    },
  },
  dark: {
    label: 'Dark',
    pieces: {
      I:'#b0b0b0', O:'#dcdcdc', T:'#9e9e9e',
      S:'#bdbdbd', Z:'#a0a0a0', J:'#8c8c8c', L:'#cfcfcf',
    },
  },
  retro: {
    label: 'Retro',
    pieces: {
      I:'#ffd24d', O:'#f4a261', T:'#e76f51',
      S:'#a4c93a', Z:'#bc4749', J:'#6a994e', L:'#e9c46a',
    },
  },
  pastel: {
    label: 'Pastel',
    pieces: {
      I:'#a0e7e5', O:'#fdfd96', T:'#cdb4ff',
      S:'#b4e4b4', Z:'#ffb3ba', J:'#a7c7ff', L:'#ffd6a5',
    },
  },
  sunset: {
    label: 'Sunset',
    pieces: {
      I:'#ffd6a5', O:'#ffb703', T:'#e07be0',
      S:'#90be6d', Z:'#ef476f', J:'#f3722c', L:'#f9c74f',
    },
  },
  ocean: {
    label: 'Ocean',
    pieces: {
      I:'#48cae4', O:'#ffd166', T:'#9d4edd',
      S:'#2dd4bf', Z:'#ff6b6b', J:'#0077b6', L:'#ff9e00',
    },
  },
  forest: {
    label: 'Forest',
    pieces: {
      I:'#74c69d', O:'#e9c46a', T:'#b5838d',
      S:'#52b788', Z:'#bc6c25', J:'#386641', L:'#dda15e',
    },
  },
  candy: {
    label: 'Candy',
    pieces: {
      I:'#5bc0eb', O:'#fde74c', T:'#e85d9f',
      S:'#9bf6a8', Z:'#ff5d8f', J:'#7b9cff', L:'#ffa15c',
    },
  },
  cyber: {
    label: 'Cyber',
    pieces: {
      I:'#00f5d4', O:'#fee440', T:'#f15bb5',
      S:'#9bff66', Z:'#ff206e', J:'#00bbf9', L:'#fb8b24',
    },
  },
};

window.applyTheme = function (name) {
  const theme = THEMES[name] || THEMES.classic;
  document.querySelector('.app').setAttribute('data-theme', name);
  for (const t of PIECE_TYPES) {
    PIECES[t].color = theme.pieces[t];
  }
  window.CURRENT_THEME = name;
  try { localStorage.setItem('tetlis_theme', name); } catch (e) {}
};

window.loadSavedTheme = function () {
  try {
    const saved = localStorage.getItem('tetlis_theme');
    if (saved && THEMES[saved]) return saved;
  } catch (e) {}
  return 'classic';
};
