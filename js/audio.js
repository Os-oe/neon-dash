// NEON DASH — Audio-System
// SFX: prozeduraler WebAudio-Chiptune-Synth („modern hybrid chiptune": Square/Tri-Wellen
// + Sub-Bass + Noise + Lowpass). ElevenLabs-Upstream war beim Build down — der Synth
// liefert dieselbe Soundliste aus Konzept 2.7 latenzfrei und kostenlos.
// Musik: Suno-Loop über eigenes WebAudio-Graph (MediaElement → Lowpass → Gain), damit
// OVERDRIVE den Filter öffnen + Pitch anheben kann und der Tod die Musik duckt.

const AudioSys = {
  ctx: null,
  sfxGain: null,
  musicEl: null,
  musicGain: null,
  musicFilter: null,
  musicStarted: false,
  slideNode: null,
  muted: localStorage.getItem('neon-dash.muted') === '1',

  setMuted(on) {
    this.muted = on;
    localStorage.setItem('neon-dash.muted', on ? '1' : '0');
    if (this.musicEl) this.musicEl.muted = on;
    if (on) this.slideStop();
  },

  // nach erster User-Geste aufrufen (Autoplay-Policy)
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.5;
        this.sfxGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.muted = true; // Audio kaputt → Spiel läuft stumm weiter
    }
  },

  startMusic() {
    try {
      this.ensure();
      if (this.musicStarted || !this.ctx) return;
      this.musicStarted = true;
      this.musicEl = new Audio('assets/audio/music-v1.mp3');
      this.musicEl.loop = true;
      this.musicEl.muted = this.muted;
      const src = this.ctx.createMediaElementSource(this.musicEl);
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 3200; // Normal-Zustand leicht gefiltert — OVERDRIVE öffnet
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      src.connect(this.musicFilter);
      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.ctx.destination);
      this.musicEl.play().catch(() => { this.musicStarted = false; });
    } catch (e) { /* Musik optional — nie das Spiel blockieren */ }
  },

  // OVERDRIVE: Filter öffnet sich + Pitch +5 % + lauter (vertikales Layering, billige Stem-Alternative)
  setOverdrive(on) {
    if (!this.musicFilter) return;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.linearRampToValueAtTime(on ? 16000 : 3200, t + 0.5);
    this.musicGain.gain.linearRampToValueAtTime(on ? 0.62 : 0.5, t + 0.5);
    this.musicEl.playbackRate = on ? 1.05 : 1.0;
  },

  // Tod: Musik duckt sofort + Filter zu; Restart stellt wieder her
  duck(on) {
    if (!this.musicFilter) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.linearRampToValueAtTime(on ? 0.10 : 0.5, t + (on ? 0.08 : 0.6));
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.linearRampToValueAtTime(on ? 600 : 3200, t + (on ? 0.08 : 0.6));
    if (!on) this.musicEl.playbackRate = 1.0;
  },

  // ---------- Synth-Primitive ----------

  tone(opts) {
    if (!this.ctx || this.muted) return;
    const { wave = 'square', f0 = 440, f1 = f0, dur = 0.15, vol = 0.25, delay = 0, curve = 'exp' } = opts;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    else osc.frequency.linearRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise(opts) {
    if (!this.ctx || this.muted) return;
    const { dur = 0.2, f0 = 800, f1 = f0, vol = 0.2, type = 'bandpass', delay = 0, q = 1 } = opts;
    const t = this.ctx.currentTime + delay;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },

  // ---------- Spiel-SFX (Liste Konzept 2.7) ----------

  jump() {
    this.tone({ wave: 'square', f0: 240, f1: 660, dur: 0.16, vol: 0.22 });
    this.tone({ wave: 'sine', f0: 90, f1: 50, dur: 0.1, vol: 0.3 }); // Sub-Punch
  },

  djump() {
    this.tone({ wave: 'square', f0: 520, f1: 760, dur: 0.07, vol: 0.2 });
    this.tone({ wave: 'square', f0: 660, f1: 980, dur: 0.09, vol: 0.2, delay: 0.06 });
  },

  land(force) {
    const v = Math.min(0.12 + force * 0.25, 0.35);
    this.tone({ wave: 'triangle', f0: 150, f1: 55, dur: 0.1, vol: v });
    this.noise({ dur: 0.08, f0: 500, f1: 200, vol: v * 0.5, type: 'lowpass' });
  },

  slideStart() {
    if (!this.ctx || this.slideNode || this.muted) return;
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.value = 0.07;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
    this.slideNode = { src, g };
  },

  slideStop() {
    if (!this.slideNode) return;
    const t = this.ctx.currentTime;
    this.slideNode.g.gain.linearRampToValueAtTime(0, t + 0.08);
    const n = this.slideNode;
    setTimeout(() => n.src.stop(), 120);
    this.slideNode = null;
  },

  // Pitch-Ladder: pro Zelle in der Kette ein Halbton höher (Mario-Standard), Reset bei Lücke
  cell(chain) {
    const f = 740 * Math.pow(2, Math.min(chain, 14) / 12);
    this.tone({ wave: 'square', f0: f, f1: f * 1.18, dur: 0.08, vol: 0.16 });
    this.tone({ wave: 'sine', f0: f * 2, f1: f * 2, dur: 0.05, vol: 0.07, delay: 0.01 });
  },

  powerup() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone({ wave: 'square', f0: f, f1: f, dur: 0.09, vol: 0.18, delay: i * 0.055 }));
    this.tone({ wave: 'sawtooth', f0: 1047, f1: 2093, dur: 0.25, vol: 0.06, delay: 0.22 });
  },

  odStart() {
    this.noise({ dur: 0.8, f0: 300, f1: 4000, vol: 0.18, type: 'bandpass', q: 2 }); // Riser
    this.tone({ wave: 'sawtooth', f0: 110, f1: 880, dur: 0.7, vol: 0.16 });
    this.tone({ wave: 'sine', f0: 60, f1: 40, dur: 0.5, vol: 0.4, delay: 0.65 }); // Boom
    [880, 1109, 1319].forEach((f, i) =>
      this.tone({ wave: 'square', f0: f, f1: f, dur: 0.12, vol: 0.16, delay: 0.7 + i * 0.07 })); // Fanfare
  },

  odTick() {
    this.tone({ wave: 'square', f0: 1300, f1: 1300, dur: 0.035, vol: 0.14 });
  },

  odEnd() {
    this.tone({ wave: 'sawtooth', f0: 700, f1: 120, dur: 0.5, vol: 0.16 });
  },

  hit() {
    this.tone({ wave: 'square', f0: 220, f1: 70, dur: 0.22, vol: 0.3 });
    this.noise({ dur: 0.15, f0: 2000, f1: 300, vol: 0.2 });
  },

  death() {
    [392, 311, 247, 196].forEach((f, i) =>
      this.tone({ wave: 'square', f0: f, f1: f * 0.97, dur: 0.16, vol: 0.2, delay: i * 0.12 }));
    this.tone({ wave: 'sine', f0: 65, f1: 35, dur: 0.6, vol: 0.3, delay: 0.1 });
  },

  milestone() {
    this.tone({ wave: 'triangle', f0: 880, f1: 880, dur: 0.12, vol: 0.2 });
    this.tone({ wave: 'triangle', f0: 1319, f1: 1319, dur: 0.25, vol: 0.2, delay: 0.1 });
  },

  nearmiss() {
    this.noise({ dur: 0.25, f0: 400, f1: 3500, vol: 0.22, type: 'bandpass', q: 1.5 });
  },

  fanfare() {
    [659, 784, 1047, 784, 1319].forEach((f, i) =>
      this.tone({ wave: 'square', f0: f, f1: f, dur: 0.12, vol: 0.18, delay: i * 0.09 }));
    this.tone({ wave: 'sawtooth', f0: 330, f1: 330, dur: 0.5, vol: 0.07, delay: 0.36 });
  },

  shieldPop() {
    this.noise({ dur: 0.2, f0: 1500, f1: 500, vol: 0.25 });
    this.tone({ wave: 'triangle', f0: 600, f1: 200, dur: 0.18, vol: 0.2 });
  },

  ui() {
    this.tone({ wave: 'square', f0: 1700, f1: 1700, dur: 0.04, vol: 0.12 });
  },
};
