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
const settings = { mode: 2, diff: 'normal', target: 15 };
let draft = null;   // { starter, picks: [mon], offers: [mon], rerolls }
let teams = null;   // [[entry], [entry]], entry 0 of team 0 is you
let G = null;       // live match

class Player {
  constructor(entry, side, human, size) {
    this.entry = entry; this.mon = entry.mon; this.r = entry.r; this.side = side; this.human = human;
    this.rr = clamp(0.24 + Math.sqrt(this.mon.h) * 0.075, 0.3, 0.72) * size; // body radius
    this.speed = 3.4 + this.r.spd * 0.042;
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

// Home spots for your side (z < 0). The opponent's are mirrored.
function homeSpots(n) {
  if (n === 2) return [[-1.7, -4.8], [1.5, -3.6]];                 // partner, you
  return [[-3, -6.3], [0, -6.6], [3, -6.3], [-3, -2.2], [3, -2.2], [0, -2.0]]; // back row, front row, you front center
}

function newMatch() {
  const n = settings.mode;
  HW = n === 2 ? 4 : 4.5; HL = n === 2 ? 8 : 9;
  const size = n === 6 ? 0.9 : 1;
  const sides = [[], []], serveOrder = [[], []];
  const spots = homeSpots(n);
  for (let s = 0; s < 2; s++) {
    const es = teams[s];
    const you = s === 0 ? es[0] : null;
    // the most defensive Pokémon play back, the best attackers near the net
    const rest = es.filter(e => e !== you).sort((a, b) => (b.r.def - b.r.pwr) - (a.r.def - a.r.pwr));
    const order = you ? [...rest, you] : rest;
    order.forEach((e, i) => {
      const p = new Player(e, s, e === you, size);
      const [hx, hz] = spots[i];
      p.homeX = s === 0 ? hx : -hx; p.homeZ = s === 0 ? hz : -hz;
      sides[s].push(p);
    });
    serveOrder[s] = you ? [sides[s].find(p => p.human), ...sides[s].filter(p => !p.human)] : sides[s].slice();
  }
  G = {
    sides, players: [...sides[0], ...sides[1]], serveOrder,
    ball: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, trail: [], special: null, noHit: 0 },
    score: [0, 0], touches: [0, 0], lastSide: -1, lastToucher: null, intended: [null, null], lastAttack: null,
    serving: 0, serverIdx: [0, -1], server: null, phase: 'serve', timer: 0, time: 0,
    meter: [0, 0], armed: [false, false], react: [0, 0], aiErr: [[0, 0], [0, 0]], leave: [false, false],
    particles: [], texts: [], shake: 0, netWobble: 0, paused: false, shown: false, rally: 0, longestRally: 0,
    cam: { x: 0, z: -HL - CAM.back },
  };
  startServe();
}

function startServe() {
  const s = G.serving, order = G.serveOrder[s];
  const idx = ((G.serverIdx[s] % order.length) + order.length) % order.length;
  G.server = order[idx];
  for (const p of G.players) {
    p.x = p.homeX; p.z = p.homeZ; p.y = 0; p.vx = p.vy = p.vz = 0; p.onGround = true; p.cool = 0; p.ai.blockWait = -1;
  }
  const sv = G.server;
  sv.x = clamp(sv.homeX, -HW + 0.6, HW - 0.6); sv.z = -toward(s) * (HL + 0.8);
  Object.assign(G.ball, { vx: 0, vy: 0, vz: 0, trail: [], special: null, noHit: 0 });
  G.touches = [0, 0]; G.lastSide = -1; G.lastToucher = null; G.intended = [null, null]; G.lastAttack = null;
  G.phase = 'serve'; G.timer = 0; G.rally = 0;
  input.hitQ = false;
  const you = G.sides[0].find(p => p.human) || G.sides[0][0];
  G.cam.z = Math.min(-HL - CAM.back, you.z - 6.6); G.cam.x = clamp(you.x * 0.55, -HW * 0.6, HW * 0.6);
}

// ===================== physics and prediction =====================
// Time until the ball, coming down, is at height y. Null if it never gets that high.
function timeToY(b, y) {
  const d = b.vy * b.vy + 2 * GB * (b.y - y);
  if (d < 0) return null;
  const t = (b.vy + Math.sqrt(d)) / GB;
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
  b.vx = (tx - b.x) / T; b.vz = (tz - b.z) / T; b.vy = vy;
}
function clearsNet(x, y, z, vx, vy, vz) {
  if (z * vz >= 0) return false;
  const tn = -z / vz;
  return y + vy * tn - 0.5 * GB * tn * tn > NET_H + BR + 0.02;
}
function landAt(x, y, z, vx, vy, vz) {
  const t = (vy + Math.sqrt(vy * vy + 2 * GB * Math.max(0, y - BR))) / GB;
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
  const pad = !aiControlled(p) ? 0.28 : 0.22;
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

  // block at the net
  if (!p.onGround && Math.abs(p.z) < p.rr + 0.9 && fromOpp && b.vz * t < 0 && b.y > NET_H - 0.3 && G.lastSide !== -1) {
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

function setterOf(s, p) {
  const mates = G.sides[s].filter(q => q !== p);
  const sc = q => Math.abs(q.homeZ) * 10 - q.homeX * toward(s); // nearest the net, then the right side
  return mates.reduce((a, q) => (sc(q) < sc(a) ? q : a));
}
function attackerOf(s, p) {
  const mates = G.sides[s].filter(q => q !== p);
  const you = mates.find(q => q.human && !AUTO);
  if (you) return you;
  const sc = x => x.r.pwr + x.r.jmp - Math.abs(x.homeZ) * 6;
  return mates.reduce((a, q) => (sc(q) > sc(a) ? q : a));
}

function pass(p, incoming, wasSpecial, fromOpp) {
  const s = p.side, t = toward(s), b = G.ball;
  let target, tx, tz, ty, apexY, skill;
  if (G.touches[s] === 1) {
    target = setterOf(s, p);
    tx = clamp(target.homeX * 0.5, -HW + 1, HW - 1); tz = -t * 1.3; ty = 1.3;
    apexY = NET_H + 2.0; skill = p.r.def;
  } else {
    target = attackerOf(s, p);
    tx = clamp(target.homeX, -HW + 0.8, HW - 0.8); tz = -t * rand(0.7, 1.2);
    ty = target.apex + target.rr * 2; apexY = NET_H + 2.6 + rand(0, 0.5); skill = p.r.skl;
    p.stats.sets++;
  }
  const heat = clamp(incoming / 16, 0, 1.6) * (wasSpecial ? 1.8 : 1);
  const err = (100 - skill) * 0.022 * (0.4 + (G.touches[s] === 1 ? heat : 0.2));
  tx += rand(-1, 1) * err; tz += rand(-1, 1) * err * 0.7; apexY += rand(-0.3, 0.3) * err;
  tz = -t * Math.max(0.5, -tz * t);

  // a hard spike can shank off the arms
  if (G.touches[s] === 1 && fromOpp && incoming > 12) {
    const shank = clamp((incoming - 12) / 12, 0, 1) * (1.35 - p.r.def / 100) * (wasSpecial ? 1.5 : 1);
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
function openSpot(s) {
  const t = toward(s), opp = G.sides[1 - s];
  let best = [0, t * HL * 0.6], bs = -1;
  for (let i = 0; i < 16; i++) {
    const x = rand(-HW * 0.85, HW * 0.85), z = t * rand(1.4, HL - 0.7);
    let d = Infinity; for (const q of opp) d = Math.min(d, Math.hypot(q.x - x, q.z - z));
    if (d > bs) { bs = d; best = [x, z]; }
  }
  return best;
}

function spike(p, special) {
  const s = p.side, t = toward(s), b = G.ball;
  const human = !aiControlled(p);
  let [tx, tz] = openSpot(s);
  if (human) {
    const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (ix) tx = clamp(b.x + ix * HW, -HW * 0.85, HW * 0.85);
    if (keys.up) tz = t * 1.8; else if (keys.down) tz = t * (HL - 1);
  } else {
    const e = (s === 0 ? MATE : DIFF[settings.diff]).err;
    tx += rand(-1, 1) * e; tz += rand(-1, 1) * e;
  }
  const speed0 = (17 + p.r.pwr * 0.12) * (special ? 1.3 : 1);
  const aims = [[tx, tz]];
  for (let i = 0; i < 5; i++) aims.push([rand(-HW * 0.8, HW * 0.8), t * rand(1.5, HL - 1)]);
  const tries = [];
  for (const f of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) for (const [ax, az] of aims) tries.push([ax, 0, az, f]);
  for (const f of [0.8, 0.65]) for (const k of [0.4, 0.9]) tries.push([tx * 0.4, NET_H + k, 0, f]);
  for (const [ax, ay, az, f] of tries) {
    const dx = ax - b.x, dy = ay - b.y, dz = az - b.z, d = Math.hypot(dx, dy, dz) || 1;
    const sp = speed0 * f, vx = dx / d * sp, vy = dy / d * sp, vz = dz / d * sp;
    if (!clearsNet(b.x, b.y, b.z, vx, vy, vz)) continue;
    const [lx, lz] = landAt(b.x, b.y, b.z, vx, vy, vz);
    if (!inCourt(lx, lz, 1 - s) || Math.abs(lz) < 0.5) continue;
    b.vx = vx; b.vy = vy; b.vz = vz;
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
  const chance = (aiControlled(p) ? (s === 0 ? MATE.block : DIFF[settings.diff].block) : 0.42)
             + (p.r.jmp - (atk ? atk.r.pwr : 50)) / 250 - (wasSpecial ? 0.25 : 0);
  const roll = Math.random(), stuff = roll < clamp(chance, 0.08, 0.75);
  if (!stuff && roll < clamp(chance, 0.08, 0.75) + 0.4) { p.cool = 0.5; return; } // the spike gets past the block
  p.cool = 0.3; b.noHit = 0.08; b.special = null;
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
    floatText('Touched', p.x, p.cy + p.rr + 0.6, p.z, '#dfe8ff', 0.7);
  }
  rerollAI();
  Sfx.block();
}

// ===================== rally flow =====================
function stepBall(h) {
  const b = G.ball, pz = b.z;
  b.vy -= GB * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  b.spin += h * Math.hypot(b.vx, b.vz) * 0.8; b.noHit -= h;
  // the net
  if ((pz < 0) !== (b.z < 0) && Math.abs(b.x) < HW + 0.6 && b.y - BR < NET_H) {
    if (b.y > NET_H - 0.12 && b.vy < 0) { // rolls on the tape
      b.y = NET_H + BR; b.vy = Math.abs(b.vy) * 0.45;
      b.vz = b.vz * 0.4 + rand(-0.8, 0.8); if (Math.abs(b.vz) < 0.4) b.vz = 0.4 * (Math.random() < 0.5 ? -1 : 1);
    } else {
      b.z = Math.sign(pz || -1) * (BR + 0.02); b.vz *= -0.3; b.vx *= 0.6;
    }
    G.netWobble = 1; b.special = null;
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
  G.longestRally = Math.max(G.longestRally, G.rally);
  if (w !== G.serving) { G.serving = w; G.serverIdx[w]++; }
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
  const cost = p => Math.hypot(p.x - lx, p.z - lz) / p.speed + (p.onGround ? 0 : 0.15);
  let best = null;
  for (const p of cands) if (!best || cost(p) < cost(best)) best = p;
  // the ball is yours when it comes to you; teammates cover what you cannot reach
  if (best && best.human && !AUTO && Math.hypot(best.x - lx, best.z - lz) > 2.4) {
    const ais = cands.filter(p => !p.human);
    if (ais.length) best = ais.reduce((a, p) => (cost(p) < cost(a) ? p : a));
  }
  return best;
}
function frontBlocker(s) {
  const ais = G.sides[s].filter(aiControlled);
  if (!ais.length) return null;
  if (s === 0 && !AUTO && settings.mode === 2) return null; // in 2 v 2 your partner stays back to dig
  const sc = p => Math.abs(p.homeZ) + Math.abs(p.homeX - G.ball.x) * 0.3;
  return ais.reduce((a, p) => (sc(p) < sc(a) ? p : a));
}

function aiThink(dt) {
  const b = G.ball;
  for (let s = 0; s < 2; s++) {
    if (G.react[s] > 0) { G.react[s] -= dt; continue; }
    const pars = s === 0 ? MATE : DIFF[settings.diff];
    let tc = timeToY(b, 1.0); if (tc == null) tc = timeToY(b, BR) || 0;
    const f = clamp(tc / 0.9, 0, 1);
    const lx = b.x + b.vx * tc + G.aiErr[s][0] * f, lz = b.z + b.vz * tc + G.aiErr[s][1] * f;
    let receiver = null, blocker = null;
    if (ownSide(s, lz)) {
      const out = Math.abs(lx) > HW + 0.2 || Math.abs(lz) > HL + 0.2;
      const leave = out && G.lastSide !== s && G.leave[s];
      if (!leave) receiver = chooseReceiver(s, lx, lz);
    } else if (G.lastSide === 1 - s && G.touches[1 - s] >= 1) {
      blocker = frontBlocker(s);
    }
    for (const p of G.sides[s]) {
      if (!aiControlled(p)) continue;
      if (p === receiver) aiReceive(p, lx, lz, pars);
      else if (p === blocker) aiBlock(p, pars, dt);
      else { moveToward(p, p.homeX, p.homeZ, 0.8 * pars.spd); p.ai.blockWait = -1; }
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
      const tx = b.x + b.vx * tc, tz = b.z + b.vz * tc - t * p.rr * 0.5;
      if (p.onGround) {
        moveToward(p, tx, tz, pars.spd);
        if (tc <= p.jumpV / GP + 0.015 && Math.hypot(p.x - tx, p.z - tz) < p.rr + 0.35) jump(p);
      } else moveToward(p, tx, tz, pars.spd * 0.8);
      return;
    }
  }
  moveToward(p, lx, lz - t * 0.1, pars.spd);
}

function aiBlock(p, pars, dt) {
  const b = G.ball, s = p.side, t = toward(s);
  const attacker = G.sides[1 - s].find(q => !q.onGround && Math.abs(q.z) < 3.2);
  const bx = clamp(attacker ? attacker.x : b.x, -HW + 0.4, HW - 0.4), bz = -t * (p.rr + 0.3);
  moveToward(p, bx, bz, pars.spd);
  if (!p.onGround) return;
  const ballNear = Math.abs(b.z) < 4 && b.y > NET_H - 0.5;
  if (attacker && ballNear && Math.hypot(p.x - bx, p.z - bz) < 0.6) {
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
const CAM = { y: 4.3, back: 5.2, pitch: 0.2, F: (H / 2) / Math.tan(28 * Math.PI / 180), cy: H * 0.5 };
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
let skyCache = null;
function buildSky() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const hy = Math.round(horizonY());
  let gr = g.createLinearGradient(0, 0, 0, hy);
  gr.addColorStop(0, '#4fb4ec'); gr.addColorStop(1, '#cdefff');
  g.fillStyle = gr; g.fillRect(0, 0, W, hy);
  g.fillStyle = 'rgba(255,248,220,0.95)'; g.beginPath(); g.arc(1090, 70, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, s] of [[180, 70, 1], [520, 40, 0.8], [800, 95, 1.1], [1180, 140, 0.6]]) {
    for (const [dx, dy, rr] of [[0, 0, 34], [36, -12, 28], [70, 2, 30], [30, 12, 30]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, rr * s, 0, Math.PI * 2); g.fill(); }
  }
  // the sea along the horizon, then sand
  gr = g.createLinearGradient(0, hy - 30, 0, hy + 26);
  gr.addColorStop(0, '#2f8fcf'); gr.addColorStop(1, '#6cc9e3');
  g.fillStyle = gr; g.fillRect(0, hy - 30, W, 56);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 22; i++) { const x = (i * 89) % W, y = hy - 22 + (i * 13) % 42; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y); g.stroke(); }
  gr = g.createLinearGradient(0, hy + 26, 0, H);
  gr.addColorStop(0, '#f1dfae'); gr.addColorStop(1, '#e3c482');
  g.fillStyle = gr; g.fillRect(0, hy + 26, W, H - hy - 26);
  // palms on the shore
  for (const [px, sc] of [[70, 1.1], [215, 0.75], [1010, 0.8], [1190, 1.15]]) {
    const by = hy + 34;
    g.strokeStyle = '#8a5a35'; g.lineWidth = 7 * sc; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px, by); g.quadraticCurveTo(px + 14 * sc, by - 60 * sc, px + 6 * sc, by - 110 * sc); g.stroke();
    g.fillStyle = '#3f9b4a';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55;
      g.beginPath(); g.ellipse(px + 6 * sc + Math.cos(a) * 34 * sc, by - 110 * sc + Math.sin(a) * 16 * sc + 10 * sc, 36 * sc, 9 * sc, a, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}

function drawCourt() {
  ctx.fillStyle = 'rgba(255,243,212,0.6)';
  groundPoly([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  groundPoly([[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]]); ctx.stroke();
  ctx.lineWidth = 2;
  groundLine(-HW, 0, HW, 0);
  if (settings.mode === 6) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; groundLine(-HW, -3, HW, -3); groundLine(-HW, 3, HW, 3); }
}

function drawNet() {
  const wob = Math.sin(G.time * 40) * 0.04 * G.netWobble;
  const xL = -HW - 0.6, xR = HW + 0.6, top = NET_H, bot = NET_H - 0.95;
  const a = proj(xL, top, wob), b = proj(xR, top, wob), c = proj(xR, bot, wob), d = proj(xL, bot, wob);
  // posts
  ctx.lineWidth = Math.max(3, a.k * 0.09); ctx.strokeStyle = '#e8453c'; ctx.lineCap = 'round';
  for (const x of [xL, xR]) { const p0 = proj(x, 0, 0), p1 = proj(x, top + 0.1, 0); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
  // mesh
  ctx.fillStyle = 'rgba(20,24,34,0.12)';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,24,34,0.4)'; ctx.lineWidth = 1;
  const cols = Math.round((xR - xL) / 0.22);
  for (let i = 0; i <= cols; i++) { const u = i / cols; ctx.beginPath(); ctx.moveTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u); ctx.lineTo(d.x + (c.x - d.x) * u, d.y + (c.y - d.y) * u); ctx.stroke(); }
  for (let j = 0; j <= 5; j++) { const v = j / 5; ctx.beginPath(); ctx.moveTo(a.x + (d.x - a.x) * v, a.y + (d.y - a.y) * v); ctx.lineTo(b.x + (c.x - b.x) * v, b.y + (c.y - b.y) * v); ctx.stroke(); }
  // tape and bottom cord
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, a.k * 0.08);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  // antennas
  ctx.lineWidth = Math.max(2, a.k * 0.03);
  for (const x of [-HW, HW]) {
    const p0 = proj(x, top, 0), p1 = proj(x, top + 0.8, 0);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = i % 2 ? '#fff' : '#e8453c';
      ctx.beginPath(); ctx.moveTo(p0.x + (p1.x - p0.x) * i / 6, p0.y + (p1.y - p0.y) * i / 6);
      ctx.lineTo(p0.x + (p1.x - p0.x) * (i + 1) / 6, p0.y + (p1.y - p0.y) * (i + 1) / 6); ctx.stroke();
    }
  }
}

function drawBall(b) {
  for (let i = 0; i < b.trail.length; i++) {
    const q = b.trail[i], a = (i + 1) / b.trail.length, p = proj(q.x, q.y, q.z);
    ctx.fillStyle = q.c ? q.c : 'rgba(255,255,255,0.7)';
    ctx.globalAlpha = a * (q.c ? 0.7 : 0.35);
    ctx.beginPath(); ctx.arc(p.x, p.y, BR * 1.35 * p.k * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const p = proj(b.x, b.y, b.z), r = Math.max(3, BR * 1.35 * p.k);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(b.spin);
  ctx.fillStyle = '#fbfbf7'; ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.ellipse(-r * 0.55, 0, r * 0.5, r * 1.2, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d7fe0'; ctx.beginPath(); ctx.ellipse(r * 0.6, -r * 0.2, r * 0.45, r * 1.2, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (b.special) { ctx.strokeStyle = b.special; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
}

function drawPlayer(p) {
  const c = proj(p.x, p.cy, p.z);
  const r = p.rr * c.k;
  drawMon(ctx, p.mon, c.x, c.y, r, {
    face: p.face, back: p.side === 0, teamColor: TEAM_COLORS[0],
    squash: p.squash, look: proj(G.ball.x, G.ball.y, G.ball.z), time: G.time,
  });
  // name tag
  const fs = Math.round(clamp(c.k * 0.16, 10, 15));
  const ty = c.y - r - fs - (p.mon.types[0] === 'electric' ? r * 0.7 : 4);
  ctx.font = `700 ${fs}px system-ui, sans-serif`;
  const tw = ctx.measureText(p.mon.name).width + 12;
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = p.human ? '#ffe14a' : TEAM_COLORS[p.side];
  roundRect(ctx, c.x - tw / 2, ty - fs * 0.75, tw, fs * 1.5, fs * 0.75); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.human ? '#2a2200' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.mon.name, c.x, ty);
}

function roundRect(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function outlinedText(text, x, y, fill, size, align = 'center', weight = 900) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = 'rgba(15,20,35,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
}

function render() {
  if (!G) return;
  const b = G.ball;
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-1, 1) * 7 * G.shake, rand(-1, 1) * 7 * G.shake);
  ctx.drawImage(skyCache || (skyCache = buildSky()), 0, 0, W, H);
  drawCourt();

  // shadows and rings on the sand
  for (const p of G.players) {
    const lift = clamp(p.y / 2, 0, 0.6);
    ctx.fillStyle = TEAM_COLORS[p.side] + '66';
    groundEllipse(p.x, p.z, p.rr * (1.05 - lift), p.rr * (0.8 - lift * 0.6)); ctx.fill();
    if (p.human) { ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; groundEllipse(p.x, p.z, p.rr * 1.35, p.rr * 1.1); ctx.stroke(); }
  }
  ctx.fillStyle = `rgba(60,40,20,${0.38 - clamp(b.y / 8, 0, 0.25)})`;
  groundEllipse(b.x, b.z, BR * 1.4, BR * 1.1); ctx.fill();

  const you = G.sides[0].find(p => p.human);
  if (G.phase === 'rally') {
    // where the ball will land when it is coming down on your side
    const tl = timeToY(b, BR);
    if (tl != null) {
      const lx = b.x + b.vx * tl, lz = b.z + b.vz * tl;
      if (lz < 0) {
        ctx.strokeStyle = 'rgba(255,140,40,0.95)'; ctx.lineWidth = 3;
        groundEllipse(lx, lz, 0.45, 0.45); ctx.stroke();
        ctx.fillStyle = 'rgba(255,140,40,0.25)'; groundEllipse(lx, lz, 0.2, 0.2); ctx.fill();
      }
    }
    // where to jump when a teammate sets you
    if (you && !AUTO && G.intended[0] === you && G.lastSide === 0) {
      const tc = timeToY(b, you.apex + you.rr * 2 + 0.05);
      if (tc != null) {
        const mx = b.x + b.vx * tc, mz = b.z + b.vz * tc;
        ctx.strokeStyle = 'rgba(80,230,140,0.95)'; ctx.lineWidth = 4;
        groundEllipse(mx, mz, 0.55, 0.55); ctx.stroke();
        groundEllipse(mx, mz, 0.25, 0.25); ctx.stroke();
        const lab = proj(mx, 0, mz);
        outlinedText('JUMP + HIT', lab.x, lab.y + 22, '#7dffb0', 14);
      }
    }
  }

  // far side, the net, then the near side
  const items = [...G.players.map(p => ({ z: p.z, d: () => drawPlayer(p) })), { z: b.z, d: () => drawBall(b) }];
  for (const q of G.particles) items.push({ z: q.z, d: () => { const p = proj(q.x, q.y, q.z); ctx.globalAlpha = clamp(q.life * 2.5, 0, 1); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, q.r * p.k), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; } });
  items.sort((a, c) => c.z - a.z);
  let netDrawn = false;
  for (const it of items) {
    if (!netDrawn && it.z < 0) { drawNet(); netDrawn = true; }
    it.d();
  }
  if (!netDrawn) drawNet();

  const bp = proj(b.x, b.y, b.z);
  if (bp.y < 0) { // ball above the screen
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(bp.x, 8); ctx.lineTo(bp.x - 10, 24); ctx.lineTo(bp.x + 10, 24); ctx.closePath(); ctx.fill();
  }
  for (const t of G.texts) if (!t.big) {
    const k = t.t / t.life, p = proj(t.x, t.y, t.z);
    ctx.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    outlinedText(t.text, p.x, p.y - t.t * 40, t.color, t.size || 22);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawHud();
}

function drawHud() {
  const cx = W / 2;
  ctx.fillStyle = 'rgba(14,20,36,0.82)';
  roundRect(ctx, cx - 250, 12, 500, 74, 18); ctx.fill();
  ctx.fillStyle = TEAM_COLORS[0]; roundRect(ctx, cx - 250, 12, 10, 74, [18, 0, 0, 18]); ctx.fill();
  ctx.fillStyle = TEAM_COLORS[1]; roundRect(ctx, cx + 240, 12, 10, 74, [0, 18, 18, 0]); ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.font = '700 14px system-ui, sans-serif'; ctx.fillStyle = '#c9d4ee';
  ctx.textAlign = 'left'; ctx.fillText(teamName(0), cx - 228, 32);
  ctx.textAlign = 'right'; ctx.fillText(teamName(1), cx + 228, 32);
  ctx.font = '900 40px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(String(G.score[0]), cx - 60, 52); ctx.fillText(String(G.score[1]), cx + 60, 52);
  ctx.font = '700 12px system-ui, sans-serif'; ctx.fillStyle = '#8b98b8';
  ctx.fillText(`TO ${settings.target}`, cx, 36); ctx.fillText('WIN BY 2', cx, 52);
  const sx = G.serving === 0 ? cx - 108 : cx + 108;
  ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.arc(sx, 52, 7, 0, Math.PI * 2); ctx.fill();
  for (let s = 0; s < 2; s++) {
    const n = G.lastSide === s && G.phase === 'rally' ? G.touches[s] : 0;
    for (let i = 0; i < 3; i++) {
      const x = (s === 0 ? cx - 228 : cx + 228 - 40) + i * 20;
      ctx.fillStyle = i < n ? TEAM_COLORS[s] : 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.arc(x + 6, 70, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let s = 0; s < 2; s++) {
    const w = 220, x = s === 0 ? 24 : W - 24 - w, y = H - 34;
    const lead = s === 0 ? G.sides[0].find(p => p.human) || G.sides[0][0] : G.serveOrder[1][0];
    ctx.fillStyle = 'rgba(14,20,36,0.7)'; roundRect(ctx, x, y, w, 16, 8); ctx.fill();
    ctx.fillStyle = TYPE_COLORS[lead.mon.types[0]]; roundRect(ctx, x + 2, y + 2, (w - 4) * G.meter[s] / 100, 12, 6); ctx.fill();
    let label = 'TYPE SPIKE';
    if (s === 0 && !AUTO) label = G.armed[0] ? 'ARMED: SPIKE TO UNLEASH' : G.meter[0] >= 100 ? 'READY: PRESS K' : 'TYPE SPIKE';
    outlinedText(label, x + (s === 0 ? 0 : w), y - 10, G.meter[s] >= 100 ? '#fff' : '#dfe6f5', 12, s === 0 ? 'left' : 'right', 800);
  }
  if (G.phase === 'serve' && !aiControlled(G.server)) {
    ctx.globalAlpha = 0.65 + Math.sin(G.time * 5) * 0.35;
    outlinedText('Press J to serve  (arrows aim it)', W / 2, 120, '#fff', 20, 'center', 800);
    ctx.globalAlpha = 1;
  }
  for (const t of G.texts) if (t.big) {
    const k = t.t / t.life, a = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    ctx.globalAlpha = a;
    const s = 1 + Math.max(0, 0.25 - t.t) * 1.6;
    outlinedText(t.text, W / 2, 190, '#fff', Math.round(64 * s));
    ctx.fillStyle = t.color; ctx.fillRect(W / 2 - 60, 230, 120, 5);
    if (t.sub) outlinedText(t.sub, W / 2, 258, '#eef3ff', 20, 'center', 700);
    ctx.globalAlpha = 1;
  }
  if (G.paused) { ctx.fillStyle = 'rgba(10,14,26,0.55)'; ctx.fillRect(0, 0, W, H); }
}
const teamName = s => `Team ${teams[s][0].mon.name}`;

// ===================== canvas sizing and loop =====================
function sizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function portrait(mon, size = 96) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr; c.height = size * dpr; c.style.width = c.style.height = size + 'px';
  c.className = 'portrait'; c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const r = size * 0.27 * clamp(0.85 + Math.sqrt(mon.h) * 0.05, 0.85, 1.15);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(size / 2, size * 0.86, r, r * 0.2, 0, 0, Math.PI * 2); g.fill();
  drawMon(g, mon, size / 2, size * 0.86 - r, r, { face: 0.6, time: 0.4 });
  return c;
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
  top.appendChild(portrait(mon, opts.small ? 72 : 104));
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
  const need = settings.mode - 1, round = draft.picks.length + 1;
  $('#draft-round').textContent = need === 1 ? 'Pick your partner' : `Round ${round} of ${need}`;
  $('#draft-help').textContent = 'Pick one teammate from these three offers.';
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
    li.appendChild(portrait(e.mon, 52));
    li.appendChild(el('div', 'ri-text', `<b>${e.mon.name}</b><span>${i === 0 ? 'You (captain)' : 'Teammate'}</span>`));
    li.appendChild(el('div', 'ri-ovr', String(e.ovr)));
    list.appendChild(li);
  });
  for (let i = es.length; i < settings.mode; i++) list.appendChild(el('li', 'roster-item empty', '<span>Open slot</span>'));
  $('#roster-ovr').textContent = `Team rating ${teamOvr(es)}`;
}
$('#btn-reroll').addEventListener('click', () => {
  if (draft.rerolls <= 0) return;
  draft.rerolls--; makeOffers(); renderDraft();
  const f = document.querySelector('#offers .card'); if (f) f.focus();
});
function draftPick(mon) {
  draft.picks.push(mon);
  if (draft.picks.length >= settings.mode - 1) { buildTeams(); renderMatchup(); show('scr-matchup'); return; }
  makeOffers(); renderDraft();
  const f = document.querySelector('#offers .card'); if (f) f.focus();
}

function buildTeams() {
  const mine = [makeEntry(draft.starter, true), ...draft.picks.map(m => makeEntry(m, false))];
  const n = settings.mode;
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
  for (let s = 0; s < 2; s++) {
    const box = $(s === 0 ? '#mu-you' : '#mu-rival');
    box.innerHTML = '';
    box.appendChild(el('h3', '', `${teamName(s)} <span class="mu-ovr">${teamOvr(teams[s])}</span>`));
    const ul = el('ul', 'mu-list');
    teams[s].forEach((e, i) => {
      const li = el('li', '');
      li.appendChild(portrait(e.mon, 48));
      li.appendChild(el('div', 'ri-text', `<b>${e.mon.name}</b><span>${i === 0 ? (s === 0 ? 'You (captain)' : 'Captain') : e.mon.types.map(cap).join(' / ')}</span>`));
      li.appendChild(el('div', 'ri-ovr', String(e.ovr)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  $('#mu-meta').textContent = `${settings.mode} v ${settings.mode} · ${cap(settings.diff)} · first to ${settings.target}, win by 2`;
}
$('#btn-play').addEventListener('click', startMatch);
function startMatch() {
  Sfx.init();
  newMatch(); skyCache = null; show('stage'); sizeCanvas();
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
    for (const p of G.sides[s]) {
      const st = p.stats;
      tb.appendChild(el('tr', p.human ? 'you' : '', `<th scope="row">${p.mon.name}</th><td>${st.kills}</td><td>${st.aces}</td><td>${st.blocks}</td><td>${st.digs}</td><td>${st.sets}</td>`));
    }
    tbl.appendChild(tb); box.appendChild(tbl);
  }
  const mvp = G.players.reduce((a, p) => (val(p) > val(a) ? p : a));
  $('#res-mvp').innerHTML = '';
  $('#res-mvp').appendChild(portrait(mvp.mon, 64));
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
  while (draft.picks.length < settings.mode - 1) { draft.picks.push(draft.offers[0]); makeOffers(); }
  buildTeams(); startMatch();
}
