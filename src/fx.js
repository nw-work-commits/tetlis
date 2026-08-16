// Screen-space effects: canvas particles + flying emoji projectiles.
// Positions are in viewport coordinates (works regardless of scroll).
window.FX = (function () {
  let layer, canvas, ctx, inited = false;
  let parts = [];
  let projs = [];

  function init() {
    if (inited) return;
    layer = document.getElementById('fxLayer');
    canvas = document.getElementById('fxCanvas');
    if (!layer || !canvas) return;
    ctx = canvas.getContext('2d');
    inited = true;
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Burst of particles at (x,y).
  function emit(x, y, color, count, opts) {
    if (!inited) return;
    opts = opts || {};
    count = count || 12;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 2.2) * (0.4 + Math.random());
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.up || 1.2),
        life: opts.life || 650, max: opts.life || 650,
        color: color || '#fff',
        size: (opts.size || 3) * (0.6 + Math.random()),
        star: !!opts.star,
      });
    }
  }

  // Fire an emoji from (x0,y0) toward (x1,y1); call onArrive(x1,y1) on impact.
  function projectile(x0, y0, x1, y1, emoji, onArrive) {
    if (!inited || !layer) return;
    const el = document.createElement('div');
    el.className = 'fx-proj';
    el.textContent = emoji || '⭐';
    layer.appendChild(el);
    projs.push({ el, x0, y0, x1, y1, t: 0, dur: 440, onArrive, done: false });
  }

  function _drawStar(c, cx, cy, outer, inner, points) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = (i % 2 === 0) ? outer : inner;
      const a = (Math.PI * i) / points - Math.PI / 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  function tick(dt) {
    if (!inited || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const f = dt / 16;
    for (const p of parts) {
      p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.25 * f; p.life -= dt;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.star) _drawStar(ctx, p.x, p.y, p.size * 1.7, p.size * 0.7, 5);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    parts = parts.filter(p => p.life > 0);

    for (const pr of projs) {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
      const x = pr.x0 + (pr.x1 - pr.x0) * e;
      const y = pr.y0 + (pr.y1 - pr.y0) * e - Math.sin(k * Math.PI) * 70; // arc
      const s = 1 + 0.4 * Math.sin(k * Math.PI);
      pr.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${k * 900}deg) scale(${s})`;
      if (k >= 1 && !pr.done) {
        pr.done = true;
        pr.el.remove();
        if (pr.onArrive) pr.onArrive(pr.x1, pr.y1);
      }
    }
    projs = projs.filter(pr => !pr.done);
  }

  // Sweeping catchphrase banner.
  function telop(text, color, emoji) {
    if (!inited || !layer) return;
    const el = document.createElement('div');
    el.className = 'fx-telop';
    el.innerHTML = `<span class="fx-telop-emoji">${emoji || ''}</span> ${text}`;
    el.style.color = '#fff';
    el.style.textShadow = `0 0 16px ${color || '#fff'}, 0 0 30px ${color || '#fff'}, 0 3px 4px rgba(0,0,0,.8)`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // Escalating special-move cut-in. level 2 = over the player's own area
  // (pass rect), level 3 = full screen.
  function cutin(o) {
    if (!inited || !layer) return;
    o = o || {};
    const lvl = o.level || 2;
    const col = o.color || '#fff';
    const el = document.createElement('div');
    el.className = 'fx-cutin lvl' + lvl;
    if (lvl < 3 && o.rect) {
      el.style.left = o.rect.left + 'px';
      el.style.top = o.rect.top + 'px';
      el.style.width = o.rect.width + 'px';
      el.style.height = o.rect.height + 'px';
    }
    const tierLabel = lvl >= 3 ? 'ファイナル必殺' : 'スーパー必殺';
    el.style.setProperty('--cc', col);
    el.innerHTML = `
      <div class="fx-cutin-lines"></div>
      <div class="fx-cutin-band" style="background:linear-gradient(115deg, transparent 30%, ${col} 50%, transparent 70%)"></div>
      <div class="fx-cutin-emoji">${o.emoji || ''}</div>
      <div class="fx-cutin-info">
        <div class="fx-cutin-tier" style="color:${col}">${tierLabel}</div>
        <div class="fx-cutin-name">${o.name || ''}</div>
        <div class="fx-cutin-telop">「${o.telop || ''}」</div>
      </div>`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), lvl >= 3 ? 1800 : 1250);
  }

  // Character victory screen overlay.
  function victory(emoji, name, telopText, color) {
    if (!inited || !layer) return;
    const el = document.createElement('div');
    el.className = 'fx-victory';
    el.innerHTML = `
      <div class="fx-victory-card" style="box-shadow:0 0 40px ${color||'#fff'}">
        <div class="fx-victory-emoji">${emoji}</div>
        <div class="fx-victory-name">${name}</div>
        <div class="fx-victory-win" style="color:${color||'#ffd700'}">WINNER!</div>
        <div class="fx-victory-telop">「${telopText}」</div>
        <div class="fx-victory-hint">R でもう一度 / Esc でメニュー</div>
      </div>`;
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', () => el.remove());
    layer.appendChild(el);
    return el;
  }
  function clearVictory() {
    if (!layer) return;
    layer.querySelectorAll('.fx-victory').forEach(e => e.remove());
  }

  function clear() {
    parts = []; projs.forEach(p => p.el && p.el.remove()); projs = [];
    if (layer) layer.querySelectorAll('.fx-telop, .fx-victory, .fx-cutin').forEach(e => e.remove());
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { init, emit, projectile, tick, clear, telop, cutin, victory, clearVictory };
})();
