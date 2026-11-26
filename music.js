// ===================== music =====================
// Original chiptune themes, played with Web Audio through the same context as the sound effects.
// In the 6 v 6 arena the home club's town has its own theme (yours at home, the rival's on the road);
// the mega bowl (Road to Glory semifinals) and championship night (the final) have their own, and so does each beach.
//
// A song is in a key (root, a MIDI note) and a mode (scale). Melody strings are 8th notes, 8 per bar:
// 1-7 are scale degrees in the middle octave, z x c v b n m the octave below, q w e r t y u the octave above,
// '-' holds the last note and '.' is a rest. Spaces are only for reading. `prog` is the chord per bar (a scale degree).
// Bass strings are 8th notes per bar: R root, F fifth, O root an octave up, T third, '-' hold, '.' rest.
// Drum strings are 16th notes per bar: k kick, s snare, h hat, o open hat.
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10],
  harm: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11], phryg: [0, 1, 3, 5, 7, 8, 10],
};
const SONGS = {
  // Pallet: a gentle, homely tune
  pallet: { root: 67, mode: 'major', bpm: 100, lead: 'pulse25', prog: [1, 4, 1, 5, 6, 4, 5, 1],
    mel: '3-5-q-7- 6---4-6- 5-3-1-3- 2-3-2-m- q-7-6-3- 4-6-q-6- 7-6-5-2- 1---5-3-',
    bass: 'R-F-O-F-', drums: ['k.......k.......', '........s.......', '....h.......h...'] },
  // Viridian: a walk in the woods, a little rough round the edges
  viridian: { root: 62, mode: 'mixo', bpm: 112, lead: 'pulse50', prog: [1, 7, 4, 1, 1, 7, 4, 5],
    mel: '5-.5-6-q 7---.6-5 4-6-q-6- 5---.--- 5-.5-6-q w-q-7-6- q---6-4- 5-6-7---',
    bass: 'R.RF.FO.', drums: ['k.....k.k.......', '....s.......s...', 'h.h.h.h.h.h.h.h.'] },
  // Pewter: heavy, stomping, made of stone
  pewter: { root: 52, mode: 'minor', bpm: 96, lead: 'pulse50', prog: [1, 6, 7, 1, 1, 6, 4, 5],
    mel: '1-1-3-5- 6---5-3- 2-2-4-7- 1---.--- 5-5-6-q- 3---2-1- 4-3-2-1- m-1----.',
    bass: 'R-R-R-FO', drums: ['k...k...k...k...', '....s.......s.s.', '..h...h...h...h.'] },
  // Cerulean: breezy, by the water
  cerulean: { root: 65, mode: 'lydian', bpm: 124, lead: 'pulse25', prog: [1, 2, 1, 2, 6, 5, 4, 5],
    mel: '1-3-5-7- q---7-5- 2-4-6-q- w---q-6- 6-q-w-e- w-q-7-5- 4-5-6-q- 7---5---',
    bass: 'R.FOR.FO', drums: ['k.......k.k.....', '....s.......s...', 'h.hhh.hhh.hhh.hh'] },
  // Vermilion: an electric march, bright brass on the beat
  vermilion: { root: 70, mode: 'major', bpm: 138, lead: 'pulse50', prog: [1, 5, 6, 4, 1, 5, 4, 5],
    mel: '1-1-1-5- 7-.7-2-. 6-6-q-6- 4---.--- 1-1-1-5- 7-q-w-e- w-q-6-4- 5---.---',
    bass: 'R.R.F.F.', drums: ['k.k.k.k.k.k.k.k.', '....s.......s.ss', 'h.h.h.h.h.h.h.h.'] },
  // Lavender: slow and eerie, with a lot of space in it
  lavender: { root: 57, mode: 'harm', bpm: 88, lead: 'pulse125', prog: [1, 4, 5, 1, 6, 4, 5, 5],
    mel: '5---3-.- 4---6-.- 7---2-.- 1---.--- 3---q-.- 6---4-.- 2---m-.- m-------',
    bass: 'R---F---', drums: ['k...............', '........s.......', '................'] },
  // Celadon: soft and floral, a lilting dance
  celadon: { root: 60, mode: 'major', bpm: 104, lead: 'tri', prog: [1, 3, 4, 1, 6, 2, 5, 1],
    mel: '3--4-5-- 5--6-7-- q--7-6-- 5-----.- 6--5-6-- 4--3-4-- 2--3-2-- 1-----.-',
    bass: 'R--F--O-', drums: ['k.....k.........', '........s.......', '..h..h..h..h..h.'] },
  // Fuchsia: quick, sneaky, all staccato
  fuchsia: { root: 64, mode: 'phryg', bpm: 132, lead: 'pulse125', prog: [1, 2, 1, 7, 1, 2, 6, 7],
    mel: '1.2.3... 2.1.m... 1.3.5.6. 5.3.2... 5.6.5.3. 2.3.2.1. n.m.1.2. 3-2-1---',
    bass: 'R.R.R.FO', drums: ['k..k..k.k..k..k.', '....s.......s...', 'hhhhhhhhhhhhhhhh'] },
  // Saffron: mysterious, floating, a bit psychic
  saffron: { root: 62, mode: 'lydian', bpm: 116, lead: 'pulse25', prog: [1, 2, 7, 1, 3, 2, 1, 2],
    mel: '1-5-w-q- 2-6-e-w- 7-4-6-5- 1---.--- 3-7-r-e- 2-6-e-w- 1-5-w-q- 2---6---',
    bass: 'R-F-R-F-', drums: ['k.......k.......', '....s.......s...', 'h...h...h...h...'] },
  // Cinnabar: hot and driving
  cinnabar: { root: 62, mode: 'minor', bpm: 150, lead: 'pulse50', prog: [1, 7, 6, 7, 1, 7, 6, 5],
    mel: '1-3-5-q- 7-5-2-m- 6-1-3-6- 7---.--- 1-3-5-q- w-q-7-5- 6-5-4-3- 2---.---',
    bass: 'RORORORO', drums: ['k.k...k.k.k...k.', '....s.......s...', 'h.h.h.h.h.h.h.h.'] },
  // Mega bowl: a big anthem for the playoffs
  bowl: { root: 62, mode: 'major', bpm: 128, lead: 'pulse50', prog: [4, 5, 3, 6, 4, 5, 1, 1],
    mel: '6-5-4-q- 7-6-5-2- 3-5-7-5- 6---.--- 6-5-4-q- 7-q-w-5- q---.--- q-w-e---',
    bass: 'R.ROR.RO', drums: ['k...k...k...k...', '....s.......s...', 'h.h.h.h.h.h.h.h.'] },
  // Championship night: the final, tense and fast
  night: { root: 60, mode: 'harm', bpm: 144, lead: 'pulse25', prog: [1, 6, 3, 7, 4, 5, 1, 5],
    mel: '1-3-5-q- 6-5-3-1- 3-5-7-5- 7-2-m--- 4-6-q-w- 7-2-5-7- q-5-3-1- m-------',
    bass: 'RRORRORO', drums: ['k..k..k.k..k..k.', '....s.......s...', 'hhhhhhhhhhhhhhhh'] },
  // Beach bleachers: sunny, with a skip in the bass
  beach: { root: 65, mode: 'major', bpm: 120, lead: 'pulse25', prog: [1, 4, 5, 1, 1, 4, 5, 1],
    mel: '5.5.6.5- 6-q-6-4- 2.2.3.2- m-2-5--- 5.5.6.5- q-w-e-w- q-6-5-2- 1---.---',
    bass: 'R..FR.F.', drums: ['k..k..k.k..k..k.', '....s.......s...', '..h...h...h...h.'] },
  // Pro tour stadium: upbeat and polished
  pro: { root: 69, mode: 'major', bpm: 132, lead: 'pulse50', prog: [1, 6, 4, 5, 1, 6, 4, 5],
    mel: '1-3-5-3- q-6-3-1- 4-6-q-6- 5---.--- 1-3-5-3- q-w-q-6- 4-5-6-7- q---.---',
    bass: 'R-ORR-OR', drums: ['k...k...k...k...', '....s.......s...', 'h.o.h.o.h.o.h.o.'] },
  // Boardwalk: laid back, swinging
  boardwalk: { root: 67, mode: 'mixo', bpm: 108, lead: 'tri', prog: [1, 4, 1, 7, 1, 4, 5, 1],
    mel: '5--6-5-3 1---.--- 4--5-4-2 m------- 5--6-5-q 7--6-5-3 2--3-4-2 1---.---',
    bass: 'R--F--O-', drums: ['k.....k.........', '....s.......s...', 'h..h.h..h..h.h..'] },
  // The title screen and the quick play menus: bright and heroic, 16 bars so it doesn't loop too soon
  title: { root: 60, mode: 'major', bpm: 120, lead: 'pulse25', prog: [1, 5, 6, 4, 1, 5, 4, 5, 6, 4, 1, 5, 6, 4, 5, 5],
    mel: '1-3-5-q- 7-5-2-5- 6-q-w-q- 6---4--- 3-5-q-e- w-7-5-7- q-6-4-6- 5------- e-w-q-6- q-6-4-q- w-q-5-3- 2-5-7-w- e-w-q-e- r-e-w-q- w---7-5- 7-w-5---',
    bass: 'R-F-O-F-', drums: ['k.......k.k.....', '....s.......s...', 'h.h.h.h.h.h.h.h.'] },
  // Road to Glory's hub, draft and match screens: a training-montage groove
  hub: { root: 62, mode: 'mixo', bpm: 112, lead: 'pulse50', prog: [1, 7, 4, 1, 6, 4, 5, 5],
    mel: '5-.3-5-q 7---4-2- 1-4-6-q- 5---.--- 6-q-6-3- 4-6-q-w- q-7-5-2- 5---.---',
    bass: 'R.ROR.FO', drums: ['k.....k.k.......', '....s.......s...', 'h.h.h.h.h.h.h.h.'] },
};
const MENU_SONGS = new Set(['title', 'hub']);

const VOL = 0.15; // the music bus, under the hit sounds
const Music = {
  bus: null, waves: {}, noise: null, song: null, id: null, game: null,
  step: 0, next: 0, pass: 0, playing: false,
  init() {
    const c = Sfx.ctx; if (!c || this.bus) return !!this.bus;
    this.bus = c.createGain(); this.bus.gain.value = 0; this.bus.connect(c.destination);
    const pulse = duty => { // a pulse wave with this duty cycle, the classic handheld sound
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      return c.createPeriodicWave(re, im);
    };
    this.waves = { pulse125: pulse(0.125), pulse25: pulse(0.25), pulse50: pulse(0.5) };
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    return true;
  },
  // which theme should be playing now, or null for silence
  wanted() {
    if (!Sfx.ctx || Sfx.muted || realSettings().music === 'off') return null;
    const scr = document.querySelector('.screen:not([hidden])'), body = document.body.classList;
    if (body.contains('on-title') || body.contains('on-menu')) // the menus have their own themes
      return careerMatch || (scr && scr.id.startsWith('scr-rtg')) ? 'hub' : 'title';
    if (typeof G === 'undefined' || !G || G.demo || G.phase === 'over' || $('#stage').hidden || !$('#pause').hidden) return null;
    const v = settings.venue[settings.mode];
    if (settings.mode === 2 || v === 'bowl' || v === 'night') return SONGS[v] ? v : 'beach';
    const h = clubs && clubs[homeSide()], id = h && Object.keys(CLUBS).find(k => CLUBS[k] === h);
    return SONGS[id] ? id : 'pallet';
  },
  compile(s) { // melody string to notes: { step (16th), semitones from the root, length in 16ths }
    const sc = MODES[s.mode], out = [];
    let t = 0, last = null;
    for (const ch of s.mel.replace(/\s+/g, '')) {
      const d = '1234567'.indexOf(ch), h = 'qwertyu'.indexOf(ch), l = 'zxcvbnm'.indexOf(ch);
      if (ch === '-') { if (last) last.len += 2; }
      else if (ch === '.') last = null;
      else { const k = d >= 0 ? d : h >= 0 ? h : l; last = { step: t, p: sc[k] + (h >= 0 ? 12 : l >= 0 ? -12 : 0), len: 2 }; out.push(last); }
      t += 2;
    }
    s.notes = out; s.byStep = new Map(out.map(n => [n.step, n]));
  },
  chord(s, bar) { // the triad on this bar's degree, as semitones from the root
    const sc = MODES[s.mode], d = s.prog[bar % s.prog.length] - 1;
    return [0, 2, 4].map(k => sc[(d + k) % 7] + (d + k >= 7 ? 12 : 0));
  },
  voice(wave, f, t, dur, vol, slide = 0) {
    const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain();
    if (this.waves[wave]) o.setPeriodicWave(this.waves[wave]); else o.type = wave === 'tri' ? 'triangle' : wave;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.7)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  },
  hit(kind, t) {
    const c = Sfx.ctx;
    if (kind === 'k') return this.voice('sine', 150, t, 0.13, 0.5, -105);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; src.playbackRate.value = 1 + Math.random() * 0.1;
    f.type = 'highpass'; f.frequency.value = kind === 's' ? 1200 : 7000;
    const dur = kind === 's' ? 0.13 : kind === 'o' ? 0.12 : 0.035, vol = kind === 's' ? 0.22 : 0.08;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.bus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },
  play(s, i, t, sd) { // everything that starts on 16th step i of the loop
    const hz = p => 440 * Math.pow(2, (s.root + p - 69) / 12), bar = Math.floor(i / 16), inBar = i % 16, ch = this.chord(s, bar);
    const n = s.byStep.get(i);
    if (n) {
      this.voice(s.lead, hz(n.p), t, n.len * sd * 0.92, 0.11);
      if (this.pass % 2 === 1) this.voice('pulse125', hz(n.p + 12), t + sd * 0.5, n.len * sd * 0.8, 0.03); // an echo an octave up on the second time through
    }
    if (inBar % 2 === 0) { // bass, in 8ths
      const b = s.bass[inBar / 2], base = ch[0] - (s.root < 60 ? 12 : 24); // keep the bass where small speakers can play it
      const p = { R: base, F: base + (ch[2] - ch[0]), O: base + 12, T: base + (ch[1] - ch[0]) }[b];
      if (p !== undefined) {
        let len = 1; while (s.bass[inBar / 2 + len] === '-') len++;
        this.voice('tri', hz(p), t, len * 2 * sd * 0.9, 0.32);
      }
    }
    if (this.pass % 2 === 1 && s.bpm < 140) { // a quiet arpeggio under the tune on the second time through
      const a = ch[[0, 1, 2, 1][inBar % 4]] - 12 + (inBar >= 8 ? 12 : 0);
      this.voice('pulse125', hz(a), t, sd * 0.8, 0.025);
    }
    for (const [k, row] of [['k', 0], ['s', 1], ['h', 2]]) {
      const ch2 = s.drums[row][inBar];
      if (ch2 !== '.' && ch2 !== undefined) this.hit(ch2 === 'o' ? 'o' : k, t);
    }
  },
  tick() {
    if (!Sfx.ctx) return;
    const want = this.wanted();
    if (want && !this.init()) return;
    if (!this.bus) return;
    const c = Sfx.ctx, now = c.currentTime;
    if (want !== this.id || (want && !MENU_SONGS.has(want) && G !== this.game)) { // a new theme or a new match starts from the top
      if (want) {
        const s = SONGS[want]; if (!s.notes) this.compile(s);
        this.song = s; this.step = 0; this.pass = 0; this.next = now + 0.15; this.game = G;
        this.bus.gain.cancelScheduledValues(now); this.bus.gain.setValueAtTime(0, now); this.bus.gain.linearRampToValueAtTime(VOL, now + 0.6);
      }
      this.id = want;
    }
    if (!want) {
      if (this.playing) { this.bus.gain.cancelScheduledValues(now); this.bus.gain.setTargetAtTime(0, now, 0.08); }
      this.playing = false; this.paused = this.id; return;
    }
    if (!this.playing) { // back from the pause menu: fade in and carry on where it stopped
      this.next = Math.max(this.next, now + 0.05);
      this.bus.gain.cancelScheduledValues(now); this.bus.gain.setTargetAtTime(VOL, now, 0.1);
      this.playing = true;
    }
    if (this.next < now - 0.5) this.next = now + 0.05; // the tab was asleep: don't try to catch up
    const s = this.song, sd = 60 / s.bpm / 4, steps = s.prog.length * 16;
    while (this.next < now + 0.2) {
      this.play(s, this.step, this.next, sd);
      this.next += sd; this.step++;
      if (this.step >= steps) { this.step = 0; this.pass++; }
    }
  },
};

// ===================== crowd =====================
// Real crowd recordings (audio/, credits in the README): a steady murmur under the play, quieter for the serve,
// and a cheer when the home side scores (bigger after a long rally, a set or the match). In championship night
// the arena is split, so the away half cheers its own side's points too. The arenas are louder than the beaches.
const CROWD_SIZE = { arena: 1, bowl: 1.2, night: 1.35, beach: 0.55, pro: 0.8, boardwalk: 0.45 };
const CROWD_FILES = ['murmur', 'cheer1', 'cheer2', 'cheer3'];
const CROWD_VOL = 0.3; // the whole crowd, against the hit sounds
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const Crowd = {
  bus: null, buf: {}, mur: null, shots: [], phase: null,
  init() {
    if (this.bus) return true;
    const c = Sfx.ctx; if (!c) return false;
    this.bus = c.createGain(); this.bus.gain.value = CROWD_VOL; this.bus.connect(c.destination);
    for (const n of CROWD_FILES) // loaded once, in the background; a sound that isn't in yet is skipped
      fetch(`audio/crowd-${n}.mp3`).then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(b => { this.buf[n] = b; if (n === 'murmur') this.loop(n); }).catch(() => {});
    return true;
  },
  loop(n) { // the murmur runs all the time; its gain does the work
    const c = Sfx.ctx, b = this.buf[n], src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.loop = true; src.loopStart = 0.06; src.loopEnd = b.duration - 0.06; // past the mp3 padding at each end
    g.gain.value = 0; src.connect(g).connect(this.bus); src.start(0, Math.random() * b.duration * 0.8);
    this.mur = g;
  },
  on() {
    return !!Sfx.ctx && !Sfx.muted && realSettings().crowd !== 'off' && typeof G !== 'undefined' && !!G && !G.demo && !G.simFast
      && !$('#stage').hidden && $('#pause').hidden;
  },
  size() { return CROWD_SIZE[settings.venue[settings.mode]] || 1; },
  shot(n, vol, at = 0, rate = 1, lp = 0) { // a one-off sound; cheers still going when the next serve is hit are faded out
    const b = this.buf[n]; if (!b) return;
    const c = Sfx.ctx, src = c.createBufferSource(), g = c.createGain(), t = c.currentTime + 0.03 + at;
    src.buffer = b; src.playbackRate.value = rate; g.gain.value = vol;
    let out = src;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; out = src.connect(f); }
    out.connect(g).connect(this.bus); src.start(t, 0.05);
    const s = { g, end: t + b.duration / rate }; this.shots.push(s);
    src.onended = () => { this.shots = this.shots.filter(x => x !== s); };
  },
  // a point: the home crowd cheers its own side; in championship night the away half cheers theirs
  point(w, setWon, matchWon) {
    if (!this.on() || !this.init()) return;
    const z = this.size(), home = w === homeSide(), beach = settings.mode === 2;
    if (!home && !venue().teamSides) return;
    const x = Math.min(1.6, 0.7 + Math.min(G.rally, 10) * 0.05 + (setWon ? 0.3 : 0) + (matchWon ? 0.3 : 0));
    this.shot(pick(['cheer1', 'cheer2', 'cheer3']), (beach ? 0.45 : 0.75) * z * x * (home ? 1 : 0.55), 0, rnd(0.95, 1.05));
  },
  tick() {
    const on = this.on();
    if (!this.bus && !(on && this.init())) return;
    const now = Sfx.ctx.currentTime, z = this.size(), ph = on ? G.phase : null;
    if (ph === 'rally' && this.phase !== 'rally') // the serve is in the air: whatever cheer is left dies down
      for (const s of this.shots) if (s.end > now + 0.3) { s.g.gain.cancelScheduledValues(now); s.g.gain.setTargetAtTime(0, now, 0.35); }
    this.phase = ph;
    const mur = on ? z * (ph === 'serve' ? 0.22 : 0.32) : 0; // the crowd hushes a little for the serve
    if (this.mur) this.mur.gain.setTargetAtTime(mur, now, 0.5);
    if (!on) for (const s of this.shots) { s.g.gain.cancelScheduledValues(now); s.g.gain.setTargetAtTime(0, now, 0.1); }
  },
};
// Browsers keep a page silent until you click, tap or press a key, so the menu music starts on the first one.
// Safari only counts some of these (a tap's touchend, a click), so listen for all of them and wake the audio each time.
function wakeAudio() {
  Sfx.init();
  if (Sfx.ctx && Sfx.ctx.state !== 'running') Sfx.ctx.resume().catch(() => {});
}
for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'click', 'touchstart', 'touchend', 'keydown']) addEventListener(ev, wakeAudio, { capture: true, passive: true });
// a hint on the title screen until the sound is on
setInterval(() => {
  const h = $('#sound-hint'); if (!h) return;
  h.hidden = !document.body.classList.contains('on-title') || Sfx.muted || realSettings().music === 'off' || (!!Sfx.ctx && Sfx.ctx.state === 'running');
}, 250);
setInterval(() => { Music.tick(); Crowd.tick(); }, 40);
