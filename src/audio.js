// Web Audio API synthesized sound effects. No external files.
// AudioContext is lazily created on first call to satisfy browser autoplay rules
// (must be triggered from a user gesture; the keyboard/click handlers will do).
(function () {
  class AudioFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.volume = 0.4;
      this._loadSettings();
    }

    _loadSettings() {
      try {
        const v = localStorage.getItem('tetlis_volume');
        if (v != null) this.volume = Math.max(0, Math.min(1, Number(v)));
        const m = localStorage.getItem('tetlis_muted');
        if (m != null) this.muted = m === '1';
      } catch (e) {}
    }
    _saveSettings() {
      try {
        localStorage.setItem('tetlis_volume', String(this.volume));
        localStorage.setItem('tetlis_muted', this.muted ? '1' : '0');
      } catch (e) {}
    }

    _ensure() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }

    // Resume the AudioContext after a user gesture (call on first key/click).
    resume() {
      this._ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = this.volume;
      this._saveSettings();
    }
    setMuted(b) {
      this.muted = !!b;
      this._saveSettings();
    }
    toggleMuted() { this.setMuted(!this.muted); return this.muted; }

    play(name) {
      if (this.muted || this.volume <= 0) return;
      this._ensure();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const out = this.master;
      switch (name) {
        case 'move':     this._blip(280, 0.025, 'square', 0.18); break;
        case 'rotate':   this._blip(440, 0.035, 'triangle', 0.22); break;
        case 'hold':     this._sweep(220, 440, 0.08, 'sine', 0.25); break;
        case 'harddrop': this._thud(); break;
        case 'lock':     this._blip(160, 0.02, 'square', 0.15); break;
        case 'line1':    this._chime([523]); break;
        case 'line2':    this._chime([523, 659]); break;
        case 'line3':    this._chime([523, 659, 784]); break;
        case 'tetris':   this._chime([523, 659, 784, 1047], 0.05, 0.25); break;
        case 'tspin':    this._chime([330, 660, 990], 0.04, 0.25); break;
        case 'combo':    this._blip(880, 0.05, 'square', 0.22); break;
        case 'levelup':  this._arp([262, 330, 392, 523], 0.06, 'up'); break;
        case 'gameover': this._arp([523, 392, 330, 262, 196, 165], 0.13, 'down'); break;
        case 'incoming': this._warn(); break;
        case 'outgoing': this._woosh(); break;
        case 'weird':    this._weird(); break;
        case 'start':    this._arp([392, 523, 659, 784], 0.05, 'up'); break;
        case 'pause':    this._blip(440, 0.06, 'sine', 0.22); break;
      }
    }

    // Synthesized character voice. profile = { base, type, vib }. kind controls
    // the pitch contour: attack (battle cry ↑), hit (yelp ↓), win (cheer ↑↑), lose (↓↓).
    voice(profile, kind) {
      if (this.muted || this.volume <= 0) return;
      this._ensure();
      if (!this.ctx) return;
      profile = profile || { base: 300, type: 'square', vib: 6 };
      const t = this.ctx.currentTime;
      const base = profile.base || 300;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = profile.type || 'square';
      const f = osc.frequency;
      let dur = 0.34;
      if (kind === 'attack') {
        f.setValueAtTime(base * 0.8, t);
        f.linearRampToValueAtTime(base * 1.7, t + 0.10);
        f.linearRampToValueAtTime(base * 1.25, t + 0.32);
      } else if (kind === 'hit') {
        f.setValueAtTime(base * 1.5, t);
        f.exponentialRampToValueAtTime(base * 0.55, t + 0.28);
      } else if (kind === 'win') {
        dur = 0.5;
        f.setValueAtTime(base, t);
        f.linearRampToValueAtTime(base * 1.5, t + 0.12);
        f.linearRampToValueAtTime(base * 2.1, t + 0.4);
      } else if (kind === 'lose') {
        dur = 0.6;
        f.setValueAtTime(base * 1.25, t);
        f.exponentialRampToValueAtTime(base * 0.4, t + 0.55);
      }
      // Vibrato LFO modulating frequency for a "voice" warble.
      let lfo, lfoGain;
      if (profile.vib) {
        lfo = this.ctx.createOscillator();
        lfoGain = this.ctx.createGain();
        lfo.frequency.value = 13;
        lfoGain.gain.value = profile.vib * base * 0.02;
        lfo.connect(lfoGain).connect(f);
        lfo.start(t);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      if (lfo) lfo.stop(t + dur + 0.05);
    }

    _blip(freq, dur, type, gain) {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _sweep(f1, f2, dur, type, gain) {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f1, t);
      osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _thud() {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
    }

    _chime(freqs, gap = 0.04, gain = 0.22) {
      const t0 = this.ctx.currentTime;
      freqs.forEach((f, i) => {
        const t = t0 + i * gap;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }

    _arp(freqs, gap, dir) {
      this._chime(freqs, gap, 0.24);
    }

    _warn() {
      const t0 = this.ctx.currentTime;
      for (let i = 0; i < 2; i++) {
        const t = t0 + i * 0.09;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 660;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + 0.08);
      }
    }

    _woosh() {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.22);
    }

    _weird() {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(220, t + 0.1);
      osc.frequency.linearRampToValueAtTime(660, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  }

  window.audioFX = new AudioFX();

  // Resume audio context on first user gesture.
  const wakeAudio = () => {
    window.audioFX.resume();
  };
  window.addEventListener('keydown', wakeAudio, { once: true });
  window.addEventListener('mousedown', wakeAudio, { once: true });
  window.addEventListener('touchstart', wakeAudio, { once: true, passive: true });
})();
