// Synthesized background music. Re-uses the AudioContext from audioFX.
// Three original loopable tracks: Pulse / Drift / Arcade.
(function () {
  const NOTE_FREQ = (() => {
    const out = {};
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for (let oct = 1; oct <= 6; oct++) {
      for (let i = 0; i < 12; i++) {
        const midi = (oct + 1) * 12 + i;
        out[names[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
      }
    }
    return out;
  })();

  function buildTracks() {
    // Each track: { bpm, subdiv (steps per beat), instruments, pattern[] }
    // Pattern cell: object keyed by voice name -> note string, or null for rest.
    return {
      pulse: {
        label: 'Pulse',
        bpm: 128, subdiv: 4,
        instruments: {
          lead: { type: 'square',   dur: 0.22, gain: 0.16 },
          bass: { type: 'triangle', dur: 0.40, gain: 0.22 },
        },
        // 32 steps in A minor — a driving 8-bit loop
        pattern: [
          { lead: 'A4', bass: 'A2' }, null,             { lead: 'C5' }, null,
          { lead: 'E5' },             null,             { lead: 'D5' }, { lead: 'C5' },
          { lead: 'B4', bass: 'E2' }, null,             { lead: 'A4' }, null,
          { lead: 'E4' },             null,             { lead: 'G4' }, { lead: 'A4' },
          { lead: 'A4', bass: 'F2' }, null,             { lead: 'C5' }, null,
          { lead: 'E5' },             null,             { lead: 'D5' }, { lead: 'B4' },
          { lead: 'C5', bass: 'G2' }, null,             { lead: 'B4' }, null,
          { lead: 'A4' },             { lead: 'G4' },   { lead: 'A4' }, null,
        ],
      },
      drift: {
        label: 'Drift',
        bpm: 56, subdiv: 1,
        instruments: {
          pad1: { type: 'sine', dur: 1.9, gain: 0.10 },
          pad2: { type: 'sine', dur: 1.9, gain: 0.09 },
          pad3: { type: 'sine', dur: 1.9, gain: 0.07 },
        },
        // Slow ambient progression in C major: I  vi  IV  V
        pattern: [
          { pad1: 'C4', pad2: 'E4', pad3: 'G4' },
          { pad1: 'A3', pad2: 'C4', pad3: 'E4' },
          { pad1: 'F3', pad2: 'A3', pad3: 'C4' },
          { pad1: 'G3', pad2: 'B3', pad3: 'D4' },
        ],
      },
      arcade: {
        label: 'Arcade',
        bpm: 156, subdiv: 4,
        instruments: {
          lead: { type: 'square', dur: 0.10, gain: 0.14 },
          bass: { type: 'square', dur: 0.16, gain: 0.16 },
        },
        // 16-step fast pentatonic-ish arpeggio in C minor
        pattern: [
          { lead: 'C5', bass: 'C3' }, { lead: 'D#5' }, { lead: 'G5' }, { lead: 'D#5' },
          { lead: 'C5', bass: 'F3' }, { lead: 'F5' },  { lead: 'A#5'}, { lead: 'F5' },
          { lead: 'D5', bass: 'G3' }, { lead: 'G5' },  { lead: 'A#5'}, { lead: 'G5' },
          { lead: 'C5', bass: 'C3' }, { lead: 'D#5' }, { lead: 'G5' }, { lead: 'C6' },
        ],
      },
    };
  }

  class Music {
    constructor() {
      this.tracks = buildTracks();
      this.current = 'off';
      this.timer = null;
      this.step = 0;
      this.master = null;
      this.volume = 0.5; // multiplier on top of audioFX master
      this._loadSettings();
    }

    _loadSettings() {
      try {
        const t = localStorage.getItem('tetlis_bgm');
        if (t && (t === 'off' || this.tracks[t])) this.current = t;
        const v = localStorage.getItem('tetlis_bgm_vol');
        if (v != null) this.volume = Math.max(0, Math.min(1, Number(v)));
      } catch (e) {}
    }
    _saveSettings() {
      try {
        localStorage.setItem('tetlis_bgm', this.current);
        localStorage.setItem('tetlis_bgm_vol', String(this.volume));
      } catch (e) {}
    }

    _ensure() {
      window.audioFX?._ensure();
      const ctx = window.audioFX?.ctx;
      if (!ctx) return;
      if (!this.master || this.master.context !== ctx) {
        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(window.audioFX.master);
      }
    }

    list() {
      return Object.keys(this.tracks).map(k => ({ id: k, label: this.tracks[k].label }));
    }

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.master) this.master.gain.value = this.volume;
      this._saveSettings();
    }

    setTrack(name) {
      this.current = name;
      this._saveSettings();
      // If we're currently playing, restart with the new track.
      if (this.timer) { this.stop(); if (name !== 'off') this.start(); }
    }

    start() {
      this.stop();
      if (this.current === 'off') return;
      const track = this.tracks[this.current];
      if (!track) return;
      this._ensure();
      if (!this.master) return;
      const stepMs = 60000 / track.bpm / track.subdiv;
      this.step = 0;
      this.timer = setInterval(() => {
        this._playStep(track, this.step % track.pattern.length);
        this.step++;
      }, stepMs);
    }

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    _playStep(track, i) {
      const cell = track.pattern[i];
      if (!cell) return;
      const ctx = window.audioFX?.ctx;
      if (!ctx) return;
      for (const voice of Object.keys(cell)) {
        const note = cell[voice];
        if (!note) continue;
        const freq = NOTE_FREQ[note];
        if (!freq) continue;
        const inst = track.instruments[voice];
        if (!inst) continue;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = inst.type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(inst.gain, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + inst.dur);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + inst.dur + 0.02);
      }
    }
  }

  window.music = new Music();
})();
