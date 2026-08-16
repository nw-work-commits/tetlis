// Web Gamepad API input. Auto-binds gamepad index N to player N.
// Standard mapping (Xbox-style buttons):
//   0:A  1:B  2:X  3:Y  4:LB  5:RB  6:LT  7:RT  8:Back  9:Start
//   12:Dpad-Up  13:Dpad-Down  14:Dpad-Left  15:Dpad-Right
window.GamepadInput = class GamepadInput {
  constructor(numPlayers, onAction) {
    this.numPlayers = numPlayers;
    this.onAction = onAction;
    this.prev = [];        // [pad][btn] -> bool
    this.das = [];         // [pad] -> {dir, downAt, lastRepeatAt}
    this.stickPrev = [];   // [pad] -> {x: -1|0|1}
    this.map = {
      14: 'left', 15: 'right', 13: 'softDown',
      12: 'hardDrop',         // D-pad Up
      0: 'rotCW',             // A
      1: 'rotCCW',            // B
      2: 'hold',              // X
      3: 'special',           // Y — special move
      4: 'rotCCW',            // LB
      5: 'rotCW',             // RB
      6: 'target',            // LT
      7: 'target',            // RT
      9: 'pause',             // Start (global)
      8: 'menu',              // Back (global)
    };
  }
  destroy() {}

  tick(now) {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (let p = 0; p < this.numPlayers; p++) {
      const pad = pads[p];
      if (!pad) continue;
      if (!this.prev[p]) this.prev[p] = [];
      if (!this.das[p]) this.das[p] = { dir: 0, downAt: 0, lastRepeatAt: 0 };
      if (!this.stickPrev[p]) this.stickPrev[p] = { x: 0 };

      // Button edges
      for (const idxStr of Object.keys(this.map)) {
        const idx = +idxStr;
        const btn = pad.buttons[idx];
        if (!btn) continue;
        const pressed = !!btn.pressed;
        const was = !!this.prev[p][idx];
        const action = this.map[idx];
        const playerArg = (action === 'pause' || action === 'menu') ? -1 : p;
        if (pressed && !was) this.onAction(playerArg, action, 'down');
        else if (!pressed && was) {
          if (action !== 'pause' && action !== 'menu') this.onAction(playerArg, action, 'up');
        }
        this.prev[p][idx] = pressed;
      }

      // Left analog stick → discrete left/right (with deadzone), soft drop on down.
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const dz = 0.45;
      const stickX = ax < -dz ? -1 : ax > dz ? 1 : 0;
      if (stickX !== this.stickPrev[p].x) {
        if (this.stickPrev[p].x === -1) this.onAction(p, 'left', 'up');
        else if (this.stickPrev[p].x === 1) this.onAction(p, 'right', 'up');
        if (stickX === -1) this.onAction(p, 'left', 'down');
        else if (stickX === 1) this.onAction(p, 'right', 'down');
        this.stickPrev[p].x = stickX;
      }
      // Soft drop while stick down
      const softDownNow = ay > dz || !!pad.buttons[13]?.pressed;
      const softDownWas = !!this.prev[p]['_sd'];
      if (softDownNow && !softDownWas) this.onAction(p, 'softDown', 'down');
      else if (!softDownNow && softDownWas) this.onAction(p, 'softDown', 'up');
      this.prev[p]['_sd'] = softDownNow;

      // DAS/ARR for held horizontal (D-pad or stick)
      const lp = !!pad.buttons[14]?.pressed || stickX === -1;
      const rp = !!pad.buttons[15]?.pressed || stickX === 1;
      const dir = lp ? -1 : rp ? 1 : 0;
      const s = this.das[p];
      if (dir !== s.dir) {
        s.dir = dir;
        s.downAt = now;
        s.lastRepeatAt = 0;
      } else if (dir !== 0) {
        const heldFor = now - s.downAt;
        if (heldFor >= CFG.DAS_MS && now - s.lastRepeatAt >= CFG.ARR_MS) {
          s.lastRepeatAt = now;
          this.onAction(p, dir < 0 ? 'left' : 'right', 'repeat');
        }
      }
    }
  }

  static listConnected() {
    if (!navigator.getGamepads) return [];
    const pads = navigator.getGamepads();
    const out = [];
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) out.push({ index: i, id: pads[i].id });
    }
    return out;
  }
};
