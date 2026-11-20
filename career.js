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
  return Number.isInteger(c.xp) && c.xp >= 0 && Number.isInteger(c.season) && c.season >= 1;
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
  $('#hub-facts').innerHTML = `<div><dt>Club</dt><dd>Not drafted yet</dd></div><div><dt>Position</dt><dd>${ROLES[c.pos].name}</dd></div>
    <div><dt>Build</dt><dd>${buildName(c)}</dd></div><div><dt>XP earned</dt><dd>${c.xpEarned}</dd></div>`;
  for (const b of $('#hub-diff').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === c.diff));
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
