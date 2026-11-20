// ===================== Road to Glory: careers =====================
// One rookie Pokémon, built from an archetype (or a custom spread), who grows by spending XP on the stats you choose.
// Loaded after game.js and uses its helpers ($, el, DEX, BY_ID, ROLES, STAT_KEYS, ovrOf, portrait, typeChips, show).
// The species only gives the look and the type: every stat comes from the build.

const RTG_KEY = 'volleydex-rtg';
const RTG_SLOTS = 3;
const RTG_POS = ['OH', 'MB', 'OPP', 'S', 'L'];
const STAT_IDS = STAT_KEYS.map(([k]) => k);

// Starting stats are RTG_BASE in each stat, plus `up` on the stats the build leans toward and minus 4 on its weak ones.
// Caps: 99 on the main stat, 94 on the second, 72 on the weak ones and 85 on the rest, unless `caps` says otherwise.
const RTG_BASE = 39;
const ARCHETYPES = {
  power:   { pos: 'OH',  name: 'Power Hitter',  lean: ['pwr', 'jmp'], weak: ['skl'],        perk: 'Heavier spikes from the left side' },
  allround:{ pos: 'OH',  name: 'All-Rounder',   lean: ['def', 'pwr'], weak: [], up: [8, 6, 3], caps: 90, perk: 'A wider window for a good pass' },
  wall:    { pos: 'MB',  name: 'Wall',          lean: ['jmp', 'pwr'], weak: ['spd', 'skl'], perk: 'A wider block' },
  quick:   { pos: 'MB',  name: 'Quick Hitter',  lean: ['spd', 'jmp'], weak: ['def'],        perk: 'Quicker spikes off a quick set' },
  cannon:  { pos: 'OPP', name: 'Cannon',        lean: ['pwr', 'jmp'], weak: ['def'],        perk: 'A harder topspin serve' },
  server:  { pos: 'OPP', name: 'Server',        lean: ['pwr', 'skl'], weak: ['jmp'],        perk: 'A more accurate float serve' },
  general: { pos: 'S',   name: 'Floor General', lean: ['skl', 'spd'], weak: ['pwr'],        perk: 'Sets land closer to the hitter' },
  jumpset: { pos: 'S',   name: 'Jump Setter',   lean: ['skl', 'jmp'], weak: ['def'],        perk: 'Faster quick sets' },
  digger:  { pos: 'L',   name: 'Digger',        lean: ['def', 'spd'], weak: ['pwr', 'jmp'], perk: 'A wider dig reach' },
  speed:   { pos: 'L',   name: 'Speedster',     lean: ['spd', 'def'], weak: ['pwr'],        perk: 'A faster chase to the ball' },
};
// Custom: spread CUSTOM_POOL points yourself, CUSTOM_MIN to CUSTOM_MAX in each stat. Every cap is CUSTOM_CAP and there is no perk.
const CUSTOM_POOL = 214, CUSTOM_MIN = 30, CUSTOM_MAX = 56, CUSTOM_CAP = 88;

function archStart(a) {
  const [p, s, rest] = a.up || [14, 9, 0], r = {};
  for (const k of STAT_IDS) r[k] = RTG_BASE + (k === a.lean[0] ? p : k === a.lean[1] ? s : a.weak.includes(k) ? -4 : rest);
  return r;
}
function archCaps(a) {
  const c = {};
  for (const k of STAT_IDS) c[k] = a.caps || (k === a.lean[0] ? 99 : k === a.lean[1] ? 94 : a.weak.includes(k) ? 72 : 85);
  return c;
}
const customCaps = () => Object.fromEntries(STAT_IDS.map(k => [k, CUSTOM_CAP]));
const customStart = () => { // an even spread, the leftover points from the left
  const r = {}, each = Math.floor(CUSTOM_POOL / STAT_IDS.length);
  let left = CUSTOM_POOL - each * STAT_IDS.length;
  for (const k of STAT_IDS) r[k] = each + (left-- > 0 ? 1 : 0);
  return r;
};
const sumStats = r => STAT_IDS.reduce((a, k) => a + r[k], 0);

// XP for one more point in a stat now at v: 5 in the 30s, then 2 more for each band of ten.
const upCost = v => 5 + 2 * Math.max(0, Math.floor((v - 30) / 10));

// ---------- saves ----------
// A career: { v, name, mon, pos, arch ('custom' or an ARCHETYPES key), r, cap, xp, xpEarned, season, diff, created }.
// Anything that does not check out is dropped, so a broken slot shows as empty instead of crashing the menu.
function validCareer(c) {
  if (!c || typeof c !== 'object' || c.v !== 1) return false;
  if (!BY_ID.has(c.mon) || !RTG_POS.includes(c.pos) || !DIFF[c.diff]) return false;
  if (c.arch !== 'custom' && !(ARCHETYPES[c.arch] && ARCHETYPES[c.arch].pos === c.pos)) return false;
  if (typeof c.name !== 'string' || c.name.length > 14) return false;
  for (const k of STAT_IDS) {
    if (!Number.isInteger(c.r?.[k]) || !Number.isInteger(c.cap?.[k])) return false;
    if (c.r[k] < 20 || c.cap[k] > 99 || c.r[k] > c.cap[k]) return false;
  }
  if (!(Number.isInteger(c.xp) && c.xp >= 0 && Number.isInteger(c.season) && c.season >= 1)) return false;
  if (c.league != null && !validLeague(c.league)) c.league = null; // a broken league sends you back to the draft, not the whole career
  return true;
}
function validLeague(L) {
  if (!L || !CLUBS[L.myClub] || !Array.isArray(L.weeks) || L.weeks.length !== 13 || !Array.isArray(L.results)) return false;
  if (!Number.isInteger(L.week) || L.week < 0 || L.week > 13) return false;
  for (const id of Object.keys(CLUBS)) if (!Array.isArray(L.clubs?.[id]) || L.clubs[id].length !== 7 || !L.clubs[id].every(m => BY_ID.has(m))) return false;
  return L.weeks.every((w, i) => Array.isArray(w) && w.length === 5 && Array.isArray(L.results[i]) && L.results[i].length === 5);
}
function loadCareers() {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(RTG_KEY)); } catch (e) {}
  return Array.from({ length: RTG_SLOTS }, (_, i) => (Array.isArray(a) && validCareer(a[i]) ? a[i] : null));
}
function saveCareers() { try { localStorage.setItem(RTG_KEY, JSON.stringify(careers)); } catch (e) {} }
let careers = loadCareers();
let slot = -1; // the career open in the hub

const careerOvr = c => ovrOf(c.r);
const careerName = c => c.name || BY_ID.get(c.mon).name;
const buildName = c => (c.arch === 'custom' ? 'Custom build' : ARCHETYPES[c.arch].name);
const escHtml = s => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Stat bars with a notch at each stat's cap.
function capBars(r, caps) {
  return `<dl class="bars cap-bars">${STAT_KEYS.map(([k, label, tip]) => `<div class="bar" title="${tip}"><dt>${label}</dt><dd>
    <span class="track"><span class="fill ${barClass(r[k])}" style="width:${r[k]}%"></span><i class="cap" style="left:${caps[k]}%"></i></span>
    <b>${r[k]}</b><span class="cap-n">/ ${caps[k]}</span></dd></div>`).join('')}</dl>`;
}
// The player card: sprite, name, position and build, OVR, stats against their caps, and the perk.
function careerCard(c) {
  const mon = BY_ID.get(c.mon), a = ARCHETYPES[c.arch];
  return `<div class="rtg-card" style="--tc:${TYPE_COLORS[mon.types[0]]}">
    <div class="card-top">${portrait(mon, 192, 128).outerHTML}<div class="ovr"><b>${careerOvr(c)}</b><span>OVR</span></div></div>
    <div class="card-body">
      <h3>${escHtml(careerName(c))}</h3>
      <p class="rtg-role">${ROLES[c.pos].name} · ${buildName(c)}</p>
      <div class="chips">${typeChips(mon)}</div>
      ${capBars(c.r, c.cap)}
      <p class="rtg-perk">${a ? `<b>Perk:</b> ${a.perk}` : '<b>No perk.</b> Custom builds pick their own starting stats instead.'}</p>
    </div>
  </div>`;
}

// ---------- the three save slots ----------
function renderSlots() {
  const box = $('#rtg-slots'); box.innerHTML = '';
  careers.forEach((c, i) => {
    const li = el('div', 'panel rtg-slot' + (c ? '' : ' empty'));
    if (!c) {
      li.innerHTML = `<p class="rtg-slot-n">Slot ${i + 1}</p><p class="rtg-slot-empty">Empty</p>`;
      const b = el('button', 'cta', 'New career'); b.type = 'button';
      b.addEventListener('click', () => openCreate(i));
      li.appendChild(b);
    } else {
      const mon = BY_ID.get(c.mon);
      li.innerHTML = `<p class="rtg-slot-n">Slot ${i + 1}</p>`;
      const row = el('div', 'rtg-slot-who');
      row.appendChild(portrait(mon, 96, 64));
      row.appendChild(el('div', 'ri-text', `<b>${escHtml(careerName(c))}</b><span>${ROLES[c.pos].short} · ${buildName(c)}</span><span>Season ${c.season}</span>`));
      row.appendChild(el('div', 'ri-ovr', String(careerOvr(c))));
      li.appendChild(row);
      const acts = el('div', 'rtg-actions');
      const go = el('button', 'cta', 'Continue'); go.type = 'button';
      go.addEventListener('click', () => openHub(i));
      const del = el('button', 'ghost small', 'Delete'); del.type = 'button';
      del.setAttribute('aria-label', `Delete the career in slot ${i + 1}`);
      del.addEventListener('click', () => askDelete(i));
      acts.append(go, del);
      li.appendChild(acts);
    }
    box.appendChild(li);
  });
  const first = box.querySelector('button'); if (first) first.setAttribute('data-autofocus', '');
}
let delSlot = -1;
function askDelete(i) {
  delSlot = i;
  $('#rtg-del-text').textContent = `${careerName(careers[i])} and everything in slot ${i + 1} will be gone for good.`;
  $('#rtg-del-dlg').showModal();
}
$('#rtg-del-yes').addEventListener('click', () => {
  if (delSlot >= 0) { careers[delSlot] = null; saveCareers(); }
  $('#rtg-del-dlg').close(); renderSlots();
  const f = $('#rtg-slots button'); if (f) f.focus();
});
$('#rtg-del-dlg').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.close(); });
$('#scr-rtg-hub [data-back]').addEventListener('click', renderSlots); // the slot shows the new OVR
$('#mm-rtg').addEventListener('click', () => { Sfx.init(); careers = loadCareers(); renderSlots(); show('scr-rtg'); });

// ---------- create a rookie ----------
let draftC = null; // the career being created: { slot, mon, pos, arch, custom: {stat: n}, diff }
function openCreate(i) {
  draftC = { slot: i, mon: pickOne(DEX).id, pos: 'OH', arch: 'power', custom: customStart(), diff: settings.diff };
  $('#rtg-q').value = ''; $('#rtg-name').value = '';
  renderDexGrid(); renderCreate(); show('scr-rtg-new');
  scrollToMon();
}
function draftCareer() { // the career the current choices make
  const a = ARCHETYPES[draftC.arch], custom = draftC.arch === 'custom';
  return { v: 1, name: $('#rtg-name').value.trim().slice(0, 14), mon: draftC.mon, pos: draftC.pos, arch: draftC.arch,
    r: custom ? { ...draftC.custom } : archStart(a), cap: custom ? customCaps() : archCaps(a),
    xp: 0, xpEarned: 0, season: 1, diff: draftC.diff, created: Date.now() };
}
function renderDexGrid() {
  const box = $('#rtg-grid'), q = $('#rtg-q').value.trim().toLowerCase().replace(/^#/, '');
  box.innerHTML = '';
  for (const m of DEX) {
    if (q && !m.name.toLowerCase().includes(q) && String(m.id) !== q.replace(/^0+/, '')) continue;
    const b = el('button', 'rtg-mon'); b.type = 'button';
    b.setAttribute('aria-pressed', String(m.id === draftC.mon));
    b.setAttribute('aria-label', `#${m.id} ${m.name}`); b.title = m.name;
    b.appendChild(portrait(m, 96, 56));
    b.addEventListener('click', () => { draftC.mon = m.id; markDex(); renderPreview(); });
    box.appendChild(b);
  }
  if (!box.children.length) box.appendChild(el('p', 'rtg-none', 'No Pokémon match that search.'));
}
function markDex() { for (const b of $('#rtg-grid').querySelectorAll('.rtg-mon')) b.setAttribute('aria-pressed', String(b.getAttribute('aria-label').startsWith(`#${draftC.mon} `))); }
function scrollToMon() { // scroll the grid, not the page, to the chosen Pokémon
  const g = $('#rtg-grid'), b = g.querySelector('[aria-pressed="true"]'); if (!b) return;
  const gr = g.getBoundingClientRect(), br = b.getBoundingClientRect();
  g.scrollTop += br.top - gr.top - (g.clientHeight - br.height) / 2;
}
$('#rtg-q').addEventListener('input', renderDexGrid);
$('#rtg-random').addEventListener('click', () => {
  draftC.mon = pickOne(DEX).id; $('#rtg-q').value = '';
  renderDexGrid(); renderPreview(); scrollToMon();
});
$('#rtg-name').addEventListener('input', renderPreview);
$('#rtg-diff').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  draftC.diff = b.dataset.v; renderCreate();
});

function renderCreate() {
  const pos = $('#rtg-pos'); pos.innerHTML = '';
  for (const p of RTG_POS) {
    const b = el('button', '', ROLES[p].name); b.type = 'button';
    b.setAttribute('aria-pressed', String(draftC.pos === p));
    b.addEventListener('click', () => {
      if (draftC.pos === p) return;
      draftC.pos = p;
      if (draftC.arch !== 'custom') draftC.arch = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k].pos === p);
      renderCreate(); $('#rtg-pos [aria-pressed="true"]').focus();
    });
    pos.appendChild(b);
  }
  $('#rtg-pos-desc').textContent = ROLE_DESC[draftC.pos];

  const builds = $('#rtg-builds'); builds.innerHTML = '';
  for (const k of [...Object.keys(ARCHETYPES).filter(k => ARCHETYPES[k].pos === draftC.pos), 'custom']) {
    const a = ARCHETYPES[k], b = el('button', 'rtg-build'); b.type = 'button';
    b.setAttribute('aria-pressed', String(draftC.arch === k));
    b.innerHTML = a
      ? `<b>${a.name}</b><span>Strong in ${a.lean.map(s => s.toUpperCase()).join(' and ')}${a.weak.length ? `, weaker in ${a.weak.map(s => s.toUpperCase()).join(' and ')}` : ', no weak stat'}</span><span class="rtg-build-perk">${a.perk}</span>`
      : `<b>Custom</b><span>Spread the starting points yourself. All caps ${CUSTOM_CAP}, no perk.</span>`;
    b.addEventListener('click', () => { draftC.arch = k; renderCreate(); $('#rtg-builds [aria-pressed="true"]').focus(); });
    builds.appendChild(b);
  }
  renderCustom();
  for (const b of $('#rtg-diff').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === draftC.diff));
  renderPreview();
}
function renderCustom() {
  const box = $('#rtg-custom'), on = draftC.arch === 'custom';
  box.hidden = !on; if (!on) return;
  const r = draftC.custom, left = CUSTOM_POOL - sumStats(r);
  box.innerHTML = `<p class="rtg-left" aria-live="polite">${left} point${left === 1 ? '' : 's'} left to spend</p>`;
  for (const [k, label] of STAT_KEYS) {
    const row = el('div', 'rtg-step-row');
    row.innerHTML = `<span class="rtg-stat">${label}</span><b>${r[k]}</b>`;
    const minus = el('button', 'rtg-pm', '−'), plus = el('button', 'rtg-pm', '+');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', `Lower ${label}`); plus.setAttribute('aria-label', `Raise ${label}`);
    minus.disabled = r[k] <= CUSTOM_MIN; plus.disabled = r[k] >= CUSTOM_MAX || left <= 0;
    minus.addEventListener('click', () => { r[k]--; renderCustom(); renderPreview(); focusPm(k, 0); });
    plus.addEventListener('click', () => { r[k]++; renderCustom(); renderPreview(); focusPm(k, 1); });
    row.insertBefore(minus, row.querySelector('b')); row.appendChild(plus);
    box.appendChild(row);
  }
  box.appendChild(el('p', 'settings-note', `Each stat can start between ${CUSTOM_MIN} and ${CUSTOM_MAX}.`));
}
function focusPm(k, i) { // keep focus on the button you pressed, or its partner once that one runs out
  const row = $('#rtg-custom').children[1 + STAT_IDS.indexOf(k)], bs = row.querySelectorAll('.rtg-pm');
  (bs[i].disabled ? bs[1 - i] : bs[i]).focus();
}
function renderPreview() {
  const c = draftCareer();
  $('#rtg-prev').innerHTML = careerCard(c);
  const left = c.arch === 'custom' ? CUSTOM_POOL - sumStats(c.r) : 0;
  const btn = $('#rtg-create');
  btn.disabled = left > 0;
  btn.title = left > 0 ? `Spend the ${left} points left first` : '';
}
$('#rtg-create').addEventListener('click', () => {
  const c = draftCareer();
  if (c.arch === 'custom' && sumStats(c.r) !== CUSTOM_POOL) return;
  careers[draftC.slot] = c; saveCareers();
  openHub(draftC.slot);
});

// ---------- the career hub ----------
function openHub(i) { slot = i; renderHub(); show('scr-rtg-hub'); }
function renderHub(focusStat) {
  const c = careers[slot]; if (!c) return;
  $('#hub-title').textContent = careerName(c);
  $('#hub-sub').textContent = `Slot ${slot + 1} · Season ${c.season} · ${c.season === 1 ? 'Rookie' : `Year ${c.season}`}`;
  $('#hub-card').innerHTML = careerCard(c);
  $('#hub-xp').innerHTML = `<b>${c.xp}</b> XP to spend`;
  const ups = $('#hub-ups'); ups.innerHTML = '';
  for (const [k, label, tip] of STAT_KEYS) {
    const v = c.r[k], full = v >= c.cap[k], cost = upCost(v);
    const row = el('div', 'rtg-up');
    row.innerHTML = `<span class="rtg-stat" title="${tip}">${label}</span><b>${v}</b><span class="cap-n">/ ${c.cap[k]}</span>`;
    const b = el('button', 'ghost small', full ? 'At cap' : `+1 · ${cost} XP`); b.type = 'button';
    b.disabled = full || c.xp < cost;
    b.setAttribute('aria-label', full ? `${label} is at its cap` : `Raise ${label} to ${v + 1} for ${cost} XP`);
    b.dataset.stat = k;
    b.addEventListener('click', () => upgrade(k));
    row.appendChild(b);
    ups.appendChild(row);
  }
  const club = c.league ? CLUBS[c.league.myClub] : null;
  $('#hub-facts').innerHTML = `<div><dt>Club</dt><dd>${club ? `<span class="rtg-club">${crestImg(c.league.myClub, 20)}${club.name}</span>` : 'Not drafted yet'}</dd></div><div><dt>Position</dt><dd>${ROLES[c.pos].name}</dd></div>
    <div><dt>Build</dt><dd>${buildName(c)}</dd></div><div><dt>XP earned</dt><dd>${c.xpEarned}</dd></div>`;
  for (const b of $('#hub-diff').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === c.diff));
  renderNext(c); renderLeague(c);
  if (focusStat) {
    const b = $(`#hub-ups [data-stat="${focusStat}"]`);
    (b && !b.disabled ? b : $('#hub-ups button:not(:disabled)') || $('#hub-diff [aria-pressed="true"]')).focus();
  }
}
function upgrade(k) {
  const c = careers[slot]; if (!c) return;
  const cost = upCost(c.r[k]);
  if (c.r[k] >= c.cap[k] || c.xp < cost) return;
  c.xp -= cost; c.r[k]++; saveCareers();
  Sfx.tone(660, 0.05, 'square', 0.03);
  renderHub(k);
}
$('#hub-diff').addEventListener('click', e => {
  const b = e.target.closest('button'), c = careers[slot]; if (!b || !c) return;
  c.diff = b.dataset.v; saveCareers(); renderHub();
});

// ===================== the league =====================
// Ten clubs in two divisions of five. A season is 13 weeks: the 4 clubs in your division home and away (8) and the
// 5 in the other division once (5). Every club plays every week, so each week is 5 matches. Then the top 2 of each
// division go to the playoffs: division winners host the other division's runner-up, and the winners meet in the final.
const DIVS = [['pallet', 'viridian', 'pewter', 'cinnabar', 'fuchsia'], ['cerulean', 'vermilion', 'lavender', 'celadon', 'saffron']];
const DIV_NAMES = ['West division', 'East division'];
const divOf = id => (DIVS[0].includes(id) ? 0 : 1);
const WEEKS = 13;
const FMT = { regular: { target: 15, sets: 3 }, semi: { target: 25, sets: 3 }, final: { target: 25, sets: 3 } };
const ROUND_NAMES = { regular: 'Regular season', semi: 'Semi-final', final: 'Final' };
const VENUE_FOR = { regular: 'arena', semi: 'bowl', final: 'night' }; // the final is in the championship arena
const CLUB_OVR = [56, 76]; // the weakest club's average OVR to the strongest's

// A season's weeks, each a list of 5 [home, away] pairs. Inside a division of 5, the circle method gives 5 rounds where
// one club rests: in round r, club r rests and clubs r+k and r-k play (k = 1, 2). Played twice (home and away swapped),
// that is 10 rounds. Each round the two resting clubs (one per division) play each other, which covers two of the five
// cross-division pairings (the East runs one round ahead in the second half, so the resting pairs differ); the other
// three are full cross-division weeks.
function makeSchedule() {
  const rr = (div, r, swap) => {
    const ids = DIVS[div], out = [];
    for (const k of [1, 2]) { const p = [ids[(r + k) % 5], ids[(r - k + 5) % 5]]; out.push(swap ? p.reverse() : p); }
    return out;
  };
  const cross = (shift, r) => { const p = [DIVS[0][r], DIVS[1][(r + shift) % 5]]; return shift % 2 ? p.reverse() : p; }; // the West hosts 3 of its 5, the East 2
  const divWeek = (r, second) => [...rr(0, r, second), ...rr(1, second ? (r + 1) % 5 : r, second), cross(second ? 1 : 0, r)];
  const crossWeek = shift => DIVS[0].map((_, r) => cross(shift, r));
  const d = [0, 1, 2, 3, 4].map(r => divWeek(r, false)), e = [0, 1, 2, 3, 4].map(r => divWeek(r, true));
  return [d[0], d[1], crossWeek(2), d[2], d[3], d[4], crossWeek(3), e[0], e[1], crossWeek(4), e[2], e[3], e[4]];
}

// Rosters: 7 Pokémon per club, no Pokémon on two clubs and none of your species. Each club aims at an average OVR
// spread evenly from CLUB_OVR[0] to CLUB_OVR[1], picking near that target so the running average stays on it.
function makeRosters(yourMon) {
  const pool = DEX.filter(m => !m.leg && m.id !== yourMon), ids = Object.keys(CLUBS).sort(() => Math.random() - 0.5);
  const out = {};
  ids.forEach((id, i) => {
    const target = CLUB_OVR[0] + (CLUB_OVR[1] - CLUB_OVR[0]) * i / (ids.length - 1);
    const roster = []; let sum = 0;
    for (let j = 0; j < 7; j++) {
      const want = target * (j + 1) - sum;
      const near = pool.slice().sort((a, b) => Math.abs(a.ovr - want) - Math.abs(b.ovr - want)).slice(0, 6);
      const m = pickOne(near);
      pool.splice(pool.indexOf(m), 1); roster.push(m.id); sum += m.ovr;
    }
    out[id] = roster;
  });
  return out;
}

// Entries for a match or a rating. Your club is you plus its seven, and the lineup leaves one of them out.
const youEntry = c => ({ mon: BY_ID.get(c.mon), captain: false, r: { ...c.r }, ovr: careerOvr(c), career: true });
const clubEntries = (L, id) => L.clubs[id].map(m => makeEntry(BY_ID.get(m), false));
function matchEntries(c, id) { return id === c.league.myClub ? [youEntry(c), ...clubEntries(c.league, id)] : clubEntries(c.league, id); }
function clubOvr(c, id) {
  const es = matchEntries(c, id), you = id === c.league.myClub ? es[0] : null;
  return teamOvr(lineup(es, you, c.pos, 6).map(x => x.entry));
}

// A simulated match from the two ratings: each rally goes to the home side with a chance that leans 0.6% per OVR point
// of difference (plus a small home edge and a little form on the day). Sets are played to the target, win by 2.
function simMatch(c, h, a, fmt) {
  const form = () => (Math.random() - 0.5) * 6;
  const p = clamp(0.5 + 0.01 + (clubOvr(c, h) + form() - clubOvr(c, a) - form()) * 0.006, 0.2, 0.8);
  const sets = [], need = Math.ceil(fmt.sets / 2);
  let wh = 0, wa = 0;
  while (wh < need && wa < need) {
    let x = 0, y = 0;
    while (!((x >= fmt.target || y >= fmt.target) && Math.abs(x - y) >= 2)) { if (Math.random() < p) x++; else y++; }
    sets.push([x, y]); if (x > y) wh++; else wa++;
  }
  return sets;
}
const homeWon = sets => sets.filter(([x, y]) => x > y).length > sets.length / 2;
const setLine = (sets, flip) => sets.map(([x, y]) => (flip ? `${y}-${x}` : `${x}-${y}`)).join(', ');

function newSeason(c) {
  const L = c.league;
  L.weeks = makeSchedule(); L.week = 0;
  L.results = L.weeks.map(w => w.map(() => null));
  L.po = null; L.champion = null;
}
// The draft screen comes later. For now the worst club (the lowest rated) takes you, as it would pick first.
function joinLeague(c) {
  c.league = { clubs: makeRosters(c.mon), myClub: null };
  c.league.myClub = Object.keys(CLUBS).reduce((a, b) => (clubAvg(c.league, b) < clubAvg(c.league, a) ? b : a));
  newSeason(c);
}
const clubAvg = (L, id) => teamOvr(clubEntries(L, id));

function standings(c) {
  const L = c.league, t = {};
  for (const id of Object.keys(CLUBS)) t[id] = { id, w: 0, l: 0, sw: 0, sl: 0, pf: 0, pa: 0 };
  L.weeks.forEach((wk, wi) => wk.forEach(([h, a], i) => {
    const s = L.results[wi][i]; if (!s) return;
    const hw = homeWon(s);
    t[h][hw ? 'w' : 'l']++; t[a][hw ? 'l' : 'w']++;
    for (const [x, y] of s) {
      t[h].pf += x; t[h].pa += y; t[a].pf += y; t[a].pa += x;
      if (x > y) { t[h].sw++; t[a].sl++; } else { t[a].sw++; t[h].sl++; }
    }
  }));
  return t;
}
function divTable(c, div, t = standings(c)) {
  return DIVS[div].map(id => t[id]).sort((x, y) => y.w - x.w || (y.sw - y.sl) - (x.sw - x.sl) || (y.pf - y.pa) - (x.pf - x.pa) || clubOvr(c, y.id) - clubOvr(c, x.id));
}
function seedPlayoffs(c) {
  const t = standings(c), [a, b] = [divTable(c, 0, t), divTable(c, 1, t)];
  c.league.po = { semis: [[a[0].id, b[1].id], [b[0].id, a[1].id]], semiRes: [null, null], final: null, finalRes: null };
}
// Where the season stands: 'regular', 'semi', 'final' or 'done'.
function phaseOf(L) {
  if (L.week < WEEKS) return 'regular';
  if (!L.po || L.po.semiRes.some(r => !r)) return 'semi';
  return L.po.finalRes ? 'done' : 'final';
}
// This round's matches: [{ h, a, set(sets) }].
function roundGames(L) {
  const ph = phaseOf(L);
  if (ph === 'regular') return L.weeks[L.week].map(([h, a], i) => ({ h, a, set: s => { L.results[L.week][i] = s; } }));
  if (ph === 'semi') return L.po.semis.map(([h, a], i) => ({ h, a, set: s => { L.po.semiRes[i] = s; } }));
  if (ph === 'final') return [{ h: L.po.final[0], a: L.po.final[1], set: s => { L.po.finalRes = s; } }];
  return [];
}
const myGame = L => roundGames(L).find(g => g.h === L.myClub || g.a === L.myClub) || null;
// Finish the round: your match's result (if you had one) goes in, the rest are simulated, then the season moves on.
function finishRound(c, mySets) {
  const L = c.league, ph = phaseOf(L);
  for (const g of roundGames(L)) g.set(mySets && (g.h === L.myClub || g.a === L.myClub) ? mySets : simMatch(c, g.h, g.a, FMT[ph]));
  if (ph === 'regular') { L.week++; if (L.week === WEEKS) seedPlayoffs(c); }
  else if (ph === 'semi') {
    const w = L.po.semis.map(([h, a], i) => (homeWon(L.po.semiRes[i]) ? h : a)), t = standings(c);
    const better = (x, y) => t[y].w - t[x].w || (t[y].sw - t[y].sl) - (t[x].sw - t[x].sl);
    L.po.final = w.sort(better);
  } else if (ph === 'final') L.champion = homeWon(L.po.finalRes) ? L.po.final[0] : L.po.final[1];
}

// ---------- XP from a match ----------
// 10 for playing, 10 for a win, plus your box score. Liberos, middles and setters touch the ball in ways the box score
// counts less, so their share is scaled up. Playoff matches give half as much again.
const POS_XP = { OH: 1, OPP: 1, MB: 1.4, S: 1.2, L: 3 };
function matchXp(c, st, won, ph) {
  const perf = Math.min(60, POS_XP[c.pos] * (2 * st.kills + 3 * st.aces + 3 * st.blocks + 1.5 * st.digs + 0.5 * st.ast));
  return Math.round((10 + (won ? 10 : 0) + perf) * (ph === 'regular' ? 1 : 1.5));
}

// ---------- playing your match ----------
const MU_BACK = $('#scr-matchup [data-back]'), MU_BACK_TEXT = MU_BACK.textContent;
function setupCareerMatch() {
  const c = careers[slot], L = c.league, g = myGame(L); if (!g) return;
  const ph = phaseOf(L), opp = g.h === L.myClub ? g.a : g.h;
  careerMatch = { slot, ph, home: g.h === L.myClub, opp, saved: JSON.parse(JSON.stringify(settings)), done: false };
  Object.assign(settings, { mode: 6, target: FMT[ph].target, sets: FMT[ph].sets, diff: c.diff });
  settings.role[6] = c.pos; settings.venue[6] = VENUE_FOR[ph];
  teams = [matchEntries(c, L.myClub), matchEntries(c, opp)];
  clubs = [CLUBS[L.myClub], CLUBS[opp]];
  renderMatchup();
  $('#mu-meta').textContent = `${ROUND_NAMES[ph]}${ph === 'regular' ? `, week ${L.week + 1}` : ''} · ${careerMatch.home ? 'Home' : 'Away'} · ${VENUES[VENUE_FOR[ph]].name} · You play ${ROLES[c.pos].name} · ${cap(c.diff)} · ${matchFormat()}`;
  MU_BACK.textContent = '← Career'; MU_BACK.dataset.back = 'scr-rtg-hub';
  show('scr-matchup');
}
// Back to the hub: your own settings come back (keeping any camera, zoom or serve change made in the match).
function careerBack() {
  if (careerMatch) {
    const keep = { camMode: settings.camMode, zoom: settings.zoom, serve: settings.serve };
    for (const k of Object.keys(settings)) delete settings[k];
    Object.assign(settings, careerMatch.saved, keep);
    careerMatch = null; saveSettings();
  }
  MU_BACK.textContent = MU_BACK_TEXT; MU_BACK.dataset.back = 'scr-pick';
  $('#res-xp').hidden = true;
  renderHub(); show('scr-rtg-hub');
}
MU_BACK.addEventListener('click', () => { if (careerMatch) careerBack(); });
// Called by showResult in game.js when your career match ends.
function careerMatchOver() {
  const m = careerMatch, c = careers[m.slot]; if (!c || m.done) return;
  m.done = true;
  const me = G.all[0].find(p => p.human), won = G.winner === 0;
  const sets = G.setLog.map(([x, y]) => (m.home ? [x, y] : [y, x])); // home side first
  const xp = matchXp(c, me.stats, won, m.ph);
  c.xp += xp; c.xpEarned += xp;
  finishRound(c, sets);
  saveCareers();
  $('#res-xp').hidden = false;
  $('#res-xp').innerHTML = `<b>+${xp} XP</b> for ${careerName(c)}${m.ph === 'regular' ? '' : ' (playoff bonus included)'}`;
}

// ---------- the hub's league panels ----------
function renderNext(c) {
  const info = $('#hub-next-info'), btn = $('#hub-next'), L = c.league;
  btn.disabled = false;
  if (!L) {
    info.innerHTML = '<p class="settings-note">Rookies join through the draft. The worst club picks first.</p>';
    btn.innerHTML = '<span aria-hidden="true">▶</span> Go to the draft'; btn.onclick = () => { joinLeague(c); saveCareers(); renderHub(); toast2(`${CLUBS[c.league.myClub].name} drafted you`); };
    return;
  }
  const ph = phaseOf(L), g = myGame(L);
  if (ph === 'done') {
    const champ = CLUBS[L.champion], won = L.champion === L.myClub;
    info.innerHTML = `<div class="rtg-champ">${crestImg(L.champion, 48)}<p><b>${won ? 'Champions!' : `${champ.name} win the title`}</b><span>Final: ${CLUBS[L.po.final[0]].name} ${setLine(L.po.finalRes)} ${CLUBS[L.po.final[1]].name}</span></p></div>`;
    btn.innerHTML = `<span aria-hidden="true">▶</span> Start season ${c.season + 1}`;
    btn.onclick = () => { c.season++; newSeason(c); saveCareers(); renderHub(); };
    return;
  }
  const label = ph === 'regular' ? `Week ${L.week + 1} of ${WEEKS}` : ROUND_NAMES[ph];
  if (g) {
    const home = g.h === L.myClub, opp = home ? g.a : g.h;
    info.innerHTML = `<p class="rtg-round">${label}</p><div class="rtg-vs">${crestImg(L.myClub, 40)}<b>${CLUBS[L.myClub].abbr}</b><span>${home ? 'vs' : 'at'}</span><b>${CLUBS[opp].abbr}</b>${crestImg(opp, 40)}</div>
      <p class="settings-note">${home ? 'Home' : 'Away'} against ${CLUBS[opp].name} (team rating ${clubOvr(c, opp)}). ${ph === 'regular' ? 'Best of 3 sets to 15.' : 'Best of 3 sets to 25.'}</p>`;
    btn.innerHTML = '<span aria-hidden="true">▶</span> Play match'; btn.onclick = setupCareerMatch;
  } else { // your club is out: the rest of the playoffs are simulated
    info.innerHTML = `<p class="rtg-round">${label}</p><p class="settings-note">${CLUBS[L.myClub].name} did not make it this far. Watch the other results come in.</p>`;
    btn.innerHTML = `<span aria-hidden="true">▶</span> Simulate the ${ph === 'semi' ? 'semi-finals' : 'final'}`;
    btn.onclick = () => { finishRound(c, null); saveCareers(); renderHub(); };
  }
}
function toast2(text) { // a short line under the Next up panel
  const p = el('p', 'rtg-toast', text); p.setAttribute('role', 'status');
  $('#hub-next-info').prepend(p);
}
function renderLeague(c) {
  const L = c.league;
  $('#hub-league').hidden = $('#hub-sched-wrap').hidden = !L;
  if (!L) return;
  const t = standings(c), tables = $('#hub-tables'); tables.innerHTML = '';
  for (const div of [0, 1]) {
    const rows = divTable(c, div, t).map((r, i) => `<tr class="${r.id === L.myClub ? 'you' : ''}${i === 1 ? ' cut' : ''}">
      <th scope="row"><span class="rtg-club">${crestImg(r.id, 20)}${CLUBS[r.id].name}</span></th><td>${r.w}</td><td>${r.l}</td><td>${r.sw}-${r.sl}</td><td>${clubOvr(c, r.id)}</td></tr>`).join('');
    tables.appendChild(el('table', 'box rtg-table', `<caption>${DIV_NAMES[div]}</caption><thead><tr><th scope="col">Club</th><th scope="col" title="Wins">W</th><th scope="col" title="Losses">L</th><th scope="col" title="Sets won and lost">Sets</th><th scope="col" title="Team rating">OVR</th></tr></thead><tbody>${rows}</tbody>`));
  }
  const sched = $('#hub-sched'); sched.innerHTML = '';
  const line = (label, h, a, res) => {
    const home = h === L.myClub, opp = home ? a : h, li = el('li', res ? (homeWon(res) === home ? 'w' : 'l') : '');
    const r = res ? `<b>${homeWon(res) === home ? 'W' : 'L'}</b> ${setLine(res, !home)}` : '';
    li.innerHTML = `<span class="rtg-wk">${label}</span><span class="rtg-club">${home ? 'vs' : 'at'} ${crestImg(opp, 20)}${CLUBS[opp].name}</span><span class="rtg-r">${r}</span>`;
    sched.appendChild(li);
  };
  L.weeks.forEach((wk, wi) => { const i = wk.findIndex(p => p.includes(L.myClub)); line(`Week ${wi + 1}`, ...wk[i], L.results[wi][i]); });
  if (L.po) {
    L.po.semis.forEach(([h, a], i) => { if (h === L.myClub || a === L.myClub) line('Semi', h, a, L.po.semiRes[i]); });
    if (L.po.final && L.po.final.includes(L.myClub)) line('Final', ...L.po.final, L.po.finalRes);
  }
  const now = sched.querySelector('li:not(.w):not(.l)'); if (now) now.classList.add('now');
}
