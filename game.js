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
const STEP = 1 / 120;
const TEAM_COLORS = ['#3fa7ff', '#ff5d5d'];
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
const SPECIAL = {
  electric: 'Thunder Spike', fire: 'Blaze Spike', water: 'Tidal Spike', grass: 'Leaf Storm Spike',
  ice: 'Blizzard Spike', fighting: 'Dynamic Spike', poison: 'Venom Spike', ground: 'Quake Spike',
  flying: 'Sky Drop Spike', psychic: 'Psy Spike', bug: 'Swarm Spike', rock: 'Rock Slide Spike',
  ghost: 'Phantom Spike', dragon: 'Dragon Spike', normal: 'Giga Spike', fairy: 'Moonlight Spike',
  steel: 'Iron Spike',
};
const STARTERS = [25, 1, 4, 7, 133, 66, 39, 54];
const CAPTAIN_BOOST = 14;
const STAT_KEYS = [['spd', 'SPD', 'Speed: how fast it runs'], ['jmp', 'JMP', 'Jump: how high it leaps'],
  ['pwr', 'PWR', 'Power: how hard it spikes and serves'], ['def', 'DEF', 'Defense: how cleanly it receives'],
  ['skl', 'SKL', 'Skill: how accurately it sets']];

// Opponent AI by difficulty. Your teammates always use MATE.
const DIFF = {
  easy:   { err: 1.6, react: 0.30, spd: 0.84, jump: 0.25, serveFault: 0.10, leaveOut: 0.40, teamOffset: -7, block: 0.22 },
  normal: { err: 0.8, react: 0.18, spd: 0.94, jump: 0.12, serveFault: 0.06, leaveOut: 0.75, teamOffset: -1, block: 0.30 },
  hard:   { err: 0.3, react: 0.09, spd: 1.03, jump: 0.05, serveFault: 0.03, leaveOut: 0.95, teamOffset: 4,  block: 0.38 },
};
const MATE = { err: 0.4, react: 0.11, spd: 1, jump: 0.07, leaveOut: 0.85, block: 0.32 };

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
    if (this.muted || !this.ctx) return;
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
const keys = { left: false, right: false, up: false, down: false, hit: false };
const input = { jumpBuf: 0, hitBuf: 0, hitQ: false, specialQ: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyJ: 'hit', Enter: 'hit', KeyK: 'special', ShiftLeft: 'special', ShiftRight: 'special',
};
function press(action, down) {
  Sfx.init();
  if (action === 'jump') { if (down) input.jumpBuf = 0.12; }
  else if (action === 'hit') { if (down && !keys.hit) { input.hitBuf = 0.25; input.hitQ = true; } keys.hit = down; }
  else if (action === 'special') { if (down) input.specialQ = true; }
  else if (action in keys) keys[action] = down;
}
addEventListener('keydown', e => {
  if (!G || $('#stage').hidden) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); e.preventDefault(); return; }
  if (e.code === 'KeyM') { Sfx.muted = !Sfx.muted; return; }
  const a = KEYMAP[e.code];
  if (a) { e.preventDefault(); if (!e.repeat) press(a, true); }
});
addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) press(a, false); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ===================== match state =====================
const settings = { mode: 2, diff: 'normal', target: 15, role: { 2: 'B', 6: 'OH' } };
let draft = null;   // { starter, picks: [mon], offers: [mon], rerolls }
let teams = null;   // [[entry], [entry]], entry 0 of team 0 is you
let G = null;       // live match

class Player {
  constructor(entry, side, human, size) {
    this.entry = entry; this.mon = entry.mon; this.r = entry.r; this.side = side; this.human = human;
    this.rr = clamp(0.24 + Math.sqrt(this.mon.h) * 0.075, 0.3, 0.72) * size; // body radius
    this.speed = 5.2 + this.r.spd * 0.065;
    this.apex = 0.55 + this.r.jmp * 0.011;
    this.jumpV = Math.sqrt(2 * GP * this.apex);
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.onGround = true;
    this.face = 0; this.cool = 0; this.squash = 1; this.homeX = 0; this.homeZ = 0;
    this.ai = { jumpErr: 0, blockWait: -1 };
    this.stats = { kills: 0, aces: 0, blocks: 0, digs: 0, sets: 0 };
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
  S: 'Takes the second touch and runs the offense: you choose who gets the set (hold left for the outside, up for the middle quick, right for the opposite, down for the pipe).',
  OH: 'Passes serves and hits high sets from the left side. In the back row you hit the pipe, taking off from behind the attack line.',
  MB: 'Blocks along the whole net and hits fast quick sets right next to the setter.',
  OPP: 'Hits from the right side, blocks the other team\'s outside hitter, and sets if the setter has to dig.',
  B: 'Takes the net on defense: block the other team\'s hitter.',
  D: 'Stays back on defense to dig spikes and chase tips.',
  L: 'Back-row defensive specialist: passes serves, digs and serves in zone 1. Always replaces the middle blocker who is in the back row, so you sit out while your middle is in the front row. A libero cannot block or attack a ball above the net.',
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
function applyLibero(s) {
  const L = G.libero[s];
  if (!L) { G.sides[s] = G.rot[s].slice(); G.bench[s] = []; return; }
  const mb = G.rot[s].find((p, i) => p.role === 'MB' && (i === 0 || i === 4 || i === 5)) || null;
  G.libSub[s] = mb;
  G.sides[s] = G.rot[s].map(p => (p === mb ? L : p));
  G.bench[s] = [mb ? mb : L];
  const m = toward(s);
  G.bench[s].forEach(p => { p.x = -(HW + 1.6) * m; p.z = -0.3 * HL * m; p.y = 0; p.vx = p.vz = p.vy = 0; p.onGround = true; });
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

function newMatch() {
  const n = settings.mode;
  HW = n === 2 ? 8 : 9.5; HL = n === 2 ? 12 : 14;
  const size = n === 6 ? 0.9 : 1;
  const sides = [[], []], rot = [[], []], all = [[], []], libero = [null, null];
  for (let s = 0; s < 2; s++) {
    const you = s === 0 ? teams[0][0] : null;
    for (const { entry, role } of lineup(teams[s], you, settings.role[n], n)) {
      const p = new Player(entry, s, entry === you, size);
      p.role = role;
      all[s].push(p);
      if (role === 'L') libero[s] = p; else { sides[s].push(p); rot[s].push(p); }
    }
  }
  G = {
    sides, players: [...sides[0], ...sides[1]], rot, all, libero, libSub: [null, null], bench: [[], []],
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, trail: [], special: null, noHit: 0 },
    score: [0, 0], touches: [0, 0], lastSide: -1, lastToucher: null, intended: [null, null], lastAttack: null,
    setterNow: [null, null], blockers: [[], []], play: [null, null],
    serving: 0, server: null, phase: 'serve', timer: 0, time: 0,
    meter: [0, 0], armed: [false, false], react: [0, 0], aiErr: [[0, 0], [0, 0]], leave: [false, false],
    particles: [], texts: [], shake: 0, netWobble: 0, paused: false, shown: false, rally: 0, longestRally: 0,
    cam: { x: 0, z: -HL - CAM.back },
  };
  startServe();
}

function startServe() {
  const s = G.serving;
  for (let k = 0; k < 2; k++) applyLibero(k);
  G.players = [...G.sides[0], ...G.sides[1]];
  G.server = G.sides[s][0];
  Object.assign(G.ball, { vx: 0, vy: 0, vz: 0, gs: 1, trail: [], special: null, noHit: 0 });
  G.touches = [0, 0]; G.lastSide = -1; G.lastToucher = null; G.intended = [null, null]; G.lastAttack = null;
  G.setterNow = [null, null]; G.play = [null, null];
  G.phase = 'serve'; G.timer = 0; G.rally = 0;
  updateFormation();
  for (const p of G.players) {
    p.x = p.homeX; p.z = p.homeZ; p.y = 0; p.vx = p.vy = p.vz = 0; p.onGround = true; p.cool = 0; p.ai.blockWait = -1;
  }
  const sv = G.server;
  sv.x = clamp(0.5 * HW, -HW + 0.6, HW - 0.6) * toward(s); sv.z = -toward(s) * (HL + 0.8); // serve from the right, behind the end line
  input.hitQ = false;
  const you = G.sides[0].find(p => p.human) || G.sides[0][0];
  G.cam.z = Math.min(-HL - CAM.back, you.z - 6.6); G.cam.x = clamp(you.x * 0.55, -HW * 0.6, HW * 0.6);
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
  if (!p.onGround) p.vy -= GP * h;
  p.x += p.vx * h; p.z += p.vz * h; p.y += p.vy * h;
  if (p.y <= 0) {
    if (!p.onGround) { p.squash = 0.78; dust(p.x, p.z, 4, '#e8d3a2'); }
    p.y = 0; p.vy = 0; p.onGround = true;
  }
  clampPlayer(p);
  const want = Math.abs(p.vx) > 0.6 ? Math.sign(p.vx) * 0.75 : 0;
  p.face += (want - p.face) * Math.min(1, h * 10);
  p.cool -= h;
}
function jump(p) {
  if (!p.onGround) return;
  p.vy = p.jumpV; p.onGround = false; p.squash = 1.2;
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
function doServe(p) {
  const s = p.side, t = toward(s);
  for (const k of [1 - s, s]) {
    if (overlaps(k).length) { // out of rotation order when the ball is served
      G.phase = 'rally';
      awardPoint(1 - k, 'OVERLAP', `${teamName(k)} was out of rotation order`, null, null);
      return;
    }
  }
  const human = !aiControlled(p);
  let tx, depth;
  if (human) {
    const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    tx = ix * HW * 0.6 + rand(-0.6, 0.6);
    depth = keys.up ? 2.6 : keys.down ? HL - 1.2 : HL * 0.6;
    depth += rand(-0.5, 0.5);
  } else { tx = rand(-HW * 0.8, HW * 0.8); depth = rand(2.2, HL - 0.8); }
  if (!human && s === 1 && Math.random() < DIFF[settings.diff].serveFault) depth = HL + rand(0.6, 2);
  const apex = NET_H + 2.6 - p.r.pwr / 99 * 1.3 + rand(0, 0.6);
  lob(tx, t * depth, apex);
  G.lastToucher = p; G.lastSide = s; G.touches = [0, 0];
  G.lastAttack = { p, type: 'serve' };
  G.phase = 'rally'; G.rally = 0;
  rerollAI();
  p.squash = 1.15;
  Sfx.serve();
}

// ===================== contacts =====================
function canContact(p, b) {
  if (p.cool > 0 || b.noHit > 0) return false;
  if (b.z * toward(p.side) > 0.7) return false;               // ball well over on the other side
  if (G.lastToucher === p && G.lastSide === p.side && G.touches[p.side] > 0) return false; // no double touch
  const pad = !aiControlled(p) ? 0.45 : 0.22; // you get a longer reach than the computer
  const dx = b.x - p.x, dy = b.y - p.cy, dz = b.z - p.z;
  return dx * dx + dy * dy + dz * dz < (p.rr + BR + pad) ** 2;
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
  const wasSpecial = b.special;

  // block at the net (a libero may not block)
  if (p.role !== 'L' && !p.onGround && Math.abs(p.z) < p.rr + 0.9 && fromOpp && b.vz * t < 0 && b.y > NET_H - 0.3 && G.lastSide !== -1) {
    doBlock(p, wasSpecial);
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
  G.lastToucher = p; G.lastSide = s; G.intended[s] = null;
  p.cool = 0.3; b.noHit = 0.06; b.special = null;
  G.meter[s] = Math.min(100, G.meter[s] + 5);
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
    const want = input.hitBuf > 0 || keys.hit;
    if (want && airborne && highEnough) action = 'spike';
    else if (want) action = 'tip';
    else action = G.touches[s] >= 3 ? 'over' : 'pass';
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
    let special = false;
    if (s === 0 && G.armed[0] && !aiControlled(p)) special = true;
    if (aiControlled(p) && G.meter[s] >= 100 && Math.random() < 0.6 && !(s === 0 && !AUTO)) special = true;
    if (!spike(p, special)) action = 'over';
  }
  if (action === 'pass') pass(p, incoming, wasSpecial, fromOpp);
  else if (action === 'over') { over(p); G.lastAttack = { p, type: 'over' }; }
  else if (action === 'tip') { tip(p); G.lastAttack = { p, type: 'tip' }; }

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
function choosePlay(s, setter) {
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
  let pick = null;
  if (!aiControlled(setter)) { // you are setting: the arrow you hold picks the play
    const want = keys.left ? 'outside' : keys.up ? 'quick' : keys.right ? 'right' : keys.down ? 'pipe' : null;
    pick = opts.find(o => o.type === want) || null;
  }
  if (!pick) {
    const wt = o => o.w * (o.q.r.pwr + o.q.r.jmp) * (o.q.human && !AUTO ? 3 : 1);
    let x = Math.random() * opts.reduce((a, o) => a + wt(o), 0);
    pick = opts.find(o => (x -= wt(o)) <= 0) || opts[0];
  }
  return { ...pick, tx: pick.ox * m, tz: pick.oz * m, ty: pick.q.apex + pick.q.rr * 2 };
}

function pass(p, incoming, wasSpecial, fromOpp) {
  const s = p.side, t = toward(s), b = G.ball;
  let target, tx, tz, ty, apexY, skill;
  if (G.touches[s] === 1) { // pass to the setter's target spot
    target = designatedSetter(s, p); G.setterNow[s] = target;
    const [ox, oz] = setterSpot();
    tx = ox * t; tz = oz * t; ty = 1.3; apexY = NET_H + 2.0; skill = p.r.def;
  } else { // set one of the hitters
    const play = choosePlay(s, p);
    target = play.q; tx = play.tx; tz = play.tz; ty = play.ty; apexY = play.apex + rand(0, 0.3); skill = p.r.skl;
    G.play[s] = play.type;
    floatText(play.call, p.x, p.cy + p.rr + 0.6, p.z, '#ffe9a0', 0.9);
    p.stats.sets++;
  }
  const heat = clamp(incoming / 16, 0, 1.6) * (wasSpecial ? 1.8 : 1);
  const err = (100 - skill) * 0.022 * (0.4 + (G.touches[s] === 1 ? heat : 0.2));
  tx += rand(-1, 1) * err; tz += rand(-1, 1) * err * 0.7; apexY += rand(-0.3, 0.3) * err;
  tz = -t * Math.max(0.5, -tz * t);

  // a hard spike can shank off the arms
  if (G.touches[s] === 1 && fromOpp && incoming > 12.5) {
    const shank = clamp((incoming - 12.5) / 8, 0, 1) * (1.35 - p.r.def / 100) * (wasSpecial ? 1.5 : 1);
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
  const t = toward(p.side);
  lob(rand(-HW * 0.8, HW * 0.8), t * rand(2.2, HL - 1.4), NET_H + rand(1.2, 2.4));
  Sfx.bump();
}
function tip(p) {
  const t = toward(p.side);
  lob(clamp(G.ball.x + rand(-1.5, 1.5), -HW + 0.5, HW - 0.5), t * rand(0.8, 2.6), NET_H + rand(0.5, 0.9));
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

function spike(p, special) {
  const s = p.side, t = toward(s), b = G.ball;
  const human = !aiControlled(p);
  let [tx, tz] = openSpot(s, human ? 16 : 4); // the computer does not always find the best gap
  if (human) {
    const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (ix) tx = clamp(b.x + ix * HW, -HW * 0.85, HW * 0.85);
    if (keys.up) tz = t * 1.8; else if (keys.down) tz = t * (HL - 1);
  } else {
    const e = (s === 0 ? MATE : DIFF[settings.diff]).err;
    tx += rand(-1, 1) * e; tz += rand(-1, 1) * e;
  }
  // Each spike is timed rather than given a raw speed: harder hitters land it sooner,
  // but there is always enough time to react and run to the landing ring.
  const flight = clamp(1.3 - p.r.pwr * 0.005, 0.8, 1.15) * (special ? 0.8 : 1) * (settings.mode === 6 ? 0.75 : 1); // 6 v 6 has more defenders to beat
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
    if (special) {
      const ty = p.mon.types[0];
      b.special = TYPE_COLORS[ty];
      G.meter[s] = 0; G.armed[s] = false;
      G.shake = 0.35;
      floatText(SPECIAL[ty] || 'Mega Spike', p.x, p.cy + p.rr + 0.8, p.z, TYPE_COLORS[ty], 1.3, 30);
    }
    Sfx.spike();
    burst(b.x, b.y, b.z, special ? TYPE_COLORS[p.mon.types[0]] : '#ffffff', special ? 22 : 10);
    return true;
  }
  return false;
}

function doBlock(p, wasSpecial) {
  const s = p.side, t = toward(s), b = G.ball;
  const atk = G.lastAttack && G.lastAttack.p;
  const human = !aiControlled(p);
  const chance = (human ? 0.55 : s === 0 ? MATE.block : DIFF[settings.diff].block)
             + (p.r.jmp - (atk ? atk.r.pwr : 50)) / 250 - (wasSpecial ? 0.25 : 0);
  const roll = Math.random(), stuff = roll < clamp(chance, human ? 0.15 : 0.08, human ? 0.8 : 0.75);
  // a computer blocker can be beaten clean; when you get there in time you always get a hand on it
  if (!human && !stuff && roll < clamp(chance, 0.08, 0.75) + 0.4) { p.cool = 0.5; return; }
  p.cool = 0.3; b.noHit = 0.08; b.special = null; b.gs = 1;
  G.lastToucher = null; G.lastSide = s; G.touches[s] = 0; G.intended[s] = null; G.intended[1 - s] = null;
  if (stuff) {
    b.z = t * (BR + 0.12);
    b.vz = t * rand(3, 6); b.vy = -rand(1, 3); b.vx = rand(-1.5, 1.5);
    G.lastAttack = { p, type: 'block' };
    floatText('BLOCK!', p.x, p.cy + p.rr + 0.6, p.z, '#fff', 1);
    G.shake = 0.2;
  } else {
    b.z = -t * (BR + 0.12);
    b.vz = -t * rand(1, 2.5); b.vy = rand(4, 6); b.vx = rand(-1, 1);
    floatText('Soft block', p.x, p.cy + p.rr + 0.6, p.z, '#dfe8ff', 0.8);
  }
  rerollAI();
  Sfx.block();
}

// ===================== rally flow =====================
function stepBall(h) {
  const b = G.ball, pz = b.z;
  b.vy -= GB * (b.gs || 1) * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  b.spin += h * Math.hypot(b.vx, b.vz) * 0.8; b.noHit -= h;
  // a block: the ball crosses the net within reach of a jumping blocker's raised arms
  if ((pz < 0) !== (b.z < 0) && b.y - BR >= NET_H - 0.05) {
    const sIn = b.z < 0 ? 0 : 1;
    if (G.lastSide === 1 - sIn) {
      for (const p of G.sides[sIn]) {
        if (p.role === 'L' || p.onGround || p.cool > 0 || Math.abs(p.z) > p.rr + 1.0) continue;
        if (Math.abs(b.x - p.x) < p.rr + 0.55 && b.y <= p.y + p.rr * 2 + 0.9) { doBlock(p, b.special); break; }
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
    if (canContact(p, b)) { contact(p); if (G.phase !== 'rally') return true; break; }
  }
  if (b.y <= BR) { b.y = BR; ballDown(); return true; }
  if (Math.abs(b.x) > HW + 9 || Math.abs(b.z) > HL + 12) { awardPoint(1 - G.lastSide, 'OUT', 'Hit out of bounds', null, null); return true; }
  return false;
}

function ballDown() {
  const b = G.ball;
  dust(b.x, b.z, 14, '#f3e2b5');
  const landSide = inCourt(b.x, b.z, 0) ? 0 : inCourt(b.x, b.z, 1) ? 1 : -1;
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

function awardPoint(w, label, sub, credit, key) {
  if (G.phase !== 'rally') return;
  G.score[w]++;
  if (credit && key) credit.stats[key]++;
  G.meter[w] = Math.min(100, G.meter[w] + 10);
  G.cheer = 1; // the crowd jumps up
  G.longestRally = Math.max(G.longestRally, G.rally);
  if (w !== G.serving) { // side out: the team that won the serve back rotates one zone clockwise
    G.serving = w; G.rot[w].push(G.rot[w].shift());
    floatText('ROTATE', 0, 2.6, -toward(w) * HL * 0.5, TEAM_COLORS[w], 1.4, 30);
  }
  G.texts.push({ big: true, text: label, sub, color: TEAM_COLORS[w], t: 0, life: 1.6 });
  Sfx.whistle(); Sfx.point(w === 0);
  const won = G.score[w] >= settings.target && G.score[w] - G.score[1 - w] >= 2;
  if (won) { G.phase = 'over'; G.timer = 2.0; G.winner = w; }
  else { G.phase = 'point'; G.timer = 1.6; }
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
        if (tc <= p.jumpV / GP + 0.015 && Math.hypot(p.x - tx, p.z - tz) < p.rr + 0.35) jump(p);
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

function humanControl(p) {
  const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iz = (keys.up ? 1 : 0) - (keys.down ? 1 : 0);
  const d = Math.hypot(ix, iz) || 1, sp = p.speed * (p.onGround ? 1 : 0.8);
  p.vx = ix / d * sp; p.vz = iz / d * sp * toward(p.side);
  if (input.jumpBuf > 0 && p.onGround) { jump(p); input.jumpBuf = 0; }
}

// ===================== main update =====================
function update(dt) {
  if (!G || G.paused) return;
  G.time += dt;
  input.jumpBuf -= dt; input.hitBuf -= dt;
  G.cheer = Math.max(0, (G.cheer || 0) - dt * 0.6);
  G.shake = Math.max(0, G.shake - dt); G.netWobble = Math.max(0, G.netWobble - dt * 2.5);
  for (const p of G.players) p.squash += (1 - p.squash) * Math.min(1, dt * 12);
  for (const q of G.particles) { q.vy -= 6 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.life -= dt; }
  G.particles = G.particles.filter(q => q.life > 0);
  for (const tx of G.texts) tx.t += dt;
  G.texts = G.texts.filter(tx => tx.t < tx.life);

  if (input.specialQ) {
    input.specialQ = false;
    if (G.meter[0] >= 100 && !G.armed[0]) { G.armed[0] = true; Sfx.tone(880, 0.2, 'sine', 0.05, 440); }
  }

  updateFormation();
  const you = G.sides[0].find(p => p.human);
  if (G.phase === 'serve') {
    const sv = G.server, b = G.ball;
    G.timer += dt;
    for (const p of G.players) {
      if (p === sv) { p.vx = p.vz = 0; }
      else if (!aiControlled(p)) humanControl(p);
      else moveToward(p, p.homeX, p.homeZ, 0.7);
      stepPlayer(p, dt);
    }
    b.x = sv.x + 0.15; b.z = sv.z + toward(sv.side) * 0.15;
    b.y = sv.y + sv.rr * 2 + 0.35 + Math.sin(G.time * 4) * 0.05;
    if (!aiControlled(sv)) { if (input.hitQ) { input.hitQ = false; doServe(sv); } }
    else if (G.timer > 1.1) doServe(sv);
  } else if (G.phase === 'rally') {
    aiThink(dt);
    if (you && !AUTO) humanControl(you);
    const steps = Math.max(1, Math.round(dt / STEP)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const p of G.players) stepPlayer(p, h);
      if (stepBall(h)) break;
    }
  } else {
    G.timer -= dt;
    for (const p of G.players) {
      if (!aiControlled(p)) humanControl(p); else moveToward(p, p.homeX, p.homeZ, 0.5);
      stepPlayer(p, dt);
    }
    if (G.timer <= 0) {
      if (G.phase === 'point') startServe();
      else if (!G.shown) { G.shown = true; showResult(); }
    }
  }
  const b = G.ball;
  if (G.phase === 'rally') {
    b.trail.push({ x: b.x, y: b.y, z: b.z, c: b.special });
    if (b.trail.length > (b.special ? 14 : 6)) b.trail.shift();
  } else b.trail.length = 0;

  // the camera drifts to keep you in view
  const focus = you || G.sides[0][0];
  const want = clamp(focus.x * 0.55 + G.ball.x * 0.15, -HW * 0.6, HW * 0.6);
  G.cam.x += (want - G.cam.x) * Math.min(1, dt * 2.5);
  const wantZ = Math.min(-HL - CAM.back, focus.z - 6.6); // back up when you go deep or serve
  G.cam.z += (wantZ - G.cam.z) * Math.min(1, dt * 3);
}

// ===================== effects =====================
function dust(x, z, n, color) {
  for (let i = 0; i < n; i++) G.particles.push({ x, y: 0.05, z, vx: rand(-1.2, 1.2), vy: rand(0.6, 2.4), vz: rand(-1.2, 1.2), life: rand(0.3, 0.6), r: rand(0.03, 0.06), color });
}
function burst(x, y, z, color, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), e = rand(-1, 1), s = rand(1.5, 4.5);
    G.particles.push({ x, y, z, vx: Math.cos(a) * s, vy: e * s, vz: Math.sin(a) * s, life: rand(0.25, 0.5), r: rand(0.03, 0.07), color });
  }
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
function proj(x, y, z) {
  const dx = x - G.cam.x, dy = y - CAM.y, dz = z - G.cam.z;
  const c = Math.cos(CAM.pitch), s = Math.sin(CAM.pitch);
  const Y = dy * c + dz * s, Z = Math.max(0.3, -dy * s + dz * c);
  const k = CAM.F / Z;
  return { x: W / 2 + dx * k, y: CAM.cy - Y * k, k, Z };
}
function horizonY() { return CAM.cy - Math.tan(CAM.pitch) * CAM.F; }

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
function buildSky() {
  const c = document.createElement('canvas'); c.width = UW; c.height = UH; const g = c.getContext('2d');
  const hy = Math.round(horizonY() * US);
  const bands = ['#3c9fe4', '#4aa8e9', '#58b2ed', '#68bcf0', '#7ac6f3', '#8ed0f6', '#a6dbf8', '#bfe6fa'];
  const bh = Math.ceil((hy - 12) / bands.length);
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, UW, bh); });
  pixelDisc(g, 412, 30, 15, '#fff3b8'); pixelDisc(g, 412, 30, 12, '#fffbe0');
  for (const [cx, cy, s] of [[70, 34, 1], [190, 22, 0.7], [300, 44, 0.9], [450, 70, 0.55]]) {
    for (const [dx, dy, r] of [[0, 4, 10], [12, -2, 11], [25, 3, 9], [36, 6, 7]]) pixelDisc(g, Math.round(cx + dx * s), Math.round(cy + dy * s), Math.round(r * s), '#ffffff');
    g.fillStyle = '#dceffa'; g.fillRect(Math.round(cx - 9 * s), Math.round(cy + 11 * s), Math.round(52 * s), 2);
  }
  // sea
  g.fillStyle = '#2f86c8'; g.fillRect(0, hy - 12, UW, 6);
  g.fillStyle = '#3a98d6'; g.fillRect(0, hy - 6, UW, 7);
  g.fillStyle = '#56b4e2'; g.fillRect(0, hy + 1, UW, 6);
  g.fillStyle = '#e8f7ff';
  for (let i = 0; i < 26; i++) g.fillRect((i * 37) % UW, hy - 10 + (i * 5) % 16, 6, 1);
  g.fillStyle = '#ffffff'; g.fillRect(0, hy + 7, UW, 1);
  // sand with a dither
  g.fillStyle = '#f0dba2'; g.fillRect(0, hy + 8, UW, UH - hy - 8);
  g.fillStyle = '#e4c98a';
  for (let y = hy + 10; y < UH; y += 3) for (let x = (y * 7) % 11; x < UW; x += 11) g.fillRect(x, y, 1, 1);
  // palms
  for (const [px, sc] of [[24, 1.1], [80, 0.75], [392, 0.8], [456, 1.1]]) {
    const by = hy + 12, h = Math.round(44 * sc);
    for (let i = 0; i < h; i++) { g.fillStyle = i % 4 < 2 ? '#8a5a35' : '#74482a'; g.fillRect(px + Math.round(Math.sin(i / h * 1.3) * 5 * sc), by - i, Math.max(2, Math.round(3 * sc)), 1); }
    const tx = px + Math.round(Math.sin(1.3) * 5 * sc), ty = by - h;
    for (const a of [-2.8, -2.2, -1.6, -1.0, -0.4, 0.2]) {
      for (let t = 0; t < 20 * sc; t++) {
        g.fillStyle = t % 5 === 4 ? '#2f7a3a' : '#3f9b4a';
        g.fillRect(Math.round(tx + Math.cos(a) * t), Math.round(ty + Math.sin(a) * t * 0.55 + t * t * 0.035), 2, 2);
      }
    }
  }
  return c;
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
let crowdCache = null;
function buildCrowd() {
  const arena = settings.mode === 6, rnd = seeded(arena ? 61 : 23);
  const v = arena
    ? { tiers: 7, endTiers: 6, rise: 0.55, depth: 0.95, gap: 3.4, fill: 0.92, riser: ['#20283f', '#262f4a'], seat: ['#33406a', '#2b365a'] }
    : { tiers: 4, endTiers: 3, rise: 0.45, depth: 0.85, gap: 3.0, fill: 0.72, riser: ['#7a5232', '#8a5e3a'], seat: ['#c98d55', '#b97f4a'] };
  const shirts = arena
    ? ['#3fa7ff', '#3fa7ff', '#ff5d5d', '#ff5d5d', '#ffffff', '#ffcf33', '#2b2f3f', '#6bd88a', '#c48bff']
    : ['#ff6b6b', '#ffcf33', '#4fd2ff', '#ffffff', '#ff9a3c', '#6bd88a', '#f49ac0', '#3fa7ff'];
  const skins = ['#f1c9a0', '#d9a477', '#b07a4f', '#8a5a3a', '#f6dcc0'];
  const person = (x, y, z, t) => ({
    x, y, z, t, shirt: shirts[Math.floor(rnd() * shirts.length)], skin: skins[Math.floor(rnd() * skins.length)],
    hat: !arena && rnd() < 0.25 ? ['#ffffff', '#ffcf33', '#ff6b6b'][Math.floor(rnd() * 3)] : null,
    sign: rnd() < 0.05 ? TEAM_COLORS[rnd() < 0.5 ? 0 : 1] : null,
    ph: rnd() * 6.28, rate: 3 + rnd() * 3,
  });
  const people = [];
  const zEnd = HL + v.gap;
  for (const sd of [-1, 1]) for (let t = 0; t < v.tiers; t++) {
    const x = sd * (HW + v.gap + v.depth * (t + 0.5)), y = v.rise * (t + 1);
    for (let z = -HL - 1.5; z <= zEnd - 0.4; z += 0.72) if (rnd() < v.fill) people.push(person(x + (rnd() - 0.5) * 0.25, y, z + (rnd() - 0.5) * 0.3, { kind: 'side', sd, t }));
  }
  for (let t = 0; t < v.endTiers; t++) {
    const z = zEnd + v.depth * (t + 0.5), y = v.rise * (t + 1);
    for (let x = -(HW + v.gap) + 0.4; x <= HW + v.gap - 0.4; x += 0.72) if (rnd() < v.fill) people.push(person(x + (rnd() - 0.5) * 0.25, y, z + (rnd() - 0.5) * 0.2, { kind: 'end', t }));
  }
  return { arena, v, people, zEnd };
}

function quad(pts, col) {
  const P = pts.map(([x, y, z]) => proj(x, y, z));
  ctx.fillStyle = col; ctx.beginPath();
  P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath(); ctx.fill();
}

function drawFan(q) {
  const bob = Math.abs(Math.sin(G.time * q.rate + q.ph)) * (0.03 + G.cheer * 0.22);
  const f = proj(q.x, q.y + bob, q.z), k = f.k;
  const w = Math.max(2.7, 0.42 * k), h = Math.max(2.7, 0.5 * k), hd = Math.max(2.7, 0.27 * k);
  ctx.fillStyle = q.shirt; ctx.fillRect(f.x - w / 2, f.y - h, w, h);
  ctx.fillStyle = q.skin; ctx.fillRect(f.x - hd / 2, f.y - h - hd, hd, hd);
  if (q.hat) { ctx.fillStyle = q.hat; ctx.fillRect(f.x - hd * 0.7, f.y - h - hd, hd * 1.4, Math.max(2.7, hd * 0.35)); }
  if (G.cheer > 0.25 && Math.sin(q.ph * 7) > -0.2) { // arms up after a point
    ctx.fillStyle = q.skin;
    ctx.fillRect(f.x - w / 2 - hd * 0.3, f.y - h - hd * 1.3, Math.max(2.7, hd * 0.35), hd * 1.1);
    ctx.fillRect(f.x + w / 2 - hd * 0.05, f.y - h - hd * 1.3, Math.max(2.7, hd * 0.35), hd * 1.1);
  }
  if (q.sign) { ctx.fillStyle = q.sign; ctx.fillRect(f.x - w * 0.9, f.y - h - hd * 2.2, w * 1.8, hd * 1.1); }
}

// Stands back to front: the far end, then each side from the top tier down, each tier with its fans.
function drawStands() {
  const C = crowdCache || (crowdCache = buildCrowd()), v = C.v, zEnd = C.zEnd, z0 = -HL - 2;
  const byTier = new Map();
  for (const q of C.people) { const key = q.t.kind + (q.t.sd || '') + q.t.t; if (!byTier.has(key)) byTier.set(key, []); byTier.get(key).push(q); }
  const X = HW + v.gap;
  for (let t = v.endTiers - 1; t >= 0; t--) {
    const zi = zEnd + v.depth * t, zo = zi + v.depth, y0 = v.rise * t, y1 = y0 + v.rise;
    quad([[-X - v.depth * v.tiers, y1, zo], [X + v.depth * v.tiers, y1, zo], [X + v.depth * v.tiers, y1, zi], [-X - v.depth * v.tiers, y1, zi]], v.seat[t % 2]);
    quad([[-X - v.depth * v.tiers, y0, zi], [X + v.depth * v.tiers, y0, zi], [X + v.depth * v.tiers, y1, zi], [-X - v.depth * v.tiers, y1, zi]], v.riser[t % 2]);
    for (const q of byTier.get('end' + t) || []) drawFan(q);
  }
  for (const sd of [-1, 1]) for (let t = v.tiers - 1; t >= 0; t--) {
    const xi = sd * (X + v.depth * t), xo = sd * (X + v.depth * (t + 1)), y0 = v.rise * t, y1 = y0 + v.rise;
    quad([[xi, y1, z0], [xi, y1, zEnd], [xo, y1, zEnd], [xo, y1, z0]], v.seat[t % 2]);
    quad([[xi, y0, z0], [xi, y0, zEnd], [xi, y1, zEnd], [xi, y1, z0]], v.riser[t % 2]);
    for (const q of byTier.get('side' + sd + t) || []) drawFan(q);
  }
  if (C.arena) { // LED ad boards around the court
    const bx = X - 0.5, h = 0.8, cols = ['#ff5d5d', '#3fa7ff', '#ffcf33', '#1b2236'];
    for (let i = 0, z = z0; z < zEnd - 0.5; z += 2.4, i++) for (const sd of [-1, 1])
      quad([[sd * bx, 0, z], [sd * bx, 0, z + 2.4], [sd * bx, h, z + 2.4], [sd * bx, h, z]], cols[(i + (sd > 0 ? 2 : 0)) % cols.length]);
    for (let i = 0, x = -bx; x < bx; x += 2.4, i++) quad([[x, 0, zEnd - 0.5], [x + 2.4, 0, zEnd - 0.5], [x + 2.4, h, zEnd - 0.5], [x, h, zEnd - 0.5]], cols[(i + 1) % cols.length]);
  }
}

function drawCourt() {
  ctx.fillStyle = settings.mode === 6 ? '#e0904c' : '#f7e6b8'; // orange indoor court, or sand
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
  for (let i = 0; i < b.trail.length; i++) {
    const q = b.trail[i], a = (i + 1) / b.trail.length, p = proj(q.x, q.y, q.z), s = Math.max(4, BR * 2.2 * p.k * (0.4 + a * 0.6));
    ctx.globalAlpha = a * (q.c ? 0.8 : 0.4); ctx.fillStyle = q.c || '#ffffff';
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  const p = proj(b.x, b.y, b.z), r = Math.max(6, BR * 1.4 * p.k);
  // a chunky pixel ball: dark rim, white body, yellow and blue panels
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.fillStyle = '#20222e'; ctx.beginPath(); ctx.arc(0, 0, r + 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbfbf2'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip(); ctx.rotate(b.spin);
  ctx.fillStyle = '#ffcf33'; ctx.fillRect(-r, -r, r * 0.8, r * 2);
  ctx.fillStyle = '#3d7fe0'; ctx.fillRect(r * 0.25, -r, r * 0.8, r * 2);
  ctx.restore(); ctx.restore();
  if (b.special) { ctx.strokeStyle = b.special; ctx.lineWidth = 5; ctx.strokeRect(p.x - r - 7, p.y - r - 7, r * 2 + 14, r * 2 + 14); }
}

function drawPlayer(p) {
  const back = p.side === 0, f = proj(p.x, p.y, p.z);
  const img = spriteImg(p.mon.id, back), box = SPRITE_BOX[p.mon.id];
  if (Math.abs(p.vx) > 0.6) p.flip = back ? p.vx < 0 : p.vx > 0;
  if (img.complete && img.naturalWidth) {
    const [sx, sy, sw, sh] = back ? box.slice(4) : box.slice(0, 4);
    const k = p.rr * 3.3 * (back ? 1 : 1.3) * f.k / sh; // the far team is drawn a bit larger so it reads at a distance
    const h = sh * k * p.squash, w = sw * k * (1 + (1 - p.squash) * 0.6);
    ctx.save(); ctx.translate(f.x, f.y); if (p.flip) ctx.scale(-1, 1);
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
  ctx.drawImage(skyCache || (skyCache = settings.mode === 6 ? buildArena() : buildSky()), 0, 0, W, H);
  drawStands();
  drawCourt();

  // shadows and rings on the sand
  for (const p of G.players) {
    const lift = clamp(p.y / 2, 0, 0.6);
    ctx.fillStyle = 'rgba(80,55,20,0.35)';
    groundEllipse(p.x, p.z, p.rr * (1.0 - lift), p.rr * (0.75 - lift * 0.5)); ctx.fill();
    ctx.strokeStyle = p.human ? '#ffe14a' : p.role === 'L' ? '#c48bff' : TEAM_COLORS[p.side]; ctx.lineWidth = p.human || p.role === 'L' ? 5 : 3;
    groundEllipse(p.x, p.z, p.rr * 1.2, p.rr * 0.95); ctx.stroke();
  }
  ctx.fillStyle = `rgba(60,40,20,${0.45 - clamp(b.y / 8, 0, 0.25)})`;
  groundEllipse(b.x, b.z, BR * 1.5, BR * 1.2); ctx.fill();

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
      if (lz < 0) { ctx.strokeStyle = '#ff8c28'; ctx.lineWidth = 5; groundEllipse(lx, lz, 0.5, 0.5); ctx.stroke(); }
    }
    // where and when to block: the other team has set its hitter
    if (you && !AUTO && G.lastSide === 1 && G.touches[1] >= 1) {
      const atk = G.sides[1].find(q => !q.onGround && Math.abs(q.z) < 3.2) || (G.touches[1] >= 2 ? G.intended[1] : null);
      if (atk && Math.abs(atk.z) < 4.5) {
        const bx = clamp(atk.x, -HW + 0.4, HW - 0.4), bz = -(you.rr + 0.35), up = !atk.onGround;
        ctx.strokeStyle = up ? '#ff4d4d' : 'rgba(255,90,90,0.75)'; ctx.lineWidth = 6;
        groundEllipse(bx, bz, 0.7, 0.4); ctx.stroke();
        const lab = proj(bx, 0, bz);
        if (!up || Math.floor(G.time * 8) % 2 === 0) labels.push([up ? 'JUMP!' : 'BLOCK HERE', lab.x * US, lab.y * US + 6, '#ff8a8a']);
      }
    }
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
  for (const q of G.particles) items.push({ z: q.z, d: () => { const p = proj(q.x, q.y, q.z), s = Math.max(2.7, q.r * 2 * p.k); ctx.globalAlpha = clamp(q.life * 2.5, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s); ctx.globalAlpha = 1; } });
  items.sort((a, c) => c.z - a.z);
  let netDrawn = false;
  for (const it of items) {
    if (!netDrawn && it.z < 0) { drawNet(); netDrawn = true; }
    it.d();
  }
  if (!netDrawn) drawNet();
  ctx.restore();

  const bp = proj(b.x, b.y, b.z);
  if (bp.y < 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); pxRect(bp.x * US - 3, 2, 6, 3, '#ffffff'); pxRect(bp.x * US - 1, 5, 2, 2, '#ffffff'); }
  for (const l of labels) pxText(l[0], l[1], l[2], l[3]);
  for (const t of G.texts) if (!t.big) {
    const k = t.t / t.life, p = proj(t.x, t.y, t.z);
    if (k > 0.8 && Math.floor(t.t * 20) % 2) continue; // blink out
    pxText(t.text.toUpperCase(), p.x * US, p.y * US - t.t * 16, t.color, t.size > 24 ? 16 : 8);
  }
  drawHud();
}

function drawHud() {
  ctx.setTransform(U, 0, 0, U, 0, 0);
  const cx = UW / 2;
  pxRect(cx - 122, 3, 244, 40, '#10141f');
  pxRect(cx - 120, 5, 240, 36, '#1e2840');
  pxRect(cx - 120, 5, 3, 36, TEAM_COLORS[0]); pxRect(cx + 117, 5, 3, 36, TEAM_COLORS[1]);
  pxText(teams[0][0].mon.name.toUpperCase(), cx - 113, 9, '#c9d4ee', 8, 'left', null);
  pxText(teams[1][0].mon.name.toUpperCase(), cx + 113, 9, '#c9d4ee', 8, 'right', null);
  pxText(String(G.score[0]), cx - 34, 22, '#ffffff', 16, 'center', null);
  pxText(String(G.score[1]), cx + 34, 22, '#ffffff', 16, 'center', null);
  pxText(`TO ${settings.target}`, cx, 22, '#8b98b8', 8, 'center', null);
  pxText('BY 2', cx, 31, '#8b98b8', 8, 'center', null);
  pxRect(G.serving === 0 ? cx - 62 : cx + 56, 26, 6, 6, '#ffcf33');
  for (let s = 0; s < 2; s++) {
    const n = G.lastSide === s && G.phase === 'rally' ? G.touches[s] : 0;
    for (let i = 0; i < 3; i++) pxRect((s === 0 ? cx - 113 : cx + 113 - 22) + i * 8, 30, 6, 6, i < n ? TEAM_COLORS[s] : '#33405f');
  }
  for (let s = 0; s < 2; s++) {
    const w = 96, x = s === 0 ? 8 : UW - 8 - w, y = UH - 12;
    const lead = s === 0 ? G.sides[0].find(p => p.human) || G.sides[0][0] : G.sides[1].find(p => p.entry.captain) || G.sides[1][0];
    pxRect(x - 1, y - 1, w + 2, 8, '#10141f'); pxRect(x, y, w, 6, '#33405f');
    const fill = Math.floor((w * G.meter[s] / 100) / 4) * 4; // fills in 4 px steps
    pxRect(x, y, fill, 6, TYPE_COLORS[lead.mon.types[0]]);
    let label = 'TYPE SPIKE';
    if (s === 0 && !AUTO) label = G.armed[0] ? 'ARMED!' : G.meter[0] >= 100 ? 'PRESS K' : 'TYPE SPIKE';
    const blink = G.meter[s] >= 100 && Math.floor(G.time * 4) % 2;
    pxText(label, s === 0 ? x : x + w, y - 11, blink ? '#ffe14a' : '#ffffff', 8, s === 0 ? 'left' : 'right');
  }
  const me = G.sides[0].find(p => p.human);
  if (me && !AUTO) {
    const where = settings.mode === 6 ? `  ZONE ${zoneOf(me)} ${isFront(me) ? 'FRONT' : 'BACK'} ROW` : '';
    pxText(ROLES[me.role].name.toUpperCase() + where, cx, UH - 12, '#c9d4ee', 8);
    if (G.phase === 'serve' && me !== G.server && overlaps(0).includes(me) && Math.floor(G.time * 4) % 2 === 0) pxText('OVERLAP! GET TO YOUR SPOT', cx, 76, '#ff8a8a', 8);
  } else if (!AUTO && G.bench[0].some(p => p.human)) {
    pxText('LIBERO ON THE BENCH: YOUR MIDDLE IS IN THE FRONT ROW', cx, UH - 12, '#c9d4ee', 8);
  }
  if (G.phase === 'serve' && !aiControlled(G.server) && Math.floor(G.time * 2.5) % 2 === 0) {
    pxText('PRESS J TO SERVE', cx, 52, '#ffffff', 8);
    pxText('ARROWS AIM', cx, 63, '#c9d4ee', 8);
  }
  for (const t of G.texts) if (t.big) {
    const k = t.t / t.life;
    if (k > 0.8 && Math.floor(t.t * 20) % 2) continue;
    const size = t.t < 0.12 ? 24 : 16;
    pxText(t.text, cx, 74 - (size - 16) / 2, '#ffffff', size);
    pxRect(cx - 24, 96, 48, 3, t.color);
    if (t.sub) pxText(t.sub.toUpperCase(), cx, 104, '#eef3ff', 8);
  }
  if (G.paused) { ctx.fillStyle = 'rgba(10,14,26,0.55)'; ctx.fillRect(0, 0, UW, UH); }
}
const teamName = s => `Team ${teams[s][0].mon.name}`;

// ===================== canvas sizing and loop =====================
function sizeCanvas() {
  canvas.width = LW; canvas.height = LH;
  ctx.imageSmoothingEnabled = false;
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * SPEEDUP;
  last = now;
  if (G && !$('#stage').hidden) {
    if (SPEEDUP > 1) { const n = Math.ceil(SPEEDUP); for (let i = 0; i < n; i++) update(dt / n); }
    else update(dt);
    render();
  }
  requestAnimationFrame(frame);
}
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { press('hit', true); press('hit', false); } });

// ===================== screens =====================
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  $('#stage').hidden = id !== 'stage';
  $('#menu').hidden = id === 'stage';
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
seg('#opt-mode', 'mode'); seg('#opt-diff', 'diff'); seg('#opt-target', 'target');
$('#btn-start').addEventListener('click', () => { Sfx.init(); buildPick(); show('scr-pick'); });

// ---------- pick your Pokémon ----------
function buildPick() {
  const grid = $('#pick-grid'); grid.innerHTML = '';
  for (const id of STARTERS) {
    const mon = BY_ID.get(id), e = makeEntry(mon, true);
    const card = monCard(e, { button: true });
    card.setAttribute('aria-label', `Play as ${mon.name}, overall ${e.ovr}`);
    card.addEventListener('click', () => startDraft(mon));
    grid.appendChild(card);
  }
  grid.querySelector('button').setAttribute('data-autofocus', '');
}

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
  const rivalCap = BY_ID.get(pickOne(STARTERS.filter(id => id !== draft.starter.id)));
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
}

function renderMatchup() {
  const n = settings.mode;
  // your position
  const pick = $('#opt-role'); pick.innerHTML = '';
  for (const r of YOUR_ROLES[n]) {
    const btn = el('button', '', ROLES[r].name);
    btn.type = 'button'; btn.setAttribute('aria-pressed', String(settings.role[n] === r));
    btn.addEventListener('click', () => { settings.role[n] = r; renderMatchup(); $('#opt-role [aria-pressed="true"]').focus(); });
    pick.appendChild(btn);
  }
  $('#role-desc').textContent = ROLE_DESC[settings.role[n]];
  for (let s = 0; s < 2; s++) {
    const box = $(s === 0 ? '#mu-you' : '#mu-rival');
    box.innerHTML = '';
    box.appendChild(el('h3', '', `${teamName(s)} <span class="mu-ovr">${teamOvr(teams[s])}</span>`));
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
      box.appendChild(el('p', 'rot-note', `Starting rotation. Zone 1 serves, and the team rotates one zone clockwise each time it wins back the serve. The libero (${lib.entry.mon.name}) always plays for the middle blocker in the back row, so only one middle is on court at a time; ${lu[subbed].entry.mon.name} starts on the bench.`));
    }
  }
  $('#mu-meta').textContent = `${n} v ${n} · ${cap(settings.diff)} · first to ${settings.target}, win by 2`;
}
$('#btn-play').addEventListener('click', startMatch);
function startMatch() {
  Sfx.init();
  newMatch(); skyCache = null; crowdCache = null; show('stage'); sizeCanvas();
  for (const p of G.players) spriteImg(p.mon.id, p.side === 0);
  if (document.fonts) document.fonts.load(`8px ${PX_FONT}`);
  for (const k in keys) keys[k] = false;
  updateTouchUI();
}

// ---------- pause and result ----------
function togglePause() {
  if (!G || G.phase === 'over') return;
  G.paused = !G.paused;
  $('#pause').hidden = !G.paused;
  if (G.paused) $('#btn-resume').focus();
}
$('#btn-resume').addEventListener('click', togglePause);
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-quit').addEventListener('click', () => { G.paused = false; $('#pause').hidden = true; G = null; show('scr-title'); });

function showResult() {
  const w = G.winner;
  $('#res-title').textContent = w === 0 ? 'You win!' : `${teamName(1)} wins`;
  $('#res-score').textContent = `${G.score[0]} : ${G.score[1]}`;
  $('#res-meta').textContent = `Longest rally: ${G.longestRally} touches`;
  const box = $('#res-box'); box.innerHTML = '';
  for (let s = 0; s < 2; s++) {
    const tbl = el('table', 'box');
    tbl.innerHTML = `<caption>${teamName(s)}</caption><thead><tr><th scope="col">Pokémon</th><th scope="col" title="Kills">K</th><th scope="col" title="Aces">A</th><th scope="col" title="Blocks">B</th><th scope="col" title="Digs">D</th><th scope="col" title="Sets">S</th></tr></thead>`;
    const tb = el('tbody');
    for (const p of G.all[s]) {
      const st = p.stats;
      tb.appendChild(el('tr', p.human ? 'you' : '', `<th scope="row">${p.mon.name}</th><td>${st.kills}</td><td>${st.aces}</td><td>${st.blocks}</td><td>${st.digs}</td><td>${st.sets}</td>`));
    }
    tbl.appendChild(tb); box.appendChild(tbl);
  }
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
for (const b of document.querySelectorAll('[data-back]')) b.addEventListener('click', () => show(b.dataset.back));

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
  buildPick(); startDraft(BY_ID.get(Number(QS.get('starter')) || 25));
  while (draft.picks.length < teamSize() - 1) { draft.picks.push(draft.offers[0]); makeOffers(); }
  buildTeams(); startMatch();
}
