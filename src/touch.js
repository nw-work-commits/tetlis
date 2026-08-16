// Touch input: on-screen buttons rendered inside one player's host element.
// Mouse fallback is included so desktop testing works without a touchscreen.
window.TouchInput = class TouchInput {
  constructor(playerIndex, hostEl, onAction) {
    this.player = playerIndex;
    this.onAction = onAction;
    this.host = hostEl;
    this.el = document.createElement('div');
    this.el.className = 'touch-pad';
    this.el.innerHTML = `
      <div class="trow">
        <button data-act="hold">ホールド</button>
        <button data-act="rotCCW">↺</button>
        <button data-act="rotCW">↻</button>
        <button data-act="hardDrop">落下</button>
      </div>
      <div class="trow">
        <button data-act="left">◀</button>
        <button data-act="softDown">▼</button>
        <button data-act="right">▶</button>
        <button data-act="target">標的</button>
        <button data-act="special">技</button>
      </div>
    `;
    this.host.appendChild(this.el);

    this.das = { dir: 0, downAt: 0, lastRepeatAt: 0 };
    this._handlers = [];

    this.el.querySelectorAll('button').forEach(btn => {
      const act = btn.dataset.act;
      const start = (e) => {
        e.preventDefault();
        this.onAction(this.player, act, 'down');
        if (act === 'left' || act === 'right') {
          this.das.dir = act === 'left' ? -1 : 1;
          this.das.downAt = performance.now();
          this.das.lastRepeatAt = 0;
        }
      };
      const end = (e) => {
        e.preventDefault();
        this.onAction(this.player, act, 'up');
        if ((act === 'left' && this.das.dir === -1) ||
            (act === 'right' && this.das.dir === 1)) {
          this.das.dir = 0;
        }
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', (e) => {
        // release on drag-out
        end(e);
      });
      this._handlers.push({ btn, start, end });
    });
  }

  destroy() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  tick(now) {
    if (this.das.dir === 0) return;
    const heldFor = now - this.das.downAt;
    if (heldFor < CFG.DAS_MS) return;
    if (now - this.das.lastRepeatAt >= CFG.ARR_MS) {
      this.das.lastRepeatAt = now;
      this.onAction(this.player, this.das.dir < 0 ? 'left' : 'right', 'repeat');
    }
  }
};
