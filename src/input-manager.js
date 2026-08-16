// Composes all input subsystems. All players always receive keyboard input
// using their fixed keymap. Gamepad index N auto-binds to player N if connected.
// Touch UI binds to the player chosen in menu (or none).
window.InputManager = class InputManager {
  constructor(numPlayers, touchPlayer, getTouchHost, onAction) {
    this.numPlayers = numPlayers;
    this.subsystems = [
      new KeyboardInput(numPlayers, onAction),
      new GamepadInput(numPlayers, onAction),
    ];
    if (touchPlayer >= 0 && touchPlayer < numPlayers) {
      const host = getTouchHost(touchPlayer);
      if (host) this.subsystems.push(new TouchInput(touchPlayer, host, onAction));
    }
  }
  tick(now) { for (const s of this.subsystems) s.tick(now); }
  destroy() { for (const s of this.subsystems) s.destroy(); }
};
