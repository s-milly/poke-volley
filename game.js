'use strict';
/* VolleyDex: Gen 1 draft volleyball. 3D court drawn on a 2D canvas, no libraries.
   World units are meters. x runs across the court, y is height, z runs toward the far
   baseline. Your team plays the near half (z < 0); the net is at z = 0. */

// ===================== constants =====================
const W = 1280, H = 720;
const NET_H = 1.55;         // net height, scaled to Pokémon size
const BR = 0.17;            // ball radius
const GB = 9.0;             // gravity on the ball (a little floaty, arcade style)
const GP = 24;              // gravity on players
// Near the top of a jump gravity eases off, so you hang there for a beat to swing.
const HANG_V = 3, HANG = 0.4;
const pGrav = vy => (Math.abs(vy) < HANG_V ? GP * HANG : GP);
// Take-off speed that reaches a given height, and the time it takes to get there, with the hang.
const jumpVFor = apex => Math.sqrt(Math.max(2 * GP * apex - HANG_V * HANG_V / HANG + HANG_V * HANG_V, HANG_V * HANG_V + 1));
const timeUp = v => (v > HANG_V ? (v - HANG_V) / GP + HANG_V / (GP * HANG) : v / (GP * HANG));
const STEP = 1 / 120;
const TEAM_COLORS = ['#3fa7ff', '#ff5d5d'];
// Clubs you can play as, named after the Gen 1 towns. `color` is the club's stripe on the scoreboard.
const CLUBS = {
  pallet:    { name: 'Pallet Sprouts',   abbr: 'PAL', color: '#7cc96b' },
  viridian:  { name: 'Viridian Rangers', abbr: 'VIR', color: '#1f7a4d' },
  pewter:    { name: 'Pewter Boulders',  abbr: 'PEW', color: '#8a8f99' },
  cerulean:  { name: 'Cerulean Tides',   abbr: 'CER', color: '#2f8cff' },
  vermilion: { name: 'Vermilion Volts',  abbr: 'VER', color: '#ff6a2b' },
  lavender:  { name: 'Lavender Spirits', abbr: 'LAV', color: '#9b7bd4' },
  celadon:   { name: 'Celadon Blossoms', abbr: 'CEL', color: '#3fbf9a' },
  fuchsia:   { name: 'Fuchsia Ninjas',   abbr: 'FCH', color: '#e0479e' },
  saffron:   { name: 'Saffron Mystics',  abbr: 'SAF', color: '#f2b51d' },
  cinnabar:  { name: 'Cinnabar Blaze',   abbr: 'CIN', color: '#d7262e' },
};
// 12x12 pixel emblems for the club crests: # is the light emblem, o a dark detail.
const CLUB_EMBLEM = {
  pallet: ["............", "..##....##..", ".####..####.", ".#####.####.", "..####.###..", "....##.##...", ".....###....", "......#.....", "......#.....", "......#.....", "....#####...", "............"],
  viridian: ["......#.....", ".....###....", "....#####...", ".....###....", "....#####...", "...#######..", "....#####...", "...#######..", "..#########.", "......#.....", "......#.....", "............"],
  pewter: ["............", "....####....", "..########..", ".####o#####.", ".###o######.", "############", "######o#####", "#####o######", ".##########.", "..########..", "............", "............"],
  cerulean: [".....#......", ".....##.....", "....###.....", "....####....", "...######...", "..########..", "..######o#..", ".#######o##.", ".########o#.", "..########..", "...######...", "............"],
  vermilion: [".......###..", "......###...", ".....###....", "....###.....", "...#######..", ".......###..", "......###...", ".....###....", "....##......", "...##.......", "..#.........", "............"],
  lavender: ["....####....", "..########..", ".##########.", ".##oo##oo##.", ".##oo##oo##.", ".##########.", ".##########.", ".####oo####.", ".##########.", ".##########.", ".#.##.##.#..", "............"],
  celadon: [".....##.....", "....####....", ".##.####.##.", ".####oo####.", "..###oo###..", ".####oo####.", ".##.####.##.", "....####....", ".....##.....", ".....#......", "....###.....", "............"],
  fuchsia: [".....#......", ".....##.....", ".....###....", "###..##.....", ".#########..", "..###oo###..", "..###oo###..", "..#########.", ".....##..###", "....###.....", ".....##.....", "......#....."],
  saffron: [".....##.....", ".....##.....", "....####....", "############", ".##########.", "..########..", "...######...", "...######...", "..###..###..", "..##....##..", ".#........#.", "............"],
  cinnabar: [".....#......", ".....##.....", "....###..#..", "...####.##..", "..#######...", "..###o####..", ".###oo#####.", ".##ooo#####.", ".##oooo####.", "..##oo####..", "...######...", "............"],
  random: ["...######...", "..##....##..", "..##....##..", "........##..", ".......##...", "......##....", ".....##.....", ".....##.....", "............", ".....##.....", ".....##.....", "............"],
};
const crestCache = {};
// A club crest as a data URL: a pixel shield in the club colour with its emblem. 24x26 px, scaled up with pixelated rendering.
function clubCrest(id) {
  if (crestCache[id]) return crestCache[id];
  const color = id === 'random' ? '#5b6a92' : CLUBS[id].color, W = 24, H = 26;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const inside = (x, y) => {
    if (x < 1 || x > W - 2 || y < 1 || y > H - 2) return false;
    if (y === 1 && (x < 3 || x > W - 4)) return false;
    if (y < 16) return true;
    return Math.abs(x + 0.5 - W / 2) <= 11 - (y - 15) * 1.15; // taper to a point
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside(x, y)) continue;
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    g.fillStyle = edge ? '#0a0e18' : y < 4 ? shade(color, 0.25) : x > W / 2 + 6 || y > 17 ? shade(color, -0.22) : color;
    g.fillRect(x, y, 1, 1);
  }
  CLUB_EMBLEM[id].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = ch === '#' ? '#fbfcff' : shade(color, -0.45);
    g.fillRect(x + 6, y + 5, 1, 1);
  }));
  return (crestCache[id] = c.toDataURL());
}
const clubId = club => Object.keys(CLUBS).find(id => CLUBS[id] === club);
const crestImg = (id, size = 48) => `<img class="crest" src="${clubCrest(id)}" width="${size}" height="${Math.round(size * 26 / 24)}" alt="">`;
let HW = 4, HL = 8;         // half width and half length of the court (set per mode)

const TYPE_COLORS = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c', grass: '#7ac74c',
  ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1', ground: '#e2bf65', flying: '#a98ff3',
  psychic: '#f95587', bug: '#a6b91a', rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc',
  dark: '#705746', steel: '#b7b7ce', fairy: '#d685ad',
};
const BODY_COLORS = {
  black: '#4a4a58', blue: '#5b8fe0', brown: '#b07a4f', gray: '#a3a9b3', green: '#69b85a',
  pink: '#f4a3c4', purple: '#9b72d6', red: '#e2553e', white: '#f1efe9', yellow: '#f4d34e',
};
const CAPTAIN_BOOST = 14;
const STAT_KEYS = [['spd', 'SPD', 'Speed: how fast it runs'], ['jmp', 'JMP', 'Jump: how high it leaps'],
  ['pwr', 'PWR', 'Power: how hard it spikes and serves'], ['def', 'DEF', 'Defense: how cleanly it receives'],
  ['skl', 'SKL', 'Skill: how accurately it sets']];

// Opponent AI by difficulty. Your teammates always use MATE.
const DIFF = {
  easy:   { err: 1.6, react: 0.30, spd: 0.84, jump: 0.25, serveFault: 0.10, leaveOut: 0.40, teamOffset: -7, block: 0.22, perfect: 0.06 },
  normal: { err: 0.8, react: 0.18, spd: 0.94, jump: 0.12, serveFault: 0.06, leaveOut: 0.75, teamOffset: -1, block: 0.30, perfect: 0.12 },
  hard:   { err: 0.3, react: 0.09, spd: 1.03, jump: 0.05, serveFault: 0.03, leaveOut: 0.95, teamOffset: 4,  block: 0.38, perfect: 0.2 },
};
const MATE = { err: 0.4, react: 0.11, spd: 1, jump: 0.07, leaveOut: 0.85, block: 0.32, perfect: 0.12 };

const QS = new URLSearchParams(location.search);
const AUTO = QS.has('auto');                 // test mode: the computer also plays your Pokémon
const SPEEDUP = Number(QS.get('fast')) || 1; // test mode: run the clock faster

// ===================== helpers =====================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const toward = s => (s === 0 ? 1 : -1); // z direction from this side toward the net

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

// ===================== Pokédex and ratings =====================
function scale(v, lo, hi) { return Math.round(clamp(25 + (v - lo) / (hi - lo) * 74, 20, 99)); }
function ovrOf(r) {
  const raw = 0.23 * r.spd + 0.2 * r.jmp + 0.22 * r.pwr + 0.19 * r.def + 0.16 * r.skl;
  return Math.round(clamp(30 + (raw - 33) * 1.25, 25, 99));
}
const DEX = RAW_DEX.map(([id, name, types, color, h, w, hp, atk, def, spa, spd, spe, leg]) => {
  const heavy = 9 * Math.log10(Math.max(w, 20) / 150);
  const r = {
    spd: scale(spe, 15, 140),
    jmp: scale(0.55 * spe + 0.45 * atk - heavy, 20, 125),
    pwr: scale(0.65 * atk + 0.35 * spa, 20, 140),
    def: scale(0.5 * def + 0.5 * hp, 20, 135),
    skl: scale(0.5 * spa + 0.5 * spd, 20, 140),
  };
  return { id, name, types, color, h, w, base: { hp, atk, def, spa, spd, spe }, leg: !!leg, r, ovr: ovrOf(r) };
});
const BY_ID = new Map(DEX.map(m => [m.id, m]));

function makeEntry(mon, captain) {
  const r = {};
  for (const k in mon.r) r[k] = captain ? Math.min(99, mon.r[k] + CAPTAIN_BOOST) : mon.r[k];
  return { mon, captain, r, ovr: ovrOf(r) };
}
const teamOvr = es => Math.round(es.reduce((a, e) => a + e.ovr, 0) / es.length);

// ===================== audio =====================
const Sfx = {
  ctx: null, muted: false,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.muted = true; } } },
  tone(freq, dur, type = 'triangle', vol = 0.06, slide = 0, delay = 0) {
    if (this.muted || !this.ctx || (G && G.demo)) return; // the title screen's background match is silent
    const c = this.ctx, t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  bump() { this.tone(520, 0.07); },
  spike() { this.tone(240, 0.16, 'sawtooth', 0.07, -140); },
  serve() { this.tone(400, 0.1, 'triangle', 0.06, 120); },
  block() { this.tone(160, 0.14, 'square', 0.06, -60); },
  whistle() { this.tone(1900, 0.22, 'sine', 0.04); },
  point(good) { const n = good ? [523, 659, 784] : [392, 330, 262]; n.forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, 0, i * 0.09)); },
};

// ===================== input =====================
// WASD moves. The mouse aims: serves, spikes, sets and over-balls go toward the cursor.
// Left click receives on the ground and spikes in the air; E sets; right click dives on the ground
// and blocks in the air; hold Space to charge a jump; Shift strafes; C and V (or the wheel) work the camera.
const keys = { left: false, right: false, up: false, down: false, hit: false, set: false, jump: false, strafe: false };
const input = { jumpT0: null, jumpQ: null, hitQ: false, setQ: false, diveQ: false, aim: null };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyE: 'set', KeyJ: 'hit', Enter: 'hit', KeyL: 'dive',
  ShiftLeft: 'strafe', ShiftRight: 'strafe', KeyC: 'cam', KeyV: 'zoom',
};
const JUMP_CHARGE = 0.4; // seconds of holding Space for a full-height jump
function press(action, down) {
  Sfx.init();
  if (action === 'jump') {
    if (down && !keys.jump) input.jumpT0 = performance.now();
    else if (!down && keys.jump && input.jumpT0 != null) { input.jumpQ = clamp((performance.now() - input.jumpT0) / 1000 / JUMP_CHARGE, 0, 1); input.jumpT0 = null; }
    keys.jump = down;
  }
  else if (action === 'hit' || action === 'set') { // when it happened, so the meter is graded at the moment you pressed or let go
    if (down && !keys[action]) { input[action + 'Q'] = true; input.downAt = performance.now(); }
    if (!down && keys[action]) input.upAt = performance.now();
    keys[action] = down;
  }
  else if (action === 'dive') { if (down) input.diveQ = true; }
  else if (action === 'cam') { if (down) cycleCam(); }
  else if (action === 'zoom') { if (down) cycleZoom(); }
  else if (action in keys) keys[action] = down;
}
addEventListener('keydown', e => {
  if (!G || $('#stage').hidden || G.demo) return;
  if (e.target.closest && e.target.closest('#coach, #pause') && (e.code === 'Enter' || e.code === 'Space')) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
  if (e.code === 'KeyM') { Sfx.muted = !Sfx.muted; return; }
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) showTabStats(true); return; }
  if (/^Digit[1-4]$/.test(e.code)) { if (!e.repeat) quickChat(+e.code[5] - 1); e.preventDefault(); return; }
  const a = KEYMAP[e.code];
  if (a) { e.preventDefault(); if (!e.repeat) press(a, true); }
});
addEventListener('keyup', e => { if (e.code === 'Tab') showTabStats(false); const a = KEYMAP[e.code]; if (a) press(a, false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.jumpT0 = null; showTabStats(false); });

// ===================== match state =====================
const settings = { mode: 2, diff: 'normal', target: 15, sets: 1, role: { 2: 'B', 6: 'OH' }, venue: { 2: 'beach', 6: 'arena' }, time: 'day', club: ['cerulean', 'random'], camMode: 'follow', zoom: 1 };
let clubs = null;   // [club, club] for this match, the rival resolved from 'random'
let draft = null;   // { starter, picks: [mon], offers: [mon], rerolls }
let capPick = null; // { role, offers: [mon], rerolls }: your own Pokémon, offered for your position
let teams = null;   // [[entry], [entry]], entry 0 of team 0 is you
let G = null;       // live match
let TUT = null;     // the tutorial, while it runs: { mode, roles, ri, steps, si, saved, ... }

class Player {
  constructor(entry, side, human, size) {
    this.entry = entry; this.mon = entry.mon; this.r = entry.r; this.side = side; this.human = human;
    this.rr = clamp(0.24 + Math.sqrt(this.mon.h) * 0.075, 0.3, 0.72) * size; // body radius
    this.speed = 4.4 + this.r.spd * 0.055;
    this.apex = 0.85 + this.r.jmp * 0.013;
    this.jumpV = jumpVFor(this.apex); this.tUp = timeUp(this.jumpV);
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.onGround = true;
    this.face = 0; this.cool = 0; this.squash = 1; this.homeX = 0; this.homeZ = 0;
    this.dive = 0; this.rec = 0; this.diveDir = [0, 1];
    this.ai = { jumpErr: 0, blockWait: -1 };
    this.stats = { kills: 0, att: 0, ast: 0, aces: 0, blocks: 0, digs: 0, sets: 0 }; // att: attacks swung, ast: sets that became kills
  }
  get cy() { return this.y + this.rr; }
}
const aiControlled = p => !p.human || AUTO;

// ===================== positions, rotations and formations =====================
// 6 v 6 uses a 5-1 system: one Setter, two Outside hitters, two Middle blockers and an Opposite.
// Zones are numbered the volleyball way, seen from your own side facing the net:
//     front row:  4 (left)   3 (middle)   2 (right)
//     back row:   5 (left)   6 (middle)   1 (right, the server)
// G.rot[s][i] is the player in zone i + 1. Winning the serve back rotates the team one zone clockwise.
// 2 v 2 uses beach roles: a Blocker who takes the net on defense and a Defender who stays back.
const ROLES = {
  S:   { name: 'Setter',         short: 'S',   fit: r => r.skl * 2 + r.spd },
  OH:  { name: 'Outside hitter', short: 'OH',  fit: r => r.pwr + r.def + r.jmp },
  MB:  { name: 'Middle blocker', short: 'MB',  fit: r => r.jmp * 1.5 + r.pwr * 0.5 + r.def * 0.3 },
  OPP: { name: 'Opposite',       short: 'OPP', fit: r => r.pwr * 2 + r.jmp },
  B:   { name: 'Blocker',        short: 'BLK', fit: r => r.jmp * 2 + r.pwr },
  D:   { name: 'Defender',       short: 'DEF', fit: r => r.def * 2 + r.spd },
  L:   { name: 'Libero',         short: 'L',   fit: r => r.def * 2 + r.spd + r.skl * 0.3 },
};
const ROLE_DESC = {
  S: 'Takes the second touch and runs the offense: point the mouse at the hitter you want and press E to set them (charge E for a quick set).',
  OH: 'Passes serves and hits high sets from the left side. In the back row you hit the pipe, taking off from behind the attack line.',
  MB: 'Blocks along the whole net and hits fast quick sets right next to the setter.',
  OPP: 'Hits from the right side, blocks the other team\'s outside hitter, and sets if the setter has to dig.',
  B: 'Takes the net on defense: block the other team\'s hitter.',
  D: 'Stays back on defense to dig spikes and chase tips.',
  L: 'Back-row defensive specialist: passes serves and digs. Plays in place of the middle blocker in the back row, and comes off when that middle rotates to the front row or is due to serve. While you are on the bench, you control the middle who took your place. A libero cannot serve, block or attack a ball above the net.',
};
const ROSTER_6 = ['S', 'OH', 'MB', 'OPP', 'OH', 'MB'];   // who starts in zones 1 to 6
const ZONE_X = [0.62, 0.62, 0, -0.62, -0.62, 0];          // zones 1 to 6, as a share of the half width; your right is +
const attackLine = () => HL / 3;                            // the "3 meter" line, scaled to this court
const YOUR_ROLES = { 2: ['B', 'D'], 6: ['S', 'OH', 'MB', 'OPP', 'L'] };
const teamSize = () => (settings.mode === 6 ? 7 : 2); // 6 v 6 drafts a libero as the seventh player

// Fill each role with the Pokémon that suits it best. Returns [{ entry, role }] in zone order.
function lineup(entries, you, yourRole, mode) {
  const pool = entries.filter(e => e !== you);
  const roles = mode === 2 ? ['B', 'D'] : [...ROSTER_6, 'L']; // index 6 is the libero, outside the rotation
  const out = new Array(roles.length).fill(null);
  if (you) { const i = Math.max(0, roles.indexOf(yourRole)); out[i] = { entry: you, role: roles[i] }; }
  for (const i of mode === 2 ? [0, 1] : [0, 3, 2, 5, 6, 1, 4]) { // setter, opposite, middles and libero first, then outsides
    if (out[i]) continue;
    const f = ROLES[roles[i]].fit;
    pool.sort((a, b) => f(b.r) - f(a.r));
    out[i] = { entry: pool.shift(), role: roles[i] };
  }
  if (mode === 2 && you) out.sort((a, b) => (b.entry === you) - (a.entry === you)); // you serve first
  return out;
}

const zoneOf = p => (p.role === 'L' ? G.rot[p.side].indexOf(G.libSub[p.side]) + 1 : G.rot[p.side].indexOf(p) + 1);
const isFront = p => settings.mode !== 6 || (zoneOf(p) >= 2 && zoneOf(p) <= 4);
const isPasser = p => settings.mode !== 6 || p.role === 'OH' || p.role === 'L' || (p.role === 'MB' && !isFront(p));

// What a side is doing right now.
function sidePhase(s) {
  if (G.phase !== 'rally') return G.serving === s ? 'serve' : 'receive';
  const b = G.ball, tl = timeToY(b, BR) || 0;
  if (ownSide(s, b.z + b.vz * tl)) return G.lastSide === s ? 'offense' : 'dig';
  return 'defense';
}
// The other team's hitter once their set is up, or null.
function oppHitter(s) {
  const o = 1 - s;
  if (G.lastSide !== o) return null;
  return G.sides[o].find(q => !q.onGround && Math.abs(q.z) < 3.5) || (G.touches[o] >= 2 ? G.intended[o] : null);
}
const setterSpot = () => (settings.mode === 6 ? [HW * 0.18, -0.9] : [HW * 0.1, -1.2]); // own coordinates

// Each frame: where every player should stand, by role, rotation and phase.
// Spots are worked out in "own" coordinates (your right is +x, the net is z = 0, your court is z < 0)
// and turned into world coordinates by multiplying by toward(s).
function updateFormation() {
  for (let s = 0; s < 2; s++) {
    const m = toward(s), ph = sidePhase(s);
    const { spots, blockers } = settings.mode === 6 ? spots6(s, ph) : spots2(s, ph);
    G.blockers[s] = blockers;
    for (const p of G.sides[s]) {
      const [ox, oz] = spots.get(p);
      p.homeX = clamp(ox, -HW - 1, HW + 1) * m; p.homeZ = oz * m;
    }
  }
}

function spots6(s, ph) {
  const m = toward(s), rot = G.sides[s], spots = new Map(), blockers = []; // on court, in zone order (the libero sits in its middle's zone)
  const fz = -0.16 * HL, bz = -0.6 * HL;
  const wing = p => (p.role === 'OH' ? -1 : p.role === 'MB' ? 0 : 1); // OH left, MB middle, S and OPP right
  const backSpot = p => (p.role === 'OH' ? [0, -0.86 * HL] : p.role === 'MB' || p.role === 'L' ? [-0.68 * HW, -0.72 * HL] : [0.68 * HW, -0.72 * HL]);
  if (ph === 'serve') {
    rot.forEach((p, i) => spots.set(p, [ZONE_X[i] * HW, i >= 1 && i <= 3 ? fz : bz]));
  } else if (ph === 'receive') {
    // three passers in a W; the setter hides near the net, ready to run to the target
    const passers = rot.filter(isPasser).sort((a, b) => ZONE_X[zoneOf(a) - 1] - ZONE_X[zoneOf(b) - 1] || zoneOf(b) - zoneOf(a));
    const W = [[-0.55 * HW, -0.6 * HL], [0, -0.7 * HL], [0.55 * HW, -0.6 * HL]];
    passers.forEach((p, i) => spots.set(p, W[i] || W[1]));
    for (const p of rot) {
      if (spots.has(p)) continue;
      if (p.role === 'S') spots.set(p, isFront(p) ? [0.35 * HW, -1.3] : [0.5 * HW, -0.28 * HL]);
      else if (isFront(p)) spots.set(p, [ZONE_X[zoneOf(p) - 1] * HW, -1.6]);
      else spots.set(p, [ZONE_X[zoneOf(p) - 1] * HW, -0.86 * HL]);
    }
    legalize(spots, rot, false);
  } else if (ph === 'offense') {
    const setter = G.setterNow[s] || rot.find(p => p.role === 'S');
    for (const p of rot) {
      if (p === setter) spots.set(p, setterSpot());
      else if (isFront(p)) spots.set(p, wing(p) === 0 ? [-0.05 * HW, -2.6] : [wing(p) * 0.75 * HW, -0.28 * HL]); // approach starts
      else if (p.role === 'OH') spots.set(p, [0, -(attackLine() + 2.2)]); // pipe approach
      else { const [x] = backSpot(p); spots.set(p, [x, -0.55 * HL]); }
    }
    // once the set is up, everyone else closes in behind the hitter to cover a blocked ball
    const hitter = G.touches[s] >= 2 ? G.intended[s] : null;
    if (hitter) {
      const hx = hitter.x * m, hz = hitter.z * m;
      for (const p of rot) if (p !== hitter) { const [x, z] = spots.get(p); spots.set(p, [x + (hx - x) * 0.45, z + (hz - 2.5 - z) * 0.45]); }
    }
  } else { // defense, or digging their attack
    const h = oppHitter(s), hx = h ? clamp(h.x * m, -HW + 0.5, HW - 0.5) : 0;
    const shift = hx * 0.22; // the back row leans toward the hitter
    const front = rot.filter(isFront);
    for (const p of rot) {
      if (isFront(p)) spots.set(p, [wing(p) * 0.6 * HW, -0.7]);
      else { const [x, z] = backSpot(p); spots.set(p, [x + shift, z]); }
    }
    if (h && ph === 'defense') {
      // double block: the middle slides over next to the wing on the hitter's side; the other wing drops back for tips
      const mb = front.find(p => p.role === 'MB');
      const wings = front.filter(p => p !== mb).sort((a, b) => Math.abs(wing(a) * 0.6 * HW - hx) - Math.abs(wing(b) * 0.6 * HW - hx));
      const out = Math.sign(hx) || 1;
      if (wings[0]) { const x = hx + out * 0.45; spots.set(wings[0], [x, -0.7]); blockers.push([wings[0], x]); }
      if (mb) { const x = hx - out * 0.45; spots.set(mb, [x, -0.7]); blockers.push([mb, x]); }
      if (wings[1]) spots.set(wings[1], [wing(wings[1]) * 0.62 * HW, -0.33 * HL]);
    }
  }
  return { spots, blockers };
}

// The overlap rule, checked when the ball is served: each front-row player must be nearer the net than
// the back-row player behind them (4 ahead of 5, 3 ahead of 6, 2 ahead of 1), and each row must keep its
// left-to-right order (4, 3, 2 and 5, 6, 1). The server is free to stand anywhere behind the end line.
const OVERLAP_PAIRS = [[3, 4], [2, 5], [1, 0]];             // [front, back] as zone indexes (zone - 1)
const OVERLAP_ROWS = [[3, 2, 1], [4, 5, 0]];                 // left to right
// Nudge a formation (own coordinates) so it obeys the rule with some room to spare.
function legalize(spots, court, serving) {
  const at = i => spots.get(court[i]);
  for (let pass = 0; pass < 3; pass++) {
    for (const [f, k] of OVERLAP_PAIRS) {
      if (serving && k === 0) continue;
      const F = at(f), B = at(k);
      if (F[1] < B[1] + 0.8) { const mid = (F[1] + B[1]) / 2; F[1] = mid + 0.45; B[1] = mid - 0.45; }
    }
    for (const row of OVERLAP_ROWS) for (let i = 0; i < 2; i++) {
      if (serving && (row[i] === 0 || row[i + 1] === 0)) continue;
      const L = at(row[i]), R = at(row[i + 1]);
      if (L[0] > R[0] - 0.8) { const mid = (L[0] + R[0]) / 2; L[0] = mid - 0.45; R[0] = mid + 0.45; }
    }
  }
}
// Who is out of position on side s right now (empty if the rotation order is legal).
function overlaps(s) {
  if (settings.mode !== 6) return [];
  const court = G.sides[s], m = toward(s), serving = G.serving === s, bad = new Set();
  const ox = p => p.x * m, oz = p => p.z * m;
  for (const [f, k] of OVERLAP_PAIRS) {
    if (serving && k === 0) continue;
    if (oz(court[f]) <= oz(court[k])) { bad.add(court[f]); bad.add(court[k]); }
  }
  for (const row of OVERLAP_ROWS) for (let i = 0; i < 2; i++) {
    if (serving && (row[i] === 0 || row[i + 1] === 0)) continue;
    if (ox(court[row[i]]) >= ox(court[row[i + 1]])) { bad.add(court[row[i]]); bad.add(court[row[i + 1]]); }
  }
  return [...bad];
}

// The libero always replaces the middle blocker who is in the back row (zones 1, 5 and 6).
// Swaps happen between rallies. The benched player waits at the sideline.
// Both teams' benches are on the same sideline as the scorer's table (world x < 0), each on its own half.
const benchSpot = s => [-(HW + 1.6), -0.3 * HL * toward(s)];
const subZone = s => [-(HW + 0.5), -attackLine() * 0.5 * toward(s)]; // the sub zone: on the sideline between the 10 foot (attack) line and the net, on that team's half

// The libero plays in place of the middle blocker who is in the back row (zones 1, 5 and 6), as in real volleyball.
// It comes off when that middle is due to serve (a libero does not serve here) and goes back on for them after the
// side out. When the middle it replaced rotates to the front row, the libero comes off and that middle returns,
// so the libero is never in the front row. Off court, the libero waits on the bench.
const backMiddle = s => G.rot[s].find((p, i) => p.role === 'MB' && (i === 0 || i === 4 || i === 5)) || null;
function libTarget(s) { // the middle the libero should be playing for right now, or null for off court
  const mb = backMiddle(s);
  return mb && G.serving === s && G.rot[s][0] === mb ? null : mb;
}
function sideFromRot(s) { G.sides[s] = G.rot[s].map(p => (p === G.libSub[s] ? G.libero[s] : p)); }
function benchFor(s) { G.bench[s] = G.libero[s] ? [G.libSub[s] || G.libero[s]] : []; }
function applyLibero(s) { // instant version, for the first serve of a set
  G.libSub[s] = G.libero[s] ? libTarget(s) : null;
  if (G.libero[s] && !G.libSub[s]) G.libOff[s] = backMiddle(s);
  sideFromRot(s); benchFor(s);
  const [bx, bz] = benchSpot(s);
  G.bench[s].forEach(p => { p.x = bx; p.z = bz; p.y = 0; p.vx = p.vz = p.vy = 0; p.onGround = true; });
  handControl();
}
// If your own player is on the bench, you play as whoever took their place until they come back on.
function handControl() {
  const me = G.me; if (!me || AUTO) return;
  const stand = me.side === 0 && !G.sides[0].includes(me)
    ? (me.role === 'L' ? G.libOff[0] : G.libero[0]) : null;
  for (const p of G.all[0]) p.human = p === (stand || me);
}
// Between rallies: put the court in zone order and, if the libero should come on or off, start a substitution.
// The player coming off and the player coming on both walk to the sub zone, pause, swap, then go to their spots.
function planSubs(s) {
  const L = G.libero[s];
  if (!L) { G.sides[s] = G.rot[s].slice(); return; }
  const want = libTarget(s), cur = G.libSub[s];
  if (want === cur) { sideFromRot(s); return; }
  if (cur && want) { // the libero moves straight from one middle to the other (cannot happen in a normal rotation)
    G.libSub[s] = want; sideFromRot(s); benchFor(s); handControl(); return;
  }
  sideFromRot(s); // the new rotation, before the swap
  const out = cur ? L : want, inn = cur ? cur : L;
  G.subs.push({ s, out, inn, want, stage: 'walk', t: 0 });
  out.subbing = inn.subbing = true;
}
function finishSub(job) { // the swap itself
  const { s, inn, want } = job;
  if (!want) G.libOff[s] = G.libSub[s]; // remember who came back on for the libero
  G.libSub[s] = want; sideFromRot(s); benchFor(s);
  G.players = [...G.sides[0], ...G.sides[1]];
  handControl();
  return inn;
}
function runSubs(dt) {
  for (const job of G.subs) {
    const { s, out, inn } = job, [zx, zz] = subZone(s);
    job.t += dt;
    if (job.stage === 'walk') { // both head for the sub zone: one from the court, one from the bench
      moveToward(out, zx + 0.7, zz, 0.75); moveToward(inn, zx - 0.7, zz, 0.75);
      const there = Math.hypot(out.x - zx - 0.7, out.z - zz) < 0.2 && Math.hypot(inn.x - zx + 0.7, inn.z - zz) < 0.2;
      if (there || job.t > 3) {
        job.stage = 'pause'; job.t = 0; out.vx = out.vz = inn.vx = inn.vz = 0;
        out.face = 1; inn.face = -1;
        floatText('SUB', zx, 2.6, zz, '#ffcf33', 1.0, 30); Sfx.tone(660, 0.12, 'square', 0.04); Sfx.tone(880, 0.12, 'square', 0.04, 0, 0.12);
      }
    } else if (job.stage === 'pause') {
      if (job.t > 0.7) { // swap
        job.stage = 'leave'; job.t = 0;
        finishSub(job);
      }
    } else if (job.stage === 'leave') { // off to the bench, on to the court
      const [bx, bz] = benchSpot(s);
      moveToward(out, bx, bz, 0.75); moveToward(inn, inn.homeX, inn.homeZ, 0.75);
      const done = Math.hypot(out.x - bx, out.z - bz) < 0.2 && Math.hypot(inn.x - inn.homeX, inn.z - inn.homeZ) < 0.3;
      if (done || job.t > 3) { job.stage = 'done'; out.subbing = inn.subbing = false; }
    }
    for (const p of [out, inn]) stepPlayer(p, dt); // the main loop skips players who are subbing
  }
  G.subs = G.subs.filter(j => j.stage !== 'done');
}

function spots2(s, ph) {
  const m = toward(s), spots = new Map(), blockers = [];
  const B = G.sides[s].find(p => p.role === 'B'), D = G.sides[s].find(p => p.role === 'D');
  if (ph === 'serve') {
    const partner = G.rot[s][1];
    spots.set(G.rot[s][0], [0.4 * HW, -HL]);
    spots.set(partner, partner.role === 'B' ? [0.15 * HW, -1.4] : [0, -0.5 * HL]);
  } else if (ph === 'receive') {
    spots.set(B, [-0.4 * HW, -0.55 * HL]); spots.set(D, [0.4 * HW, -0.55 * HL]);
  } else if (ph === 'offense') {
    const setter = G.setterNow[s] || D;
    const other = setter === B ? D : B;
    spots.set(setter, setterSpot());
    spots.set(other, [clamp(other.x * m, -0.6 * HW, 0.6 * HW), -0.3 * HL]);
  } else {
    const h = oppHitter(s), hx = h ? clamp(h.x * m, -HW + 0.5, HW - 0.5) : 0;
    spots.set(B, [hx, -0.7]);
    spots.set(D, [clamp(hx * 0.3, -0.5 * HW, 0.5 * HW), -0.6 * HL]);
    if (h && ph === 'defense') blockers.push([B, hx]);
  }
  return { spots, blockers };
}

function newMatch(demo = false) { // demo: the title screen's background match, with no one under your control
  const n = settings.mode;
  HW = n === 2 ? 8 : 9.5; HL = n === 2 ? 12 : 14;
  const size = n === 6 ? 0.9 : 1;
  const sides = [[], []], rot = [[], []], all = [[], []], libero = [null, null];
  for (let s = 0; s < 2; s++) {
    const you = s === 0 && !demo ? teams[0][0] : null;
    for (const { entry, role } of lineup(teams[s], you, settings.role[n], n)) {
      const p = new Player(entry, s, entry === you, size);
      p.role = role;
      all[s].push(p);
      if (role === 'L') libero[s] = p; else { sides[s].push(p); rot[s].push(p); }
    }
  }
  G = {
    sides, players: [...sides[0], ...sides[1]], rot, all, libero, me: all[0].find(p => p.human) || null, libSub: [null, null], libOff: [null, null], bench: [[], []],
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, trail: [], special: null, noHit: 0 },
    score: [0, 0], sets: [0, 0], setNo: 1, setLog: [], setDone: false, firstServe: 0, touches: [0, 0], lastSide: -1, lastToucher: null, intended: [null, null], lastAttack: null,
    setterNow: [null, null], blockers: [[], []], play: [null, null], subs: [], started: false,
    serving: 0, server: null, phase: 'serve', timer: 0, time: 0,
    react: [0, 0], aiErr: [[0, 0], [0, 0]], leave: [false, false],
    particles: [], rings: [], texts: [], shake: 0, netWobble: 0, paused: false, shown: false, rally: 0, longestRally: 0,
    cam: { x: 0, y: CAM.y, z: -HL - CAM.back, yaw: 0, pitch: CAM.pitch }, demo,
  };
  startServe();
}

function nextSet() { // fresh score; the team that received first last set serves first this time
  G.setDone = false; G.setNo++; G.score = [0, 0];
  G.firstServe = 1 - G.firstServe; G.serving = G.firstServe;
  for (let k = 0; k < 2; k++) applyLibero(k); // the server changes, so the libero may need to come on or off
  G.players = [...G.sides[0], ...G.sides[1]];
}

function startServe() {
  tutServe();
  const s = G.serving;
  if (!G.started) { for (let k = 0; k < 2; k++) applyLibero(k); G.started = true; }
  else for (const job of G.subs) { // never start a serve mid-swap
    if (job.stage !== 'leave') finishSub(job);
    job.out.subbing = job.inn.subbing = false;
    const [bx, bz] = benchSpot(job.s); job.out.x = bx; job.out.z = bz;
  }
  G.subs = [];
  G.players = [...G.sides[0], ...G.sides[1]];
  G.server = tutServer() || G.sides[s][0];
  Object.assign(G.ball, { vx: 0, vy: 0, vz: 0, gs: 1, trail: [], special: null, noHit: 0 });
  G.touches = [0, 0]; G.lastSide = -1; G.lastToucher = null; G.intended = [null, null]; G.lastAttack = null; G.setBy = null; G.killCam = null;
  G.setterNow = [null, null]; G.play = [null, null];
  G.phase = 'serve'; G.timer = 0; G.rally = 0;
  updateFormation();
  for (const p of G.players) {
    p.x = p.homeX; p.z = p.homeZ; p.y = 0; p.vx = p.vy = p.vz = 0; p.onGround = true; p.cool = 0; p.ai.blockWait = -1;
    p.dive = p.rec = 0;
  }
  const sv = G.server;
  sv.x = clamp(0.5 * HW, -HW + 0.6, HW - 0.6) * toward(s); sv.z = -toward(s) * (HL + 0.8); // serve from the right, behind the end line
  input.hitQ = input.setQ = input.diveQ = false; G.toss = false; G.hold = null; G.setPick = null; G.meterShow = null; G.tid = (G.tid || 0) + 1;
  const you = G.sides[0].find(p => p.human) || G.sides[0][0];
  Object.assign(G.cam, camWant(you, false));
}

// ===================== physics and prediction =====================
// Time until the ball, coming down, is at height y. Null if it never gets that high.
function timeToY(b, y) {
  const g = GB * (b.gs || 1);
  const d = b.vy * b.vy + 2 * g * (b.y - y);
  if (d < 0) return null;
  const t = (b.vy + Math.sqrt(d)) / g;
  return t >= 0 ? t : null;
}
const ownSide = (s, z) => z * toward(s) < 0;
function inCourt(x, z, s) { // inside the court of side s
  return Math.abs(x) <= HW && Math.abs(z) <= HL && ownSide(s, z);
}
function clampPlayer(p) {
  const t = toward(p.side);
  p.x = clamp(p.x, -HW - 3, HW + 3);
  p.z = clamp(p.z * t, -(HL + 4), -(p.rr + 0.08)) * t;
}
function stepPlayer(p, h) {
  if (!p.onGround) p.vy -= pGrav(p.vy) * h;
  p.x += p.vx * h; p.z += p.vz * h; p.y += p.vy * h;
  if (p.y <= 0) {
    if (!p.onGround) { p.squash = 0.78; p.blockUp = false; dust(p.x, p.z, 4, '#e8d3a2'); }
    p.y = 0; p.vy = 0; p.onGround = true;
  }
  clampPlayer(p);
  const sp = Math.hypot(p.vx, p.vz);
  if (p.onGround && p.dive <= 0) { // running: a stride to bob on, and little puffs kicked up behind
    p.run = (p.run || 0) + sp * h * 2.4;
    if (sp > 2 && (p.puff = (p.puff || 0) - h) <= 0) { p.puff = 0.12; puff(p.x - p.vx * 0.05, p.z - p.vz * 0.05); }
  }
  p.lean = (p.lean || 0) + (clamp(p.vx * 0.03, -0.16, 0.16) * (p.onGround ? 1 : 0.5) - (p.lean || 0)) * Math.min(1, h * 12);
  const want = p.strafe && input.aim ? Math.sign(input.aim.x - p.x) * 0.75 : Math.abs(p.vx) > 0.6 ? Math.sign(p.vx) * 0.75 : 0;
  p.face += (want - p.face) * Math.min(1, h * 10);
  p.cool -= h;
  if (p.dive > 0) { // sliding along the floor, slowing down
    p.dive -= h; const f = Math.max(0, 1 - 3.2 * h); p.vx *= f; p.vz *= f;
    if (p.dive <= 0) { p.rec = p.diveSide ? 0.17 : 0.34; p.vx = p.vz = 0; dust(p.x, p.z, 6, '#e8d3a2'); }
  } else if (p.rec > 0) { p.rec -= h; p.vx = p.vz = 0; }
}
// Right mouse: a dive. A fast slide that reaches low balls, then a moment on the floor getting up.
function startDive(p, ix, iz) {
  if (!p.onGround || p.dive > 0 || p.rec > 0) return;
  let dx = ix, dz = iz * toward(p.side);
  if (!dx && !dz) { // no direction held: dive at the ball
    const tl = timeToY(G.ball, BR);
    if (tl != null) { dx = G.ball.x + G.ball.vx * tl - p.x; dz = G.ball.z + G.ball.vz * tl - p.z; }
    if (Math.hypot(dx, dz) < 0.3) { dx = 0; dz = toward(p.side); }
  }
  const d = Math.hypot(dx, dz), v = p.speed * 1.75;
  p.diveSide = keys.strafe && Math.abs(dx) > Math.abs(dz) * 1.2; // strafing side dives get up faster
  p.diveDir = [dx / d, dz / d]; p.vx = dx / d * v; p.vz = dz / d * v;
  p.dive = 0.36; p.squash = 0.8;
  dust(p.x, p.z, 5, '#e8d3a2');
  Sfx.tone(300, 0.08, 'triangle', 0.04, -120);
}

// ===================== timing meter =====================
// Hold the hit button to wind up. The meter fills over CHARGE seconds; your touch is graded by how full it is
// when you meet the ball (or when you let go, if that was just before). Hold past full and it goes red: a bad hit.
const CHARGE = 0.35;      // seconds from empty to full in a rally
const RELEASE_WIN = 0.2;  // a release this long before contact still counts
const SET_WIN = 1.6;      // a set call (E) is kept this long after you let go, so a quick tap still sets
const holdWin = h => (h.kind === 'set' ? SET_WIN : RELEASE_WIN);
// A press shorter than this is a tap (a trackpad's tap-to-click sends both at once). A tap counts as held
// until the ball reaches you, and runs out once the meter is well past full. On a serve, tap to toss and tap again to hit.
const TAP = 0.12;
const tapGone = h => h.tap && holdLevel(h) > 1.6;
const ZONES = [[0.4, -0.25, 'WEAK', '#ff8a8a', '#3a2630'], [0.65, 0.3, 'OK', '#c9d4ee', '#5d6b8a'], [0.85, 0.65, 'GOOD', '#7dffb0', '#2f9e63'], [1, 1, 'PERFECT', '#ffe14a', '#ffcf33']];
const TOO_LONG = { q: -0.5, label: 'TOO LONG', color: '#ff5a5a' };
function gradeL(L) {
  for (const [top, q, label, color] of ZONES) if (L <= top) return { q, label, color };
  return TOO_LONG;
}
// E is the set. Its meter is a charge, not a timing window: start holding while you run in,
// and if it is full when you touch the ball you get a quick set (low and fast); before that, a high set.
const SET_CHARGE = 0.4;
const SET_HIGH = { q: 0.65, label: 'HIGH SET', color: '#8fd3ff' }, SET_QUICK = { q: 0.55, label: 'QUICK SET', color: '#7dffb0', quick: true };
const holdLevel = h => ((h.tr ?? G.time) - h.t0) / h.C;
// The game clock at a key or mouse event during the last frame (update() has already moved G.time to the end of it).
const evTime = ms => (ms == null ? G.time : G.time - clamp((last - ms) / 1000, 0, 0.05) * SPEEDUP);
// Your wind-up for the touch you are about to make, or null if you are not holding (or let go too soon).
function holdGrade() {
  const h = G.hold;
  if (!h || (h.tr != null && G.time - h.tr > holdWin(h))) return null;
  if (h.kind === 'set') return { ...(holdLevel(h) >= 1 ? SET_QUICK : SET_HIGH), set: true };
  return gradeL(holdLevel(h));
}
const contactY = p => (p.dive > 0 ? p.y + p.rr * 0.55 : p.cy);
const reachOf = p => p.rr + BR + (aiControlled(p) ? 0.22 : p.onGround ? 0.45 : 1.05) + (p.dive > 0 ? 0.55 : 0);
// The ball is at its sweet spot: past the closest approach, deep in the body, or about to hit the floor.
function sweetSpot(dx, dy, dz, vx, vy, vz, y, core) {
  return dx * vx + dy * vy + dz * vz >= 0 || dx * dx + dy * dy + dz * dz < core * core || y < BR + 0.22;
}
function predictContact(p) {
  const b = G.ball, t = toward(p.side);
  if (p.cool > 0.5 || (G.lastToucher === p && G.lastSide === p.side && G.touches[p.side] > 0)) return null;
  const g = GB * (b.gs || 1), R = reachOf(p), core = (p.rr + BR) * 0.85;
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, py = p.y, pvy = p.onGround ? 0 : p.vy, best = Infinity, bestT = 0;
  for (let k = 0; k <= 130; k++) {
    const tt = k * STEP, cy = py + (p.dive > 0 ? p.rr * 0.55 : p.rr);
    const dx = x - p.x, dy = y - cy, dz = z - p.z, d = Math.hypot(dx, dy, dz);
    if (z * t <= 0.7) {
      if (d < R && sweetSpot(dx, dy, dz, vx, vy - pvy, vz, y, core)) return { T: tt, reach: true };
      if (d < best) { best = d; bestT = tt; }
    }
    if (y <= BR) break;
    vy -= g * STEP; x += vx * STEP; y += vy * STEP; z += vz * STEP;
    if (py > 0 || pvy) { pvy -= pGrav(pvy) * STEP; py += pvy * STEP; if (py <= 0) { py = 0; pvy = 0; } }
  }
  return best < R + 1.2 ? { T: bestT, reach: false } : null;
}
// c is your Space charge from 0 to 1: a tap jumps to about two thirds of full height, a full charge a little above it.
function jump(p, c = null) {
  if (!p.onGround) return;
  p.vy = p.jumpV * (c == null ? 1 : Math.sqrt(0.62 + 0.48 * c)); p.onGround = false; p.squash = 1.2; p.blockUp = false;
}
function moveToward(p, tx, tz, mult) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const sp = p.speed * mult * (p.onGround ? 1 : 0.7);
  if (d < 0.08) { p.vx = p.vz = 0; return; }
  const v = Math.min(sp, d * 8);
  p.vx = dx / d * v; p.vz = dz / d * v;
}

// Launch the ball so it peaks at apexY and comes down through (tx, ty, tz).
function launchTo(tx, tz, ty, apexY) {
  const b = G.ball;
  apexY = Math.max(apexY, b.y + 0.3, ty + 0.2);
  const vy = Math.sqrt(2 * GB * (apexY - b.y));
  const T = vy / GB + Math.sqrt(2 * (apexY - ty) / GB);
  b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = vy; b.gs = 1;
}
function clearsNet(x, y, z, vx, vy, vz, g = GB) {
  if (z * vz >= 0) return false;
  const tn = -z / vz;
  return y + vy * tn - 0.5 * g * tn * tn > NET_H + BR + 0.02;
}
function landAt(x, y, z, vx, vy, vz, g = GB) {
  const t = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, y - BR))) / g;
  return [x + vx * t, z + vz * t];
}
// A high, arcing ball into the other court that is sure to clear the net.
function lob(tx, tz, apexY) {
  const b = G.ball;
  for (let k = 0; k < 14; k++) {
    launchTo(tx, tz, BR, apexY);
    if (clearsNet(b.x, b.y, b.z, b.vx, b.vy, b.vz)) return;
    apexY += 0.3;
  }
}

// ===================== serving =====================
const serveY = p => p.y + p.rr * 2 + 0.6; // where your hand meets the toss
function doServe(p, q = null) {
  const s = p.side, t = toward(s);
  for (const k of [1 - s, s]) {
    if (!TUT && overlaps(k).length) { // out of rotation order when the ball is served
      G.phase = 'rally';
      awardPoint(1 - k, 'OVERLAP', `${teamName(k)} was out of rotation order`, null, null);
      return;
    }
  }
  const human = !aiControlled(p);
  let tx, depth;
  if (human) {
    const a = aimInto(s, 0.6);
    if (a) { tx = a[0]; depth = a[1] * t; } // serve toward the cursor
    else { // no mouse: aim with the movement keys
      const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      tx = ix * HW * 0.6 + rand(-0.6, 0.6);
      depth = keys.up ? 2.6 : keys.down ? HL - 1.2 : HL * 0.6;
    }
    const e = q == null ? 1 : q >= 0 ? 1 - q * 0.8 : 1 - q * 2.5; // your timing tightens or sprays the aim
    tx += rand(-0.6, 0.6) * (e - 1); depth += rand(-0.5, 0.5) * e;
  } else { tx = rand(-HW * 0.8, HW * 0.8); depth = rand(2.2, HL - 0.8); }
  if (!human && s === 1 && Math.random() < DIFF[settings.diff].serveFault) depth = HL + rand(0.6, 2);
  const apex = NET_H + 2.6 - p.r.pwr / 99 * 1.3 + rand(0, 0.6) - (q == null ? 0 : q * 0.9); // a perfect hit is flatter and faster
  lob(tx, t * depth, apex);
  G.lastToucher = p; G.lastSide = s; G.touches = [0, 0]; G.tid++; G.toss = false;
  G.lastAttack = { p, type: 'serve' };
  G.phase = 'rally'; G.rally = 0;
  rerollAI();
  p.squash = 1.15;
  hitstop(q != null && q >= 1 ? 0.12 : 0.07, '#ffffff');
  Sfx.serve();
}

// ===================== contacts =====================
function canContact(p, b) {
  if (p.cool > 0 || b.noHit > 0) return false;
  if (b.z * toward(p.side) > 0.7) return false;               // ball well over on the other side
  if (G.lastToucher === p && G.lastSide === p.side && G.touches[p.side] > 0) return false; // no double touch
  const dx = b.x - p.x, dy = b.y - contactY(p), dz = b.z - p.z; // you get a longer reach than the computer
  return dx * dx + dy * dy + dz * dz < reachOf(p) ** 2;
}

function rerollAI() {
  for (let s = 0; s < 2; s++) {
    const pars = s === 0 ? MATE : DIFF[settings.diff];
    G.react[s] = pars.react;
    G.aiErr[s] = [rand(-1, 1) * pars.err, rand(-1, 1) * pars.err];
    G.leave[s] = Math.random() < pars.leaveOut;
    for (const p of G.sides[s]) p.ai.jumpErr = rand(-1, 1) * pars.jump;
  }
}

function contact(p) {
  const s = p.side, t = toward(s), b = G.ball;
  const incoming = Math.hypot(b.vx, b.vy, b.vz);
  const fromOpp = G.lastSide !== s;
  const human = !aiControlled(p);
  const tm = human ? holdGrade() : null; // your wind-up for this ball
  if (human && tm) G.meterShow = { p, L: holdLevel(G.hold), color: tm.color, t: G.time };
  if (human) G.hold = null;
  const q = tm ? tm.q : null, dove = p.dive > 0;
  if (tm) {
    floatText(tm.label, p.x, p.cy + p.rr + 1.1, p.z, tm.color, 0.7);
    if (tm.q >= 1) Sfx.tone(1320, 0.06, 'square', 0.03);
  }

  // block at the net (a libero may not block)
  if (p.role !== 'L' && !p.onGround && !p.dive && (aiControlled(p) || p.blockUp) && Math.abs(p.z) < p.rr + 0.9 && fromOpp && b.vz * t < 0 && b.y > NET_H - 0.3 && G.lastSide !== -1) {
    doBlock(p);
    return;
  }

  if (fromOpp) { G.touches[s] = 0; G.intended[1 - s] = null; }
  G.touches[s]++;
  if (G.touches[s] > 3) {
    awardPoint(1 - s, 'FOUR HITS', 'Only 3 touches per side', null, null);
    return;
  }
  const la = G.lastAttack;
  if (fromOpp && la && la.type === 'spike') p.stats.digs++;
  const setter = !fromOpp && G.setBy && G.lastToucher === G.setBy && G.setBy !== p ? G.setBy : null; // who set you, if this is the touch after their set
  G.setBy = null;
  G.lastToucher = p; G.lastSide = s; G.intended[s] = null;
  p.cool = 0.3; b.noHit = 0.06; b.special = null; G.tid++;
  G.rally++;

  // push the ball out of the body so it leaves cleanly
  const nx = b.x - p.x, ny = b.y - p.cy, nz = b.z - p.z, d = Math.hypot(nx, ny, nz) || 1;
  const k = (p.rr + BR + 0.02) / d;
  b.x = p.x + nx * k; b.y = p.cy + ny * k; b.z = p.z + nz * k;
  if (b.z * t > -0.05) b.z = -t * 0.05; // never start a hit on the far side of the net

  const airborne = !p.onGround;
  const highEnough = b.y > NET_H;
  let action;
  if (!aiControlled(p)) {
    // E sets (the third touch has to go over, so a set there is an over ball toward the cursor).
    // Left click receives on the ground and spikes in the air above the net; in the air on the third touch, below the net, it tips.
    // No hold at all still passes, just less cleanly.
    if (tm && tm.set) action = G.touches[s] >= 3 ? 'over' : 'set';
    else if (tm && airborne && highEnough && !dove) action = 'spike';
    else if (G.touches[s] >= 3) action = tm && airborne ? 'tip' : 'over';
    else action = 'pass';
  } else {
    const nearNet = Math.abs(p.z) < 3;
    if (airborne && highEnough && (G.touches[s] >= 2 || (fromOpp && nearNet && incoming < 9 && Math.random() < 0.5))) action = 'spike';
    else action = G.touches[s] >= 3 ? 'over' : 'pass';
  }

  // a libero may not attack a ball that is above the net
  if ((action === 'spike' || action === 'tip') && p.role === 'L' && b.y > NET_H) {
    action = 'over';
    if (!aiControlled(p)) floatText('LIBERO: NO ATTACKS ABOVE THE NET', p.x, p.cy + p.rr + 0.6, p.z, '#ffd6d6', 1.4);
  }
  // back-row players may only spike from behind the attack line
  if (action === 'spike' && settings.mode === 6 && !isFront(p) && -p.z * t < attackLine()) {
    action = 'over';
    if (!aiControlled(p)) floatText('BACK ROW: HIT FROM BEHIND THE LINE', p.x, p.cy + p.rr + 0.6, p.z, '#ffd6d6', 1.4);
  }
  if (action === 'spike') {
    // a perfectly timed spike lets loose the hitter's type move. The computer times one perfectly now and then.
    let sq = q;
    if (!human && Math.random() < (s === 0 ? MATE : DIFF[settings.diff]).perfect) sq = 1;
    if (!spike(p, sq)) action = 'over';
  }
  if (action === 'pass' || action === 'set') pass(p, incoming, fromOpp, q, dove, action === 'set' ? tm : null);
  else if (action === 'over') { over(p); G.lastAttack = { p, type: 'over' }; }
  else if (action === 'tip') { tip(p); G.lastAttack = { p, type: 'tip' }; }
  if (action === 'spike' || action === 'over' || action === 'tip') { // an attack: the swing counts, and so does the set behind it
    p.stats.att++;
    if (G.lastAttack && G.lastAttack.p === p) G.lastAttack.setter = setter;
  }
  if (human) tutEvent(action, { q, tm, first: fromOpp, dove, to: G.intended[s] });

  rerollAI();
  p.squash = 0.85;
}

// Who sets after this first touch: the setter, or the opposite if the setter had to take the first ball.
function designatedSetter(s, p) {
  const mates = G.sides[s].filter(q => q !== p);
  if (settings.mode === 2) return mates[0];
  const [sx, sz] = setterSpot(), m = toward(s);
  return mates.find(q => q.role === 'S') || mates.find(q => q.role === 'OPP' && isFront(q)) || mates.find(q => q.role === 'OPP')
    || mates.reduce((a, q) => (Math.hypot(q.x * m - sx, q.z * m - sz) < Math.hypot(a.x * m - sx, a.z * m - sz) ? q : a));
}

// The setter's options. Outside "4" set, middle quick, back set to the opposite, or the pipe to the back-row outside.
function playOptions(s, setter) {
  const m = toward(s), [tx, tz] = setterSpot();
  const passGood = Math.hypot(setter.x * m - tx, setter.z * m - tz) < 1.4;
  const opts = [];
  for (const q of G.sides[s]) {
    if (q === setter) continue;
    let o = null;
    if (settings.mode === 2) o = { type: 'high', call: 'SET', ox: clamp(q.x * m, -0.6 * HW, 0.6 * HW), oz: -1.1, apex: NET_H + 2.6, w: 1 };
    else if (isFront(q)) {
      if (q.role === 'OH') o = { type: 'outside', call: 'OUTSIDE', ox: -0.72 * HW, oz: -1.0, apex: NET_H + 2.8, w: 1 };
      else if (q.role === 'MB') o = { type: 'quick', call: 'QUICK', ox: setter.x * m - 1.1, oz: -0.8, apex: NET_H + 1.0, w: passGood ? 1.1 : 0.2 };
      else o = { type: 'right', call: 'BACK SET', ox: 0.72 * HW, oz: -1.0, apex: NET_H + 2.6, w: 0.9 };
    } else if (q.role === 'OH') o = { type: 'pipe', call: 'PIPE', ox: 0, oz: -(attackLine() + 0.7), apex: NET_H + 2.5, w: 0.5 };
    if (o) { o.q = q; opts.push(o); }
  }
  return opts;
}
// The hitter you are aiming at as setter: the one nearest the cursor, left to right.
function aimedOption(opts) {
  if (!input.aim || !opts.length) return null;
  const sx = proj(input.aim.x, 0, input.aim.z).x;
  return opts.reduce((a, o) => (Math.abs(proj(o.q.x, 0, o.q.z).x - sx) < Math.abs(proj(a.q.x, 0, a.q.z).x - sx) ? o : a));
}
function choosePlay(s, setter, tm = null) {
  const m = toward(s), opts = playOptions(s, setter);
  let pick = null;
  if (!aiControlled(setter) && s === 0) { // you set whoever the cursor points at (on touch screens, the button you tapped)
    pick = aimedOption(opts) || opts.find(o => o.type === G.setPick) || null; G.setPick = null;
  }
  if (!pick) {
    const callMe = (G.chat && G.chat.k === 1 && G.time - G.chat.t < 4) || !!(tutStep() && tutStep().callMe); // you called for the ball
    const wt = o => o.w * (o.q.r.pwr + o.q.r.jmp) * (o.q.human && !AUTO ? (callMe ? 12 : 3) : 1);
    let x = Math.random() * opts.reduce((a, o) => a + wt(o), 0);
    pick = opts.find(o => (x -= wt(o)) <= 0) || opts[0];
  }
  pick = { ...pick };
  if (tm && tm.quick && pick.type !== 'quick') { pick.apex = NET_H + 1.25; pick.call = 'QUICK'; if (pick.type !== 'pipe') pick.oz = Math.max(pick.oz, -0.9); } // the pipe stays behind the attack line // a charged E: low and fast
  if (tm && !tm.quick && pick.type === 'quick') { pick.apex = NET_H + 1.9; pick.call = 'HIGH'; }
  return { ...pick, tx: pick.ox * m, tz: pick.oz * m, ty: pick.q.apex + pick.q.rr * 2 };
}

function pass(p, incoming, fromOpp, q = null, dove = false, setTm = null) {
  const s = p.side, t = toward(s), b = G.ball;
  let target, tx, tz, ty, apexY, skill;
  if (G.touches[s] === 1) { // pass to the setter's target spot
    target = designatedSetter(s, p); G.setterNow[s] = target;
    const [ox, oz] = setterSpot();
    tx = ox * t; tz = oz * t; ty = 1.3; apexY = NET_H + 2.0; skill = p.r.def;
  } else { // set one of the hitters
    const play = choosePlay(s, p, setTm);
    target = play.q; tx = play.tx; tz = play.tz; ty = play.ty; apexY = Math.max(play.apex, ty + (play.call === 'QUICK' ? 0.35 : 0.9)) + rand(0, 0.3); skill = p.r.skl;
    G.play[s] = play.type;
    floatText(play.call, p.x, p.cy + p.rr + 0.6, p.z, '#ffe9a0', 0.9);
    p.stats.sets++; G.setBy = p;
  }
  const heat = clamp(incoming / 16, 0, 1.6);
  // your timing: no click is the old auto pass (x1), a perfect click nearly takes the error away
  const tq = q == null ? 1 : clamp(1 - q * 0.85, 0.15, 1.4);
  const err = (100 - skill) * 0.022 * (0.4 + (G.touches[s] === 1 ? heat : 0.2)) * (tq + (dove ? 0.3 : 0));
  tx += rand(-1, 1) * err; tz += rand(-1, 1) * err * 0.7; apexY += rand(-0.3, 0.3) * err;
  tz = -t * Math.max(0.5, -tz * t);

  // a hard spike can shank off the arms
  if (G.touches[s] === 1 && fromOpp && incoming > 12.5) {
    const shank = clamp((incoming - 12.5) / 8, 0, 1) * (1.35 - p.r.def / 100) * (q == null ? 1 : clamp(1 - q, 0, 1.3));
    if (Math.random() < shank) {
      const sx = Math.random() < 0.5 ? -1 : 1;
      tx = b.x + sx * rand(2.5, 7); tz = b.z - t * rand(1, 8); apexY = b.y + rand(0.2, 1.4); target = null;
      floatText('SHANKED', p.x, p.cy + p.rr + 0.6, p.z, '#ffd6d6', 0.8);
    }
  }
  launchTo(tx, tz, ty, apexY);
  G.intended[s] = target;
  Sfx.bump();
}

function over(p) {
  const t = toward(p.side), a = !aiControlled(p) && aimInto(p.side, 0.8);
  if (a) lob(a[0] + rand(-0.5, 0.5), a[1] + t * rand(-0.5, 0.5), NET_H + rand(1.2, 2.0));
  else lob(rand(-HW * 0.8, HW * 0.8), t * rand(2.2, HL - 1.4), NET_H + rand(1.2, 2.4));
  Sfx.bump();
}
function tip(p) {
  const t = toward(p.side), a = !aiControlled(p) && aimInto(p.side, 0.5);
  if (a) lob(a[0], t * clamp(a[1] * t, 0.8, 3.2), NET_H + rand(0.5, 0.9)); // a soft shot toward the cursor, kept short
  else lob(clamp(G.ball.x + rand(-1.5, 1.5), -HW + 0.5, HW - 0.5), t * rand(0.8, 2.6), NET_H + rand(0.5, 0.9));
  Sfx.bump();
}

// Where to hit: the open spot farthest from every defender.
function openSpot(s, tries = 16) {
  const t = toward(s), opp = G.sides[1 - s];
  let best = [0, t * HL * 0.6], bs = -1;
  for (let i = 0; i < tries; i++) {
    const x = rand(-HW * 0.85, HW * 0.85), z = t * rand(1.4, HL - 0.7);
    let d = Infinity; for (const q of opp) d = Math.min(d, Math.hypot(q.x - x, q.z - z));
    if (d > bs) { bs = d; best = [x, z]; }
  }
  return best;
}

function spike(p, q = null) {
  const special = q != null && q >= 1;
  const s = p.side, t = toward(s), b = G.ball;
  const human = !aiControlled(p);
  let [tx, tz] = openSpot(s, human ? 16 : 4); // the computer does not always find the best gap
  if (human) {
    const a = aimInto(s, 0.6);
    if (a) [tx, tz] = a; // the spike goes where the cursor points
    else { // no mouse: aim with the movement keys
      const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      if (ix) tx = clamp(b.x + ix * HW, -HW * 0.85, HW * 0.85);
      if (keys.up) tz = t * 1.8; else if (keys.down) tz = t * (HL - 1);
    }
    if (q != null && q < 0) { tx += rand(-1.5, 1.5); tz += t * rand(-1, 1); } // mistimed: it sprays
  } else {
    const e = (s === 0 ? MATE : DIFF[settings.diff]).err;
    tx += rand(-1, 1) * e; tz += rand(-1, 1) * e;
  }
  // Each spike is timed rather than given a raw speed: harder hitters land it sooner,
  // but there is always enough time to react and run to the landing ring.
  const power = q == null ? 1 : 1.1 - q * 0.3; // your timing: a perfect swing lands about 20% sooner
  // your own spike, and any perfect spike, is a kill shot: it is on the floor in about a third of a second
  const flight = human || special ? clamp(0.5 - p.r.pwr * 0.0015, 0.36, 0.48) * power
    : clamp(1.3 - p.r.pwr * 0.005, 0.8, 1.15) * (settings.mode === 6 ? 0.75 : 1) * power; // 6 v 6 has more defenders to beat
  const aims = [[tx, tz]];
  for (let i = 0; i < 5; i++) aims.push([rand(-HW * 0.8, HW * 0.8), t * rand(1.5, HL - 1)]);
  const tries = [];
  for (const k of [1, 0.85, 1.15, 0.7]) for (const [ax, az] of aims) tries.push([ax, az, flight * k]);
  // A spike leaves the hand going down, like a line drive. It gets its own lighter gravity
  // (until someone touches it) so it still takes about `flight` seconds to land.
  for (const c of [0.6, -0.8, -2]) for (const [ax, az, T] of tries) {
    const g = Math.max(2.5, 2 * (b.y - BR - c * T) / (T * T));
    const vx = (ax - b.x) / T, vz = (az - b.z) / T, vy = -c;
    if (!clearsNet(b.x, b.y, b.z, vx, vy, vz, g)) continue;
    const [lx, lz] = landAt(b.x, b.y, b.z, vx, vy, vz, g);
    if (!inCourt(lx, lz, 1 - s) || Math.abs(lz) < 0.5) continue;
    b.vx = vx; b.vy = vy; b.vz = vz; b.gs = g / GB;
    G.lastAttack = { p, type: 'spike' };
    if (human || special) G.shake = Math.max(G.shake, 0.18);
    if (special) {
      const ty = p.mon.types[0];
      b.special = ty;
      for (let i = 0; i < 16; i++) specialFx(b, true); // the hit throws out a burst of the move's particles
      G.shake = 0.35;
    }
    Sfx.spike();
    hitstop(special ? 0.32 : human ? 0.12 : 0.15, special ? TYPE_COLORS[p.mon.types[0]] : '#ffffff');
    burst(b.x, b.y, b.z, special ? TYPE_COLORS[p.mon.types[0]] : '#ffffff', special ? 22 : 10);
    return true;
  }
  return false;
}

function doBlock(p) {
  const s = p.side, t = toward(s), b = G.ball;
  const atk = G.lastAttack && G.lastAttack.p;
  const human = !aiControlled(p);
  const chance = (human ? 0.55 : s === 0 ? MATE.block : DIFF[settings.diff].block)
             + (p.r.jmp - (atk ? atk.r.pwr : 50)) / 250;
  const roll = Math.random(), stuff = roll < clamp(chance, human ? 0.15 : 0.08, human ? 0.8 : 0.75);
  // a computer blocker can be beaten clean; when you get there in time you always get a hand on it
  if (!human && !stuff && roll < clamp(chance, 0.08, 0.75) + 0.4) { p.cool = 0.5; return; }
  if (human) tutEvent('block', { stuff });
  p.cool = 0.3; b.noHit = 0.08; b.special = null; b.gs = 1; G.tid++;
  G.lastToucher = null; G.lastSide = s; G.touches[s] = 0; G.intended[s] = null; G.intended[1 - s] = null;
  if (stuff) {
    b.z = t * (BR + 0.12);
    b.vz = t * rand(3, 6); b.vy = -rand(1, 3); b.vx = rand(-1.5, 1.5);
    G.lastAttack = { p, type: 'block' };
    floatText('BLOCK!', p.x, p.cy + p.rr + 0.6, p.z, '#fff', 1);
    G.shake = 0.2; hitstop(0.16, '#ffffff');
  } else {
    b.z = -t * (BR + 0.12);
    b.vz = -t * rand(1, 2.5); b.vy = rand(4, 6); b.vx = rand(-1, 1);
    floatText('Soft block', p.x, p.cy + p.rr + 0.6, p.z, '#dfe8ff', 0.8);
  }
  rerollAI();
  Sfx.block();
}

// ===================== rally flow =====================
// A freeze frame on a big contact, so it lands with some weight. The world stops; the screen still draws.
function hitstop(sec, color) {
  if (AUTO && SPEEDUP > 1) return;
  G.freeze = Math.max(G.freeze || 0, sec); G.freezeMax = G.freeze; G.freezeAt = { x: G.ball.x, y: G.ball.y, z: G.ball.z, c: color };
}
function stepBall(h) {
  const b = G.ball, pz = b.z;
  b.vy -= GB * (b.gs || 1) * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  b.spin += h * Math.hypot(b.vx, b.vz) * 0.8; b.noHit -= h;
  // a block: the ball crosses the net within reach of a jumping blocker's raised arms
  if ((pz < 0) !== (b.z < 0) && b.y - BR >= NET_H - 0.05) {
    const sIn = b.z < 0 ? 0 : 1;
    if (G.lastSide === 1 - sIn) {
      for (const p of G.sides[sIn]) {
        if (p.role === 'L' || p.onGround || p.cool > 0 || Math.abs(p.z) > p.rr + 1.0 || !(aiControlled(p) || p.blockUp)) continue; // you block with right click in the air
        if (Math.abs(b.x - p.x) < p.rr + 0.55 && b.y <= p.y + p.rr * 2 + 0.9) { doBlock(p); break; }
      }
    }
  }
  // the net
  if ((pz < 0) !== (b.z < 0) && Math.abs(b.x) < HW + 0.6 && b.y - BR < NET_H) {
    if (b.y > NET_H - 0.12 && b.vy < 0) { // rolls on the tape
      b.y = NET_H + BR; b.vy = Math.abs(b.vy) * 0.45;
      b.vz = b.vz * 0.4 + rand(-0.8, 0.8); if (Math.abs(b.vz) < 0.4) b.vz = 0.4 * (Math.random() < 0.5 ? -1 : 1);
    } else {
      b.z = Math.sign(pz || -1) * (BR + 0.02); b.vz *= -0.3; b.vx *= 0.6;
    }
    G.netWobble = 1; b.special = null; b.gs = 1;
  }
  for (const p of G.players) {
    if (!canContact(p, b)) continue;
    if (!aiControlled(p)) { // you meet the ball at its sweet spot, so the meter can count down to it
      const dx = b.x - p.x, dy = b.y - contactY(p), dz = b.z - p.z;
      if (!sweetSpot(dx, dy, dz, b.vx, b.vy - p.vy, b.vz, b.y, (p.rr + BR) * 0.85) && b.z * toward(p.side) < 0.4) continue;
    }
    contact(p); if (G.phase !== 'rally') return true; break;
  }
  if (b.y <= BR) { b.y = BR; ballDown(); return true; }
  if (Math.abs(b.x) > HW + 9 || Math.abs(b.z) > HL + 12) { awardPoint(1 - G.lastSide, 'OUT', 'Hit out of bounds', null, null); return true; }
  return false;
}

function ballDown() {
  const b = G.ball;
  dust(b.x, b.z, 14, '#f3e2b5');
  const landSide = inCourt(b.x, b.z, 0) ? 0 : inCourt(b.x, b.z, 1) ? 1 : -1;
  G.rings.push({ x: b.x, z: b.z, t: 0, c: landSide === -1 ? '#ff6b6b' : '#ffffff' }); // a ring spreads where it lands
  if (landSide === -1) {
    awardPoint(1 - G.lastSide, 'OUT', `${G.lastToucher ? G.lastToucher.mon.name : 'The block'} hit it out`, null, null);
    return;
  }
  const w = 1 - landSide, la = G.lastAttack;
  let label = 'POINT', sub = 'The ball hit the sand', credit = null, key = null;
  if (la && la.p.side === w) {
    credit = la.p;
    const name = la.p.mon.name;
    if (la.type === 'serve') { label = 'ACE!'; key = 'aces'; sub = `${name} served an ace`; }
    else if (la.type === 'spike') { label = 'KILL!'; key = 'kills'; sub = `${name} put it away`; }
    else if (la.type === 'block') { label = 'STUFF BLOCK!'; key = 'blocks'; sub = `${name} shut it down`; }
    else if (la.type === 'tip') { label = 'TIP!'; key = 'kills'; sub = `${name} found the gap`; }
    else { label = 'POINT'; key = 'kills'; sub = `${name} dropped it in`; }
    if (G.lastSide === landSide) sub += ' (no return)';
  } else if (G.lastSide === landSide) { label = 'DROPPED'; sub = 'Nobody got to it'; }
  awardPoint(w, label, sub, credit, key);
}

// Best of 3 is first to 2 sets, best of 5 first to 3. At 2-2 in a best of 5 the fifth set is played to 15
// (or to the chosen target if that is lower), still win by 2.
const setsToWin = () => Math.ceil(settings.sets / 2);
const decider = () => Math.min(15, settings.target);
function setTarget() {
  return settings.sets === 5 && G.setNo === 5 ? decider() : settings.target;
}

function awardPoint(w, label, sub, credit, key) {
  if (G.phase !== 'rally') return;
  G.score[w]++;
  if (credit && key) credit.stats[key]++;
  if (key === 'kills' && G.lastAttack && G.lastAttack.setter) G.lastAttack.setter.stats.ast++;
  G.cheer = 1; // the crowd jumps up
  if (key === 'kills' && G.lastAttack && G.lastAttack.type === 'spike') G.killCam = { x: G.ball.x, z: G.ball.z, t: 1.4 }; // the camera pushes in on the kill
  G.longestRally = Math.max(G.longestRally, G.rally);
  if (TUT) { G.texts.push({ big: true, text: label, sub, color: TEAM_COLORS[w], t: 0, life: 1.6 }); Sfx.whistle(); G.phase = 'point'; G.timer = 1.6; return; }
  if (w !== G.serving) { // side out: the team that won the serve back rotates one zone clockwise
    G.serving = w; G.rot[w].push(G.rot[w].shift());
    planSubs(w); planSubs(1 - w); G.players = [...G.sides[0], ...G.sides[1]];
    floatText('ROTATE', 0, 2.6, -toward(w) * HL * 0.5, TEAM_COLORS[w], 1.4, 30);
  }
  G.texts.push({ big: true, text: label, sub, color: TEAM_COLORS[w], t: 0, life: 1.6 });
  Sfx.whistle(); Sfx.point(w === 0);
  const setWon = G.score[w] >= setTarget() && G.score[w] - G.score[1 - w] >= 2;
  if (setWon) {
    G.sets[w]++; G.setLog.push([...G.score]);
    if (G.sets[w] >= setsToWin()) { G.phase = 'over'; G.timer = 2.0; G.winner = w; return; }
    G.setDone = true; G.phase = 'point'; G.timer = 3.0;
    G.texts.push({ big: true, text: `SET ${G.setNo} TO ${w === 0 ? 'YOU' : 'RIVAL'}`, sub: `${G.score[0]} - ${G.score[1]} · Sets ${G.sets[0]} - ${G.sets[1]}`, color: TEAM_COLORS[w], t: -1.4, life: 1.6 });
  } else { G.phase = 'point'; G.timer = 1.6; }
}

// ===================== AI =====================
function chooseReceiver(s, lx, lz) {
  if (G.lastSide === s && G.touches[s] > 0 && G.intended[s]) return G.intended[s];
  const cands = G.sides[s].filter(p => !(G.lastSide === s && G.lastToucher === p && G.touches[s] > 0));
  const first = G.lastSide !== s, serve = G.lastAttack && G.lastAttack.type === 'serve';
  const cost = p => Math.hypot(p.x - lx, p.z - lz) / p.speed + (p.onGround ? 0 : 0.15)
    + (first && settings.mode === 6 && p.role === 'S' ? 0.35 : 0) + (first && serve && !isPasser(p) ? 0.4 : 0);
  let best = null;
  for (const p of cands) if (!best || cost(p) < cost(best)) best = p;
  // you called it: teammates leave this ball to you
  const you = cands.find(p => p.human);
  if (you && !AUTO && s === 0 && G.chat && G.chat.k === 0 && G.time - G.chat.t < 3 && G.chat.tid >= G.tid - 1) return you;
  if (you && first && s === 0 && tutStep() && tutStep().mine && Math.hypot(you.x - lx, you.z - lz) < 5) return you; // tutorial: the first ball is yours
  // the ball is yours when it comes to you; teammates cover what you cannot reach
  if (best && best.human && !AUTO && Math.hypot(best.x - lx, best.z - lz) > 2.4) {
    const ais = cands.filter(p => !p.human);
    if (ais.length) best = ais.reduce((a, p) => (cost(p) < cost(a) ? p : a));
  }
  return best;
}
function aiThink(dt) {
  const b = G.ball;
  for (let s = 0; s < 2; s++) {
    if (G.react[s] > 0) { G.react[s] -= dt; continue; }
    const pars = s === 0 ? MATE : DIFF[settings.diff];
    let tc = timeToY(b, 1.0); if (tc == null) tc = timeToY(b, BR) || 0;
    const f = clamp(tc / 0.9, 0, 1);
    const lx = b.x + b.vx * tc + G.aiErr[s][0] * f, lz = b.z + b.vz * tc + G.aiErr[s][1] * f;
    let receiver = null;
    if (ownSide(s, lz)) {
      const out = Math.abs(lx) > HW + 0.2 || Math.abs(lz) > HL + 0.2;
      const leave = out && G.lastSide !== s && G.leave[s];
      if (!leave) receiver = chooseReceiver(s, lx, lz);
    }
    const blockers = new Map(G.blockers[s]);
    for (const p of G.sides[s]) {
      if (!aiControlled(p)) continue;
      if (p === receiver) aiReceive(p, lx, lz, pars);
      else if (blockers.has(p)) aiBlock(p, pars, dt, blockers.get(p) * toward(s));
      else { moveToward(p, p.homeX, p.homeZ, 0.85 * pars.spd); p.ai.blockWait = -1; }
    }
  }
}

function aiReceive(p, lx, lz, pars) {
  const b = G.ball, s = p.side, t = toward(s);
  const attack = G.lastSide === s && G.touches[s] >= 2;
  if (attack) {
    const cy = p.apex + p.rr * 2 + 0.05 + p.ai.jumpErr;
    const tc = timeToY(b, cy);
    if (tc != null) {
      let tx = b.x + b.vx * tc, tz = b.z + b.vz * tc - t * p.rr * 0.5;
      if (settings.mode === 6 && !isFront(p)) tz = -t * Math.max(-tz * t, attackLine() + 0.15); // take off behind the line
      if (p.onGround) {
        moveToward(p, tx, tz, pars.spd);
        if (tc <= p.tUp + 0.015 && Math.hypot(p.x - tx, p.z - tz) < p.rr + 0.35) jump(p);
      } else moveToward(p, tx, tz, pars.spd * 0.8);
      return;
    }
  }
  moveToward(p, lx, lz - t * 0.1, pars.spd);
}

function aiBlock(p, pars, dt, bxWorld) {
  const b = G.ball, s = p.side, t = toward(s);
  const attacker = G.sides[1 - s].find(q => !q.onGround && Math.abs(q.z) < 3.5);
  const bx = clamp(bxWorld, -HW + 0.4, HW - 0.4), bz = -t * (p.rr + 0.3);
  moveToward(p, bx, bz, pars.spd);
  if (!p.onGround) return;
  const ballNear = Math.abs(b.z) < 4 && b.y > NET_H - 0.5;
  if (attacker && ballNear && Math.hypot(p.x - bx, p.z - bz) < 0.8) {
    if (p.ai.blockWait < 0) p.ai.blockWait = pars.react * 0.8 + 0.04;
    else { p.ai.blockWait -= dt; if (p.ai.blockWait <= 0) { jump(p); p.ai.blockWait = -1; } }
  } else p.ai.blockWait = -1;
}

function humanControl(p, dt) {
  const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iz = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  p.strafe = keys.strafe && !!input.aim;
  if (input.diveQ) { // right click: a dive on the ground, a block in the air
    input.diveQ = false;
    if (G.phase === 'rally') {
      if (p.onGround) { startDive(p, ix, iz); if (p.dive > 0) tutEvent('dive'); }
      else if (p.role !== 'L') { p.blockUp = true; tutEvent('blockup', { net: Math.abs(p.z) < p.rr + 1.2 }); }
    }
  }
  if (p.dive > 0 || p.rec > 0) { input.jumpT0 = null; input.jumpQ = null; return; } // the slide carries you, then you get up
  const d = Math.hypot(ix, iz) || 1, sp = p.speed * (p.strafe ? 0.85 : 1);
  const wx = ix / d * sp, wz = iz / d * sp * toward(p.side);
  if (p.onGround) { // quick to get going and quick to plant, but not instant, so a cut has a little weight
    const k = Math.min(1, dt * (ix || iz ? 15 : 20)); p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
  } else {
    const aim = jumpAssist(p);
    if (aim) { const m = Math.min(1, dt * 8); p.vx += (aim[0] - p.vx) * m; p.vz += (aim[1] - p.vz) * m; }
    else { const k = Math.min(1, dt * 2.5); p.vx += (wx * 0.8 - p.vx) * k; p.vz += (wz * 0.8 - p.vz) * k; } // a running jump keeps its momentum
  }
  if (input.jumpT0 != null && p.onGround) p.squash = Math.min(p.squash, 1 - 0.14 * clamp((performance.now() - input.jumpT0) / 1000 / JUMP_CHARGE, 0, 1)); // crouch while charging
  if (input.jumpQ != null) {
    if (p.onGround) { jump(p, input.jumpQ); const aim = jumpAssist(p); if (aim) { p.vx = aim[0]; p.vz = aim[1]; } tutEvent('jump', { c: input.jumpQ }); }
    input.jumpQ = null;
  }
}

// Spike help: once you are in the air on your own team's ball, you drift toward the spot where the ball
// comes down to hand height, so a jump that is roughly right meets it. Returns the drift velocity, or null.
function jumpAssist(p) {
  const b = G.ball, t = toward(p.side);
  if (G.phase !== 'rally' || p.onGround || b.vy > 6) return null;
  if (G.lastSide !== p.side && b.z * t > 0) return null; // their ball on their side: a block, not a spike
  const vy = p.vy, hy = p.y + Math.max(0, vy * vy / (2 * GP)) + p.rr * 1.6; // hand height near the top of the jump
  let tc = timeToY(b, Math.min(hy, b.y));
  if (tc == null) return null;
  tc = Math.min(tc, 1.2);
  const tx = b.x + b.vx * tc, tz = Math.min((b.z + b.vz * tc) * t, -0.3) * t; // never past your side of the net
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d > 3.2) return null; // too far to be what you jumped for
  const v = Math.min(5, d / Math.max(tc, 0.2));
  return d < 0.05 ? [0, 0] : [dx / d * v, dz / d * v];
}

// ===================== main update =====================
function update(dt) {
  if (!G || G.paused) return;
  if (G.freeze > 0) { G.freeze -= dt; return; } // inputs wait in their queues until the world moves again
  G.time += dt;
  G.cheer = Math.max(0, (G.cheer || 0) - dt * 0.6);
  G.shake = Math.max(0, G.shake - dt); if (G.killCam) G.killCam.t -= dt; G.netWobble = Math.max(0, G.netWobble - dt * 2.5);
  for (const p of G.players) p.squash += (1 - p.squash) * Math.min(1, dt * 12);
  for (const q of G.particles) {
    q.vy -= 6 * dt * (q.g ?? 1);
    if (q.drag) { const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy *= d; q.vz *= d; }
    if (q.jit) { q.vx += rand(-q.jit, q.jit) * dt; q.vy += rand(-q.jit, q.jit) * dt; q.vz += rand(-q.jit, q.jit) * dt; }
    if (q.spin) q.rot += q.spin * dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.life -= dt;
  }
  G.particles = G.particles.filter(q => q.life > 0);
  for (const r of G.rings) r.t += dt;
  G.rings = G.rings.filter(r => r.t < 0.6);
  for (const tx of G.texts) tx.t += dt;
  G.texts = G.texts.filter(tx => tx.t < tx.life);

  updateFormation();
  const you = G.sides[0].find(p => p.human);
  if (G.phase === 'rally' && you && !AUTO) { // the wind-up: press starts it, letting go freezes it
    if (input.hitQ && !(G.hold && G.hold.kind === 'set' && keys.set)) G.hold = { t0: evTime(input.downAt), tr: null, C: CHARGE, kind: 'hit' };
    if (input.setQ) G.hold = { t0: evTime(input.downAt), tr: null, C: SET_CHARGE, kind: 'set' };
    if (G.hold && G.hold.tr == null && !G.hold.tap && !keys[G.hold.kind]) {
      const tr = Math.max(G.hold.t0, evTime(input.upAt));
      if (G.hold.kind === 'hit' && tr - G.hold.t0 < TAP) G.hold.tap = true; else G.hold.tr = tr;
    }
    if (G.hold && (G.time - (G.hold.tr ?? G.time) > holdWin(G.hold) || tapGone(G.hold))) G.hold = null;
  }
  if (G.phase !== 'rally') input.setQ = false;
  if (G.phase === 'serve') {
    const sv = G.server, b = G.ball;
    G.timer += dt;
    for (const p of G.players) {
      if (p === sv) { p.vx = p.vz = 0; }
      else if (!aiControlled(p)) humanControl(p, dt);
      else moveToward(p, p.homeX, p.homeZ, 0.7);
      stepPlayer(p, dt);
    }
    b.x = sv.x + 0.15; b.z = sv.z + toward(sv.side) * 0.15;
    if (!aiControlled(sv)) { // press to toss and hold; let go as the ball drops back to your hand
      const hy = serveY(sv);
      if (!G.toss) {
        b.y = sv.y + sv.rr * 2 + 0.35 + Math.sin(G.time * 4) * 0.05;
        if (input.hitQ) {
          input.hitQ = false; G.toss = true; b.vy = 4.6; sv.squash = 1.1; Sfx.tone(520, 0.05, 'triangle', 0.03, 160);
          G.hold = { kind: 'hit', t0: G.time, tr: null, C: Math.max(0.3, timeToY({ ...b, vx: 0, vz: 0 }, hy) ?? 0.9) }; // full as it reaches your hand
        }
      } else {
        b.vy -= GB * dt; b.y += b.vy * dt;
        const h = G.hold;
        let hitNow = false;
        if (h && h.tap) { if (input.hitQ) { input.hitQ = false; h.tr = Math.max(h.t0, evTime(input.downAt)); hitNow = true; } } // the second tap hits
        else if (h && !keys.hit) {
          h.tr = Math.max(h.t0, evTime(input.upAt));
          if (h.tr - h.t0 < TAP) { h.tap = true; h.tr = null; } else hitNow = true;
        }
        if (hitNow) {
          const gr = gradeL(holdLevel(h));
          floatText(gr.label, sv.x, sv.cy + sv.rr + 1.1, sv.z, gr.color, 0.7);
          G.meterShow = { p: sv, L: holdLevel(h), color: gr.color, t: G.time };
          G.hold = null; doServe(sv, gr.q); tutEvent('serve', { q: gr.q });
        } else if (b.vy < 0 && b.y < hy - 0.4) { floatText(TOO_LONG.label, sv.x, sv.cy + sv.rr + 1.1, sv.z, TOO_LONG.color, 0.7); G.meterShow = { p: sv, L: 1.2, color: TOO_LONG.color, t: G.time }; G.hold = null; doServe(sv, -0.4); }
      }
    } else {
      b.y = sv.y + sv.rr * 2 + 0.35 + Math.sin(G.time * 4) * 0.05;
      if (G.timer > 1.1) doServe(sv);
    }
  } else if (G.phase === 'rally') {
    input.hitQ = input.setQ = false;
    aiThink(dt);
    if (you && !AUTO) humanControl(you, dt);
    // step the clock with the physics, so a touch is graded at the moment it happens, not at the end of the frame
    const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps, tEnd = G.time;
    G.time -= dt;
    for (let i = 0; i < steps; i++) {
      G.time += h;
      for (const p of G.players) stepPlayer(p, h);
      if (stepBall(h) || G.freeze > 0) break;
    }
    G.time = tEnd;
  } else {
    G.timer -= dt;
    if (G.subs.length) runSubs(dt);
    for (const p of G.players) {
      if (p.subbing) continue;
      if (!aiControlled(p)) humanControl(p, dt); else moveToward(p, p.homeX, p.homeZ, 0.5);
      stepPlayer(p, dt);
    }
    if (G.timer <= 0) {
      if (G.phase === 'point') { if (!G.subs.length) { if (G.setDone) nextSet(); startServe(); } }
      else if (G.demo) demoMatch(); // the background match ends: a new one starts with new teams
      else if (!G.shown) { G.shown = true; showResult(); }
    }
  }
  const b = G.ball;
  if (G.phase === 'rally') {
    b.trail.push({ x: b.x, y: b.y, z: b.z, c: b.special });
    const fast = Math.hypot(b.vx, b.vy, b.vz) > 11;
    if (b.trail.length > (b.special ? 24 : fast ? 11 : 6)) b.trail.shift();
    if (b.special) { b.fxAcc = (b.fxAcc || 0) + dt * FX[b.special].rate; for (; b.fxAcc >= 1; b.fxAcc--) specialFx(b); }
  } else b.trail.length = 0;

  if (TUT) tutTick(dt, you);

  // the camera drifts to keep you in view (or holds still in fixed mode), and dollies in or out with the zoom
  const cw = G.demo ? demoCam() : camWant(you || G.sides[0][0], true);
  G.cam.x += (cw.x - G.cam.x) * Math.min(1, dt * 2.5);
  G.cam.z += (cw.z - G.cam.z) * Math.min(1, dt * 3);
  G.cam.y += (cw.y - G.cam.y) * Math.min(1, dt * 4);
  G.cam.yaw += (cw.yaw - G.cam.yaw) * Math.min(1, dt * 2.2);
  G.cam.pitch += (cw.pitch - G.cam.pitch) * Math.min(1, dt * 2);
}
// Where the camera wants to be. Zoom slides it along its own line of sight, so the court stays framed the same way.
// In follow mode it also frames you and the ball together: it turns toward the play, pulls back as the two
// spread apart or the ball climbs, and tilts up to keep a high ball in the shot.
function camWant(focus, ball) {
  const fixed = settings.camMode === 'fixed', b = G.ball;
  const x = fixed ? 0 : clamp(focus.x * 0.55 + (ball ? b.x * 0.15 : 0), -HW * 0.6, HW * 0.6);
  const z0 = fixed ? -(HL + 0.8) - 6.6 : Math.min(-HL - CAM.back, focus.z - 6.6); // back up when you go deep or serve
  let d = settings.zoom, yaw = 0, pitch = CAM.pitch;
  if (!fixed && ball) {
    const bx = clamp(b.x, -HW - 2, HW + 2), bz = clamp(b.z, -HL - 2, HL + 2);
    const mx = focus.x * 0.6 + bx * 0.4, mz = focus.z * 0.6 + bz * 0.4;
    yaw = clamp(Math.atan2(mx - x, Math.max(2, mz - z0)) * 0.85, -0.12, 0.12);
    const spread = Math.hypot(focus.x - bx, focus.z - bz) + Math.max(0, b.y - 3) * 0.6;
    d *= 1 + clamp((spread - 3.5) * 0.02, -0.05, 0.14);
    pitch -= clamp((b.y - 3.2) * 0.022, 0, 0.07);
  }
  const kc = G.killCam;
  if (kc && kc.t > 0 && !fixed) { // after a kill, lean in toward where the spike landed
    const k = Math.min(1, kc.t / 0.4);
    d *= 1 - 0.14 * k;
    yaw += clamp(Math.atan2(kc.x - x, Math.max(2, kc.z - z0)) * 0.5, -0.1, 0.1) * k;
  }
  const piv = CAM.y / Math.tan(CAM.pitch), cam = { x, z: z0 + piv * (1 - d), y: CAM.y * d, yaw, pitch };
  // never tilt so far that your own feet drop toward the bottom edge of the screen
  for (let i = 0; i < 6 && cam.pitch < CAM.pitch && screenYAt(cam, focus.x, 0, focus.z) > H * 0.86; i++) cam.pitch = Math.min(CAM.pitch, cam.pitch + 0.015);
  return cam;
}
function screenYAt(cam, x, y, z) { // proj()'s vertical, for a camera that is not G.cam
  const ex = x - cam.x, ez = z - cam.z, dz = ex * Math.sin(cam.yaw) + ez * Math.cos(cam.yaw), dy = y - cam.y;
  const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
  return CAM.cy - (dy * c + dz * s) * CAM.F / Math.max(0.3, -dy * s + dz * c);
}
const ZOOMS = [1, 0.86, 1.12], ZOOM_NAMES = { 1: 'NORMAL', 0.86: 'CLOSE', 1.12: 'WIDE' };
function cycleCam() {
  settings.camMode = settings.camMode === 'fixed' ? 'follow' : 'fixed'; saveSettings();
  toast(`CAMERA: ${settings.camMode === 'fixed' ? 'FIXED' : 'FOLLOW'}`); tutEvent('cam');
}
function cycleZoom() {
  const i = ZOOMS.indexOf(settings.zoom);
  settings.zoom = ZOOMS[(i + 1) % ZOOMS.length]; saveSettings();
  toast(`ZOOM: ${ZOOM_NAMES[settings.zoom]}`); tutEvent('cam');
}
function wheelZoom(dy) {
  settings.zoom = Math.round(clamp(settings.zoom * Math.exp(dy * 0.0012), 0.84, 1.14) * 100) / 100; saveSettings();
  toast(`ZOOM ${Math.round(100 / settings.zoom)}%`); tutEvent('cam');
}
function toast(text) { if (G) G.toast = { text, t: G.time }; }

// 1 to 4: quick chat over your Pokémon. "Set me!" tells your setter to look for you; "Mine!" sends your teammates off the ball.
const CHATS = ['MINE!', 'SET ME!', 'NICE!', 'MY BAD'];
function quickChat(k) {
  const you = G && G.sides[0].find(p => p.human);
  if (!you || AUTO || G.paused) return;
  G.chat = { k, t: G.time, tid: G.tid };
  tutEvent('chat', { k });
  Sfx.tone([660, 880, 990, 440][k], 0.06, 'square', 0.025);
}

// ===================== effects =====================
function dust(x, z, n, color) {
  for (let i = 0; i < n; i++) G.particles.push({ x, y: 0.05, z, vx: rand(-1.2, 1.2), vy: rand(0.6, 2.4), vz: rand(-1.2, 1.2), life: rand(0.3, 0.6), r: rand(0.03, 0.06), color });
}
function puff(x, z) {
  for (let i = 0; i < 2; i++) G.particles.push({ x: x + rand(-0.1, 0.1), y: 0.05, z: z + rand(-0.1, 0.1), vx: rand(-0.4, 0.4), vy: rand(0.4, 1.1), vz: rand(-0.4, 0.4), life: rand(0.22, 0.34), r: rand(0.04, 0.07), color: '#f6f1e3' });
}
function burst(x, y, z, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-1, 1), s = rand(1.5, 4.5);
    G.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: e * s, vz: Math.sin(a) * s, life: rand(0.25, 0.5), r: rand(0.03, 0.07), color });
  }
}
// ===================== special moves: each type's spike leaves its own trail =====================
// trail: how the streak behind the ball is drawn. cols: [outer, middle, core]. rate: particles a second.
// part(): one particle, with its position and speed relative to the ball. Particle fields: shape, g (gravity
// scale, below 0 rises), drag, jit (random buzz), rot/spin, grow (size gain over its life), shrink, a (opacity).
const R3 = s => [rand(-s, s), rand(-s, s), rand(-s, s)];
const FX = {
  fire:     { trail: 'flame', cols: ['#e8401c', '#ff8a1f', '#ffe9a0'], rate: 90,
    part: () => ({ color: pickOne(['#ffd23f', '#ff8a1f', '#e8401c']), v: [rand(-0.6, 0.6), rand(0.8, 2.4), rand(-0.6, 0.6)], g: -0.15, life: rand(0.25, 0.45), r: rand(0.05, 0.1), shrink: 1 }) },
  water:    { trail: 'wave', cols: ['#2f63d8', '#6390f0', '#e6f2ff'], rate: 60,
    part: () => Math.random() < 0.25
      ? { shape: 'bubble', color: '#cfe4ff', v: R3(0.6), g: -0.08, drag: 2, life: rand(0.45, 0.7), r: rand(0.05, 0.09) }
      : { shape: 'puff', color: pickOne(['#6390f0', '#9cc4ff', '#ffffff']), v: [rand(-1, 1), rand(0, 1.6), rand(-1, 1)], g: 1, life: rand(0.35, 0.55), r: rand(0.03, 0.06) } },
  electric: { trail: 'bolt', cols: ['#f7d02c', '#fff27a', '#ffffff'], rate: 70,
    part: () => ({ shape: 'spark', color: pickOne(['#fff6a0', '#f7d02c', '#ffffff']), v: R3(5), g: 0, life: rand(0.08, 0.18), r: 0.05 }) },
  grass:    { trail: 'helix', cols: ['#3f8a2a', '#7ac74c', '#d9f5b5'], rate: 45,
    part: () => ({ shape: 'leaf', color: pickOne(['#7ac74c', '#4f9a35', '#b6e07a']), v: R3(1.3), g: 0.12, drag: 1.5, rot: rand(0, 6.3), spin: rand(-10, 10), life: rand(0.6, 0.9), r: rand(0.06, 0.09) }) },
  ice:      { trail: 'streak', cols: ['#5fc4d6', '#96d9d6', '#ffffff'], rate: 50,
    part: () => Math.random() < 0.3
      ? { shape: 'star', color: '#ffffff', v: R3(0.4), g: 0, life: rand(0.3, 0.5), r: rand(0.05, 0.08) }
      : { shape: 'diamond', color: pickOne(['#e8fbff', '#96d9d6', '#bfeef5']), v: R3(1), g: 0.6, rot: rand(0, 6.3), spin: rand(-6, 6), life: rand(0.4, 0.6), r: rand(0.05, 0.08) } },
  fighting: { trail: 'streak', cols: ['#8e1f1a', '#c22e28', '#ffb07a'], rate: 22,
    part: () => ({ shape: 'ring', color: pickOne(['#ff8a3d', '#ffffff', '#c22e28']), v: [0, 0, 0], g: 0, grow: 3, life: 0.22, r: 0.12, a: 0.9 }) },
  poison:   { trail: 'wave', cols: ['#6d2a6c', '#a33ea1', '#e3a6e2'], rate: 40,
    part: () => Math.random() < 0.7
      ? { shape: 'bubble', color: pickOne(['#c36ac1', '#a33ea1', '#e3a6e2']), v: [rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5)], g: -0.1, drag: 2, jit: 4, life: rand(0.5, 0.8), r: rand(0.04, 0.09) }
      : { shape: 'puff', color: '#7a2a78', v: [rand(-0.4, 0.4), 0, rand(-0.4, 0.4)], g: 1, life: rand(0.4, 0.6), r: rand(0.04, 0.06) } },
  ground:   { trail: 'streak', cols: ['#8a6a2c', '#c9a352', '#f0dda8'], rate: 50,
    part: () => Math.random() < 0.7
      ? { shape: 'puff', color: pickOne(['#e2bf65', '#b8954a', '#d9c18a']), v: [rand(-0.6, 0.6), rand(0, 0.6), rand(-0.6, 0.6)], g: 0.1, drag: 2, grow: 1.6, a: 0.7, life: rand(0.5, 0.7), r: rand(0.07, 0.11) }
      : { shape: 'rock', color: '#8a6a3a', v: R3(1.2), g: 1.2, rot: rand(0, 6.3), spin: rand(-12, 12), life: rand(0.4, 0.6), r: rand(0.03, 0.05) } },
  flying:   { trail: 'helix', cols: ['#7d68d6', '#a98ff3', '#ffffff'], rate: 45,
    part: () => Math.random() < 0.8
      ? { shape: 'spark', color: pickOne(['#ffffff', '#dfe6ff', '#c9b8ff']), v: R3(2.5), g: 0, drag: 2, life: rand(0.25, 0.4), r: 0.05 }
      : { shape: 'leaf', color: '#ffffff', v: R3(0.8), g: 0.3, drag: 1, rot: rand(0, 6.3), spin: rand(-8, 8), life: rand(0.5, 0.8), r: rand(0.06, 0.08) } },
  psychic:  { trail: 'helix', cols: ['#c2306a', '#f95587', '#ffd0e0'], rate: 30,
    part: () => Math.random() < 0.6
      ? { shape: 'ring', color: pickOne(['#f95587', '#ffb3cf']), v: [0, 0, 0], g: 0, grow: 2.5, life: 0.35, r: 0.06, a: 0.8 }
      : { shape: 'star', color: '#ffd0e0', v: R3(0.6), g: 0, life: rand(0.3, 0.5), r: rand(0.04, 0.07) } },
  bug:      { trail: 'streak', cols: ['#6b7a10', '#a6b91a', '#e6f08a'], rate: 55,
    part: () => ({ color: pickOne(['#a6b91a', '#d4e157', '#4f5a0c']), v: R3(1.5), g: 0, jit: 40, drag: 1, life: rand(0.4, 0.7), r: rand(0.025, 0.04) }) },
  rock:     { trail: 'streak', cols: ['#6e6540', '#b6a136', '#e8dca0'], rate: 32,
    part: () => ({ shape: 'rock', color: pickOne(['#b6a136', '#8c7a2a', '#6e6540']), v: [rand(-1.2, 1.2), rand(0, 1.5), rand(-1.2, 1.2)], g: 1.3, rot: rand(0, 6.3), spin: rand(-12, 12), life: rand(0.5, 0.7), r: rand(0.05, 0.09) }) },
  ghost:    { trail: 'ghosts', cols: ['#3c2a55', '#735797', '#c9b3ea'], rate: 30,
    part: () => ({ shape: 'puff', color: pickOne(['#735797', '#a68bd0', '#3c2a55']), v: [rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)], g: -0.05, drag: 1.5, grow: 1.2, jit: 3, a: 0.55, life: rand(0.5, 0.8), r: rand(0.07, 0.1) }) },
  dragon:   { trail: 'wave', cols: ['#4a1fbf', '#6f35fc', '#7fe3ff'], rate: 65,
    part: () => Math.random() < 0.75
      ? { color: pickOne(['#6f35fc', '#9f7bff', '#4bd0ff']), v: [rand(-0.6, 0.6), rand(0.8, 2), rand(-0.6, 0.6)], g: -0.15, life: rand(0.25, 0.45), r: rand(0.05, 0.09), shrink: 1 }
      : { shape: 'spark', color: '#bff3ff', v: R3(4), g: 0, life: rand(0.1, 0.2), r: 0.05 } },
  normal:   { trail: 'ghosts', cols: ['#8f8a75', '#d8d3bd', '#ffffff'], rate: 30,
    part: () => ({ shape: 'spark', color: pickOne(['#ffffff', '#e8e2cf']), v: R3(1.5), g: 0, life: rand(0.12, 0.2), r: 0.05, back: 0.35 }) },
  fairy:    { trail: 'helix', cols: ['#b5578a', '#d685ad', '#ffe3f1'], rate: 45,
    part: () => ({ shape: 'star', color: pickOne(['#ffd1ea', '#d685ad', '#ffffff']), v: R3(0.8), g: 0.15, drag: 1, rot: rand(0, 6.3), spin: rand(-4, 4), life: rand(0.5, 0.8), r: rand(0.05, 0.09) }) },
  steel:    { trail: 'streak', cols: ['#6f7488', '#b7b7ce', '#ffffff'], rate: 50,
    part: () => ({ shape: 'spark', color: pickOne(['#ffffff', '#ffd27a', '#b7b7ce']), v: [rand(-3.5, 3.5), rand(1, 4), rand(-3.5, 3.5)], g: 1.6, life: rand(0.2, 0.35), r: 0.04 }) },
  dark:     { trail: 'ghosts', cols: ['#2a211b', '#705746', '#c9a98f'], rate: 30,
    part: () => ({ shape: 'puff', color: pickOne(['#3a2e26', '#705746']), v: R3(0.5), g: -0.05, drag: 1.5, grow: 1.2, a: 0.6, life: rand(0.5, 0.8), r: rand(0.07, 0.1) }) },
};
function specialFx(b, hit = false) {
  const fx = FX[b.special]; if (!fx) return;
  const o = fx.part(), [vx, vy, vz] = o.v, k = o.back || 0, sp = hit ? 2.2 : 1;
  delete o.v;
  G.particles.push(Object.assign({ x: b.x + rand(-0.06, 0.06), y: b.y + rand(-0.06, 0.06), z: b.z + rand(-0.06, 0.06),
    vx: vx * sp - b.vx * k, vy: vy * sp - b.vy * k, vz: vz * sp - b.vz * k, rot: 0, life0: o.life }, o, { r: o.r * 1.5 }));
}
function floatText(text, x, y, z, color, life, size = 22) { G.texts.push({ text, x, y, z, color, t: 0, life, size }); }

// ===================== drawing: Pokémon =====================
// face: -1 (facing left) .. 0 (facing the viewer) .. 1 (facing right). back: seen from behind.
function drawMon(ctx, mon, x, y, r, o = {}) {
  const face = o.face == null ? 1 : o.face, fs = face >= 0 ? 1 : -1, back = !!o.back;
  const sq = o.squash || 1, time = o.time || 0;
  const body = BODY_COLORS[mon.color] || '#ccc', dark = shade(body, -0.45);
  const t1 = mon.types[0], t2 = mon.types[1] || t1, tc = TYPE_COLORS[t1], tc2 = TYPE_COLORS[t2];
  const rx = r * (1 + (1 - sq) * 0.7), ry = r * sq;
  const lw = Math.max(1.2, r * 0.08);
  ctx.save();
  ctx.translate(x, y + (r - ry));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // behind the body
  ctx.save(); ctx.scale(fs, 1);
  if (t1 === 'flying' || t1 === 'dragon' || t2 === 'flying' || t2 === 'dragon') {
    const flap = Math.sin(time * 14) * 0.35;
    ctx.fillStyle = shade(tc2 === TYPE_COLORS.flying ? '#e9e4ff' : tc2, 0.2); ctx.strokeStyle = dark; ctx.lineWidth = lw;
    for (const side of back || Math.abs(face) < 0.4 ? [-1, 1] : [-1]) {
      ctx.save(); ctx.scale(side, 1); ctx.translate(-r * 0.6, -r * 0.3); ctx.rotate(-0.5 + flap);
      ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.1, r * 0.55, r * 0.28, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  if (t1 === 'fire' && (back || Math.abs(face) > 0.3)) { // flame tail
    const fl = 1 + Math.sin(time * 18) * 0.12;
    ctx.save(); ctx.translate(back ? r * 0.1 : -r * 1.0, back ? r * 0.55 : r * 0.1);
    ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.ellipse(0, -r * 0.2 * fl, r * 0.2, r * 0.32 * fl, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.ellipse(0, -r * 0.15 * fl, r * 0.1, r * 0.18 * fl, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (t1 === 'water' && Math.abs(face) > 0.3) { // tail fin
    ctx.fillStyle = shade(tc, 0.25); ctx.strokeStyle = dark; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.3); ctx.lineTo(-r * 1.35, -r * 0.05); ctx.lineTo(-r * 1.25, r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  // feet
  if (t1 !== 'ghost') {
    ctx.fillStyle = shade(body, -0.25);
    for (const fx of [-0.45, 0.45]) { ctx.beginPath(); ctx.ellipse(fx * r, ry * 0.86, r * 0.28, r * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  // body
  const grad = ctx.createRadialGradient(-rx * 0.35, -ry * 0.45, r * 0.1, 0, 0, r * 1.1);
  grad.addColorStop(0, shade(body, 0.35)); grad.addColorStop(0.6, body); grad.addColorStop(1, shade(body, -0.18));
  ctx.fillStyle = grad; ctx.strokeStyle = dark; ctx.lineWidth = lw;
  ctx.beginPath();
  if (t1 === 'ghost') {
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0);
    const n = 4, wv = Math.sin(time * 6) * r * 0.06;
    for (let i = 0; i <= n; i++) { const px = rx - (2 * rx) * i / n; ctx.lineTo(px, ry * 0.75 + (i % 2 ? r * 0.25 : 0) + wv); }
    ctx.closePath();
  } else ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  if (!back) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.ellipse(face * rx * 0.12, ry * 0.32, rx * 0.5, ry * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    if (mon.types[1]) {
      ctx.fillStyle = tc2; ctx.strokeStyle = shade(tc2, -0.4); ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath(); ctx.arc(face * rx * 0.1, ry * 0.42, r * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (o.teamColor) { // a team stripe across the back
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = o.teamColor; ctx.globalAlpha = 0.55; ctx.fillRect(-rx, ry * 0.25, rx * 2, ry * 0.22); ctx.restore();
  }

  ctx.save(); ctx.scale(fs, 1);
  drawFeature(ctx, t1, r, ry, tc, body, dark, lw, time);
  ctx.restore();

  if (!back) {
    const look = o.look ? Math.atan2(o.look.y - y, o.look.x - x) : 0;
    const er = r * 0.17, py = Math.sin(look) * er * 0.45, px = Math.cos(look) * er * 0.45;
    for (const ex of [-0.22, 0.22]) {
      const cx = face * rx * 0.25 + ex * rx, cy = -ry * 0.18;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(0.8, r * 0.04);
      ctx.beginPath(); ctx.ellipse(cx, cy, er * 0.85, er, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1d1d26'; ctx.beginPath(); ctx.arc(cx + px, cy + py, er * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + px - er * 0.18, cy + py - er * 0.2, er * 0.17, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,110,120,0.45)';
    for (const cx of Math.abs(face) < 0.4 ? [-0.55, 0.55] : [fs * 0.62]) {
      ctx.beginPath(); ctx.ellipse(cx * rx, ry * 0.08, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath(); ctx.arc(face * rx * 0.3, ry * 0.05, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}

function drawFeature(ctx, type, r, ry, tc, body, dark, lw, time) {
  ctx.lineWidth = lw; ctx.strokeStyle = dark;
  const top = -ry;
  switch (type) {
    case 'normal':
      ctx.fillStyle = body;
      for (const ex of [-0.45, 0.25]) { ctx.beginPath(); ctx.ellipse(ex * r, top + r * 0.05, r * 0.2, r * 0.26, ex * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      break;
    case 'electric':
      ctx.fillStyle = '#ffe14a';
      ctx.beginPath(); ctx.moveTo(-r * 0.05, top + r * 0.1); ctx.lineTo(r * 0.12, top - r * 0.35); ctx.lineTo(-r * 0.02, top - r * 0.3);
      ctx.lineTo(r * 0.18, top - r * 0.75); ctx.lineTo(-r * 0.22, top - r * 0.2); ctx.lineTo(-r * 0.06, top - r * 0.24); ctx.lineTo(-r * 0.25, top + r * 0.1); ctx.closePath();
      ctx.fill(); ctx.stroke(); break;
    case 'fire': {
      const fl = 1 + Math.sin(time * 16) * 0.1;
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(0, top - r * 0.12 * fl, r * 0.18, r * 0.3 * fl, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(r * 0.02, top - r * 0.05 * fl, r * 0.09, r * 0.16 * fl, 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'water':
      ctx.fillStyle = shade(tc, 0.3);
      ctx.beginPath(); ctx.moveTo(-r * 0.5, top + r * 0.2); ctx.quadraticCurveTo(-r * 0.3, top - r * 0.45, r * 0.1, top + r * 0.05); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'grass':
      ctx.strokeStyle = '#3d7a2c'; ctx.beginPath(); ctx.moveTo(-r * 0.05, top + r * 0.05); ctx.lineTo(-r * 0.05, top - r * 0.25); ctx.stroke();
      ctx.fillStyle = '#6cc04a';
      ctx.beginPath(); ctx.ellipse(-r * 0.25, top - r * 0.3, r * 0.22, r * 0.1, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(r * 0.15, top - r * 0.32, r * 0.22, r * 0.1, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'ice':
      ctx.fillStyle = '#d6fbff';
      for (const [ex, hgt] of [[-0.35, 0.35], [-0.05, 0.55], [0.25, 0.35]]) { ctx.beginPath(); ctx.moveTo(ex * r - r * 0.1, top + r * 0.12); ctx.lineTo(ex * r, top - hgt * r); ctx.lineTo(ex * r + r * 0.1, top + r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'fighting':
      ctx.fillStyle = '#d33a2c';
      ctx.fillRect(-r * 0.92, top + ry * 0.26, r * 1.84, r * 0.16);
      ctx.beginPath(); ctx.moveTo(-r * 0.85, top + ry * 0.32); ctx.lineTo(-r * 1.25, top + ry * 0.2 + Math.sin(time * 10) * r * 0.08); ctx.lineTo(-r * 1.2, top + ry * 0.45); ctx.closePath(); ctx.fill(); break;
    case 'poison':
      ctx.fillStyle = 'rgba(120,40,140,0.55)';
      for (const [ex, ey, rr] of [[-0.5, 0.15, 0.12], [-0.2, 0.55, 0.09], [0.55, 0.45, 0.1]]) { ctx.beginPath(); ctx.arc(ex * r, ey * r, rr * r, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#c86ad0'; ctx.beginPath(); ctx.moveTo(-r * 0.12, top + r * 0.1); ctx.lineTo(0, top - r * 0.3); ctx.lineTo(r * 0.12, top + r * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'ground': case 'rock':
      ctx.fillStyle = type === 'rock' ? '#9c8f6c' : '#c9a35a';
      for (const ex of [-0.45, -0.1, 0.25]) { ctx.beginPath(); ctx.moveTo(ex * r - r * 0.16, top + r * 0.2); ctx.lineTo(ex * r - r * 0.06, top - r * 0.12); ctx.lineTo(ex * r + r * 0.12, top - r * 0.06); ctx.lineTo(ex * r + r * 0.16, top + r * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'psychic':
      ctx.fillStyle = '#ff5f9e'; ctx.beginPath(); ctx.moveTo(0, top + r * 0.12); ctx.lineTo(r * 0.12, top + r * 0.28); ctx.lineTo(0, top + r * 0.44); ctx.lineTo(-r * 0.12, top + r * 0.28); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,95,158,0.35)'; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.arc(0, 0, r * (1.15 + Math.sin(time * 4) * 0.05), -2.4, -0.7); ctx.stroke(); break;
    case 'bug':
      ctx.lineWidth = lw * 0.9;
      for (const [ex, dx] of [[-0.15, -0.3], [0.2, 0.35]]) { ctx.beginPath(); ctx.moveTo(ex * r, top + r * 0.1); ctx.quadraticCurveTo(ex * r, top - r * 0.3, (ex + dx) * r, top - r * 0.45); ctx.stroke(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc((ex + dx) * r, top - r * 0.45, r * 0.07, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'ghost':
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill(); break;
    case 'dragon':
      ctx.fillStyle = '#f2ead0';
      for (const ex of [-0.3, 0.2]) { ctx.beginPath(); ctx.moveTo(ex * r - r * 0.08, top + r * 0.15); ctx.quadraticCurveTo(ex * r - r * 0.05, top - r * 0.3, ex * r - r * 0.25, top - r * 0.4); ctx.lineTo(ex * r + r * 0.08, top + r * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      break;
    case 'fairy': case 'steel': {
      ctx.fillStyle = type === 'fairy' ? '#ffd1ec' : '#d6d6e6';
      ctx.beginPath(); ctx.moveTo(0, top + r * 0.1); ctx.quadraticCurveTo(r * 0.05, top - r * 0.35, -r * 0.2, top - r * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.2, top - r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (type === 'fairy') { ctx.fillStyle = '#fff6a8'; star(ctx, r * 0.55, top - r * 0.2, r * 0.1 * (1 + Math.sin(time * 5) * 0.2)); }
      break;
    }
    case 'flying':
      ctx.fillStyle = shade(body, -0.1);
      ctx.beginPath(); ctx.moveTo(-r * 0.1, top + r * 0.1); ctx.quadraticCurveTo(-r * 0.4, top - r * 0.4, -r * 0.55, top - r * 0.15); ctx.quadraticCurveTo(-r * 0.3, top - r * 0.05, -r * 0.1, top + r * 0.1); ctx.fill(); ctx.stroke(); break;
  }
}
function star(ctx, x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? s * 0.4 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// ===================== camera and projection =====================
const canvas = $('#court'), ctx = canvas.getContext('2d');
const CAM = { y: 8.6, back: 3.6, pitch: 0.47, F: (H / 2) / Math.tan(31 * Math.PI / 180), cy: H * 0.56 };
// The camera turns (yaw) and tilts (pitch) as it follows the play. Painted backdrops are built at the resting pitch.
const camPitch = () => (G && G.cam.pitch != null ? G.cam.pitch : CAM.pitch);
function proj(x, y, z) {
  const ex = x - G.cam.x, dy = y - G.cam.y, ez = z - G.cam.z, yw = G.cam.yaw || 0;
  const cy = Math.cos(yw), sy = Math.sin(yw), dx = ex * cy - ez * sy, dz = ex * sy + ez * cy;
  const pt = camPitch(), c = Math.cos(pt), s = Math.sin(pt);
  const Y = dy * c + dz * s, Z = Math.max(0.3, -dy * s + dz * c);
  const k = CAM.F / Z;
  return { x: W / 2 + dx * k, y: CAM.cy - Y * k, k, Z };
}
function horizonY() { return CAM.cy - Math.tan(CAM.pitch) * CAM.F; }   // resting horizon, for the painted backdrops
function horizonNow() { return CAM.cy - Math.tan(camPitch()) * CAM.F; }

function groundPoly(pts) {
  ctx.beginPath();
  pts.forEach(([x, z], i) => { const p = proj(x, 0, z); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.closePath();
}
function groundLine(x0, z0, x1, z1) {
  const a = proj(x0, 0, z0), b = proj(x1, 0, z1);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}
function groundEllipse(x, z, rw, rd) { // an ellipse lying flat on the sand
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = i / 24 * Math.PI * 2, p = proj(x + Math.cos(a) * rw, 0, z + Math.sin(a) * rd);
    i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
  }
  ctx.closePath();
}

// ===================== drawing: scene =====================
// The game is drawn at LW x LH and scaled up with hard pixel edges.
// World drawing uses 1280 x 720 coordinates under a scale of S. The HUD, text and the painted backdrops are laid
// out on a 480 x 270 grid (UW x UH) and drawn at U times that size, so the pixel font stays crisp.
const LW = 960, LH = 540, S = LW / W;
const UW = 480, UH = 270, US = UW / W, U = LW / UW;
const PX_FONT = '"Press Start 2P", monospace';

// Sprites: front for the other team, back for yours (Pokémon FireRed/LeafGreen sprites).
const SPR = { front: [], back: [] };
function spriteImg(id, back) {
  const set = back ? SPR.back : SPR.front;
  if (!set[id]) { const img = new Image(); img.src = `sprites/${back ? 'back' : 'front'}/${id}.png`; set[id] = img; }
  return set[id];
}

function pxText(text, x, y, color, size = 8, align = 'center', outline = '#10141f') {
  ctx.save(); ctx.setTransform(U, 0, 0, U, 0, 0);
  ctx.font = `${size}px ${PX_FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
  x = Math.round(x); y = Math.round(y);
  if (outline) {
    ctx.fillStyle = outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) ctx.fillText(text, x + dx, y + dy);
  }
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}
function pxRect(x, y, w, h, col) { // UI grid pixels, whatever the current transform
  ctx.save(); ctx.setTransform(U, 0, 0, U, 0, 0);
  ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}
function pixelDisc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2, 1); }
}

let skyCache = null;
// Beach backdrops for each time of day, painted once on the UI grid (UW x UH). Animated bits are in drawSkyFx.
const islandH = x => (x >= 180 && x < 310 ? Math.max(0, Math.round(9 * Math.sin((x - 180) / 130 * Math.PI) + 3 * Math.sin(x / 9))) : 0);
const LIGHT_X = 230; // the lighthouse stands on the island's shoulder
function lighthouseBase(hy) { // the lowest island top under its footprint, so the tower sits on the rock with no gap
  let h = Infinity; for (let x = LIGHT_X - 3; x < LIGHT_X + 3; x++) h = Math.min(h, islandH(x));
  return hy - 12 - h + 1;
}
function paintIsland(g, hy, col, lighthouse) {
  g.fillStyle = col;
  for (let x = 180; x < 310; x++) { const h = islandH(x); if (h > 0) g.fillRect(x, hy - 12 - h, 1, h); }
  for (let x = 330; x < 390; x++) { const h = Math.round(5 * Math.sin((x - 330) / 60 * Math.PI)); if (h > 0) g.fillRect(x, hy - 12 - h, 1, h); }
  if (lighthouse) {
    const lx = LIGHT_X, base = lighthouseBase(hy);
    for (let i = 0; i < 14; i++) { g.fillStyle = lighthouse === 'day' ? (Math.floor(i / 3) % 2 ? '#e8453c' : '#ffffff') : '#20263a'; g.fillRect(lx - (i < 2 ? 3 : 2), base - i, i < 2 ? 6 : 4, 1); }
    g.fillStyle = lighthouse === 'day' ? '#2b2f3f' : '#fff3b0'; g.fillRect(lx - 2, base - 17, 4, 3);
    g.fillStyle = lighthouse === 'day' ? '#e8453c' : '#3a2a20'; g.fillRect(lx - 3, base - 18, 6, 1);
  }
}
function buildSky() { // day
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#3c9fe4', '#4aa8e9', '#58b2ed', '#68bcf0', '#7ac6f3', '#8ed0f6', '#a6dbf8', '#bfe6fa'];
  const bh = Math.ceil((hy - 12) / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  pixelDisc(g, 412, 14, 11, '#fff3b8'); pixelDisc(g, 412, 14, 8, '#fffbe0');
  for (const [cx, cy, s] of [[60, 8, 0.8], [180, 4, 0.6], [270, 12, 0.7], [470, 18, 0.5], [340, 2, 0.45]]) { // layered clouds
    for (const [dx, dy, r] of [[0, 4, 10], [12, -2, 11], [25, 3, 9], [36, 6, 7]]) pixelDisc(g, Math.round(cx + dx * s), Math.round(cy + dy * s), Math.round(r * s), '#ffffff');
    g.fillStyle = '#dcebf7'; g.fillRect(Math.round(cx - 9 * s), Math.round(cy + 8 * s), Math.round(52 * s), 2);
  }
  paintIsland(g, hy, '#6f9fbf', 'day');
  g.fillStyle = '#2f86c8'; g.fillRect(0, hy - 12, UW, 6);
  g.fillStyle = '#3a98d6'; g.fillRect(0, hy - 6, UW, 7);
  g.fillStyle = '#56b4e2'; g.fillRect(0, hy + 1, UW, 6);
  g.fillStyle = '#e8f7ff'; for (let i = 0; i < 26; i++) g.fillRect((i * 37) % UW, hy - 10 + (i * 5) % 16, 6, 1);
  g.fillStyle = '#ffffff'; for (let x = 0; x < UW; x += 2) g.fillRect(x, hy + 7 + ((x / 2) % 3 === 0 ? 1 : 0), 2, 1); // foam
  g.fillStyle = '#d9c48c'; g.fillRect(0, hy + 9, UW, 3);                                                        // wet sand
  g.fillStyle = '#f0dba2'; g.fillRect(0, hy + 12, UW, UH - hy - 12);
  g.fillStyle = '#e4c98a'; for (let y = hy + 13; y < UH; y += 3) for (let x = (y * 7) % 11; x < UW; x += 11) g.fillRect(x, y, 1, 1);
  g.fillStyle = '#fff1d6'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % UW, hy + 14 + (i * 31) % (UH - hy - 14), 2, 1); // shells
  return c;
}
function buildBeachNight() {
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#05081a', '#070c22', '#0a112b', '#0e1634', '#121c3e', '#172348'];
  const bh = Math.ceil((hy - 12) / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  const r = seeded(5); g.fillStyle = '#c9d4ee'; for (let i = 0; i < 90; i++) g.fillRect(Math.floor(r() * UW), Math.floor(r() * (hy - 14)), 1, 1);
  pixelDisc(g, 430, 12, 12, 'rgba(220,230,255,0.15)'); pixelDisc(g, 430, 12, 8, '#f2f0de');
  g.fillStyle = '#d6d2bd'; g.fillRect(427, 9, 2, 2); g.fillRect(432, 14, 3, 2); g.fillRect(429, 16, 1, 1);
  paintIsland(g, hy, '#0b0f1f', 'night');
  g.fillStyle = '#ffd27a'; for (let i = 0; i < 30; i++) g.fillRect(232 + i * 6 + (i % 3), hy - 13 - (i % 2), 1, 1); // city lights
  g.fillStyle = '#0c1430'; g.fillRect(0, hy - 12, UW, 13);
  g.fillStyle = '#111c40'; g.fillRect(0, hy + 1, UW, 6);
  g.fillStyle = '#cfd8f0'; for (let i = 0; i < 9; i++) g.fillRect(422 + ((i * 5) % 16), hy - 10 + i * 2, 10 - (i % 3) * 2, 1); // moon path
  g.fillStyle = '#8fa0c8'; for (let x = 0; x < UW; x += 2) g.fillRect(x, hy + 7, 2, 1);
  g.fillStyle = '#3b3f52'; g.fillRect(0, hy + 9, UW, 3);
  g.fillStyle = '#56596a'; g.fillRect(0, hy + 12, UW, UH - hy - 12);
  g.fillStyle = '#4b4e5e'; for (let y = hy + 13; y < UH; y += 3) for (let x = (y * 7) % 11; x < UW; x += 11) g.fillRect(x, y, 1, 1);
  return c;
}

// Animated sky and sea details, drawn over the backdrop on the UI grid every frame.
const STARS = (() => { const r = seeded(9); return Array.from({ length: 40 }, () => [Math.floor(r() * UW), Math.floor(r() * 30), r() * 6.28]); })();
// The painted backdrop is drawn a little larger than the screen, so it can slide with the camera's turn and tilt.
const BG_S = 1.16, BG = { s: 1, x: 0, y: 0 };
let skyTop = null;
function drawBackdrop() {
  const img = skyCache || (skyCache = backdropFor());
  if (!skyTop) { const [r, g, b] = img.getContext('2d').getImageData(1, 0, 1, 1).data; skyTop = `rgb(${r},${g},${b})`; }
  const hb = horizonY(), hn = horizonNow();
  BG.s = BG_S; BG.x = W / 2 - (W / 2) * BG_S - (G.cam.yaw || 0) * CAM.F; BG.y = hn - hb * BG_S;
  if (BG.y > 0) { ctx.fillStyle = skyTop; ctx.fillRect(0, 0, W, BG.y + 1); }
  ctx.drawImage(img, BG.x, BG.y, W * BG_S, H * BG_S);
}
function drawSkyFx() {
  if (venue().mode !== 2) return;
  const tod = settings.time, hy = Math.round(horizonY() * US), t = G.time;
  ctx.save(); ctx.setTransform(U * BG.s, 0, 0, U * BG.s, BG.x * S, BG.y * S);
  if (tod === 'night') {
    for (const [x, y, ph] of STARS) if (y < hy - 14 && Math.sin(t * 2 + ph) > 0.3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); }
    const lx = LIGHT_X, ly = lighthouseBase(hy) - 16, a = t * 1.2, reach = Math.cos(a) * 140; // lighthouse beam sweeps around
    ctx.fillStyle = 'rgba(255,243,176,0.14)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + reach, ly - 6); ctx.lineTo(lx + reach, ly + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) if (Math.sin(t * 6 + i * 2) > 0.5) ctx.fillRect(424 + i * 4, hy - 8 + i * 3, 2, 1);
  } else {
    const dark = tod === 'sunset';
    for (let i = 0; i < 5; i++) { // gulls
      const x = ((t * (8 + i * 2) + i * 97) % (UW + 40)) - 20, y = 6 + ((i * 7) % 18) + Math.sin(t * 1.5 + i) * 2, up = Math.sin(t * 9 + i * 2) > 0;
      ctx.fillStyle = dark ? '#2a1830' : '#ffffff';
      ctx.fillRect(x - 3, y + (up ? -1 : 0), 3, 1); ctx.fillRect(x + 1, y + (up ? -1 : 0), 3, 1); ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 2; i++) { // sailboats
      const x = ((t * (2 + i) + 180 + i * 170) % (UW + 30)) - 15, y = hy - 9 + i * 3 + Math.round(Math.sin(t * 2 + i));
      ctx.fillStyle = dark ? '#2a1830' : '#4a3a2a'; ctx.fillRect(x - 4, y, 9, 2);
      ctx.fillStyle = dark ? '#3a2240' : '#ffffff'; for (let k = 0; k < 6; k++) ctx.fillRect(x, y - 1 - k, Math.max(1, 5 - k), 1);
    }
    ctx.fillStyle = dark ? '#ffd27a' : '#ffffff';
    for (let i = 0; i < 10; i++) if (Math.sin(t * 5 + i * 1.7) > 0.6) ctx.fillRect((i * 53 + 17) % UW, hy - 10 + (i * 3) % 14, 2, 1);
  }
  ctx.restore();
}

// ===================== venues: the arena (6 v 6) and the beach (2 v 2), with crowds =====================
function seeded(n) { return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Indoor backdrop, drawn once at low resolution: arena walls, light rigs and banners above, the blue floor below.
function buildArena() {
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#0f1424', '#141a2e', '#182038', '#1c2642', '#212c4c', '#263256'];
  const bh = Math.ceil(hy / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  // light rigs
  for (let row = 0; row < 2; row++) {
    const y = 8 + row * 14;
    g.fillStyle = '#2d3550'; g.fillRect(0, y + 3, UW, 2);
    for (let x = 6 + row * 10; x < UW; x += 22) {
      g.fillStyle = '#fff6d0'; g.fillRect(x, y, 6, 3);
      g.fillStyle = 'rgba(255,246,208,0.12)'; g.fillRect(x - 3, y + 3, 12, 10);
    }
  }
  // championship banners hanging from the rafters
  const cols = ['#ff5d5d', '#3fa7ff', '#ffcf33', '#6bd88a', '#c48bff', '#ff9a3c'];
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 52, col = cols[i % cols.length];
    g.fillStyle = col; g.fillRect(x, 36, 18, 22);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 54, 18, 4);
    g.fillStyle = '#ffffff'; g.fillRect(x + 7, 41, 4, 4); g.fillRect(x + 4, 48, 10, 2);
    g.fillStyle = col; g.fillRect(x, 58, 9, 3);
  }
  // upper concourse glow along the wall
  g.fillStyle = '#323c62'; g.fillRect(0, hy - 34, UW, 3);
  g.fillStyle = '#3c4772'; g.fillRect(0, hy - 31, UW, 31);
  g.fillStyle = '#2a3354';
  for (let x = 0; x < UW; x += 6) g.fillRect(x, hy - 31 + ((x / 6) % 2) * 2, 3, 31);
  // floor: blue free zone with faint boards
  g.fillStyle = '#2f5d9e'; g.fillRect(0, hy, UW, UH - hy);
  g.fillStyle = '#2a5592';
  for (let y = hy + 2; y < UH; y += 4) g.fillRect(0, y, UW, 1);
  return c;
}

// Stands and fans, in world coordinates so they move with the camera. Built once per match.
// More painted backdrops (UI grid, UW x UH), one per venue style.
function buildArenaBig() { // mega bowl: roof trusses and big light rigs above
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#0b0f1c', '#0f1424', '#131a2e', '#172038'];
  const bh = Math.ceil(hy / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  g.fillStyle = '#26304c';
  for (let x = -40; x < UW + 40; x += 30) { g.fillRect(x, 0, 2, hy); for (let y = 0; y < hy; y += 2) g.fillRect(x + y * 0.6, y, 1, 1); }
  for (let y = 6; y < hy; y += 12) g.fillRect(0, y, UW, 1);
  for (let x = 10; x < UW; x += 40) { g.fillStyle = '#fffbe6'; g.fillRect(x, 4, 14, 4); g.fillStyle = 'rgba(255,246,208,0.10)'; g.fillRect(x - 6, 8, 26, 30); }
  g.fillStyle = '#2f5d9e'; g.fillRect(0, hy, UW, UH - hy);
  g.fillStyle = '#2a5592'; for (let y = hy + 2; y < UH; y += 4) g.fillRect(0, y, UW, 1);
  return c;
}
function buildNight() { // championship night: dark roof and light rigs
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  g.fillStyle = '#05070d'; g.fillRect(0, 0, UW, hy);
  g.fillStyle = '#121828'; for (let x = 0; x < UW; x += 24) g.fillRect(x, 0, 1, hy);
  for (let x = 30; x < UW; x += 70) { g.fillStyle = '#ffffff'; g.fillRect(x, 6, 6, 3); g.fillStyle = '#ffcf33'; g.fillRect(x + 1, 9, 4, 1); }
  g.fillStyle = '#1b2d52'; g.fillRect(0, hy, UW, UH - hy);
  g.fillStyle = '#18284a'; for (let y = hy + 2; y < UH; y += 4) g.fillRect(0, y, UW, 1);
  return c;
}
function buildSunset() { // sunset over the water, palms in silhouette, orange sand
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#2b1d4f', '#46245e', '#6b2c69', '#93366b', '#c2466a', '#e7646a', '#f8875f', '#ffad5c', '#ffd27a'];
  const bh = Math.ceil((hy - 10) / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  pixelDisc(g, 300, hy - 10, 16, '#ffe9a8'); pixelDisc(g, 300, hy - 10, 12, '#fff6d6');
  g.fillStyle = '#5a2f63'; g.fillRect(0, hy - 10, UW, 18);           // the sea
  g.fillStyle = '#7a3a6a'; g.fillRect(0, hy - 4, UW, 12);
  g.fillStyle = '#ffcf7a'; for (let i = 0; i < 8; i++) g.fillRect(284 + ((i * 7) % 20), hy - 8 + i * 2, 12 - (i % 3) * 3, 1); // sun on the water
  g.fillStyle = '#2a1830'; // pier
  g.fillRect(0, hy - 16, 120, 3); for (let x = 4; x < 120; x += 12) g.fillRect(x, hy - 14, 2, 10);
  g.fillStyle = '#e8b47c'; g.fillRect(0, hy + 8, UW, UH - hy - 8);
  g.fillStyle = '#d89f68'; for (let y = hy + 10; y < UH; y += 3) for (let x = (y * 7) % 11; x < UW; x += 11) g.fillRect(x, y, 1, 1);
  for (const [px, sc] of [[150, 0.9], [196, 0.7], [420, 1.0], [462, 0.8]]) { // palm silhouettes
    const by = hy + 8, h = Math.round(46 * sc);
    g.fillStyle = '#2a1830';
    for (let i = 0; i < h; i++) g.fillRect(px + Math.round(Math.sin(i / h * 1.3) * 5 * sc), by - i, Math.max(2, Math.round(3 * sc)), 1);
    const tx = px + Math.round(Math.sin(1.3) * 5 * sc), ty = by - h;
    for (const a of [-2.8, -2.2, -1.6, -1.0, -0.4, 0.2]) for (let t = 0; t < 20 * sc; t++) g.fillRect(Math.round(tx + Math.cos(a) * t), Math.round(ty + Math.sin(a) * t * 0.55 + t * t * 0.035), 2, 2);
  }
  return c;
}

// The venues you can pick on the title screen. Stands are built in world coordinates from these settings:
// tiers along each sideline and behind the far end; a deck with `base` > 0 is an upper deck.
const ARENA_SEATS = { riser: ['#20283f', '#262f4a'], seat: ['#33406a', '#2b365a'] };
const VENUES = {
  beach: { mode: 2, name: 'Bleachers', backdrop: 'beach', court: 'sand', shirts: 'beach',
    decks: [{ tiers: 4, endTiers: 3, rise: 0.45, depth: 0.85, gap: 3.0, base: 0, fill: 0.72, riser: ['#7a5232', '#8a5e3a'], seat: ['#c98d55', '#b97f4a'] }] },
  pro: { mode: 2, name: 'Pro tour stadium', backdrop: 'beach', court: 'sand', shirts: 'beach', extras: ['sponsors', 'flags'],
    decks: [{ tiers: 10, endTiers: 3, rise: 0.62, depth: 0.9, gap: 3.6, base: 0, fill: 0.88, riser: ['#8f98ab', '#7f889b'], seat: ['#3a7bd5', '#2f6bc0'] }] },
  boardwalk: { mode: 2, name: 'Boardwalk', backdrop: 'beach', court: 'sand', shirts: 'beach', extras: ['rope', 'umbrellas', 'tower', 'lights'],
    decks: [], standing: { rows: 3, gap: 2.8 } },
  arena: { mode: 6, name: 'Classic arena', backdrop: buildArena, court: '#e0904c', shirts: 'arena', extras: ['led'],
    decks: [{ tiers: 7, endTiers: 6, rise: 0.55, depth: 0.95, gap: 3.4, base: 0, fill: 0.92, ...ARENA_SEATS }] },
  bowl: { mode: 6, name: 'Mega bowl', backdrop: buildArenaBig, court: '#e0904c', shirts: 'arena', extras: ['led'],
    decks: [
      { tiers: 10, endTiers: 10, rise: 0.6, depth: 0.9, gap: 3.4, base: 0, fill: 0.93, ...ARENA_SEATS },
      { tiers: 12, endTiers: 12, rise: 0.85, depth: 1.0, gap: 3.4 + 9 + 2.2, base: 6 + 2.0, fill: 0.9, riser: ['#1a2036', '#20273f'], seat: ['#3a2f6a', '#32285c'], ribbon: true },
    ] },
  night: { mode: 6, name: 'Championship night', backdrop: buildNight, court: '#d9874a', shirts: 'arena', extras: ['led', 'phones', 'lasers', 'dark'], teamSides: true,
    decks: [{ tiers: 14, endTiers: 13, rise: 0.72, depth: 0.95, gap: 3.4, base: 0, fill: 0.95, riser: ['#141a2c', '#181f34'], seat: ['#222a44', '#1d243b'] }] },
};
const VENUE_DESC = {
  beach: 'Wooden bleachers along the sand, with palms, the sea and an island lighthouse behind.',
  pro: 'Tall grandstands on both sides, sponsor boards and corner flags, like a pro beach tour stop.',
  boardwalk: 'No stands: fans stand three deep behind a rope line, with umbrellas, a lifeguard tower and string lights.',
  arena: 'A busy indoor gym with stands on three sides and LED boards around the court.',
  bowl: 'A huge two-deck arena: a lower bowl, a concourse with an LED ribbon board, and a steep upper deck rising to the roof.',
  night: 'A dark, packed bowl: the crowd is split into blue and red halves, phone lights twinkle and lasers fly overhead.',
};
const venue = () => VENUES[settings.venue[settings.mode]];
const TIMES = { day: 'Day', sunset: 'Sunset', night: 'Night' };
function backdropFor() {
  const V = venue();
  if (V.backdrop !== 'beach') return V.backdrop();
  return { day: buildSky, sunset: buildSunset, night: buildBeachNight }[settings.time]();
}

let crowdCache = null;
function buildCrowd() {
  const V = venue(), arena = V.mode === 6, rnd = seeded(arena ? 61 : 23);
  const shirts = V.shirts === 'arena'
    ? ['#3fa7ff', '#3fa7ff', '#ff5d5d', '#ff5d5d', '#ffffff', '#ffcf33', '#2b2f3f', '#6bd88a', '#c48bff']
    : ['#ff6b6b', '#ffcf33', '#4fd2ff', '#ffffff', '#ff9a3c', '#6bd88a', '#f49ac0', '#3fa7ff'];
  const skins = ['#f1c9a0', '#d9a477', '#b07a4f', '#8a5a3a', '#f6dcc0'];
  const person = (x, y, z, key, sd, standing) => ({
    x, y, z, key, standing,
    shirt: V.teamSides && sd ? (rnd() < 0.8 ? TEAM_COLORS[sd < 0 ? 0 : 1] : shirts[Math.floor(rnd() * shirts.length)]) : shirts[Math.floor(rnd() * shirts.length)],
    skin: skins[Math.floor(rnd() * skins.length)],
    hat: !arena && rnd() < 0.25 ? ['#ffffff', '#ffcf33', '#ff6b6b'][Math.floor(rnd() * 3)] : null,
    sign: rnd() < 0.05 ? TEAM_COLORS[rnd() < 0.5 ? 0 : 1] : null,
    phone: ((V.extras && V.extras.includes('phones')) || (V.mode === 2 && settings.time === 'night')) && rnd() < 0.08,
    ph: rnd() * 6.28, rate: 3 + rnd() * 3,
  });
  const people = [], tiers = [];
  V.decks.forEach((d, di) => {
    const zEnd = HL + d.gap, X = HW + d.gap, wideX = X + d.depth * d.tiers;
    for (let t = 0; t < d.endTiers; t++) {
      const zi = zEnd + d.depth * t, y0 = d.base + d.rise * t;
      tiers.push({ kind: 'end', d, di, t, zi, zo: zi + d.depth, y0, y1: y0 + d.rise, X: wideX, key: `e${di}.${t}` });
      for (let x = -X + 0.4; x <= X - 0.4; x += 0.72) if ((Math.abs(x) % 9) > 0.8 && rnd() < d.fill) people.push(person(x + (rnd() - 0.5) * 0.25, y0 + d.rise, zi + d.depth * 0.5, `e${di}.${t}`, 0));
    }
    for (const sd of [-1, 1]) for (let t = 0; t < d.tiers; t++) {
      const xi = sd * (X + d.depth * t), y0 = d.base + d.rise * t;
      tiers.push({ kind: 'side', d, di, t, sd, xi, xo: xi + sd * d.depth, y0, y1: y0 + d.rise, z0: -HL - 2, z1: zEnd, key: `s${di}.${sd}.${t}` });
      for (let z = -HL - 1.5; z <= zEnd - 0.4; z += 0.72) if (((z + 40) % 8) > 0.8 && rnd() < d.fill) people.push(person(xi + sd * d.depth * 0.5 + (rnd() - 0.5) * 0.25, y0 + d.rise, z + (rnd() - 0.5) * 0.3, `s${di}.${sd}.${t}`, sd));
    }
  });
  if (V.standing) { // fans standing on the sand behind a rope line
    const { rows, gap } = V.standing;
    for (let r = rows - 1; r >= 0; r--) {
      const off = gap + r * 0.7, key = `st${r}`;
      for (const sd of [-1, 1]) for (let z = -HL - 1; z <= HL + gap; z += 0.62) if (rnd() < 0.8) people.push(person(sd * (HW + off) + (rnd() - 0.5) * 0.3, 0, z + (rnd() - 0.5) * 0.3, key, sd, true));
      for (let x = -HW - gap; x <= HW + gap; x += 0.62) if (rnd() < 0.8) people.push(person(x + (rnd() - 0.5) * 0.3, 0, HL + off + (rnd() - 0.5) * 0.3, key, 0, true));
    }
  }
  // back to front: upper decks before lower ones, outer tiers before inner ones, the far end before the sides
  tiers.sort((a, b) => (b.di - a.di) || ((a.kind === 'end' ? 0 : 1) - (b.kind === 'end' ? 0 : 1)) || (b.t - a.t));
  const byKey = new Map();
  for (const q of people) { if (!byKey.has(q.key)) byKey.set(q.key, []); byKey.get(q.key).push(q); }
  const um = [];
  if (V.extras && V.extras.includes('umbrellas')) for (let i = 0; i < 14; i++) {
    const sd = i % 2 ? 1 : -1, end = i % 5 === 0;
    um.push(end ? { x: rand(-HW, HW), z: HL + V.standing.gap + 3 + rnd() * 3 } : { x: sd * (HW + V.standing.gap + 3 + rnd() * 3), z: -HL + rnd() * 2 * HL },
      );
    um[um.length - 1].col = ['#ff5d5d', '#ffcf33', '#3fa7ff', '#6bd88a', '#ffffff'][i % 5];
  }
  const palms = [];
  if (V.mode === 2) {
    const d = V.decks[0], back = d ? HW + d.gap + d.depth * d.tiers + 2 : HW + (V.standing ? V.standing.gap : 3) + 5.5;
    const endZ = d ? HL + d.gap + d.depth * d.endTiers + 2.5 : HL + 9;
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) palms.push({ x: sd * (back + rnd() * 2), z: -HL + i * (2 * HL / 3) + rnd() * 2, h: 7 + rnd() * 3, v: Math.floor(rnd() * 3), flip: sd > 0 });
    for (let i = 0; i < 5; i++) palms.push({ x: -HW - 4 + i * (2 * HW + 8) / 4 + rnd(), z: endZ + rnd() * 2, h: 8 + rnd() * 3, v: Math.floor(rnd() * 3), flip: rnd() < 0.5 });
    palms.sort((a, b) => b.z - a.z);
  }
  return { V, people, tiers, byKey, um, palms };
}

function quad(pts, col) {
  const P = pts.map(([x, y, z]) => proj(x, y, z));
  ctx.fillStyle = col; ctx.beginPath();
  P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.fill();
}

function drawFan(q) {
  const bob = Math.abs(Math.sin(G.time * q.rate + q.ph)) * (0.03 + G.cheer * 0.22);
  const f = proj(q.x, q.y + bob, q.z);
  if (f.x < -40 || f.x > W + 40 || f.y < -40 || f.y > H + 60) return;
  const k = f.k, tall = q.standing ? 1.7 : 1;
  const w = Math.max(2, 0.42 * k), h = Math.max(2, 0.5 * k * tall), hd = Math.max(2, 0.27 * k);
  ctx.fillStyle = q.shirt; ctx.fillRect(f.x - w / 2, f.y - h, w, h);
  ctx.fillStyle = q.skin; ctx.fillRect(f.x - hd / 2, f.y - h - hd, hd, hd);
  if (q.hat) { ctx.fillStyle = q.hat; ctx.fillRect(f.x - hd * 0.7, f.y - h - hd, hd * 1.4, Math.max(2, hd * 0.35)); }
  if (G.cheer > 0.25 && Math.sin(q.ph * 7) > -0.2) { // arms up after a point
    ctx.fillStyle = q.skin;
    ctx.fillRect(f.x - w / 2 - hd * 0.3, f.y - h - hd * 1.3, Math.max(2, hd * 0.35), hd * 1.1);
    ctx.fillRect(f.x + w / 2 - hd * 0.05, f.y - h - hd * 1.3, Math.max(2, hd * 0.35), hd * 1.1);
  }
  if (q.sign) { ctx.fillStyle = q.sign; ctx.fillRect(f.x - w * 0.9, f.y - h - hd * 2.2, w * 1.8, hd * 1.1); }
  if (q.phone && Math.sin(G.time * 2 + q.ph * 5) > 0.3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x + w * 0.3, f.y - h - hd * 1.6, Math.max(2, hd * 0.4), Math.max(2, hd * 0.4)); }
}

function drawStands() {
  const C = crowdCache || (crowdCache = buildCrowd()), V = C.V, ex = V.extras || [];
  for (const T of C.tiers) {
    const d = T.d;
    if (T.t === 0 && d.base > 0) { // an upper deck's front wall, topped by a glowing LED ribbon board
      if (T.kind === 'end') { quad([[-T.X, 0, T.zi], [T.X, 0, T.zi], [T.X, d.base, T.zi], [-T.X, d.base, T.zi]], '#141a2e'); quad([[-T.X, d.base - 0.9, T.zi], [T.X, d.base - 0.9, T.zi], [T.X, d.base, T.zi], [-T.X, d.base, T.zi]], ribbonColor()); }
      else { quad([[T.xi, 0, T.z0], [T.xi, 0, T.z1], [T.xi, d.base, T.z1], [T.xi, d.base, T.z0]], '#141a2e'); quad([[T.xi, d.base - 0.9, T.z0], [T.xi, d.base - 0.9, T.z1], [T.xi, d.base, T.z1], [T.xi, d.base, T.z0]], ribbonColor()); }
    }
    if (T.kind === 'end') {
      quad([[-T.X, T.y1, T.zo], [T.X, T.y1, T.zo], [T.X, T.y1, T.zi], [-T.X, T.y1, T.zi]], d.seat[T.t % 2]);
      quad([[-T.X, T.y0, T.zi], [T.X, T.y0, T.zi], [T.X, T.y1, T.zi], [-T.X, T.y1, T.zi]], d.riser[T.t % 2]);
    } else {
      quad([[T.xi, T.y1, T.z0], [T.xi, T.y1, T.z1], [T.xo, T.y1, T.z1], [T.xo, T.y1, T.z0]], d.seat[T.t % 2]);
      quad([[T.xi, T.y0, T.z0], [T.xi, T.y0, T.z1], [T.xi, T.y1, T.z1], [T.xi, T.y1, T.z0]], d.riser[T.t % 2]);
    }
    for (const q of C.byKey.get(T.key) || []) drawFan(q);
  }
  for (let r = 2; r >= 0; r--) for (const q of C.byKey.get(`st${r}`) || []) drawFan(q);
  const z0 = -HL - 2;
  if (ex.includes('led')) { // LED ad boards around the court
    const bx = HW + 2.9, zEnd = HL + 2.9, h = 0.8, cols = ['#ff5d5d', '#3fa7ff', '#ffcf33', '#1b2236'];
    for (let i = 0, z = z0; z < zEnd; z += 2.4, i++) for (const sd of [-1, 1]) quad([[sd * bx, 0, z], [sd * bx, 0, z + 2.4], [sd * bx, h, z + 2.4], [sd * bx, h, z]], cols[(i + (sd > 0 ? 2 : 0)) % cols.length]);
    for (let i = 0, x = -bx; x < bx; x += 2.4, i++) quad([[x, 0, zEnd], [x + 2.4, 0, zEnd], [x + 2.4, h, zEnd], [x, h, zEnd]], cols[(i + 1) % cols.length]);
  }
  if (ex.includes('sponsors')) { // painted sponsor boards on the sand
    const bx = HW + 3.0, zEnd = HL + 3.0, h = 0.9, logos = ['#ff5d5d', '#3fa7ff', '#ffcf33', '#6bd88a'];
    const board = (a, b, i, side) => {
      quad([[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]]], '#f4f6fb');
      const m = (u, v) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, v];
      const p0 = m(0.2, 0), p1 = m(0.8, 0);
      quad([[p0[0], 0.25, p0[1]], [p1[0], 0.25, p1[1]], [p1[0], 0.65, p1[1]], [p0[0], 0.65, p0[1]]], logos[(i + side) % logos.length]);
    };
    for (let i = 0, z = z0; z < zEnd; z += 3, i++) for (const sd of [-1, 1]) board([sd * bx, z], [sd * bx, z + 3], i, sd > 0 ? 2 : 0);
    for (let i = 0, x = -bx; x < bx; x += 3, i++) board([x, zEnd], [x + 3, zEnd], i, 1);
  }
  if (ex.includes('rope')) { // posts and a rope line around the court
    const gx = HW + V.standing.gap - 0.8, gz = HL + V.standing.gap - 0.8;
    ctx.strokeStyle = '#f0e2c0'; ctx.lineWidth = 3;
    const line = pts => { ctx.beginPath(); pts.forEach(([x, z], i) => { const p = proj(x, 0.8, z); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); };
    line([[-gx, z0], [-gx, gz], [gx, gz], [gx, z0]]);
    for (const [x, z] of [[-gx, gz], [gx, gz], ...Array.from({ length: 8 }, (_, i) => [-gx, z0 + i * 4]), ...Array.from({ length: 8 }, (_, i) => [gx, z0 + i * 4])]) {
      const a = proj(x, 0, z), b = proj(x, 1.0, z); ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, 0.12 * a.k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  if (ex.includes('umbrellas')) for (const u of C.um) {
    const a = proj(u.x, 0, u.z), b = proj(u.x, 2.2, u.z), r = 1.2 * b.k;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, 0.08 * a.k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = u.col; ctx.beginPath(); ctx.moveTo(b.x - r, b.y + r * 0.3); ctx.lineTo(b.x, b.y - r * 0.35); ctx.lineTo(b.x + r, b.y + r * 0.3); ctx.closePath(); ctx.fill();
  }
  if (ex.includes('tower')) { // lifeguard tower
    const x = HW + 8, z = HL - 2, legs = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
    ctx.strokeStyle = '#f4f6fb'; ctx.lineWidth = 4;
    for (const [dx, dz] of legs) { const a = proj(x + dx, 0, z + dz), b = proj(x + dx, 2.4, z + dz); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    quad([[x - 1, 2.4, z - 1], [x + 1, 2.4, z - 1], [x + 1, 3.6, z - 1], [x - 1, 3.6, z - 1]], '#f4f6fb');
    quad([[x - 1.3, 3.6, z - 1.2], [x + 1.3, 3.6, z - 1.2], [x, 4.4, z - 1.2], [x, 4.4, z - 1.2]], '#ff5d5d');
  }
  if (ex.includes('lights')) { // string lights along the boardwalk
    for (const sd of [-1, 1]) {
      const x = sd * (HW + V.standing.gap + 3.2);
      for (let z = -HL; z < HL + 4; z += 6) {
        const a = proj(x, 0, z), b = proj(x, 3.4, z); ctx.strokeStyle = '#3a2232'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        for (let i = 1; i < 10; i++) { const u = i / 10, p = proj(x, 3.4 - Math.sin(u * Math.PI) * 0.7, z + u * 6); ctx.fillStyle = i % 2 ? '#ffe9a0' : '#ffb35c'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      }
    }
  }
  if (ex.includes('flags')) { // corner flags
    for (const [x, z] of [[-HW - 1.4, -HL - 1.4], [HW + 1.4, -HL - 1.4], [-HW - 1.4, HL + 1.4], [HW + 1.4, HL + 1.4]]) {
      const a = proj(x, 0, z), b = proj(x, 4.5, z), wv = Math.sin(G.time * 5 + x) * 0.25;
      ctx.strokeStyle = '#d9dde6'; ctx.lineWidth = Math.max(2, 0.08 * a.k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      quad([[x, 4.5, z], [x + 1.4, 4.2 + wv, z], [x, 3.7, z], [x, 3.7, z]], x < 0 ? TEAM_COLORS[0] : TEAM_COLORS[1]);
    }
  }
}
// Props around the court, in world coordinates: referee stand, benches and table indoors, palms and beach gear outside.
function seatedPerson(x, y, z, shirt) { drawFan({ x, y, z, shirt, skin: '#e0b48a', ph: x * 3 + z, rate: 2, standing: false }); }
// Pixel-art palm trees: three shapes, painted once per time of day, then drawn in perspective like the sprites.
const PALM_W = 72, PALM_H = 104, PALM_BASE = 30; // sprite size and where the trunk meets the sand
const PALM_COLORS = {
  day:    { bark: '#8a5a35', ring: '#6e4428', lit: '#b07a4f', rib: '#2c6e34', leaf: '#3f9b4a', tip: '#6cc04a', nut: '#5a3a1e' },
  sunset: { bark: '#6e3f34', ring: '#552e2a', lit: '#9a5a44', rib: '#2a4a32', leaf: '#3b6a3c', tip: '#6f8f46', nut: '#3e2622' },
  night:  { bark: '#2c2a3a', ring: '#222030', lit: '#3d3a52', rib: '#142228', leaf: '#1d3036', tip: '#2c4a4c', nut: '#1a1824' },
};
let palmCache = null;
function buildPalms() {
  const out = {};
  for (const [tod, C] of Object.entries(PALM_COLORS)) {
    out[tod] = [0, 1, 2].map(v => {
      const c = document.createElement('canvas'); c.width = PALM_W; c.height = PALM_H; const g = c.getContext('2d');
      const r = seeded(31 + v * 17), lean = [10, 16, 6][v], topY = [26, 22, 30][v];
      const px = (x, y, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
      // trunk: curved, tapering, with ring bands and a lit edge
      let cx = PALM_BASE, cy = PALM_H - 1;
      const steps = PALM_H - 1 - topY;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, x = PALM_BASE + lean * t * t, y = PALM_H - 1 - i, w = Math.round(6 - 2.5 * t);
        for (let k = 0; k < w; k++) px(x - w / 2 + k, y, i % 5 === 0 ? C.ring : k === 0 ? C.lit : C.bark);
        cx = x; cy = y;
      }
      // fronds: a dark rib with leaflets hanging off both sides, drooping at the ends
      const angles = [-2.9, -2.45, -1.95, -1.4, -0.95, -0.45, 0.05, -1.65].map(a => a + (r() - 0.5) * 0.25);
      for (const a of angles) {
        const L = 22 + r() * 10, dx = Math.cos(a), dy = Math.sin(a);
        for (let sgm = 0; sgm < L; sgm++) {
          const fx = cx + dx * sgm, fy = cy + dy * sgm * 0.75 + sgm * sgm * 0.028;
          px(fx, fy, C.rib); px(fx, fy + 1, C.rib);
          if (sgm > 3 && sgm % 2 === 0) {
            const len = Math.max(2, Math.round(5 - sgm / L * 3));
            for (let q = 1; q <= len; q++) {
              px(fx - dy * q * 0.5 + q * 0.15, fy + q, q === len ? C.tip : C.leaf);
              px(fx + dy * q * 0.5 + q * 0.15, fy + q * 0.6 + 1, q === len ? C.tip : C.leaf);
            }
          }
        }
      }
      for (const [ox, oy] of [[-2, 2], [1, 3], [3, 1]]) { g.fillStyle = C.nut; g.fillRect(Math.round(cx + ox), Math.round(cy + oy), 3, 3); }
      return c;
    });
  }
  return out;
}
function drawPalm(x, z, h, v = 0, flip = false) {
  const tod = venue().mode === 2 ? settings.time : 'day';
  const img = (palmCache || (palmCache = buildPalms()))[tod][v % 3];
  const f = proj(x, 0, z), ph = h * f.k, sc = ph / PALM_H, w = PALM_W * sc;
  ctx.save(); ctx.translate(f.x, f.y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -PALM_BASE * sc, -ph, w, ph);
  ctx.restore();
}
const TIME_DARK = () => venue().mode === 2 && settings.time === 'night';
function drawRefStand() { // the up referee's tall chair at the right-hand net post
  const x = HW + 1.4, z = 0;
  ctx.strokeStyle = '#d9dde6'; ctx.lineWidth = 4;
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { const a = proj(x + dx, 0, z + dz), b = proj(x + dx * 0.6, 1.8, z + dz * 0.6); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  quad([[x - 0.5, 1.8, z - 0.5], [x + 0.5, 1.8, z - 0.5], [x + 0.5, 1.8, z + 0.5], [x - 0.5, 1.8, z + 0.5]], '#9aa3b5');
  drawFan({ x, y: 1.8, z, shirt: '#1b1f2a', skin: '#e0b48a', ph: 1, rate: 1, standing: true });
}
function drawProps() {
  const V = venue(), C = crowdCache;
  drawRefStand();
  if (V.mode === 6) {
    const x = -(HW + 1.9); // scorer's table at the net and team benches along the left sideline
    quad([[x, 0, -1.6], [x, 0, 1.6], [x, 0.8, 1.6], [x, 0.8, -1.6]], '#1b2236');
    quad([[x, 0.62, -1.6], [x, 0.62, 1.6], [x, 0.8, 1.6], [x, 0.8, -1.6]], '#ffcf33');
    seatedPerson(x - 0.5, 0.45, -0.7, '#ffffff'); seatedPerson(x - 0.5, 0.45, 0.7, '#ffffff');
    for (const [z0, z1, col] of [[-HL * 0.6, -3, TEAM_COLORS[0]], [3, HL * 0.6, TEAM_COLORS[1]]]) {
      quad([[x - 0.3, 0, z0], [x - 0.3, 0, z1], [x - 0.3, 0.45, z1], [x - 0.3, 0.45, z0]], '#3a4466');
      quad([[x - 0.3, 0.45, z0], [x - 0.3, 0.45, z1], [x - 0.8, 0.45, z1], [x - 0.8, 0.45, z0]], col);
      quad([[x + 0.1, 0, z1 + 0.3], [x + 0.1, 0, z1 + 0.8], [x + 0.1, 0.7, z1 + 0.8], [x + 0.1, 0.7, z1 + 0.3]], '#4fa3ff'); // water cooler
    }
    return;
  }
  // beach: palms beyond the stands, and gear at the near corners
  for (const p of C.palms) drawPalm(p.x, p.z, p.h, p.v, p.flip);
  if (settings.time === 'night') drawLightPoles();
  for (const sd of [-1, 1]) {
    const x = sd * (HW + 1.6), z = -HL - 0.8;
    quad([[x - 0.35, 0, z], [x + 0.35, 0, z], [x + 0.35, 0.45, z], [x - 0.35, 0.45, z]], sd < 0 ? '#3fa7ff' : '#ff5d5d'); // cooler
    quad([[x - 0.35, 0.45, z], [x + 0.35, 0.45, z], [x + 0.35, 0.5, z + 0.45], [x - 0.35, 0.5, z + 0.45]], '#ffffff');
    const bx = sd * (HW + 2.3), bz = -HL + 1.2; // surfboard stuck in the sand
    quad([[bx - 0.22, 0, bz], [bx + 0.22, 0, bz], [bx + 0.15, 2.0, bz], [bx - 0.15, 2.0, bz]], sd < 0 ? '#ffcf33' : '#6bd88a');
    quad([[bx - 0.04, 0, bz], [bx + 0.04, 0, bz], [bx + 0.04, 2.0, bz], [bx - 0.04, 2.0, bz]], '#ffffff');
  }
}

// Indoors: the far wall behind the end stand, with lit suites, exit signs, banners and a video board showing the score.
function drawArenaWall() {
  const V = venue(); if (V.mode !== 6 || V.decks.length !== 1) return;
  const d = V.decks[0], z = HL + d.gap + d.depth * d.endTiers + 0.2, top = d.base + d.rise * d.endTiers, X = HW + d.gap + d.depth * d.tiers + 4;
  const night = (V.extras || []).includes('dark');
  quad([[-X, 0, z], [X, 0, z], [X, top + 9, z], [-X, top + 9, z]], night ? '#0b0f1c' : '#1a2140');
  quad([[-X, top + 0.6, z - 0.01], [X, top + 0.6, z - 0.01], [X, top + 2.4, z - 0.01], [-X, top + 2.4, z - 0.01]], night ? '#141a2c' : '#262f52');
  for (let x = -X + 0.6, i = 0; x < X - 1; x += 2.2, i++) // suite windows
    quad([[x, top + 0.9, z - 0.02], [x + 1.7, top + 0.9, z - 0.02], [x + 1.7, top + 2.1, z - 0.02], [x, top + 2.1, z - 0.02]], (i * 7) % 5 === 0 ? '#3a4466' : night ? '#ffd27a' : '#fff1b8');
  for (const sx of [-1, 1]) { // exit signs and banners
    const ex = sx * (X - 2);
    quad([[ex - 0.6, top + 3, z - 0.02], [ex + 0.6, top + 3, z - 0.02], [ex + 0.6, top + 3.5, z - 0.02], [ex - 0.6, top + 3.5, z - 0.02]], '#2bd16b');
    for (let k = 0; k < 2; k++) { const bx = sx * (8 + k * 3.2), col = k ? TEAM_COLORS[sx < 0 ? 0 : 1] : '#ffcf33';
      quad([[bx - 1, top + 3.2, z - 0.02], [bx + 1, top + 3.2, z - 0.02], [bx + 1, top + 7.5, z - 0.02], [bx - 1, top + 7.5, z - 0.02]], col);
      quad([[bx - 0.4, top + 5.4, z - 0.03], [bx + 0.4, top + 5.4, z - 0.03], [bx + 0.4, top + 6.4, z - 0.03], [bx - 0.4, top + 6.4, z - 0.03]], '#ffffff'); }
  }
  // video board
  const bw = 5.5, b0 = top + 3.0, b1 = top + 7.6;
  quad([[-bw - 0.3, b0 - 0.3, z - 0.05], [bw + 0.3, b0 - 0.3, z - 0.05], [bw + 0.3, b1 + 0.3, z - 0.05], [-bw - 0.3, b1 + 0.3, z - 0.05]], '#3a4466');
  quad([[-bw, b0, z - 0.06], [bw, b0, z - 0.06], [bw, b1, z - 0.06], [-bw, b1, z - 0.06]], '#05070d');
  const c = proj(0, (b0 + b1) / 2, z), tx = c.x * US, ty = c.y * US;
  if (ty > 2 && ty < UH) {
    const msg = G.cheer > 0.4 ? (Math.floor(G.time * 4) % 2 ? 'MAKE SOME NOISE!' : 'POINT!') : settings.sets > 1 ? `SETS ${G.sets[0]}-${G.sets[1]}` : 'VOLLEYDEX';
    ctx.save(); ctx.setTransform(U, 0, 0, U, 0, 0);
    pxText(msg, tx, ty - 10, '#ffcf33', 8, 'center', null);
    pxText(`${G.score[0]} - ${G.score[1]}`, tx, ty + 1, '#ffffff', 8, 'center', null);
    ctx.restore();
  }
}

function ribbonColor() { const c = ['#3fa7ff', '#ff5d5d', '#ffcf33', '#c48bff']; return c[Math.floor(G.time / 2.5) % c.length]; }

// Light poles at the night beach (drawn with the scene, no beams).
function drawLightPoles() {
  for (const [x, z] of [[-HW - 2.4, -HL - 2.4], [HW + 2.4, -HL - 2.4], [-HW - 2.4, HL + 2.4], [HW + 2.4, HL + 2.4]]) {
    const a = proj(x, 0, z), b = proj(x, 9, z);
    ctx.strokeStyle = '#7d8598'; ctx.lineWidth = Math.max(3, 0.18 * a.k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#3a4152'; ctx.fillRect(b.x - 0.9 * b.k, b.y - 0.45 * b.k, 1.8 * b.k, 0.9 * b.k);
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(b.x - 0.75 * b.k, b.y - 0.3 * b.k, 1.5 * b.k, 0.6 * b.k);
  }
}
// Whole-scene lighting by time of day. Night is an even tint (no spotlights); sunset is warm golden light.
function drawVenueLights() {
  const ex = venue().extras || [];
  if (venue().mode === 2 && settings.time === 'night') { ctx.fillStyle = 'rgba(8,12,34,0.30)'; ctx.fillRect(0, 0, W, H); }
  if (venue().mode === 2 && settings.time === 'sunset') {
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(255,120,80,0.20)'); gr.addColorStop(1, 'rgba(255,170,90,0.08)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  if (ex.includes('lasers')) {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = G.time * 0.8 + i * 1.6;
      ctx.strokeStyle = ['rgba(63,167,255,0.5)', 'rgba(255,93,93,0.5)', 'rgba(196,139,255,0.5)', 'rgba(107,216,138,0.5)'][i];
      ctx.beginPath(); ctx.moveTo(i % 2 ? W : 0, 30); ctx.lineTo(W / 2 + Math.sin(a) * 700, 250 + Math.cos(a * 1.3) * 60); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawCourt() {
  ctx.fillStyle = venue().court === 'sand' ? (settings.time === 'sunset' ? '#efc98f' : '#f7e6b8') : venue().court;
  groundPoly([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]]); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineJoin = 'miter';
  groundPoly([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]]); ctx.stroke();
  ctx.lineWidth = 3;
  groundLine(-HW, 0, HW, 0);
  if (settings.mode === 6) { const a = attackLine(); groundLine(-HW, -a, HW, -a); groundLine(-HW, a, HW, a); } // attack lines
}

function drawNet() {
  const wob = Math.sin(G.time * 40) * 0.04 * G.netWobble;
  // the mesh is a band at the top with open space below, so you can see the far side through it
  const xL = -HW - 0.6, xR = HW + 0.6, top = NET_H, bot = NET_H - 0.5;
  const a = proj(xL, top, wob), b = proj(xR, top, wob), c = proj(xR, bot, wob), d = proj(xL, bot, wob);
  ctx.lineWidth = 8; ctx.strokeStyle = '#d8392f'; ctx.lineCap = 'butt';
  for (const x of [xL, xR]) { const p0 = proj(x, 0, 0), p1 = proj(x, top + 0.1, 0); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(16,20,31,0.18)';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(16,20,31,0.55)'; ctx.lineWidth = 2.7;
  const cols = Math.round((xR - xL) / 0.45);
  for (let i = 0; i <= cols; i++) { const u = i / cols; ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u); ctx.lineTo(d.x + (c.x - d.x) * u, d.y + (c.y - d.y) * u); ctx.stroke(); }
  for (let j = 0; j <= 2; j++) { const v = j / 2; ctx.beginPath(); ctx.moveTo(a.x + (d.x - a.x) * v, a.y + (d.y - a.y) * v); ctx.lineTo(b.x + (c.x - b.x) * v, b.y + (c.y - b.y) * v); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  ctx.lineWidth = 4;
  for (const x of [-HW, HW]) {
    const p0 = proj(x, top, 0), p1 = proj(x, top + 0.8, 0);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? '#ffffff' : '#d8392f';
      ctx.beginPath(); ctx.moveTo(p0.x + (p1.x - p0.x) * i / 4, p0.y + (p1.y - p0.y) * i / 4);
      ctx.lineTo(p0.x + (p1.x - p0.x) * (i + 1) / 4, p0.y + (p1.y - p0.y) * (i + 1) / 4); ctx.stroke();
    }
  }
}

function drawBall(b) {
  const sty = b.trail.find(q => q.c);
  if (sty) drawSpecialTrail(b, sty.c);
  else if (b.trail.length > 2 && Math.hypot(b.vx, b.vy, b.vz) > 11) { // a hard hit leaves a streak, thickest at the ball
    ctx.lineCap = 'round';
    for (let i = 1; i < b.trail.length; i++) {
      const a = proj(b.trail[i - 1].x, b.trail[i - 1].y, b.trail[i - 1].z), c = proj(b.trail[i].x, b.trail[i].y, b.trail[i].z), f = i / b.trail.length;
      const lw = Math.max(2, BR * 2 * c.k * f);
      ctx.globalAlpha = f * 0.5; ctx.strokeStyle = '#10141f'; ctx.lineWidth = lw + 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      ctx.globalAlpha = f * 0.9; ctx.strokeStyle = b.trail[i].c || '#ffffff'; ctx.lineWidth = lw; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < b.trail.length; i++) {
    if (b.trail[i].c) continue; // a special move draws its own trail
    const q = b.trail[i], a = (i + 1) / b.trail.length, p = proj(q.x, q.y, q.z), s = Math.max(4, BR * 2.2 * p.k * (0.4 + a * 0.6));
    ctx.globalAlpha = a * (q.c ? 0.8 : 0.4); ctx.fillStyle = q.c || '#ffffff';
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  const p = proj(b.x, b.y, b.z), r = Math.max(6, BR * 1.4 * p.k);
  if (b.special) { // a glow in the move's colours around the ball
    const [c0, c1] = FX[b.special].cols, pulse = 1 + 0.12 * Math.sin(G.time * 40);
    ctx.globalAlpha = 0.3; ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(p.x, p.y, (r + 11) * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // a chunky pixel ball: dark rim, white body, yellow and blue panels
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#20222e'; ctx.beginPath(); ctx.arc(0, 0, r + 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbfbf2'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); ctx.rotate(b.spin);
  ctx.fillStyle = '#ffcf33'; ctx.fillRect(-r, -r, r * 0.8, r * 2);
  ctx.fillStyle = '#3d7fe0'; ctx.fillRect(r * 0.25, -r, r * 0.8, r * 2);
  ctx.restore(); ctx.restore();
}

function drawParticle(q) {
  const p = proj(q.x, q.y, q.z), t = q.life0 ? 1 - q.life / q.life0 : 0; // t runs 0 to 1 over its life
  const s = Math.max(2.7, q.r * 2 * p.k * (q.grow ? 1 + q.grow * t : 1) * (q.shrink ? 1 - 0.7 * t : 1));
  ctx.globalAlpha = clamp(q.life * 2.5, 0, 1) * (q.a ?? 1);
  ctx.fillStyle = ctx.strokeStyle = q.color;
  switch (q.shape) {
    case 'spark': { // a short streak along its motion
      const e = proj(q.x - q.vx * 0.035, q.y - q.vy * 0.035, q.z - q.vz * 0.035);
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.45);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(e.x, e.y); ctx.stroke(); break;
    }
    case 'leaf':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.9, s * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); break;
    case 'diamond':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot); ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.42, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.42, 0); ctx.closePath(); ctx.fill(); ctx.restore(); break;
    case 'star': { // four points, twinkling
      const k = s * (0.75 + 0.25 * Math.sin(G.time * 30 + q.rot * 5));
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot); ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? k * 0.3 : k; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.restore(); break;
    }
    case 'ring':
      ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.stroke(); break;
    case 'bubble':
      ctx.lineWidth = Math.max(1.2, s * 0.2); ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillRect(p.x - s * 0.3, p.y - s * 0.3, Math.max(1.5, s * 0.2), Math.max(1.5, s * 0.2)); break;
    case 'puff':
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.55, 0, Math.PI * 2); ctx.fill(); break;
    case 'rock':
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot); ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = '#00000055'; ctx.fillRect(-s / 2, s * 0.1, s, s * 0.4); ctx.restore(); break;
    default:
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

// The streak behind a special spike, in the move's style. Thin and faint at the tail, full at the ball.
function drawSpecialTrail(b, ty) {
  const fx = FX[ty] || FX.normal, [c0, c1, c2] = fx.cols;
  const pts = b.trail.filter(q => q.c).map(q => proj(q.x, q.y, q.z));
  pts.push(proj(b.x, b.y, b.z));
  const n = pts.length; if (n < 3) return;
  const nrm = pts.map((q, i) => { // screen-space normal to the path at each point
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)], dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  });
  const W = i => Math.max(2, BR * 3.2 * pts[i].k * (i / (n - 1)));
  const at = (i, off) => ({ x: pts[i].x + nrm[i].x * off, y: pts[i].y + nrm[i].y * off });
  // one tapering line along the path, pushed sideways by off(i)
  const line = (col, alpha, wk, off = () => 0) => {
    ctx.strokeStyle = col;
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1), a = at(i - 1, off(i - 1)), c = at(i, off(i));
      ctx.globalAlpha = alpha * f; ctx.lineWidth = Math.max(1.5, W(i) * wk);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
  };
  ctx.lineCap = ctx.lineJoin = 'round';
  const T = G.time;
  switch (fx.trail) {
    case 'flame': { // flickering, wider than the ball, white-hot at the core
      const fl = i => W(i) * 0.25 * Math.sin(T * 50 + i * 1.7);
      line(c0, 0.45, 2.2, fl); line(c1, 0.85, 1.3, i => fl(i) * 0.5); line(c2, 1, 0.5);
      break;
    }
    case 'wave': { // a ribbon that ripples side to side
      const wv = i => W(i) * 0.5 * Math.sin(i * 0.9 - T * 18);
      line(c0, 0.5, 1.8, wv); line(c1, 0.9, 1.0, wv); line(c2, 0.9, 0.35, wv);
      break;
    }
    case 'bolt': { // jagged lightning, redrawn every frame, with a forked branch
      const jag = pts.map((_, i) => (i === n - 1 ? 0 : rand(-1, 1) * W(i) * 1.1));
      line(c0, 0.5, 1.6, i => jag[i]); line(c1, 1, 0.7, i => jag[i]); line(c2, 1, 0.3, i => jag[i]);
      const j = Math.floor(rand(n * 0.3, n * 0.8)), s = rand(-1, 1) > 0 ? 1 : -1, a = at(j, jag[j]);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + nrm[j].x * s * W(j) * 2 + rand(-6, 6), a.y + nrm[j].y * s * W(j) * 2 + rand(-6, 6)); ctx.stroke();
      break;
    }
    case 'helix': { // two strands twisting around a faint core
      line(c0, 0.35, 1.2);
      line(c1, 0.95, 0.35, i => W(i) * 0.9 * Math.sin(i * 0.8 - T * 22));
      line(c2, 0.95, 0.35, i => W(i) * 0.9 * Math.sin(i * 0.8 - T * 22 + Math.PI));
      break;
    }
    case 'ghosts': { // fading copies of the ball along its path
      line(c0, 0.35, 1.0);
      for (let i = n - 4; i >= 0; i -= 3) {
        const f = i / (n - 1), r = Math.max(4, BR * 1.4 * pts[i].k);
        ctx.globalAlpha = 0.55 * f; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4 * f; ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.stroke();
      }
      break;
    }
    default: // a layered streak
      line('#10141f', 0.4, 1.5); line(c1, 0.95, 1.1); line(c2, 1, 0.4);
  }
  ctx.globalAlpha = 1;
}

// Where the ball will land, on either side of the net: four black carets painted flat on the floor
// at the corners of a square, each pointing at the spot. They start wide, then close in and shrink as the ball drops.
function drawLandingCarets(lx, lz, tl) {
  const k = clamp(tl / 1.4, 0, 1), r = 0.24 + 0.86 * k, L = 0.2 + 0.16 * k;
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const cx = lx + sx * r, cz = lz + sz * r;
    // lay a local frame on the ground at this corner: one world metre along x and along z, in canvas px
    const o = proj(cx, 0, cz), ex = proj(cx + 0.1, 0, cz), ez = proj(cx, 0, cz + 0.1);
    const dx = -sx / Math.SQRT2, dz = -sz / Math.SQRT2, nx = -dz, nz = dx; // d points at the spot
    const pt = (u, v) => [(dx * u + nx * v) * L, (dz * u + nz * v) * L];
    ctx.save();
    ctx.transform((ex.x - o.x) * 10, (ex.y - o.y) * 10, (ez.x - o.x) * 10, (ez.y - o.y) * 10, o.x, o.y);
    const pts = [pt(-0.75, -0.9), pt(0, 0), pt(-0.75, 0.9)];
    for (const [col, lw] of [['rgba(255,250,235,0.6)', 0.46 * L], ['#000000', 0.3 * L]]) { // black, with a thin light rim for dark floors
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.stroke();
    }
    ctx.restore();
  }
}

// The wind-up meter over your head. It fills left to right while you hold; gold is the last stretch before full.
// Past full the whole bar turns red. The white tick shows how full it will be when the ball reaches you.
// A thin vertical meter beside your Pokemon, in the style of a basketball shot meter.
// It fills upward while you hold; the gold notch at the top is the PERFECT window.
// Past the top it turns red. After a release it freezes in the grade colour and fades.
function drawTimingMeter(p, L, tick, dim, result, set = false) {
  const bx = p.box || { ...proj(p.x, p.y, p.z), w: 40, h: 60 };
  const w = 2, h = 22, x = Math.round((bx.x + bx.w / 2) * US + 3), y = Math.round((bx.y - bx.h * 0.55) * US - h / 2);
  const bow = 3, off = i => Math.round(bow * Math.sin(Math.PI * i / h)); // row i (0 = top) bows outward
  if (set && L != null) L = Math.min(L, 1); // a set charge never goes red: full is a quick set
  const over = L != null && L > 1, gold = set ? 1 : ZONES[2][0];
  const top = l => h - Math.round(h * clamp(l, 0, 1)); // first row filled at level l
  const fillCol = L == null ? null : result ? result.color : set ? (L >= 1 ? SET_QUICK.color : SET_HIGH.color) : L > gold ? '#ffcf33' : '#ffffff';
  ctx.save(); ctx.globalAlpha = result ? result.a : dim ? 0.45 : 1;
  pxRect(x + off(0) - 1, y - 1, w + 2, 1, 'rgba(10,14,24,0.85)');
  pxRect(x + off(h - 1) - 1, y + h, w + 2, 1, 'rgba(10,14,24,0.85)');
  for (let i = 0; i < h; i++) {
    const rx = x + off(i);
    pxRect(rx - 1, y + i, w + 2, 1, 'rgba(10,14,24,0.85)');
    let col = over ? '#d8343a' : i < top(gold) ? 'rgba(255,207,51,0.35)' : 'rgba(255,255,255,0.12)';
    if (!over && fillCol && i >= top(L)) col = fillCol;
    pxRect(rx, y + i, w, 1, col);
  }
  if (!over && !set) pxRect(x + off(top(gold)) - 2, y + top(gold), w + 4, 1, '#ffcf33');
  if (set && L != null && !result) pxText(L >= 1 ? 'QUICK' : 'SET', x + 8, y + h / 2 - 4, fillCol, 8, 'left', null);
  if (tick != null && !result) { const i = clamp(top(tick), 0, h - 1); pxRect(x + off(i) - 4, y + i - 1, 2, 2, tick > 1 ? '#ff5a5a' : '#eef3ff'); }
  ctx.restore();
}

// 6 v 6, when the pass is coming to you as setter. With a mouse, the hitter nearest the cursor is marked:
// that is who gets your set. On a touch screen, a button over each hitter to tap instead.
function setChoices() {
  const you = G.sides[0].find(p => p.human);
  if (settings.mode !== 6 || AUTO || !you || G.phase !== 'rally' || G.lastSide !== 0 || G.touches[0] !== 1 || G.intended[0] !== you) return null;
  return playOptions(0, you).sort((a, b) => proj(a.q.x, 0, a.q.z).x - proj(b.q.x, 0, b.q.z).x);
}
function drawSetButtons() {
  G.setBtns = [];
  const opts = setChoices();
  if (!opts) return;
  const aimed = aimedOption(opts);
  if (aimed) {
    const q = aimed.q, top = proj(q.x, q.y + q.rr * 2 + 0.3, q.z), x = Math.round(top.x * US), y = Math.round(top.y * US - 12);
    const w = aimed.call.length * 8 + 8;
    pxRect(x - w / 2 - 1, y - 1, w + 2, 16, '#10141f'); pxRect(x - w / 2, y, w, 14, '#ffcf33'); pxRect(x - w / 2, y + 12, w, 2, '#c48a10');
    pxText(aimed.call, x, y + 3, '#141c33', 8, 'center', null);
    pxRect(x - 2, y + 15, 4, 3, '#ffcf33');
    return;
  }
  const chip = (x, y, w, text, on, type) => {
    const h = 14;
    pxRect(x - 1, y - 1, w + 2, h + 2, '#10141f');
    pxRect(x, y, w, h, on ? '#ffcf33' : '#2b3a5e');
    pxRect(x, y + h - 2, w, 2, on ? '#c48a10' : '#1b2640');
    pxText(text, x + w / 2, y + 3, on ? '#141c33' : '#ffffff', 8, 'center', null);
    G.setBtns.push({ x, y, w, h, type });
  };
  // a number badge over each hitter, nudged up where two would overlap
  const you = G.sides[0].find(p => p.human), bx = you.box || { ...proj(you.x, you.y, you.z), w: 40, h: 60 };
  const placed = [{ x: (bx.x + bx.w / 2) * US, y: (bx.y - bx.h * 0.55) * US - 13, w: 10, h: 26 }]; // your own meter
  const hits = (x, y) => placed.some(r => x < r.x + r.w + 3 && x + 17 > r.x && y < r.y + r.h + 3 && y + 17 > r.y);
  opts.forEach((o, i) => {
    const q = o.q, top = proj(q.x, q.y + q.rr * 2 + 0.3, q.z);
    let x = Math.round(top.x * US - 7), y = Math.round(top.y * US - 20);
    while (hits(x, y)) y -= 17;
    placed.push({ x, y, w: 14, h: 14 });
    chip(clamp(x, 2, UW - 16), clamp(y, 2, UH - 16), 14, String(i + 1), G.setPick === o.type, o.type);
  });
  // and the same choices as a row of buttons, left to right in the order they stand
  const items = opts.map((o, i) => ({ o, text: `${i + 1} ${o.call}` })), gap = 6;
  const total = items.reduce((a, it) => a + it.text.length * 8 + 8, 0) + gap * (items.length - 1);
  let x = Math.round(UW / 2 - total / 2);
  pxText('SET TO', UW / 2, UH - 64, '#c9d4ee', 8);
  for (const it of items) { const w = it.text.length * 8 + 8; chip(x, UH - 52, w, it.text, G.setPick === it.o.type, it.o.type); x += w + gap; }
}

function drawPlayer(p) {
  const back = p.side === 0, f = proj(p.x, p.y, p.z);
  const img = spriteImg(p.mon.id, back), box = SPRITE_BOX[p.mon.id];
  if (p.strafe && input.aim) p.flip = back ? input.aim.x < p.x : input.aim.x > p.x; // strafing: face the cursor
  else if (Math.abs(p.vx) > 0.6) p.flip = back ? p.vx < 0 : p.vx > 0;
  if (img.complete && img.naturalWidth) {
    const [sx, sy, sw, sh] = back ? box.slice(4) : box.slice(0, 4);
    const k = p.rr * 3.3 * (back ? 1 : 1.3) * f.k / sh; // the far team is drawn a bit larger so it reads at a distance
    const h = sh * k * p.squash, w = sw * k * (1 + (1 - p.squash) * 0.6);
    p.box = { x: f.x, y: f.y, w: sw * k, h: sh * k }; // on-screen sprite size, for the meter
    ctx.save(); ctx.translate(f.x, f.y);
    const down = p.dive > 0 ? 1 : p.rec > 0 ? clamp(p.rec / 0.2, 0, 1) : 0; // laid out on a dive, then back up
    if (down) {
      const side = p.diveDir[0];
      if (Math.abs(side) > 0.35) ctx.rotate(Math.sign(side) * 1.25 * down);
      else ctx.scale(1 + 0.35 * down, 1 - 0.45 * down);
    }
    else { // lean into the run and bounce on the stride
      ctx.rotate(p.lean || 0);
      if (p.onGround && Math.hypot(p.vx, p.vz) > 1) ctx.translate(0, -Math.abs(Math.sin(p.run || 0)) * h * 0.06);
    }
    if (p.flip) ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h, w, h);
    ctx.restore();
  } else { // fallback while sprites load
    const c = proj(p.x, p.cy, p.z), r = p.rr * c.k;
    drawMon(ctx, p.mon, c.x, c.y, r, { face: p.face, back, squash: p.squash, time: G.time });
  }
}

function render() {
  if (!G) return;
  const b = G.ball;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (G.shake > 0) ctx.translate(Math.round(rand(-1, 1) * 3 * G.shake) / S, Math.round(rand(-1, 1) * 3 * G.shake) / S);
  drawBackdrop();
  drawSkyFx();
  drawArenaWall();
  drawStands();
  drawProps();
  drawCourt();

  // shadows and rings on the sand
  for (const p of G.players) {
    const lift = clamp(p.y / 2, 0, 0.6);
    ctx.fillStyle = 'rgba(80,55,20,0.35)';
    groundEllipse(p.x, p.z, p.rr * (1.0 - lift), p.rr * (0.75 - lift * 0.5)); ctx.fill();
    ctx.strokeStyle = p.human ? '#ffe14a' : p.role === 'L' ? '#c48bff' : TEAM_COLORS[p.side]; ctx.lineWidth = p.human || p.role === 'L' ? 5 : 3;
    groundEllipse(p.x, p.z, p.rr * 1.2, p.rr * 0.95); ctx.stroke();
    if (p.human && p.y > 0.15) { // a thin line down to your ring, so you can read how high you are
      const a = proj(p.x, 0, p.z), c = proj(p.x, p.y, p.z);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
  }
  for (const r of G.rings) { // landing rings
    const k = r.t / 0.6, rad = 0.3 + k * 1.1;
    ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.c; ctx.lineWidth = 4 * (1 - k) + 1;
    groundEllipse(r.x, r.z, rad, rad); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(60,40,20,${0.45 - clamp(b.y / 8, 0, 0.25)})`;
  groundEllipse(b.x, b.z, BR * 1.5, BR * 1.2); ctx.fill();
  if (G.phase === 'rally') { // a faint ring on the floor right under the ball, wherever it is now
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
    groundEllipse(b.x, b.z, 0.45, 0.45); ctx.stroke();
  }

  const you = G.sides[0].find(p => p.human);
  const labels = [];
  if (G.phase === 'serve' && you && !AUTO && settings.mode === 6 && you !== G.server) { // your legal spot for this serve
    const bad = overlaps(0).includes(you);
    ctx.strokeStyle = bad ? '#ff4d4d' : '#50e68c'; ctx.lineWidth = 4;
    groundEllipse(you.homeX, you.homeZ, 0.55, 0.55); ctx.stroke();
    const lab = proj(you.homeX, 0, you.homeZ); labels.push(['YOUR SPOT', lab.x * US, lab.y * US + 6, bad ? '#ff8a8a' : '#7dffb0']);
  }
  if (G.phase === 'rally') {
    const tl = timeToY(b, BR);
    if (tl != null) {
      const lx = b.x + b.vx * tl, lz = b.z + b.vz * tl;
      drawLandingCarets(lx, lz, tl);
    }
  }
  // where your serve or attack would go: the cursor, pulled inside the other court
  const aim = you && !AUTO && (G.phase === 'rally' || (G.phase === 'serve' && G.server === you)) ? aimInto(0, 0.6) : null;
  if (aim) {
    const [ax, az] = aim;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(16,20,31,0.6)'; groundEllipse(ax, az, 0.6, 0.6); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe14a'; groundEllipse(ax, az, 0.6, 0.6); ctx.stroke();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = proj(ax + dx * 0.3, 0, az + dz * 0.3), c = proj(ax + dx * 0.8, 0, az + dz * 0.8);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
  }
  if (G.phase === 'rally') {
    if (you && !AUTO && G.intended[0] === you && G.lastSide === 0) {
      const tc = timeToY(b, you.apex + you.rr * 2 + 0.05);
      if (tc != null) {
        const mx = b.x + b.vx * tc, mz = b.z + b.vz * tc;
        ctx.strokeStyle = '#50e68c'; ctx.lineWidth = 6;
        groundEllipse(mx, mz, 0.6, 0.6); ctx.stroke(); groundEllipse(mx, mz, 0.25, 0.25); ctx.stroke();
        const lab = proj(mx, 0, mz); labels.push(['JUMP + HIT', lab.x * US, lab.y * US + 6, '#7dffb0']);
      }
    }
  }

  // far side, the net, then the near side
  const items = [...G.players, ...G.bench[0], ...G.bench[1]].map(p => ({ z: p.z, d: () => drawPlayer(p) }));
  items.push({ z: b.z, d: () => drawBall(b) });
  for (const q of G.particles) items.push({ z: q.z, d: () => drawParticle(q) });
  items.sort((a, c) => c.z - a.z);
  let netDrawn = false;
  for (const it of items) {
    if (!netDrawn && it.z < 0) { drawNet(); netDrawn = true; }
    it.d();
  }
  if (!netDrawn) drawNet();
  if (G.freeze > 0 && G.freezeAt) { // the impact: a star of lines around the ball while the world is held still
    const f = G.freezeAt, p = proj(f.x, f.y, f.z), k = 1 - G.freeze / G.freezeMax, r0 = Math.max(16, 0.55 * p.k) * (1 + k * 0.5);
    ctx.globalAlpha = 1 - k * 0.4;
    for (const [col, lw] of [['#20222e', 8], [f.c, 4]]) { // dark under-stroke so it reads on white sprites and sand
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + 0.2, r1 = r0 * (i % 2 ? 1.7 : 2.5);
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    drawBall(G.ball); // the ball on top of whoever hit it
  }
  ctx.restore();

  const bp = proj(b.x, b.y, b.z);
  if (bp.y < 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); pxRect(bp.x * US - 3, 2, 6, 3, '#ffffff'); pxRect(bp.x * US - 1, 5, 2, 2, '#ffffff'); }
  ctx.setTransform(S, 0, 0, S, 0, 0); drawVenueLights();
  if (!G.demo) for (const l of labels) pxText(l[0], l[1], l[2], l[3]); // no call-outs over the title screen's match
  G.setBtns = [];
  if (you && !AUTO) {
    const m = G.meterShow, mk = m && m.p === you ? 1 - (G.time - m.t) / 0.45 : 0;
    if (mk > 0) drawTimingMeter(you, m.L, null, false, { color: m.color, a: Math.min(1, mk * 2) });
    else if (G.phase === 'serve' && G.toss && G.server === you && G.hold) drawTimingMeter(you, holdLevel(G.hold), null, false);
    else if (G.phase === 'rally') {
      const pr = predictContact(you), h = G.hold, L = h ? holdLevel(h) : null, set = !!h && h.kind === 'set';
      const tick = pr && pr.reach && !set ? (h && h.tr != null ? null : (L || 0) + pr.T / CHARGE) : null;
      if (h || (pr && pr.T <= CHARGE * 1.6)) drawTimingMeter(you, L, tick, !h && !(pr && pr.reach), null, set);
    }
    if (G.phase === 'rally') {
      drawSetButtons();
    }
  }
  if (you && !AUTO && you.blockUp && !you.onGround) { const c = proj(you.x, you.y + you.rr * 2 + 0.5, you.z); pxText('BLOCK', c.x * US, c.y * US - 10, '#ffffff', 8); }
  if (you && G.chat && G.time - G.chat.t < 1.6) { // quick chat bubble over your Pokémon
    const text = CHATS[G.chat.k], c = proj(you.x, you.y + you.rr * 2 + 0.9, you.z), w = text.length * 8 + 10;
    const x = Math.round(clamp(c.x * US, w / 2 + 2, UW - w / 2 - 2)), y = Math.round(c.y * US - 34);
    pxRect(x - w / 2 - 1, y - 1, w + 2, 16, '#10141f'); pxRect(x - w / 2, y, w, 14, '#ffffff');
    pxRect(x - 3, y + 14, 6, 2, '#ffffff'); pxRect(x - 1, y + 16, 2, 2, '#ffffff');
    pxText(text, x, y + 3, '#141c33', 8, 'center', null);
  }
  for (const t of G.texts) if (!t.big && !G.demo) {
    const k = t.t / t.life, p = proj(t.x, t.y, t.z);
    if (k > 0.8 && Math.floor(t.t * 20) % 2) continue; // blink out
    pxText(t.text.toUpperCase(), p.x * US, p.y * US - t.t * 16, t.color, t.size > 24 ? 16 : 8);
  }
  if (!G.demo) drawHud();
}

function drawHud() {
  ctx.setTransform(U, 0, 0, U, 0, 0);
  const cx = UW / 2;
  drawScoreboard();
  if (G.toast && G.time - G.toast.t < 1.2) pxText(G.toast.text, cx, UH - 84, '#ffffff', 8);
  const me = G.sides[0].find(p => p.human);
  if (me && !AUTO) {
    const where = settings.mode === 6 ? `  ZONE ${zoneOf(me)} ${isFront(me) ? 'FRONT' : 'BACK'} ROW` : '';
    pxText(ROLES[me.role].name.toUpperCase() + where, cx, UH - 12, '#c9d4ee', 8);
    if (G.phase === 'serve' && !TUT && me !== G.server && overlaps(0).includes(me) && Math.floor(G.time * 4) % 2 === 0) pxText('OVERLAP! GET TO YOUR SPOT', cx, 76, '#ff8a8a', 8);
  }
  if (G.phase === 'serve' && !aiControlled(G.server) && Math.floor(G.time * 2.5) % 2 === 0) {
    pxText(G.toss ? 'LET GO AS IT DROPS' : 'HOLD CLICK TO TOSS', cx, 52, '#ffffff', 8);
    pxText(input.aim ? 'THE CURSOR AIMS' : 'WASD AIMS', cx, 63, '#c9d4ee', 8);
  }
  for (const t of G.texts) if (t.big && t.t >= 0) {
    const k = t.t / t.life;
    if (k > 0.8 && Math.floor(t.t * 20) % 2) continue;
    const size = t.t < 0.12 ? 24 : 16;
    pxText(t.text, cx, 74 - (size - 16) / 2, '#ffffff', size);
    pxRect(cx - 24, 96, 48, 3, t.color);
    if (t.sub) pxText(t.sub.toUpperCase(), cx, 104, '#eef3ff', 8);
  }
  if (G.paused) { ctx.fillStyle = 'rgba(10,14,26,0.55)'; ctx.fillRect(0, 0, UW, UH); }
}
const teamName = s => clubs ? clubs[s].name : `Team ${teams[s][0].mon.name}`;

// Broadcast-style scoreboard, top left: logo | club code | sets won | points in this set.
let logoCache = null;
function scoreLogo() { // a pixel volleyball with a VD monogram, drawn once at UI-grid size
  if (logoCache) return logoCache;
  const c = document.createElement('canvas'); c.width = c.height = 24;
  const g = c.getContext('2d'), r = 11.5;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const dx = x + 0.5 - 12, dy = y + 0.5 - 12, d = Math.hypot(dx, dy);
    if (d > r) continue;
    const band = Math.floor((dx * 0.8 + dy + 24) / 6) % 3; // diagonal panels like a match ball
    g.fillStyle = d > r - 1.3 ? '#0e1a3a' : ['#1f5fd6', '#ffd23a', '#ffffff'][band];
    g.fillRect(x, y, 1, 1);
  }
  logoCache = c; return c;
}
function drawScoreboard() {
  const x0 = 4, y0 = 4, rowH = 15, multi = settings.sets > 1;
  const logoW = 30, nameW = 44, setW = multi ? 16 : 0, ptsW = 22, W = logoW + nameW + setW + ptsW, H = rowH * 2 + 3;
  pxRect(x0 + 2, y0 + 2, W, H, 'rgba(5,8,16,0.45)'); // drop shadow
  pxRect(x0, y0, W, H, '#f4f6fb');
  // logo
  ctx.save(); ctx.setTransform(U, 0, 0, U, 0, 0); ctx.drawImage(scoreLogo(), x0 + 3, y0 + 4); ctx.restore();
  pxText('VD', x0 + 15, y0 + 13, '#ffffff', 8, 'center', '#0e1a3a');
  pxRect(x0 + logoW - 1, y0 + 3, 1, H - 6, '#c5ccd9');
  for (let k = 0; k < 2; k++) {
    const y = y0 + 1 + k * (rowH + 1), club = clubs ? clubs[k] : { abbr: k ? 'RIV' : 'YOU', color: TEAM_COLORS[k] };
    let x = x0 + logoW;
    pxRect(x, y, nameW, rowH, '#e2e6ef');
    pxRect(x, y, 3, rowH, club.color);
    if (G.serving === k) { pxRect(x + 6, y + 6, 4, 4, '#ffcf33'); pxRect(x + 7, y + 5, 2, 6, '#ffcf33'); pxRect(x + 5, y + 7, 6, 2, '#ffcf33'); }
    pxText(club.abbr, x + 13, y + 4, '#141c33', 8, 'left', null);
    const n = G.lastSide === k && G.phase === 'rally' ? G.touches[k] : 0; // touches used this side
    for (let i = 0; i < 3; i++) pxRect(x + nameW - 5, y + 3 + i * 4, 3, 3, i < n ? club.color : '#c5ccd9');
    x += nameW;
    if (multi) { pxRect(x, y, setW, rowH, '#141c33'); pxText(String(G.sets[k]), x + setW / 2 + 1, y + 4, '#ffffff', 8, 'center', null); x += setW; }
    pxText(String(G.score[k]), x + ptsW / 2 + 1, y + 4, '#141c33', 8, 'center', null);
  }
  pxRect(x0 + logoW, y0 + rowH + 1, W - logoW, 1, '#c5ccd9');
  // set and target, in a dark tab under the board
  const info = TUT ? 'TUTORIAL' : multi ? `SET ${G.setNo} · TO ${setTarget()}` : `TO ${setTarget()} · WIN BY 2`;
  const tw = info.length * 8 + 8;
  pxRect(x0, y0 + H, tw, 12, '#141c33');
  pxText(info, x0 + 4, y0 + H + 2, '#c9d4ee', 8, 'left', null);
}

// ===================== canvas sizing and loop =====================
function sizeCanvas() {
  canvas.width = LW; canvas.height = LH;
  ctx.imageSmoothingEnabled = false;
}
let last = performance.now();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * SPEEDUP;
  last = now;
  if (G && G.demo && reduceMotion.matches) { if (!G.drawnStill) { render(); G.drawnStill = true; } } // a still frame
  else if (G && !$('#stage').hidden) {
    if (SPEEDUP > 1) { const n = Math.ceil(SPEEDUP); for (let i = 0; i < n; i++) update(dt / n); }
    else update(dt);
    render();
  }
  requestAnimationFrame(frame);
}
// mouse: the cursor aims; left button receives, spikes and serves; right button dives, or blocks in the air
function setButtonAt(e) { // a setter button under the pointer, if any
  if (!G || !G.setBtns || !G.setBtns.length) return null;
  const r = canvas.getBoundingClientRect(), ux = (e.clientX - r.left) / r.width * UW, uy = (e.clientY - r.top) / r.height * UH;
  return G.setBtns.find(b => ux >= b.x - 2 && ux <= b.x + b.w + 2 && uy >= b.y - 2 && uy <= b.y + b.h + 2) || null;
}
canvas.addEventListener('pointerdown', e => {
  const btn = setButtonAt(e);
  if (btn) { G.setPick = btn.type; Sfx.tone(700, 0.04, 'square', 0.025); }
  if (e.pointerType === 'touch') { if (btn) e.preventDefault(); return; }
  aimAt(e);
  if (e.button === 0) press('hit', true); // held until the button comes back up
  else if (e.button === 2) { press('dive', true); press('dive', false); }
  else return;
  e.preventDefault();
});
addEventListener('pointerup', e => { if (e.pointerType !== 'touch' && e.button === 0 && keys.hit) press('hit', false); });
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') aimAt(e); });
canvas.addEventListener('wheel', e => { if (G && !G.paused && !G.demo) { e.preventDefault(); wheelZoom(e.deltaY); } }, { passive: false });
// The point on the floor under the cursor, in world metres. Kept fixed on the floor while the camera drifts.
function aimAt(e) {
  if (!G) return;
  const r = canvas.getBoundingClientRect();
  const u = (CAM.cy - (e.clientY - r.top) / r.height * H) / CAM.F, v = ((e.clientX - r.left) / r.width * W - W / 2) / CAM.F;
  const pt = camPitch(), c = Math.cos(pt), sn = Math.sin(pt), den = sn - u * c;
  if (den <= 0.02) return; // at or above the horizon
  const t = G.cam.y / den, rx = v * t, rz = t * (u * sn + c), yw = G.cam.yaw || 0; // in the camera's turned frame
  input.aim = { x: G.cam.x + rx * Math.cos(yw) + rz * Math.sin(yw), z: G.cam.z - rx * Math.sin(yw) + rz * Math.cos(yw) };
}
// The cursor's floor point, pulled inside the other team's court with a margin, or null without a mouse.
function aimInto(s, margin = 0.5) {
  if (!input.aim) return null;
  const t = toward(s);
  return [clamp(input.aim.x, -HW + margin, HW - margin), t * clamp(input.aim.z * t, 1.2, HL - margin)];
}
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ===================== screens =====================
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  const title = id === 'scr-title';
  if (title) startDemo(); else stopDemo();
  $('#stage').hidden = id !== 'stage' && !title; // on the title screen the stage is the background
  $('#stage').classList.toggle('demo-bg', title);
  $('#menu').hidden = id === 'stage';
  document.body.classList.toggle('on-title', title);
  for (const d of document.querySelectorAll('#scr-title dialog[open]')) if (!title) d.close();
  window.scrollTo(0, 0);
  const first = id === 'stage' ? null : document.querySelector(`#${id} [data-autofocus]`);
  if (first) first.focus({ preventScroll: true });
}

// A sprite drawn at `size` px (a multiple of 96 keeps the pixels even), cropped to a `box` px square.
function portrait(mon, size = 96, box = 64) {
  const wrap = el('span', 'portrait'); wrap.style.width = wrap.style.height = box + 'px';
  const img = new Image();
  img.src = `sprites/front/${mon.id}.png`; img.width = img.height = size; img.alt = ''; img.decoding = 'async';
  wrap.appendChild(img);
  return wrap;
}

function typeChips(mon) {
  return mon.types.map(t => `<span class="chip" style="--c:${TYPE_COLORS[t]}">${cap(t)}</span>`).join('');
}
function barClass(v) { return v >= 80 ? 'b4' : v >= 65 ? 'b3' : v >= 45 ? 'b2' : 'b1'; }
function statBars(r, base) {
  return `<dl class="bars">${STAT_KEYS.map(([k, label, tip]) => {
    const boost = base && r[k] !== base[k] ? `<span class="boost">+${r[k] - base[k]}</span>` : '';
    return `<div class="bar" title="${tip}"><dt>${label}</dt><dd><span class="track"><span class="fill ${barClass(r[k])}" style="width:${r[k]}%"></span></span><b>${r[k]}</b>${boost}</dd></div>`;
  }).join('')}</dl>`;
}
function baseLine(mon) {
  const b = mon.base;
  return `<p class="base">HP ${b.hp} · Atk ${b.atk} · Def ${b.def} · SpA ${b.spa} · SpD ${b.spd} · Spe ${b.spe}</p>`;
}
function monCard(entryOrMon, opts = {}) {
  const e = entryOrMon.mon ? entryOrMon : null, mon = e ? e.mon : entryOrMon;
  const r = e ? e.r : mon.r, ovr = e ? e.ovr : mon.ovr;
  const card = el(opts.button ? 'button' : 'div', 'card' + (mon.leg ? ' legend' : ''));
  if (opts.button) card.type = 'button';
  card.style.setProperty('--tc', TYPE_COLORS[mon.types[0]]);
  const top = el('div', 'card-top');
  top.appendChild(portrait(mon, 192, 128));
  top.appendChild(el('div', 'ovr', `<b>${ovr}</b><span>OVR</span>`));
  card.appendChild(top);
  card.appendChild(el('div', 'card-body',
    `<h3><span class="dex">#${String(mon.id).padStart(3, '0')}</span> ${mon.name}${mon.leg ? ' <span class="star" title="Legendary">★</span>' : ''}</h3>
     <div class="chips">${typeChips(mon)}</div>
     ${statBars(r, e && e.captain ? mon.r : null)}
     ${opts.small ? '' : baseLine(mon)}`));
  return card;
}

// ---------- title ----------
function seg(group, key) {
  const box = $(group);
  box.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    for (const x of box.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    settings[key] = key === 'diff' ? b.dataset.v : Number(b.dataset.v);
  });
}
seg('#opt-diff', 'diff'); seg('#opt-target', 'target'); seg('#opt-sets', 'sets');
// Settings are kept between visits (not in test mode). Anything stale or unknown falls back to the default.
const SAVE_KEY = 'volleydex-settings';
function saveSettings() { // during the tutorial, save the player's own settings (plus any camera change), not the tutorial's
  const s = demoSaved ? demoSaved.settings : TUT ? { ...TUT.saved, camMode: settings.camMode, zoom: settings.zoom } : settings;
  if (!AUTO) try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
}
function loadSettings() {
  let o; try { o = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return; }
  if (!o || typeof o !== 'object') return;
  if ([2, 6].includes(o.mode)) settings.mode = o.mode;
  if (DIFF[o.diff]) settings.diff = o.diff;
  if ([11, 15, 25].includes(o.target)) settings.target = o.target;
  if ([1, 3, 5].includes(o.sets)) settings.sets = o.sets;
  if (TIMES[o.time]) settings.time = o.time;
  if (['follow', 'fixed'].includes(o.camMode)) settings.camMode = o.camMode;
  if (typeof o.zoom === 'number' && o.zoom >= 0.84 && o.zoom <= 1.14) settings.zoom = o.zoom;
  for (const n of [2, 6]) {
    if (o.role && YOUR_ROLES[n].includes(o.role[n])) settings.role[n] = o.role[n];
    if (o.venue && VENUES[o.venue[n]] && VENUES[o.venue[n]].mode === n) settings.venue[n] = o.venue[n];
  }
  if (Array.isArray(o.club) && CLUBS[o.club[0]]) settings.club[0] = o.club[0];
  if (Array.isArray(o.club) && (CLUBS[o.club[1]] || o.club[1] === 'random')) settings.club[1] = o.club[1];
  for (const [box, key] of [['#opt-diff', 'diff'], ['#opt-target', 'target'], ['#opt-sets', 'sets']])
    for (const b of document.querySelectorAll(`${box} button`)) b.setAttribute('aria-pressed', String(b.dataset.v === String(settings[key])));
}
if (!AUTO) loadSettings();
function renderVenuePick() {
  const box = $('#opt-venue'); box.innerHTML = '';
  for (const [id, v] of Object.entries(VENUES)) {
    if (v.mode !== settings.mode) continue;
    const b = el('button', '', v.name); b.type = 'button'; b.setAttribute('aria-pressed', String(settings.venue[settings.mode] === id));
    b.addEventListener('click', () => { settings.venue[settings.mode] = id; renderVenuePick(); });
    box.appendChild(b);
  }
  $('#venue-sub').textContent = settings.mode === 2 ? '2 v 2 on the sand. Pick a beach and a time of day.' : '6 v 6 in the arena. Arenas are indoors, so there is no time of day to pick.';
  $('#venue-desc').textContent = VENUE_DESC[settings.venue[settings.mode]];
  const tbox = $('#opt-time'); tbox.innerHTML = '';
  $('#time-pick').hidden = settings.mode !== 2; // the arenas are indoors
  for (const [id, name] of Object.entries(TIMES)) {
    const b = el('button', '', name); b.type = 'button'; b.setAttribute('aria-pressed', String(settings.time === id));
    b.addEventListener('click', () => { settings.time = id; renderVenuePick(); });
    tbox.appendChild(b);
  }
}
renderVenuePick();
function renderClubPick() {
  if (settings.club[1] === settings.club[0]) settings.club[1] = 'random';
  for (const k of [0, 1]) {
    const box = $(k ? '#opt-rival' : '#opt-club'); box.innerHTML = '';
    for (const id of k ? ['random', ...Object.keys(CLUBS)] : Object.keys(CLUBS)) {
      const c = id === 'random' ? null : CLUBS[id], mine = k === 1 && id === settings.club[0];
      const [city, nick] = c ? c.name.split(' ') : ['Random', 'Any club'];
      const b = el('button', 'club-tile' + (c ? '' : ' random'), c ? `${crestImg(id, 72)}<b>${city}</b><span>${mine ? 'Your team' : nick}</span><i>${c.abbr}</i>` : `${crestImg(id, 36)}<b>Random rival</b><span>Any club but yours</span>`);
      b.type = 'button'; b.setAttribute('aria-pressed', String(settings.club[k] === id));
      b.setAttribute('aria-label', c ? `${c.name} (${c.abbr})` : 'Random rival');
      if (c) b.style.setProperty('--cc', c.color);
      b.disabled = mine;
      b.addEventListener('click', () => { settings.club[k] = id; renderClubPick(); $(`${k ? '#opt-rival' : '#opt-club'} [aria-pressed="true"]`).focus(); });
      box.appendChild(b);
    }
    const id = settings.club[k];
    $(k ? '#opt-rival-name' : '#opt-club-name').textContent = id === 'random' ? 'Random rival' : CLUBS[id].name;
  }
}
renderClubPick();
// Menu flow: game mode on the title screen, then teams, then venue, time of day and rules.
function renderSummary() {
  // the demo scoreboard wears the same clubs
  const rows2 = document.querySelectorAll('#bug .bug-row');
  if (rows2.length) settings.club.forEach((id, k) => {
    rows2[k].style.setProperty('--cc', id === 'random' ? '#8a93a8' : CLUBS[id].color);
    rows2[k].querySelector('b').textContent = id === 'random' ? '???' : CLUBS[id].abbr;
  });
  saveSettings();
  renderScene();
}

// ---- Title scene: the chosen venue's sky over a full court, a net and two teams of Pokémon in a rally. ----
// Everything on the stage goes through one camera: a pinhole standing behind your end line, looking across the net.
// World units match the game (x across, z toward the far end, net at z = 0, your side z < 0). Stage units are CSS px,
// x from the stage centre and y from its top. The backdrop is a 560x220 canvas drawn at 2x behind a 440 px stage,
// and the whole stage is then scaled by stageF (CSS --sf) to fill the window.
const SCENE_W = 560, SCENE_H = 220, SCENE_SKY = 110;
const ST = { hor: SCENE_SKY * 2, camH: 4.5, back: 14.7, F: 359 }; // horizon y, camera height, camera to net, focal length
let stageK = 1;                                                    // horizontal squeeze on narrow screens
let sceneTop = 80;                                                 // canvas row where the arena stands stop, under the subtitle
let stageF = 1;                                                    // stage size: 1 = the 440 px stage, scaled up to fit the window
function sp(x, h, z) { // world point -> stage px; k is px per world unit at that depth
  const k = ST.F / (z + ST.back);
  return { x: x * k * stageK, y: ST.hor + (ST.camH - h) * k, k };
}
const groundZ = y => ST.camH * ST.F / (y - ST.hor) - ST.back; // stage y on the ground -> world z
// Court size and the home spot [x, z] of each player on the stage, per mode.
const STAGE = {
  2: { hw: 8, hl: 12, near: [[-4.6, -6.6], [4.4, -6.9]], far: [[4.8, 5.2], [-4.4, 6.4]] },
  6: { hw: 9.5, hl: 14, near: [[-7.2, -6.6], [0.6, -7.1], [6.8, -6.4]], far: [[-5.8, 4.6], [0.4, 7.6], [5.8, 5.2]] },
};
const SCENE_BALL = [
  '....oooo....', '..oowwyyoo..', '.owwwwyyyyo.', '.owwwwwyyyo.', 'owbbwwwwyyyo', 'obbbbwwwwyyo',
  'obbbbbwwwwwo', 'owbbbbwwwwwo', '.owbbbwwwwo.', '.owwbbwwwwo.', '..oowwwwoo..', '....oooo....'];
const scenePicks = (() => { // a fresh cast each visit: three of yours from behind, three rivals facing you
  const ids = DEX.map(m => m.id).sort(() => Math.random() - 0.5);
  return { near: ids.slice(0, 3), far: ids.slice(3, 6) };
})();
const sceneCache = {}, sceneFloor = {};
function sceneBackdrop() {
  const vid = settings.venue[settings.mode], C = STAGE[settings.mode], key = `${vid}:${stageK.toFixed(2)}:${sceneTop}`;
  if (sceneCache[key]) return sceneCache[key];
  const mode = settings.mode, time = settings.time; settings.time = 'day'; // the title stage is always in daylight
  const bd = backdropFor(); settings.time = time; settings.mode = mode;
  const V = VENUES[vid], hy = Math.round(horizonY() * US), ox = (SCENE_W - UW) / 2;
  const c = document.createElement('canvas'); c.width = SCENE_W; c.height = SCENE_H; const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const [r, gg, b] = bd.getContext('2d').getImageData(1, 0, 1, 1).data; // carry the top sky band upward
  g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, SCENE_W, SCENE_SKY - hy + 1);
  g.drawImage(bd, 0, 0, UW, SCENE_H - SCENE_SKY + hy, ox, SCENE_SKY - hy, UW, SCENE_H - SCENE_SKY + hy);
  const mid = document.createElement('canvas'); mid.width = SCENE_W; mid.height = SCENE_H; mid.getContext('2d').drawImage(c, 0, 0);
  g.save(); g.scale(-1, 1); // mirror the backdrop's edges to fill the wider stage
  g.drawImage(mid, ox, 0, ox, SCENE_H, -ox, 0, ox, SCENE_H);
  g.drawImage(mid, UW, 0, ox, SCENE_H, -(2 * ox + UW), 0, ox, SCENE_H);
  g.restore();
  const sand = V.court === 'sand', cx = SCENE_W / 2;
  let floor = null;
  if (!sand) { // keep a patch of bare floor for the page background before the stands cover the corners
    const t = document.createElement('canvas'); t.width = t.height = 32; t.getContext('2d').drawImage(c, 0, SCENE_H - 32, 32, 32, 0, 0, 32, 32);
    const [fr, fg, fb] = g.getImageData(4, SCENE_H - 3, 1, 1).data;
    floor = { '--v-floor': `rgb(${fr},${fg},${fb})`, '--v-tile': `url(${t.toDataURL()})` };
    sceneStands(g, V, C);
  }
  if (sand) { // rake the sand flat: the backdrop's diagonal rake marks fight with the court lines
    const img = g.getImageData(0, SCENE_SKY, SCENE_W, SCENE_H - SCENE_SKY), d = img.data, count = {};
    for (let i = (SCENE_H - SCENE_SKY - 40) * SCENE_W * 4; i < d.length; i += 4) { const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; count[k] = (count[k] || 0) + 1; }
    const top = Number(Object.keys(count).sort((a, b2) => count[b2] - count[a])[0]), sr = top >> 16, sg = (top >> 8) & 255, sb = top & 255;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < 70) { d[i] = sr; d[i + 1] = sg; d[i + 2] = sb; }
    }
    g.putImageData(img, 0, SCENE_SKY);
  }
  // the court in perspective, row by row: both halves, from the far end line down past the bottom of the stage
  const line = sand ? '#2f6bd6' : '#f4f1e8', lineW = 0.16;
  for (let row = SCENE_SKY + 1; row < SCENE_H; row++) {
    const z = groundZ(row * 2 + 1); if (z > C.hl + lineW) continue;
    const k = ST.F / (z + ST.back), hw = C.hw * k * stageK / 2, lw = Math.max(1, Math.round(lineW * k * stageK / 2));
    if (!sand && z <= C.hl) { g.fillStyle = row % 3 ? V.court : shade(V.court, -0.06); g.fillRect(Math.round(cx - hw), row, Math.round(hw * 2), 1); }
    g.fillStyle = line; g.fillRect(Math.round(cx - hw - lw / 2), row, lw, 1); g.fillRect(Math.round(cx + hw - lw / 2), row, lw, 1);
  }
  const across = z => { // a line across the court at depth z, at least one pixel thick
    const a = sp(0, 0, z + lineW / 2), b2 = sp(0, 0, z - lineW / 2), hw = C.hw * a.k * stageK / 2;
    const y0 = Math.floor(a.y / 2), y1 = Math.max(y0 + 1, Math.round(b2.y / 2));
    if (y0 >= SCENE_H) return;
    g.fillStyle = line; g.fillRect(Math.round(cx - hw), y0, Math.round(hw * 2), y1 - y0);
  };
  across(C.hl);
  if (!sand) { across(0); across(C.hl / 3); across(-C.hl / 3); } // centre line and both attack lines
  const url = c.toDataURL(); if (floor) sceneFloor[url] = floor;
  return (sceneCache[key] = url);
}
// The arena's stands on the title stage, painted straight onto the backdrop, wrapping the court on three sides like
// the in-game venues: a dark roof with light rigs, a steep bowl behind the far end line and along both sidelines
// that dims toward the roof, and LED boards around the court.
function sceneStands(g, V, C) {
  const ex = V.extras || [], d = V.decks[0], night = ex.includes('dark'), rnd = seeded(77), cx = SCENE_W / 2;
  const row = (h, z) => sp(0, h, z).y / 2;                  // stage px are 2 canvas px
  const P = (x, h, z) => { const q = sp(x, h, z); return [cx + q.x / 2, q.y / 2]; };
  const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, h, z], i) => g[i ? 'lineTo' : 'moveTo'](...P(x, h, z))); g.closePath(); g.fill(); };
  const gap = 11, z0 = C.hl + gap, X = C.hw + gap, zNear = -12, rise = 1, depth = 0.8, topRow = sceneTop; // the bowl tops out just under the subtitle
  let N = 1; while (row(rise * N, z0 + depth * N) > topRow && N < 60) N++;
  const top = Math.round(row(rise * N, z0 + depth * N));
  g.fillStyle = night ? '#05070d' : '#0f1424'; g.fillRect(0, 0, SCENE_W, top);   // the roof
  // light rigs, only out past the title and subtitle so the text sits on a plain dark roof
  for (let r = 0; r < 2; r++) for (let x = 8 + r * 20; x < SCENE_W - 14; x += 40) {
    const y = 6 + r * 16;
    if (Math.abs(x + 4 - cx) < 170) continue;
    g.fillStyle = 'rgba(255,246,208,0.08)'; g.fillRect(x - 4, y + 3, 16, 12);
    g.fillStyle = '#fff6d0'; g.fillRect(x, y, 8, 3);
  }
  const shirts = ['#3fa7ff', '#3fa7ff', '#ff5d5d', '#ff5d5d', '#ffffff', '#ffcf33', '#2b2f3f', '#6bd88a', '#c48bff'];
  const skins = ['#f1c9a0', '#d9a477', '#b07a4f', '#8a5a3a', '#f6dcc0'];
  const fan = (x, h, z, side) => { // one fan sitting at world point (x, h, z)
    const q = sp(x, h, z), kx = q.k * stageK / 2, ky = q.k / 2, px = Math.round(cx + q.x / 2), foot = Math.round(q.y / 2);
    if (px < 4 || px > SCENE_W - 5 || foot < top) return; // the edge columns are stretched across the page sides: keep them plain
    const w = Math.max(2, Math.round(0.42 * kx)), fh = Math.max(2, Math.round(0.5 * ky)), hd = Math.max(1, Math.round(0.27 * ky));
    g.fillStyle = V.teamSides && rnd() < 0.8 ? TEAM_COLORS[side < 0 ? 0 : 1] : shirts[Math.floor(rnd() * shirts.length)];
    g.fillRect(px - (w >> 1), foot - fh, w, fh);
    g.fillStyle = skins[Math.floor(rnd() * skins.length)]; g.fillRect(px - (hd >> 1), foot - fh - hd, hd, hd);
    if (rnd() < 0.06) { const a = Math.max(1, hd >> 1); g.fillRect(px - (w >> 1) - a, foot - fh - hd - a, a, hd + a); g.fillRect(px + w - (w >> 1), foot - fh - hd - a, a, hd + a); } // arms up
    if (night && rnd() < 0.08) { g.fillStyle = '#ffffff'; g.fillRect(px + 1, foot - fh - hd - 1, 1, 1); } // phone lights
  };
  g.save(); g.beginPath(); g.rect(0, top, SCENE_W, SCENE_H - top); g.clip(); // nothing pokes up into the roof
  for (let t = N - 1; t >= 0; t--) { // far end: far tiers first, nearer ones paint over them
    const zi = z0 + depth * t, y0 = rise * t, y1 = y0 + rise;
    const rSeat = Math.round(row(y1, zi + depth)), rLip = Math.round(row(y1, zi)), rFoot = Math.round(row(y0, zi));
    g.fillStyle = d.seat[t % 2]; g.fillRect(0, rSeat, SCENE_W, Math.max(1, rLip - rSeat));
    g.fillStyle = d.riser[t % 2]; g.fillRect(0, rLip, SCENE_W, Math.max(1, rFoot - rLip));
    const half = cx / (sp(0, y1, zi).k * stageK / 2) + 1;
    for (let x = -half; x <= half; x += 0.72) if (Math.abs(x) % 9 >= 0.8 && rnd() < d.fill) fan(x + (rnd() - 0.5) * 0.2, y1, zi + depth * 0.5, x);
  }
  // the sidelines: outer tiers first (still under the roof clip)
  for (let t = N - 1; t >= 0; t--) {
    const y0 = rise * t, y1 = y0 + rise;
    for (const sd of [-1, 1]) {
      // each side tier runs back to the far-end tier of the same row, so the rows turn the corner as one bowl
      const xi = sd * (X + depth * t), xo = xi + sd * depth, zi = z0 + depth * t, zs = zi + depth;
      poly([[xi, y1, zs], [xi, y1, zNear], [xo, y1, zNear], [xo, y1, zs]], d.seat[t % 2]);
      poly([[xi, y0, zi], [xi, y0, zNear], [xi, y1, zNear], [xi, y1, zi]], d.riser[t % 2]);
      for (let z = zi - 0.4; z >= zNear + 5; z -= 0.5) if ((z + 40) % 8 >= 0.8 && rnd() < d.fill) fan(xi + sd * depth * 0.5 + (rnd() - 0.5) * 0.2, y1, z + (rnd() - 0.5) * 0.25, sd);
    }
  }
  g.restore();
  const fade = g.createLinearGradient(0, top, 0, Math.round(row(0, z0)));    // lights aim at the court, so the upper rows dim
  fade.addColorStop(0, night ? 'rgba(5,7,13,0.8)' : 'rgba(15,20,36,0.7)'); fade.addColorStop(0.6, 'rgba(15,20,36,0.25)'); fade.addColorStop(1, 'rgba(15,20,36,0)');
  g.fillStyle = fade; g.fillRect(0, top, SCENE_W, Math.round(row(0, z0)) - top);
  g.fillStyle = '#0b0f1c'; g.fillRect(0, top - 3, SCENE_W, 4);                // the fascia under the roof, with a ribbon board
  g.fillStyle = night ? '#ff5d5d' : '#3fa7ff'; g.fillRect(0, top - 2, SCENE_W, 1);
  g.fillStyle = '#ffcf33'; for (let x = 6; x < SCENE_W; x += 18) g.fillRect(x, top - 2, 6, 1);
  if (ex.includes('led')) { // LED ad boards on the front wall of the stands: along the far end, then down both sidelines
    const zb = z0 - 0.05, xb = X - 0.05, H = 1, cols = ['#3fa7ff', '#ff5d5d', '#ffcf33', '#6bd88a'];
    poly([[-xb, 0, zb], [xb, 0, zb], [xb, H, zb], [-xb, H, zb]], '#0b0f1c');
    const n = Math.round(2 * xb / 3);
    for (let i = 0; i < n; i++) {
      const a = -xb + (2 * xb / n) * i + 0.08, b2 = -xb + (2 * xb / n) * (i + 1) - 0.08;
      poly([[a, 0.1, zb], [b2, 0.1, zb], [b2, H - 0.1, zb], [a, H - 0.1, zb]], cols[i % cols.length]);
      poly([[a + 0.5, H - 0.3, zb], [b2 - 0.5, H - 0.3, zb], [b2 - 0.5, H - 0.2, zb], [a + 0.5, H - 0.2, zb]], '#ffffff');
    }
    for (const sd of [-1, 1]) {
      const x = sd * xb;
      poly([[x, 0, zb], [x, 0, zNear], [x, H, zNear], [x, H, zb]], '#0b0f1c');
      for (let i = 0, z = zb; z > zNear; i++, z -= 3) {
        const z2 = Math.max(zNear, z - 3) + 0.08;
        poly([[x, 0.1, z - 0.08], [x, 0.1, z2], [x, H - 0.1, z2], [x, H - 0.1, z - 0.08]], cols[(i + (sd > 0 ? 2 : 0)) % cols.length]);
      }
    }
  }
}
let sceneBallUrl = null;
function sceneBall() {
  if (sceneBallUrl) return sceneBallUrl;
  const c = document.createElement('canvas'); c.width = c.height = 12; const g = c.getContext('2d');
  const col = { o: '#10141f', w: '#fbfcff', y: '#ffcf33', b: '#3fa7ff' };
  SCENE_BALL.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } }));
  return (sceneBallUrl = c.toDataURL());
}
// A player sprite. Its feet (the bottom centre of the drawn pixels) are the point the stage places on the court.
function sceneMon(id, back) {
  const b = SPRITE_BOX[id], s = back ? 2 : 1, [vx, vy, vw, vh] = back ? b.slice(4) : b.slice(0, 4);
  const m = el('span', 'mon');
  const img = new Image(); img.src = `sprites/${back ? 'back' : 'front'}/${id}.png`; img.alt = ''; img.decoding = 'async';
  img.width = img.height = 96 * s; m.appendChild(img);
  return { el: m, fx: (vx + vw / 2) * s, fy: (vy + vh) * s };
}
// Hand the venue's sky and floor colours to the page, so the title screen's background matches the stage.
const tintCache = {};
function sceneTint(url) {
  const set = t => { for (const k in t) document.body.style.setProperty(k, t[k]); };
  if (tintCache[url]) return set(tintCache[url]);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = SCENE_W; c.height = SCENE_H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = (x, y) => { const [r, gg, b] = g.getImageData(x, y, 1, 1).data; return `rgb(${r},${gg},${b})`; };
    const strip = document.createElement('canvas'); strip.width = 2; strip.height = SCENE_H; // the stage's two edge columns,
    const sg = strip.getContext('2d');                                                     // stretched to fill the page sides
    sg.drawImage(c, 0, 0, 1, SCENE_H, 0, 0, 1, SCENE_H); sg.drawImage(c, SCENE_W - 1, 0, 1, SCENE_H, 1, 0, 1, SCENE_H);
    const tile = document.createElement('canvas'); tile.width = tile.height = 32; // a patch of floor from the stage's
    tile.getContext('2d').drawImage(c, 0, SCENE_H - 32, 32, 32, 0, 0, 32, 32);       // corner, clear of the court lines
    set(tintCache[url] = { '--v-sky': px(2, 2), '--v-floor': px(4, SCENE_H - 3), '--v-edge': `url(${strip.toDataURL()})`, '--v-tile': `url(${tile.toDataURL()})`, ...sceneFloor[url] });
  };
  img.src = url;
}
function renderScene() {
  if (!$('#scene')) return; // the old painted title stage is not on the page
  const scene = $('#scene'), C = STAGE[settings.mode];
  // Grow the whole stage with the window: tall enough to fill the screen above the mode picker, never smaller
  // than 2x pixels, and no bigger than the width allows. Everything inside scales together, so the court keeps its shape.
  const below = innerWidth > 860 && innerHeight >= 700 ? 250 : 330; // room kept for the mode picker
  stageF = Math.max(1, Math.min(1.8, (innerHeight - below) / 440, innerWidth / 300));
  document.documentElement.style.setProperty('--sf', stageF.toFixed(3));
  stageK = Math.min(1, (innerWidth - 40) / (600 * stageF)); // pull everything in on narrow screens
  const hero = $('#title-hero'), lede = hero.querySelector('.lede');
  // the stands top out just under the subtitle; where the title runs taller than the sky (phones), the stage art
  // moves down by --stage-dy so the subtitle keeps a plain roof or sky behind it
  let dy = 0;
  if (lede && lede.offsetParent) {
    const under = lede.getBoundingClientRect().bottom - hero.getBoundingClientRect().top + 18;
    dy = Math.max(0, Math.ceil(under - 200 * stageF));
    sceneTop = Math.round(clamp((under - dy) / (2 * stageF), 56, 100));
  }
  document.documentElement.style.setProperty('--stage-dy', `${dy}px`);
  const bd = sceneBackdrop();
  $('#title-hero').style.backgroundImage = `url(${bd}), var(--v-edge, none)`;
  sceneTint(bd);
  scene.style.setProperty('--ball', `url(${sceneBall()})`);
  $('#bug-logo').src = scoreLogo().toDataURL();
  const cast = [[], []];
  ['near', 'far'].forEach((side, t) => {
    const box = $(`#scene-${side}`); box.innerHTML = '';
    C[side].forEach(([x, z], i) => {
      const m = sceneMon(scenePicks[side][i], !t);
      box.appendChild(m.el);
      cast[t].push(Object.assign(m, { hx: x, hz: z, x, z, k0: sp(x, 0, z).k, air: 0, move: null, jump: null }));
    });
  });
  // the net: tape at NET_H, a mesh band under it, posts just outside the sidelines
  const L = sp(-(C.hw + 0.6), NET_H, 0), R = sp(C.hw + 0.6, NET_H, 0), lo = sp(0, NET_H - 0.8, 0), foot = sp(0, 0, 0);
  const net = scene.querySelector('.net');
  net.style.left = `calc(50% + ${L.x}px)`; net.style.width = `${R.x - L.x}px`;
  net.style.top = `${L.y}px`; net.style.height = `${lo.y - L.y}px`;
  net.style.setProperty('--post', `${foot.y - L.y + 6}px`);
  Rally.cast(C, cast);
}

// ---- Attract mode: the stage plays a demo rally the way volleyball is played. A serve from behind the end line,
// then each side passes to its setter, the setter puts it up, and a hitter runs in, jumps and spikes it over.
// The other side digs it and plays it back, until a spike hits the sand and the scoreboard counts the point.
// Runs only while the title is on screen and the reader has not asked for reduced motion; otherwise a still frame.
const Rally = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const lerp = (a, b, t) => a + (b - a) * t, ease = t => t * t * (3 - 2 * t);
  let C = null, P = [[], []], ball = { x: 0, h: 2.6, z: -3 }, leg = null, wait = 0, held = null;
  let touches = 0, rallyLen = 3, score = [0, 0], serve = 0, server = [0, 0];
  let raf = 0, last = 0, on = false;
  const els = {};
  const dir = t => (t ? 1 : -1); // which way is "into my own court" for team t (0 = near, 1 = far)

  function moveTo(p, x, z, dur) { p.move = { x0: p.x, z0: p.z, x1: x, z1: z, t: 0, dur: Math.max(0.05, dur) }; }
  function jump(p, H, dur, delay = 0) { p.jump = { t: -delay, dur, H }; }
  function home(t, dur = 0.9) { for (const p of P[t]) moveTo(p, p.hx, p.hz, dur); }
  // A flight of the ball. Height is a parabola in time (gravity), x and z move at a steady rate. `peak` is how high
  // the arc rises above a straight line; it is raised if needed so the ball clears the tape by `clear`.
  function fly(to, dur, peak, then, clear) {
    const a = { ...ball };
    let c = peak;
    if (clear !== undefined && (a.z < 0) !== (to.z < 0)) {
      const u = -a.z / (to.z - a.z), base = lerp(a.h, to.h, u);
      c = Math.max(c, (NET_H + clear - base) / (4 * u * (1 - u)));
    }
    leg = { a, b: to, c, dur, t: 0, then };
  }
  const reach = (p, h) => ({ x: p.x, h, z: p.z });
  // the spot a player will be standing on when the ball gets there
  const spotOf = p => (p.move ? { x: p.move.x1, z: p.move.z1 } : { x: p.x, z: p.z });

  function startRally() {
    touches = 0; rallyLen = 1 + Math.floor(Math.random() * 4);
    const t = serve, s = P[t][server[t] % P[t].length];
    const sz = t ? C.hl + 0.9 : -(C.hl * 0.5 + 1.4); // far server stands behind the end line; yours steps back off screen
    moveTo(s, s.hx * 0.7, sz, 1.0);
    held = s; ball = reach(s, 1.0);
    wait = 1.2;
    leg = { idle: true, then: () => toss(t, s) };
  }
  function toss(t, s) {
    held = null;
    fly(reach(s, 3.0), 0.75, 0.5, () => serveOver(t, s));
    jump(s, 0.9, 0.6, 0.35);
  }
  function serveOver(t, s) {
    const o = 1 - t, r = P[o][Math.floor(Math.random() * P[o].length)];
    const x = clamp(r.hx + rand(-1.6, 1.6), -C.hw + 0.8, C.hw - 0.8), z = r.hz + rand(-1, 1.2) * dir(o);
    moveTo(r, x, z, 1.0);
    fly({ x, h: 0.9, z }, 1.35, 1.6, () => receive(o, r), 0.6);
    server[t]++;
    setTimeout(() => moveTo(s, s.hx, s.hz, 1.2), 500);
  }
  // first touch: a forearm pass up to the setter by the net
  function receive(t, r) {
    touches++;
    const mates = P[t].filter(p => p !== r);
    const setter = mates.reduce((a, b) => (Math.abs(a.hx) < Math.abs(b.hx) ? a : b)); // whoever plays nearest the middle
    const x = clamp(setter.hx * 0.35, -C.hw * 0.4, C.hw * 0.4), z = 1.4 * dir(t);
    moveTo(setter, x, z, 0.85);
    jump(r, 0.15, 0.25);
    fly({ x, h: 2.4, z }, 1.05, 1.6, () => set(t, setter, r));
  }
  // second touch: the setter puts it up in front of a hitter, who runs in and jumps
  function set(t, setter, passer) {
    const pool = P[t].filter(p => p !== setter), hitter = settings.mode === 2 ? passer : pool[Math.floor(Math.random() * pool.length)];
    const x = clamp(hitter.hx * 0.75, -C.hw + 1.2, C.hw - 1.2), z = 2.2 * dir(t);
    moveTo(hitter, x, z, 0.75);
    jump(setter, 0.25, 0.3);
    jump(hitter, 0.9, 0.7, 0.95 - 0.35);
    fly({ x, h: 3.1, z }, 0.95, 1.0, () => spike(t, hitter, setter));
  }
  // third touch: the spike, either dug by the other side or into the sand for a point
  function spike(t, hitter, setter) {
    const o = 1 - t, dug = touches < rallyLen * 3 && Math.random() < 0.8;
    touches++;
    setTimeout(() => home(t, 0.9), 250);
    if (dug) {
      const d = P[o][Math.floor(Math.random() * P[o].length)], at = spotOf(d);
      const x = clamp(at.x + rand(-1.2, 1.2), -C.hw + 0.6, C.hw - 0.6), z = at.z + rand(-0.8, 0.8);
      moveTo(d, x, z, 0.35);
      fly({ x, h: 0.6, z }, 0.42, 0.05, () => receive(o, d), 0.15);
    } else {
      let best = null, bd = -1; // the open spot furthest from every defender
      for (let i = 0; i < 12; i++) {
        const x = rand(-C.hw + 1, C.hw - 1), z = rand(1.8, C.hl - 1.5) * dir(o);
        const dd = Math.min(...P[o].map(p => Math.hypot(p.x - x, (p.z - z) * 0.7)));
        if (dd > bd) { bd = dd; best = { x, z }; }
      }
      const d = P[o].reduce((a, b) => (Math.hypot(a.x - best.x, a.z - best.z) < Math.hypot(b.x - best.x, b.z - best.z) ? a : b));
      moveTo(d, lerp(d.x, best.x, 0.4), lerp(d.z, best.z, 0.4), 0.4); // a lunge that comes up short
      fly({ x: best.x, h: 0, z: best.z }, 0.45, 0.05, () => kill(t, best), 0.15);
    }
  }
  function kill(t, at) {
    burst(at.x, at.z); point(t);
    const away = dir(1 - t);
    fly({ x: at.x + rand(-1, 1), h: 0, z: at.z + away * 2.2 }, 0.5, 0.7, () => {
      leg = null; wait = 1.0;
      home(0, 1.0); home(1, 1.0);
      if (Math.max(...score) >= settings.target) setTimeout(() => { score = [0, 0]; document.querySelectorAll('#bug em').forEach(e => (e.textContent = '0')); }, 900);
    });
  }
  function burst(x, z) {
    const p = sp(x, 0, z);
    els.burst.style.translate = `${p.x}px ${p.y}px`;
    els.burst.style.zIndex = z > 0 ? 1 : 2;
    els.burst.animate([{ opacity: 1, scale: 0.4 }, { opacity: 0, scale: 1.4 * p.k / 30 }], { duration: 420, easing: 'ease-out' });
  }
  function point(k) {
    score[k]++;
    const row = document.querySelectorAll('#bug .bug-row')[k];
    row.querySelector('em').textContent = score[k];
    row.classList.add('pt'); setTimeout(() => row.classList.remove('pt'), 900);
    serve = k; markServe();
  }
  function markServe() { document.querySelectorAll('#bug .bug-row').forEach((r, k) => r.classList.toggle('serving', k === serve)); }

  function draw() {
    for (const team of P) for (const p of team) {
      const f = sp(p.x, p.air, p.z), sc = f.k / p.k0;
      p.el.style.transform = `translate(${(f.x - p.fx * sc).toFixed(1)}px, ${(f.y - p.fy * sc).toFixed(1)}px) scale(${sc.toFixed(3)})`;
    }
    const b = sp(ball.x, ball.h, ball.z), g = sp(ball.x, 0, ball.z), far = ball.z > 0;
    els.bx.style.translate = `${b.x.toFixed(1)}px ${b.y.toFixed(1)}px`;
    els.bx.style.zIndex = far ? 1 : 4; // behind the net on the far side, in front of it on yours
    els.ball.style.scale = clamp(b.k / 30, 0.4, 1.6).toFixed(3);
    els.sh.style.translate = `${g.x.toFixed(1)}px ${g.y.toFixed(1)}px`;
    els.sh.style.zIndex = far ? 1 : 2;
    els.sh.style.scale = clamp(g.k / 34, 0.3, 1.5).toFixed(3);
  }
  function step(dt) {
    for (const team of P) for (const p of team) {
      if (p.move) {
        const m = p.move; m.t = Math.min(1, m.t + dt / m.dur); const e = ease(m.t);
        p.x = lerp(m.x0, m.x1, e); p.z = lerp(m.z0, m.z1, e); if (m.t >= 1) p.move = null;
      }
      if (p.jump) {
        const j = p.jump; j.t += dt; const u = j.t / j.dur;
        p.air = u <= 0 ? 0 : u >= 1 ? 0 : j.H * 4 * u * (1 - u); if (u >= 1) p.jump = null;
      }
    }
    if (held) ball = reach(held, 1.0 + held.air);
    if (wait > 0) { wait -= dt; if (wait <= 0) { wait = 0; if (leg && leg.idle) { const f = leg.then; leg = null; f(); } else startRally(); } return; }
    if (!leg) { startRally(); return; }
    if (leg.idle) return;
    leg.t = Math.min(1, leg.t + dt / leg.dur);
    const t = leg.t;
    ball = { x: lerp(leg.a.x, leg.b.x, t), z: lerp(leg.a.z, leg.b.z, t), h: lerp(leg.a.h, leg.b.h, t) + leg.c * 4 * t * (1 - t) };
    if (t >= 1) { const f = leg.then; leg = null; f && f(); }
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function still() { // the frame shown with reduced motion: a set hanging over your side of the net
    for (const team of P) for (const p of team) { p.x = p.hx; p.z = p.hz; p.air = 0; p.move = p.jump = null; }
    const h = P[0][0];
    ball = { x: clamp(h.hx * 0.75, -C.hw + 1.2, C.hw - 1.2), h: 3.0, z: -2.2 };
    draw();
  }
  function run(want) {
    if (!$('#scene')) return;
    want = want && !reduce.matches;
    if (want === on) return;
    on = want; $('#scene').classList.toggle('live', on);
    cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } else if (C) still();
  }
  reduce.addEventListener('change', () => run(!$('#scr-title').hidden));
  return {
    cast(layout, players) { // new players: start a fresh rally with them
      C = layout; P = players;
      Object.assign(els, { bx: $('#scene .ball-x'), ball: $('#scene .ball'), sh: $('#scene .ball-shadow'), burst: $('#scene .burst') });
      leg = null; held = null; wait = 0.6; server = [0, 0]; markServe();
      still();
    },
    run,
  };
})();
let sceneW = innerWidth, sceneH = innerHeight;
addEventListener('resize', () => {
  if ((Math.abs(innerWidth - sceneW) > 40 || Math.abs(innerHeight - sceneH) > 60) && !$('#scr-title').hidden) { sceneW = innerWidth; sceneH = innerHeight; renderScene(); }
});
$('#scr-title').classList.add('intro');
setTimeout(() => $('#scr-title').classList.remove('intro'), 1200);

// ---- Title background: a computer-vs-computer 6 v 6 match in the championship arena, filmed by a slow, panning
// broadcast camera. It borrows the match settings while it runs; your own settings and teams come back when you leave.
let demoSaved = null;
const realSettings = () => (demoSaved ? demoSaved.settings : settings);
function demoMatch() {
  const pool = DEX.filter(m => !m.leg).sort(() => Math.random() - 0.5);
  teams = [0, 1].map(k => pool.slice(k * 7, k * 7 + 7).map((m, i) => makeEntry(m, i === 0)));
  const ids = Object.keys(CLUBS).sort(() => Math.random() - 0.5);
  clubs = [CLUBS[ids[0]], CLUBS[ids[1]]];
  newMatch(true);
  for (const p of G.players) spriteImg(p.mon.id, p.side === 0);
  G.camT0 = Math.random() * 60; // start each match at a different point of the camera's sweep
}
function startDemo() {
  if (demoSaved) return;
  demoSaved = { settings: JSON.parse(JSON.stringify(settings)), teams, clubs, G };
  Object.assign(settings, { mode: 6, diff: 'hard', target: 25, sets: 1, time: 'day', camMode: 'follow', zoom: 1 });
  settings.venue = { ...settings.venue, 6: 'night' };
  skyCache = null; skyTop = null; crowdCache = null; palmCache = null;
  demoMatch(); sizeCanvas();
}
function stopDemo() {
  if (!demoSaved) return;
  Object.assign(settings, demoSaved.settings);
  teams = demoSaved.teams; clubs = demoSaved.clubs;
  if (G && G.demo) G = demoSaved.G;
  demoSaved = null; skyCache = null; skyTop = null; crowdCache = null; palmCache = null;
}
// The camera sweeps slowly from one side of the court to the other, rising and falling and dollying in and out,
// and turns a little toward the ball. update() eases toward this, so every move is smooth.
function demoCam() {
  const t = G.time + (G.camT0 || 0), b = G.ball;
  const sweep = Math.sin(t * 0.09), rise = Math.sin(t * 0.063 + 1.3), dolly = Math.sin(t * 0.047 + 0.4);
  const x = clamp(sweep * HW * 0.75 + b.x * 0.15, -HW, HW);
  const z = -HL - CAM.back - 1.5 - 3.5 * (0.5 + 0.5 * dolly);
  const y = CAM.y * (1.05 + 0.35 * rise);
  // aim a little left of the play, so on wide screens the match sits in the open space right of the menu
  const aim = b.x * 0.4 - (innerWidth > 760 ? HW * 0.45 : 0);
  const yaw = clamp(Math.atan2(aim - x, Math.max(4, b.z * 0.3 - z)) * 0.8, -0.26, 0.2);
  return { x, y, z, yaw, pitch: CAM.pitch + 0.04 * rise };
}

// ---- The main menu
const qp = $('#qp'), qpBtn = $('#mm-quick');
qpBtn.addEventListener('click', () => {
  const open = qp.hidden; qp.hidden = !open; qpBtn.setAttribute('aria-expanded', String(open));
  if (open) qp.querySelector('button').focus();
});
function pickMode(n) { // Quick play: the court you pick starts the usual setup, on to choosing your club
  Sfx.init(); stopDemo();
  qp.hidden = true; qpBtn.setAttribute('aria-expanded', 'false'); // closed again when you come back
  if (n !== settings.mode) settings.mode = n;
  saveSettings(); renderClubPick(); show('scr-team');
}
$('#opt-mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) pickMode(Number(b.dataset.v)); });
for (const b of document.querySelectorAll('#main-menu [aria-disabled="true"]')) b.addEventListener('click', e => e.preventDefault()); // Franchise and Road to Glory: not yet
// up and down arrows move through the menu, like a console game
$('#main-menu').addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const items = [...document.querySelectorAll('#main-menu .mm, #qp:not([hidden]) button')], i = items.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
});
// dialogs: How to play and Settings
for (const d of document.querySelectorAll('#scr-title dialog')) {
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
}
$('#mm-howto').addEventListener('click', () => $('#howto-dlg').showModal());
$('#mm-settings').addEventListener('click', () => { markSettings(); $('#settings-dlg').showModal(); });
const SET_ROWS = [['#set-diff', 'diff', String], ['#set-target', 'target', Number], ['#set-sets', 'sets', Number], ['#set-cam', 'camMode', String]];
function markSettings() {
  const r = realSettings();
  for (const [box, key] of SET_ROWS) for (const b of document.querySelectorAll(`${box} button`)) b.setAttribute('aria-pressed', String(b.dataset.v === String(r[key])));
  for (const b of document.querySelectorAll('#set-sound button')) b.setAttribute('aria-pressed', String((b.dataset.v === 'off') === Sfx.muted));
  // the match setup screen shows the same rules
  for (const [box, key] of [['#opt-diff', 'diff'], ['#opt-target', 'target'], ['#opt-sets', 'sets']])
    for (const b of document.querySelectorAll(`${box} button`)) b.setAttribute('aria-pressed', String(b.dataset.v === String(r[key])));
}
for (const [box, key, conv] of SET_ROWS) $(box).addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  realSettings()[key] = conv(b.dataset.v); saveSettings(); markSettings();
});
$('#set-sound').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Sfx.init(); Sfx.muted = b.dataset.v === 'off'; markSettings(); });
$('#btn-team-next').addEventListener('click', () => { renderSummary(); renderVenuePick(); show('scr-venue'); });
renderSummary();
$('#btn-start').addEventListener('click', () => { Sfx.init(); saveSettings(); buildPick(); show('scr-pick'); });
// Quick match: the best fit of your three captain offers, then the strongest Pokémon of each draft round.
function quickTeams() {
  buildPick();
  const fit = ROLES[capPick.role].fit, best = (list, f) => list.reduce((a, b) => (f(b) > f(a) ? b : a));
  draft = { starter: best(capPick.offers, m => fit(makeEntry(m, true).r)), picks: [], offers: [], rerolls: 2 };
  makeOffers();
  while (draft.picks.length < teamSize() - 1) { draft.picks.push(best(draft.offers, m => m.ovr)); makeOffers(); }
  buildTeams();
}
$('#btn-quick').addEventListener('click', () => { Sfx.init(); quickTeams(); renderMatchup(); show('scr-matchup'); });

// ---------- pick your position, then your Pokémon ----------
// Three random Pokémon from those best suited to the position (top third of the dex by that role's fit).
function captainOffers(role) {
  const fit = ROLES[role].fit;
  const pool = DEX.filter(m => !m.leg || Math.random() < 0.25)
    .sort((a, b) => fit(makeEntry(b, true).r) - fit(makeEntry(a, true).r)).slice(0, 50);
  const out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function buildPick() {
  const role = settings.role[settings.mode];
  capPick = { role, offers: captainOffers(role), rerolls: 2 };
  renderPick();
}
function renderPick() {
  saveSettings();
  const n = settings.mode, role = settings.role[n];
  if (!capPick || capPick.role !== role) capPick = { role, offers: captainOffers(role), rerolls: capPick ? capPick.rerolls : 2 };
  const pick = $('#opt-role'); pick.innerHTML = '';
  for (const r of YOUR_ROLES[n]) {
    const btn = el('button', '', ROLES[r].name);
    btn.type = 'button'; btn.setAttribute('aria-pressed', String(role === r));
    if (role === r) btn.setAttribute('data-autofocus', '');
    btn.addEventListener('click', () => { settings.role[n] = r; renderPick(); $('#opt-role [aria-pressed="true"]').focus(); });
    pick.appendChild(btn);
  }
  $('#role-desc').textContent = ROLE_DESC[role];
  const grid = $('#pick-grid'); grid.innerHTML = '';
  for (const mon of capPick.offers) {
    const e = makeEntry(mon, true);
    const card = monCard(e, { button: true });
    card.setAttribute('aria-label', `Play ${ROLES[role].name} as ${mon.name}, overall ${e.ovr}`);
    card.addEventListener('click', () => startDraft(mon));
    grid.appendChild(card);
  }
  const rr = $('#btn-reroll-cap');
  rr.textContent = `New offers (${capPick.rerolls} left)`;
  rr.disabled = capPick.rerolls <= 0;
}
$('#btn-reroll-cap').addEventListener('click', () => {
  if (!capPick || capPick.rerolls <= 0) return;
  capPick.rerolls--; capPick.offers = captainOffers(capPick.role); renderPick();
  const f = document.querySelector('#pick-grid .card'); if (f) f.focus();
});

// ---------- draft ----------
function startDraft(starter) {
  draft = { starter, picks: [], offers: [], rerolls: 2 };
  makeOffers(); renderDraft(); show('scr-draft');
}
function draftPool() {
  const taken = new Set([draft.starter.id, ...draft.picks.map(m => m.id)]);
  return DEX.filter(m => !taken.has(m.id));
}
function makeOffers() {
  const pool = draftPool(), out = [];
  while (out.length < 3 && pool.length) {
    const wts = pool.map(m => (m.leg ? 0.25 : 1) * (0.6 + m.ovr / 100));
    let x = Math.random() * wts.reduce((a, b) => a + b, 0), i = 0;
    while ((x -= wts[i]) > 0) i++;
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  draft.offers = out;
}
function renderDraft() {
  const need = teamSize() - 1, round = draft.picks.length + 1;
  $('#draft-round').textContent = need === 1 ? 'Pick your partner' : `Round ${round} of ${need}`;
  $('#draft-help').textContent = settings.mode === 6
    ? 'Pick one teammate from these three offers. You need six: five on court plus a libero. Positions are given out by stats on the matchup screen.'
    : 'Pick one teammate from these three offers.';
  const offers = $('#offers'); offers.innerHTML = '';
  draft.offers.forEach((mon, i) => {
    const card = monCard(mon, { button: true });
    card.setAttribute('aria-label', `Draft ${mon.name}, overall ${mon.ovr}`);
    if (i === 0) card.setAttribute('data-autofocus', '');
    card.addEventListener('click', () => draftPick(mon));
    offers.appendChild(card);
  });
  const rr = $('#btn-reroll');
  rr.textContent = `New offers (${draft.rerolls} left)`;
  rr.disabled = draft.rerolls <= 0;
  renderRoster();
}
function renderRoster() {
  const list = $('#roster'); list.innerHTML = '';
  const es = [makeEntry(draft.starter, true), ...draft.picks.map(m => makeEntry(m, false))];
  es.forEach((e, i) => {
    const li = el('li', 'roster-item');
    li.appendChild(portrait(e.mon, 96, 64));
    li.appendChild(el('div', 'ri-text', `<b>${e.mon.name}</b><span>${i === 0 ? 'You (captain)' : 'Teammate'}</span>`));
    li.appendChild(el('div', 'ri-ovr', String(e.ovr)));
    list.appendChild(li);
  });
  for (let i = es.length; i < teamSize(); i++) list.appendChild(el('li', 'roster-item empty', `<span>${settings.mode === 6 && i === 6 ? 'Open slot (libero)' : 'Open slot'}</span>`));
  $('#roster-ovr').textContent = `Team rating ${teamOvr(es)}`;
}
$('#btn-reroll').addEventListener('click', () => {
  if (draft.rerolls <= 0) return;
  draft.rerolls--; makeOffers(); renderDraft();
  const f = document.querySelector('#offers .card'); if (f) f.focus();
});
function draftPick(mon) {
  draft.picks.push(mon);
  if (draft.picks.length >= teamSize() - 1) { buildTeams(); renderMatchup(); show('scr-matchup'); return; }
  makeOffers(); renderDraft();
  const f = document.querySelector('#offers .card'); if (f) f.focus();
}

function buildTeams() {
  const mine = [makeEntry(draft.starter, true), ...draft.picks.map(m => makeEntry(m, false))];
  const n = teamSize();
  const myDrafted = draft.picks.length ? draft.picks.reduce((a, m) => a + m.ovr, 0) / draft.picks.length : 55;
  const target = myDrafted + DIFF[settings.diff].teamOffset;
  const capPool = DEX.filter(m => !m.leg && m.id !== draft.starter.id && !draft.picks.includes(m));
  const rivalCap = pickOne(capPool);
  const taken = new Set([draft.starter.id, rivalCap.id, ...draft.picks.map(m => m.id)]);
  const pool = DEX.filter(m => !taken.has(m.id) && (!m.leg || Math.random() < 0.3));
  const theirs = [makeEntry(rivalCap, true)];
  let sum = 0;
  for (let i = 0; i < n - 1; i++) {
    const want = target * (i + 1) - sum; // keep the running average on target
    const near = pool.slice().sort((a, b) => Math.abs(a.ovr - want) - Math.abs(b.ovr - want)).slice(0, 10);
    const m = pickOne(near);
    pool.splice(pool.indexOf(m), 1);
    sum += m.ovr; theirs.push(makeEntry(m, false));
  }
  teams = [mine, theirs];
  const pickRival = settings.club[1] === 'random' || settings.club[1] === settings.club[0];
  const rival = pickRival ? pickOne(Object.keys(CLUBS).filter(c => c !== settings.club[0])) : settings.club[1];
  clubs = [CLUBS[settings.club[0]], CLUBS[rival]];
}

function renderMatchup() {
  const n = settings.mode;
  for (let s = 0; s < 2; s++) {
    const box = $(s === 0 ? '#mu-you' : '#mu-rival');
    box.innerHTML = '';
    box.appendChild(el('h3', '', `<span class="mu-name">${clubs ? crestImg(clubId(clubs[s]), 28) : ''}${teamName(s)}</span> <span class="mu-ovr">${teamOvr(teams[s])}</span>`));
    const lu = lineup(teams[s], s === 0 ? teams[0][0] : null, settings.role[n], n);
    const ul = el('ul', 'mu-list');
    for (const { entry: e, role } of lu) {
      const li = el('li', '');
      li.appendChild(portrait(e.mon, 96, 64));
      const who = s === 0 && e === teams[0][0] ? 'You' : e.mon.types.map(cap).join(' / ');
      li.appendChild(el('div', 'ri-text', `<b>${e.mon.name}</b><span>${who}</span>`));
      li.appendChild(el('span', 'role-tag', ROLES[role].short));
      li.appendChild(el('div', 'ri-ovr', String(e.ovr)));
      ul.appendChild(li);
    }
    box.appendChild(ul);
    if (n === 6) { // the starting rotation, seen from that team's side of the net
      const court = el('div', 'rot-court');
      court.appendChild(el('div', 'rot-net', 'NET'));
      const lib = lu[6], subbed = [0, 4, 5].find(i => lu[i].role === 'MB'); // the libero takes the back-row middle's place
      for (const z of [4, 3, 2, 5, 6, 1]) {
        const { entry: e, role } = z - 1 === subbed ? lib : lu[z - 1];
        const you = s === 0 && e === teams[0][0];
        court.appendChild(el('div', 'rot-cell' + (you ? ' you' : '') + (role === 'L' ? ' lib' : ''), `<i>${z}</i><b>${ROLES[role].short}</b><span>${e.mon.name}</span>`));
      }
      box.appendChild(court);
      box.appendChild(el('p', 'rot-note', `Starting rotation. Zone 1 serves, and the team rotates one zone clockwise each time it wins back the serve. The libero (${lib.entry.mon.name}) plays for the middle blocker in the back row and comes off when that middle rotates to the front or is due to serve; ${lu[subbed].entry.mon.name} starts on the bench.`));
    }
  }
  $('#mu-meta').textContent = `${n} v ${n} · You play ${ROLES[settings.role[n]].name} · ${cap(settings.diff)} · ${matchFormat()}`;
}
function matchFormat() {
  if (settings.sets === 1) return `one set to ${settings.target}, win by 2`;
  const fifth = settings.sets === 5 && decider() < settings.target ? `, 5th set to ${decider()}` : '';
  return `best of ${settings.sets} (first to ${setsToWin()} sets), sets to ${settings.target}${fifth}, win by 2`;
}
$('#btn-play').addEventListener('click', startMatch);
function startMatch() {
  Sfx.init();
  newMatch(); skyCache = null; skyTop = null; crowdCache = null; palmCache = null; show('stage'); sizeCanvas();
  for (const p of G.players) spriteImg(p.mon.id, p.side === 0);
  if (document.fonts) document.fonts.load(`8px ${PX_FONT}`);
  for (const k in keys) keys[k] = false;
  updateTouchUI();
}

// ---------- tutorial ----------
// A run through every position of one game mode. Each position is a real point-by-point game with the rival on Easy,
// no rotations and no end; a coach panel lists the drills and ticks each one off when you do it.
// Step fields: text, ev (the event that counts), test (optional check on it), serve ('you', 'us' or 'them': who serves while
// this drill is on), mine (teammates leave the first ball to you), callMe (your setter looks for you).
const TUT_BASICS = [
  { title: 'Move', text: 'Move with W A S D. You only move while you hold them.', ev: 'move' },
  { title: 'Jump', text: 'Hold Space to crouch and charge, let go to jump. Charge it all the way for a full-height jump.', ev: 'jump', test: d => d.c >= 0.95 },
  { title: 'Camera', text: 'Press C to switch between a camera that follows you and one that holds still. V or the mouse wheel zooms.', ev: 'cam' },
];
const T_SERVE = { title: 'Serve', text: 'Hold left click to toss, then let go as the ball drops back to your hand. The serve goes where the cursor points.', ev: 'serve', test: d => d.q > 0, serve: 'you' };
const T_PASS = { title: 'Receive', text: 'Their serve is yours: get under the black carets, hold left click as the ball comes in and let go to pass.', ev: 'pass', test: d => d.first, mine: true };
const T_PERFECT = { title: 'Perfect pass', text: 'Pass again, and let go with the meter in the gold notch at the top for a PERFECT pass.', ev: 'pass', test: d => d.first && d.q >= 1, mine: true };
const T_DIVE = { title: 'Dive', text: 'Right click on the ground to dive. Hold a direction to dive that way; hold none and you dive at the ball.', ev: 'dive' };
const T_BLOCKUP = { title: 'Block', text: 'When they attack, stand at the net, jump just after their hitter jumps and right click in the air to put your block up.', ev: 'blockup', test: d => d.net, serve: 'us' };
const T_BLOCK = { title: 'Touch a spike', text: 'Now get a hand on one of their spikes: stand at the net in front of their hitter, jump just after they jump and right click. A block does not use one of your 3 touches.', ev: 'block', serve: 'us' };
const T_SPIKE = { title: 'Spike', text: 'Your setter is looking for you. Follow the green ring, jump as the ball comes down and hold left click; let go to swing.', ev: 'spike', callMe: true };
const TUT_ROLE = {
  B: [T_SERVE, T_BLOCKUP, T_BLOCK, T_SPIKE],
  D: [T_PASS, T_PERFECT, T_DIVE,
    { title: 'Set', text: 'When your partner passes and the ball comes to you, press E to set them.', ev: 'set', test: d => d.tm && d.tm.set }],
  S: [T_SERVE,
    { title: 'Set', text: 'Your team passes to you. Point the cursor at a hitter (the gold tag shows who) and press E as the ball reaches you.', ev: 'set', test: d => d.tm && d.tm.set },
    { title: 'Quick set', text: 'Hold E early, so the blue meter is full when you touch the ball: a low, fast QUICK SET.', ev: 'set', test: d => d.tm && d.tm.quick },
    { title: 'Spread it', text: 'Set two different hitters: move the cursor to a new one before you press E.', ev: 'set', test: (d, T) => { if (d.to) T.hitters.add(d.to); return T.hitters.size >= 2; } }],
  OH: [T_PASS,
    { title: 'Call for it', text: 'Press 2 to call SET ME! Your setter looks for you for a few seconds after.', ev: 'chat', test: d => d.k === 1 },
    T_SPIKE,
    { title: 'Big swing', text: 'Spike again with the meter at GOOD or PERFECT when you meet the ball, for a harder hit.', ev: 'spike', test: d => d.q >= 0.65, callMe: true }],
  MB: [T_BLOCKUP, T_BLOCK,
    { ...T_SPIKE, text: 'Middles hit quick sets: be at the net and in the air early, as the setter touches the ball, and hold left click.' }],
  OPP: [T_SERVE, T_SPIKE, T_BLOCKUP],
  L: [T_PASS, T_PERFECT, T_DIVE,
    { title: 'Call it', text: 'Press 1 to call MINE! and your teammates leave the next ball to you.', ev: 'chat', test: d => d.k === 0 }],
};
const tutStep = () => (TUT && !TUT.wait ? TUT.steps[TUT.si] || null : null);
function tutServe() { // who serves follows the drill
  const st = tutStep();
  if (st) G.serving = st.serve === 'you' || st.serve === 'us' ? 0 : 1;
}
function tutServer() {
  const st = tutStep(), me = G && G.all[0].find(p => p.human);
  if (!st || !me || G.serving !== 0) return null;
  if (st.serve === 'you' && G.sides[0].includes(me)) return me;
  return G.sides[0].find(p => p !== me) || null; // a teammate serves, so you are free to set up at the net
}
function tutEvent(ev, d = {}) {
  const st = tutStep();
  if (!st || st.ev !== ev || (st.test && !st.test(d, TUT))) return;
  tutNext(true);
}
function tutNext(done) {
  const st = tutStep(); if (!st) return;
  TUT.marks[TUT.si] = done ? 'done' : 'skipped';
  TUT.si++;
  if (done) { toast(`${st.title.toUpperCase()}: DONE`); Sfx.tone(880, 0.08, 'square', 0.03); Sfx.tone(1320, 0.12, 'square', 0.03, 0, 0.08); }
  if (TUT.si >= TUT.steps.length) TUT.endAt = G.time + 1.4; // let the play finish, then the card
  else if (G.phase === 'serve' && !G.toss && G.timer < 0.9) { // a new drill can change who serves: set the serve up again
    const before = G.server; tutServe(); if ((tutServer() || G.sides[G.serving][0]) !== before) startServe();
  }
  renderCoach();
}
function tutTick(dt, me) {
  if (TUT.wait) return;
  if (TUT.endAt != null && G.time >= TUT.endAt) { TUT.endAt = null; tutRoleDone(); return; }
  const st = tutStep();
  if (st && st.ev === 'move' && me && (keys.left || keys.right || keys.up || keys.down)) {
    TUT.moved += Math.hypot(me.vx, me.vz) * dt;
    if (TUT.moved > 4) tutNext(true);
  }
}
function startTutorial(mode) {
  Sfx.init();
  TUT = { mode, roles: YOUR_ROLES[mode], ri: 0, saved: JSON.parse(JSON.stringify(settings)) };
  Object.assign(settings, { mode, diff: 'easy', target: 25, sets: 1 });
  tutRole();
}
function tutRole() {
  const role = TUT.roles[TUT.ri];
  settings.role[TUT.mode] = role;
  quickTeams();
  Object.assign(TUT, { steps: [...(TUT.ri === 0 ? TUT_BASICS : []), ...TUT_ROLE[role]], si: 0, marks: [], moved: 0, hitters: new Set(), wait: false, endAt: null });
  startMatch();
  renderCoach();
}
function tutRoleDone() {
  TUT.wait = true; G.paused = true;
  renderCoach();
  const b = $('#coach .cta'); if (b) b.focus({ preventScroll: true });
}
function endTutorial() {
  if (!TUT) return;
  const cam = { camMode: settings.camMode, zoom: settings.zoom };
  Object.assign(settings, TUT.saved, cam);
  TUT = null; G = null;
  $('#coach').hidden = true;
  saveSettings(); renderSummary(); show('scr-title');
}
function renderCoach() {
  const box = $('#coach');
  box.hidden = !TUT;
  if (!TUT) return;
  const role = TUT.roles[TUT.ri], n = TUT.roles.length, mode = `${TUT.mode} v ${TUT.mode}`;
  const steps = TUT.steps.map((st, i) => {
    const m = TUT.marks[i], cur = i === TUT.si && !TUT.wait;
    const tag = m === 'done' ? '<i aria-hidden="true">✓</i>' : m === 'skipped' ? '<i aria-hidden="true">-</i>' : `<i aria-hidden="true">${i + 1}</i>`;
    const state = m === 'done' ? ' (done)' : m === 'skipped' ? ' (skipped)' : cur ? ' (now)' : '';
    return `<li class="${m || ''}${cur ? ' now' : ''}">${tag}<span>${st.title}<span class="vh">${state}</span></span></li>`;
  }).join('');
  let body;
  if (TUT.wait) {
    const last = TUT.ri >= n - 1, next = last ? null : TUT.roles[TUT.ri + 1];
    body = `<p class="coach-done">${ROLES[role].name}: done</p>`
      + (last ? `<p>That is every position in ${mode}. You are ready for a real match.</p>
           <div class="coach-actions"><button type="button" class="cta small" data-tut="menu">Back to menu</button></div>`
        : `<p>Up next, <b>${ROLES[next].name}</b>. ${ROLE_DESC[next]}</p>
           <div class="coach-actions"><button type="button" class="cta small" data-tut="next">Next: ${ROLES[next].name} <span aria-hidden="true">▶</span></button>
           <button type="button" class="ghost small" data-tut="quit">End tutorial</button></div>`);
  } else {
    const st = TUT.steps[TUT.si];
    body = st ? `<p class="coach-now">${st.text}</p>` : '<p class="coach-now">Nice work. Finishing the point...</p>';
    body += `<div class="coach-actions"><button type="button" class="ghost small" data-tut="skip"${st ? '' : ' disabled'}>Skip step</button>
      <button type="button" class="ghost small" data-tut="quit">End tutorial</button></div>`;
  }
  box.innerHTML = `<p class="coach-kicker">Tutorial · ${mode} · Position ${TUT.ri + 1} of ${n}</p>
    <h2>${ROLES[role].name}</h2><ol class="coach-steps">${steps}</ol>${body}`;
}
$('#coach').addEventListener('click', e => {
  const b = e.target.closest('button[data-tut]'); if (!b || !TUT) return;
  if (e.detail) b.blur(); // a mouse click: give the keys back to the game (Space must not press this button again)
  const a = b.dataset.tut;
  if (a === 'skip') tutNext(false);
  else if (a === 'next') { TUT.ri++; tutRole(); }
  else endTutorial();
});
// the tutorial's own mode picker, in How to play
let tutMode = settings.mode;
function renderTutPick() {
  for (const b of document.querySelectorAll('#tut-mode button')) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === tutMode));
  $('#tut-roles').textContent = `Positions: ${YOUR_ROLES[tutMode].map(r => ROLES[r].name).join(', ')}.`;
}
$('#tut-mode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tutMode = Number(b.dataset.v); renderTutPick(); });
$('#btn-tut').addEventListener('click', () => { $('#howto-dlg').close(); stopDemo(); startTutorial(tutMode); });
renderTutPick();

// ---------- pause and result ----------
function togglePause() {
  if (!G || G.phase === 'over' || (TUT && TUT.wait)) return;
  G.paused = !G.paused;
  $('#pause').hidden = !G.paused; showTabStats(false);
  if (G.paused) $('#btn-resume').focus();
}
$('#btn-resume').addEventListener('click', togglePause);
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-quit').addEventListener('click', () => { showTabStats(false); G.paused = false; $('#pause').hidden = true; G = null; if (TUT) endTutorial(); else show('scr-title'); });

// The box score, one table per team. Used by the Tab scoreboard during a match and the result screen after it.
const BOX_COLS = [['kills', 'K', 'Kills'], ['att', 'ATT', 'Attack attempts'], ['ast', 'AST', 'Assists: sets that became kills'],
  ['blocks', 'BLK', 'Blocks'], ['digs', 'DIG', 'Digs'], ['aces', 'ACE', 'Aces']];
function boxScore(box) {
  box.innerHTML = '';
  for (let s = 0; s < 2; s++) {
    const tbl = el('table', 'box');
    tbl.innerHTML = `<caption>${teamName(s)}</caption><thead><tr><th scope="col">Pokémon</th>${BOX_COLS.map(([, h, t]) => `<th scope="col" title="${t}">${h}</th>`).join('')}</tr></thead>`;
    const tb = el('tbody');
    for (const p of G.all[s]) tb.appendChild(el('tr', p.human ? 'you' : '', `<th scope="row">${p.mon.name}</th>${BOX_COLS.map(([k]) => `<td>${p.stats[k]}</td>`).join('')}`));
    tbl.appendChild(tb); box.appendChild(tbl);
  }
}
// Hold Tab during a match to see the box score. The match keeps running underneath.
let tabTimer = null;
function fillTabStats() {
  if (!G) return;
  $('#tab-score').textContent = `${G.score[0]} - ${G.score[1]}${settings.sets > 1 ? ` · Sets ${G.sets[0]} - ${G.sets[1]}` : ''}`;
  boxScore($('#tab-box'));
}
function showTabStats(on) {
  const o = $('#tabstats');
  if (on && G && !G.paused) {
    if (o.hidden) { fillTabStats(); tabTimer = setInterval(fillTabStats, 250); } // the rally keeps going, so keep the numbers live
    o.hidden = false;
  } else { o.hidden = true; clearInterval(tabTimer); tabTimer = null; }
}
function showResult() {
  showTabStats(false);
  const w = G.winner;
  $('#res-title').textContent = w === 0 ? 'You win!' : `${teamName(1)} wins`;
  const multi = settings.sets > 1;
  $('#res-score').textContent = multi ? `${G.sets[0]} : ${G.sets[1]}` : `${G.score[0]} : ${G.score[1]}`;
  $('#res-meta').textContent = (multi ? `Sets: ${G.setLog.map(x => x.join('-')).join(', ')} · ` : '') + `Longest rally: ${G.longestRally} touches`;
  boxScore($('#res-box'));
  const mvp = G.players.reduce((a, p) => (val(p) > val(a) ? p : a));
  $('#res-mvp').innerHTML = '';
  $('#res-mvp').appendChild(portrait(mvp.mon, 192, 128));
  $('#res-mvp').appendChild(el('div', '', `<span>MVP</span><b>${mvp.mon.name}</b><small>${teamName(mvp.side)}</small>`));
  show('scr-result');
}
const val = p => (p.stats.kills + p.stats.aces + p.stats.blocks) * 3 + p.stats.digs + p.stats.sets * 0.5;
$('#btn-rematch').addEventListener('click', startMatch);
$('#btn-redraft').addEventListener('click', () => { buildPick(); show('scr-pick'); });
$('#btn-menu').addEventListener('click', () => show('scr-title'));
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => { if (b.dataset.back === 'scr-title') renderSummary(); show(b.dataset.back); });

// ---------- touch controls ----------
const isTouch = matchMedia('(pointer: coarse)').matches;
function updateTouchUI() { $('#touch').hidden = !isTouch; }
for (const b of document.querySelectorAll('#touch [data-act]')) {
  const act = b.dataset.act;
  const on = e => { e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); press(act, true); b.classList.add('down'); };
  const off = e => { e.preventDefault(); press(act, false); b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}

// ===================== boot =====================
window.addEventListener('resize', () => { if (G) sizeCanvas(); });
$('#dex-count').textContent = String(DEX.length);
show('scr-title');
requestAnimationFrame(frame);

if (AUTO) { // test mode: draft and play without input
  window.__test = { get G() { return G; }, settings };
  if (QS.get('mode')) settings.mode = Number(QS.get('mode'));
  if (QS.get('diff')) settings.diff = QS.get('diff');
  if (QS.get('target')) settings.target = Number(QS.get('target'));
  if (QS.get('sets')) settings.sets = Number(QS.get('sets'));
  if (QS.get('venue') && VENUES[QS.get('venue')]) settings.venue[VENUES[QS.get('venue')].mode] = QS.get('venue');
  if (QS.get('time') && TIMES[QS.get('time')]) settings.time = QS.get('time');
  if (QS.get('role') && YOUR_ROLES[settings.mode].includes(QS.get('role'))) settings.role[settings.mode] = QS.get('role');
  buildPick(); startDraft(BY_ID.get(Number(QS.get('starter'))) || capPick.offers[0]);
  while (draft.picks.length < teamSize() - 1) { draft.picks.push(draft.offers[0]); makeOffers(); }
  buildTeams(); startMatch();
}
