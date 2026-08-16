// Bootstrap: one menu -> 2D / 3D / 2D-vs-3D sessions.
(function () {
  const fieldsEl = document.getElementById('fields');
  const statusEl = document.getElementById('matchStatus');
  let session = null;     // uniform interface: tick(dt,now), draw(), status(), setPaused(b), destroy()
  let lastOpts = null;

  function destroySession() {
    if (session) { try { session.destroy(); } catch (e) {} session = null; }
    fieldsEl.innerHTML = '';
    if (window.FX) FX.clear();
  }
  const _toMenu = () => { destroySession(); window.music?.stop(); menu.show(); };

  // ----- 2D session (wraps Match + InputManager) -----
  function makeSession2D(o) {
    const match = new Match(o.numPlayers, fieldsEl, o.handicaps, o.types, o.mode, o.widths, o.characters);
    window.__match = match;
    const inputs = new InputManager(
      o.numPlayers, o.touchPlayer,
      (idx) => match.views[idx] && match.views[idx].root,
      (player, action, phase) => {
        match.dispatch(player, action, phase);
        if (player === -1 && action === 'menu' && phase === 'down') _toMenu();
      }
    );
    window.audioFX?.play('start');
    window.music?.start();
    return {
      tick(dt, now){ inputs.tick(now); match.tick(dt); },
      draw(){ match.draw(); },
      status(){ return match.status(); },
      setPaused(p){ match.games.forEach(g => { if (!g.gameOver && !g.finished) g.paused = p; }); },
      destroy(){ inputs.destroy(); window.music?.stop(); },
    };
  }

  function start(o) {
    destroySession();
    lastOpts = o;
    applyTheme(o.theme);
    // Per-player dimension drives which engine hosts the match.
    const dims = (o.dims && o.dims.length) ? o.dims : Array(o.numPlayers).fill('2d');
    const all2d = dims.every(d => d === '2d');
    if (all2d) {
      // Pure 2D (1-4 players) keeps the full-featured Match path.
      session = makeSession2D(o);
    } else if (o.numPlayers === 1) {
      // Solo 3D.
      session = new Session3D(fieldsEl, { mode3d:o.mode3d, type3d:(o.types && o.types[0]) || 'human',
        char:(o.characters && o.characters[0]), depth:o.depth3d, autoDepth:o.autoDepth3d, speedMul:o.speedMul3d, onMenu:_toMenu });
    } else {
      // Mixed / multi-3D (2D vs 3D, 3D vs 3D, any combination).
      session = new SessionArena(fieldsEl, { dims, types:o.types, characters:o.characters,
        mode:o.mode, widths:o.widths, mode3d:o.mode3d, depth:o.depth3d, autoDepth:o.autoDepth3d,
        speedMul:o.speedMul3d, touchPlayer:o.touchPlayer, onMenu:_toMenu });
      session.onRestart = () => start(lastOpts);
    }
    window.__session = session; // debug handle
  }

  const menu = new Menu((o) => start(o));
  menu.onBack = _toMenu;

  // Global Esc returns to menu from any session.
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && session) _toMenu(); });

  if (window.FX) FX.init();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (session) {
      session.tick(dt, now);
      session.draw();
      statusEl.textContent = session.status();
    }
    if (window.FX) FX.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause + silence when the tab is hidden (BGM setInterval keeps firing otherwise).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.music?.stop();
      if (session && session.setPaused) session.setPaused(true);
    } else {
      last = performance.now();
      try { const ctx = window.audioFX?.ctx; if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      if (session && window.music && window.music.current !== 'off') window.music.start();
    }
  });

  const _shutdown = () => {
    window.music?.stop();
    try { const ctx = window.audioFX?.ctx; if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) {}
  };
  window.addEventListener('pagehide', _shutdown);
  window.addEventListener('beforeunload', _shutdown);
})();
