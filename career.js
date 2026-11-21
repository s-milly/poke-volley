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

// XP for one more point in a stat now at v: 10 in the 30s, then 4 more for each band of ten.
const upCost = v => 10 + 4 * Math.max(0, Math.floor((v - 30) / 10));

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
  if (c.league && (!c.league.ps || typeof c.league.ps !== 'object')) c.league.ps = {};
  if (!c.log || typeof c.log !== 'object') c.log = {};
  if (!Array.isArray(c.trophies)) c.trophies = [];
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
      li.innerHTML = `<p class="rtg-slot-n">Slot ${i + 1}</p><div class="rtg-slot-plus" aria-hidden="true">+</div><p class="rtg-slot-empty">Empty. Create a rookie and start from the draft.</p>`;
      const b = el('button', 'cta', 'New career'); b.type = 'button';
      b.addEventListener('click', () => openCreate(i));
      li.appendChild(b);
    } else {
      const mon = BY_ID.get(c.mon), club = c.league ? c.league.myClub : null;
      li.style.setProperty('--tc', TYPE_COLORS[mon.types[0]]);
      li.innerHTML = `<p class="rtg-slot-n">Slot ${i + 1}</p>`;
      const top = el('div', 'rtg-slot-top');
      top.appendChild(portrait(mon, 192, 128));
      top.appendChild(el('div', 'ovr', `<b>${careerOvr(c)}</b><span>OVR</span>`));
      li.appendChild(top);
      li.appendChild(el('div', 'rtg-slot-who', `<b>${escHtml(careerName(c))}</b><span>${ROLES[c.pos].name} · ${buildName(c)}</span>
        <span class="rtg-club">${club ? `${crestImg(club, 20)}${CLUBS[club].name}` : 'Not drafted yet'}</span><span>Season ${c.season} · ${ageLabel(c.season)}${(c.trophies || []).length ? ` · ${c.trophies.length} troph${c.trophies.length === 1 ? 'y' : 'ies'}` : ''}</span>`));
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
  renderHof();
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
function openHub(i) { slot = i; hubTab = 'home'; renderHub(); show('scr-rtg-hub'); }
// The hub is split into tabs: home (this week's tasks), upgrades, standings, schedule, stats and career. Only one pane
// shows at a time, and the hub fills the window, so each pane is laid out to fit without scrolling.
let hubTab = 'home';
const HUB_TABS = ['home', 'up', 'stand', 'sched', 'stats', 'awards', 'career'];
function setHubTab(t, focus) {
  if ($(`#tab-${t}`).hidden) t = 'home';
  hubTab = t;
  $('#rtg-hub').dataset.tab = t;
  for (const k of HUB_TABS) {
    const b = $(`#tab-${k}`), on = k === t;
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    $(`#pane-${k}`).hidden = !on;
  }
  if (focus) $(`#tab-${t}`).focus();
  if (t === 'career') fitHistory();
}
$('#hub-tabs').addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) setHubTab(b.dataset.tab); });
$('#hub-tabs').addEventListener('keydown', e => { // arrow keys, Home and End move between the tabs
  const shown = HUB_TABS.filter(k => !$(`#tab-${k}`).hidden), i = shown.indexOf(hubTab);
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: shown.length - 1 }[e.key];
  if (j == null) return;
  e.preventDefault(); setHubTab(shown[(j + shown.length) % shown.length], true);
});
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
function renderStrip(c) { // the season at a glance, over the tabs
  const L = c.league, chips = [];
  if (L) {
    const t = standings(c)[L.myClub], place = divTable(c, divOf(L.myClub)).findIndex(r => r.id === L.myClub);
    const ph = phaseOf(L);
    chips.push(['Season ' + c.season, ph === 'regular' ? `Week ${Math.min(L.week + 1, WEEKS)} of ${WEEKS}` : ph === 'done' ? 'Season over' : ROUND_NAMES[ph]]);
    chips.push(['Record', `${t.w}-${t.l}`]);
    chips.push(['Division', t.w + t.l ? `${ORD[place]} in the ${DIV_NAMES[divOf(L.myClub)].split(' ')[0]}` : DIV_NAMES[divOf(L.myClub)]]); // no place until a match is played
    chips.push(['Status', c.starter ? 'Starter' : 'Bench']);
    chips.push(['Team trust', `${trustOf(c)}% · ${trustLabel(trustOf(c))}`]);
  } else chips.push(['Season ' + c.season, 'Not drafted yet']);
  chips.push(['XP to spend', `${c.xp} XP`]);
  $('#hub-strip').innerHTML = chips.map(([k, v]) => `<li><small>${k}</small><b>${v}</b></li>`).join('');
}
// Home: this week's tasks. Train (one drill, optional) and play the match; the list starts again each week.
function renderTasks(c) {
  const L = c.league, ph = L ? phaseOf(L) : null, g = L ? myGame(L) : null;
  $('#week-label').textContent = !L ? 'Before the draft' : ph === 'regular' ? `Week ${L.week + 1} of ${WEEKS}` : ph === 'done' ? 'Off-season' : ROUND_NAMES[ph];
  const trained = !!(L && c.drill && c.drill.key === drillKey(c));
  $('#task-train').hidden = $('#hub-train-wrap').hidden;
  $('#task-train').classList.toggle('done', trained);
  $('#task-train-state').textContent = trained ? 'Done' : 'To do · before the match';
  $('#task-play-t').textContent = !L ? 'Join the draft' : ph === 'done' ? `Start season ${c.season + 1}`
    : !g ? 'Follow the playoffs' : ph === 'regular' ? `Play your week ${L.week + 1} match` : `Play the ${ROUND_NAMES[ph].toLowerCase()}`;
  $('#task-play-state').textContent = 'To do';
}
function renderTabs(c) {
  const L = c.league;
  $('#tab-stand').hidden = $('#tab-sched').hidden = !L;
  $('#tab-awards').hidden = !(L && phaseOf(L) === 'done' && (L.awards || []).length);
  const canDrill = !$('#hub-train-wrap').hidden && !(c.drill && c.drill.key === drillKey(c));
  $('#tab-home-badge').hidden = !canDrill; $('#tab-home-badge').textContent = 'Train';
  const canUp = STAT_KEYS.some(([k]) => c.r[k] < c.cap[k] && c.xp >= upCost(c.r[k]));
  $('#tab-up-badge').hidden = !canUp; $('#tab-up-badge').textContent = `${c.xp} XP`;
  setHubTab(hubTab);
}
function renderHub(focusStat) {
  const c = careers[slot]; if (!c) return;
  $('#hub-title').textContent = careerName(c);
  c.peak = Math.max(c.peak || 0, careerOvr(c));
  $('#hub-sub').textContent = `${c.league ? `${CLUBS[c.league.myClub].name} · ` : ''}Season ${c.season} · ${ageLabel(c.season)}`;
  $('#hub-card').innerHTML = careerCard(c);
  $('#hub-xp').innerHTML = `<b>${c.xp}</b> XP to spend`;
  const ups = $('#hub-ups'); ups.innerHTML = '';
  for (const [k, label, tip] of STAT_KEYS) {
    const v = c.r[k], full = v >= c.cap[k], cost = upCost(v);
    const row = el('div', 'rtg-up');
    row.innerHTML = `<span class="rtg-stat" title="${tip}">${label}</span><span class="track" aria-hidden="true"><span class="fill ${barClass(v)}" style="width:${v}%"></span><i class="cap" style="left:${c.cap[k]}%"></i></span><b>${v}</b><span class="cap-n">/ ${c.cap[k]}</span>`;
    const b = el('button', 'ghost small', full ? 'At cap' : `+1 · ${cost} XP`); b.type = 'button';
    b.disabled = full || c.xp < cost;
    b.setAttribute('aria-label', full ? `${label} is at its cap` : `Raise ${label} to ${v + 1} for ${cost} XP`);
    b.dataset.stat = k;
    b.addEventListener('click', () => upgrade(k));
    row.appendChild(b);
    ups.appendChild(row);
  }
  const a = ARCHETYPES[c.arch];
  $('#hub-perk').innerHTML = a ? `<b>Perk:</b> ${a.perk}` : '<b>No perk.</b> Custom builds pick their own starting stats instead.';
  for (const b of $('#hub-diff').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === c.diff));
  renderNext(c); renderLeague(c); renderTraining(c); renderStats(c); renderTasks(c); renderStrip(c); renderTabs(c);
  if (focusStat) {
    const b = $(`#hub-ups [data-stat="${focusStat}"]`);
    (b && !b.disabled ? b : $('#hub-ups button:not(:disabled)') || $('#hub-diff [aria-pressed="true"]')).focus();
  }
}
function upgrade(k) {
  const c = careers[slot]; if (!c) return;
  const cost = upCost(c.r[k]);
  if (c.r[k] >= c.cap[k] || c.xp < cost) return;
  c.xp -= cost; c.r[k]++;
  const up = promote(c); saveCareers();
  Sfx.tone(660, 0.05, 'square', 0.03);
  renderHub(k);
  if (up) toast2(`Your rating caught up with ${rivalStarter(c).mon.name}'s (${rivalStarter(c).ovr}). You start from now on!`);
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
function clubOvr(c, id) { // the seven who start: on your club that includes you only once you are a starter
  if (id !== c.league.myClub || !c.starter) return teamOvr(lineup(clubEntries(c.league, id), null, c.pos, 6).map(x => x.entry));
  const es = matchEntries(c, id);
  return teamOvr(lineup(es, es[0], c.pos, 6).map(x => x.entry));
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
  L.ps = {};        // regular-season stat lines for every player in the league, for the awards: key -> line
  L.awards = null;  // filled in when the final is played
  careerLog(c);     // your own line for the new season
}
// The rookie draft: you and nine other prospects, one pick per club. Clubs pick worst first (by team rating in your
// first season, as there are no standings yet) and each takes the best prospect left, by OVR plus a little scouting
// noise. So where you go depends on your build and stats. The other prospects are the draft show's supporting cast:
// they do not join the rosters.
function joinLeague(c) {
  c.league = { clubs: makeRosters(c.mon), myClub: null };
  const L = c.league, order = Object.keys(CLUBS).sort((a, b) => clubAvg(L, a) - clubAvg(L, b));
  const taken = new Set([c.mon, ...Object.values(L.clubs).flat()]);
  const pool = DEX.filter(m => !m.leg && !taken.has(m.id)).sort(() => Math.random() - 0.5).slice(0, 9);
  const scout = () => (Math.random() - 0.5) * 6;
  const prospects = [{ you: true, mon: c.mon, pos: c.pos, ovr: careerOvr(c), v: careerOvr(c) + scout() },
    ...pool.map(m => { const ovr = 33 + Math.floor(Math.random() * 14); /* 33 to 46, so a new rookie (41 to 43) usually goes early, to a weak club */ return { mon: m.id, pos: pickOne(RTG_POS), ovr, v: ovr + scout() }; })];
  prospects.sort((a, b) => b.v - a.v);
  L.draft = order.map((club, i) => ({ club, ...prospects[i], v: undefined }));
  const mine = L.draft.findIndex(d => d.you);
  L.myClub = L.draft[mine].club; c.draftPick = { n: mine + 1, club: L.myClub, season: c.season };
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
  for (const g of roundGames(L)) {
    if (mySets && (g.h === L.myClub || g.a === L.myClub)) { g.set(mySets); continue; }
    const sets = simMatch(c, g.h, g.a, FMT[ph]);
    g.set(sets);
    if (ph === 'regular') simStats(c, g.h, g.a, sets);
  }
  if (ph === 'regular') { L.week++; if (L.week === WEEKS) seedPlayoffs(c); }
  else if (ph === 'semi') {
    const w = L.po.semis.map(([h, a], i) => (homeWon(L.po.semiRes[i]) ? h : a)), t = standings(c);
    const better = (x, y) => t[y].w - t[x].w || (t[y].sw - t[y].sl) - (t[x].sw - t[x].sl);
    L.po.final = w.sort(better);
  } else if (ph === 'final') { L.champion = homeWon(L.po.finalRes) ? L.po.final[0] : L.po.final[1]; endSeason(c); }
}

// ---------- XP from a match ----------
// 10 for playing, 10 for a win, plus your box score. Liberos, middles and setters touch the ball in ways the box score
// counts less, so their share is scaled up. Playoff matches give half as much again.
const POS_XP = { OH: 1, OPP: 1, MB: 1.4, S: 1.2, L: 3 };
function matchXp(c, st, won, ph) {
  const perf = Math.min(60, POS_XP[c.pos] * (2 * st.kills + 3 * st.aces + 3 * st.blocks + 1.5 * st.digs + 0.5 * st.ast));
  return Math.round((10 + (won ? 10 : 0) + perf) * (ph === 'regular' ? 1 : 1.5));
}

// ---------- team trust ----------
// Trust runs from 0% (a new rookie, or a new arrival at a club) to 100%. It decides two things:
// - Playing time. Off the bench, the coach only calls you in at more moments as trust grows (careerCallIn), and you
//   start once it reaches TRUST_START, or once your OVR catches up with the starter ahead of you and trust is at least
//   TRUST_OVR. (OVR, not position fit: a build made for a position already fits it about as well as a weak club's
//   starter does.)
// - How often the setter picks you (trustSetWeight, used by choosePlay in game.js). It keeps growing once you start.
const TRUST_START = 75, TRUST_OVR = 50, BENCH_XP = 5;
const callLate = target => Math.round(target * 2 / 3); // 10 in a set to 15, 17 in a set to 25
const trustOf = c => clamp(Math.round(c.trust || 0), 0, 100);
// A match you play: 2 for coming on, up to 5 from your box score (as in matchXp), 1 for a win and GOAL_TRUST for a
// met coach's goal. A bad game costs trust, and each of these counts on its own:
// - hitting errors: 2 or more attacks hit out, into the net or stuffed, and more of them than kills: -3
// - the coach's goal: under half of it: -2
// - serving and passing: 2 or more serves missed or first passes the team could not play: -2 (-4 for 4 or more)
// Sitting the whole match gives 1. A short outing off the bench is about 2 to 5 before losses, a full match as a
// starter 4 to 10. With training (drillTrust), a rookie usually starts around the end of the first season.
function trustChange(c, st, won, played, goal) {
  if (!played) return { d: 1, why: ['sat the whole match'] };
  const perf = POS_XP[c.pos] * (2 * st.kills + 3 * st.aces + 3 * st.blocks + 1.5 * st.digs + 0.5 * st.ast);
  const met = goal && (st[goal.stat] || 0) >= goal.n;
  let d = 2 + Math.min(5, Math.round(perf / 5)) + (won ? 1 : 0) + (met ? GOAL_TRUST : 0);
  const why = [];
  if (st.herr >= 2 && st.herr > st.kills) { d -= 3; why.push(`${st.herr} hitting errors to ${st.kills} kill${st.kills === 1 ? "" : "s"}`); }
  if (goal && !met && (st[goal.stat] || 0) < goal.n / 2) { d -= 2; why.push('well short of the coach\'s goal'); }
  const sp = st.serr + st.rerr;
  if (sp >= 2) { d -= sp >= 4 ? 4 : 2; why.push(`${st.serr} missed serve${st.serr === 1 ? '' : 's'} and ${st.rerr} bad pass${st.rerr === 1 ? '' : 'es'}`); }
  return { d, why };
}
const drillTrust = score => (score >= 70 ? 2 : score >= 35 ? 1 : 0);
// The setter's weight for you against a teammate's 1 (game.js). 0.22 at 0% trust, 1.17 at 75% and 1.6 at 100%: as
// an outside in the front row, about 1 set in 10 at 0%, 1 in 3 at 75% and 4 in 10 at 100%. Calling for the ball
// multiplies it by 1 at 0% (they do not listen yet) up to 3.5 at 100%. (Quick play has no trust: 3, and 12 called.)
function trustSetWeight(callMe) {
  const u = trustOf(careers[careerMatch.slot]) / 100;
  return (0.22 + 1.38 * u ** 1.3) * (callMe ? 1 + 2.5 * u ** 1.5 : 1);
}
const trustLabel = t => (t >= 90 ? 'Go-to hitter' : t >= 75 ? 'Trusted' : t >= 40 ? 'Earning it' : t >= 15 ? 'Unproven' : 'New face');
// The starter ahead of you: the weaker (by position fit) of those your club puts at your position without you.
function rivalStarter(c) {
  const fit = ROLES[c.pos].fit, mine = lineup(clubEntries(c.league, c.league.myClub), null, c.pos, 6).filter(x => x.role === c.pos);
  return mine.reduce((a, b) => (fit(b.entry.r) < fit(a.entry.r) ? b : a)).entry;
}
function promote(c) { // true if you have just become a starter
  if (c.starter || !c.league) return false;
  const t = trustOf(c);
  if (t >= TRUST_START || (t >= TRUST_OVR && careerOvr(c) >= rivalStarter(c).ovr)) { c.starter = true; return true; }
  return false;
}
// Called by game.js at each dead ball while you sit: should the coach send you on now? The more trust, the more
// moments count. At any trust: once the set is decided (a team 3 from the target and 6 ahead), or in the last points
// of set 2 or later. From 25%: when the team falls 5 behind. From 50%: after a lost set, and from callLate points in
// set 2 or later.
function careerCallIn() {
  if (!careerMatch || !G) return false;
  const t = trustOf(careers[careerMatch.slot]), T = settings.target;
  const [us, them] = G.score, last = G.setLog[G.setLog.length - 1], hi = Math.max(us, them);
  if (hi >= T - 3 && Math.abs(us - them) >= 6) return coachSays('THIS SET IS DECIDED. GET SOME REPS IN!');
  if (G.setNo >= 2 && hi >= T - 2) return coachSays('A FEW POINTS FOR YOU. YOU ARE IN!');
  if (t >= 25 && us + them >= 6 && them - us >= 5) return coachSays('WE NEED A SPARK. YOU ARE IN!');
  if (t >= 50 && us + them === 0 && last && last[0] < last[1]) return coachSays('THE LAST SET GOT AWAY. YOU ARE IN!');
  if (t >= 50 && G.setNo >= 2 && hi >= callLate(T)) return coachSays('TIME FOR YOUR MINUTES. YOU ARE IN!');
  return false;
}
function callInText(c, target) { // when the coach may send you on, at your trust
  const t = trustOf(c), now = [`a set is out of reach (a team on ${target - 3} and 6 ahead)`, 'a set from set 2 on reaches its last points'];
  if (t >= 25) now.push('the team falls 5 behind');
  if (t >= 50) now.push('the team has lost the last set', `a team reaches ${callLate(target)} points in set 2 or later`);
  const next = t < 25 ? ' At 25% the coach also turns to you when the team falls 5 behind.' : t < 50 ? ' At 50% you also come on after a lost set and earlier in late sets.' : '';
  return `${now.slice(0, -1).join(', ')} or ${now[now.length - 1]}.${next}`;
}
function coachSays(text) { toast(`COACH: ${text}`, 2.5); return true; }

// ---------- playing your match ----------
const MU_BACK = $('#scr-matchup [data-back]'), MU_BACK_TEXT = MU_BACK.innerHTML;
function setupCareerMatch() {
  const c = careers[slot], L = c.league, g = myGame(L); if (!g) return;
  const ph = phaseOf(L), opp = g.h === L.myClub ? g.a : g.h;
  careerMatch = { slot, ph, home: g.h === L.myClub, opp, saved: JSON.parse(JSON.stringify(settings)), done: false };
  Object.assign(settings, { mode: 6, target: FMT[ph].target, sets: FMT[ph].sets, diff: c.diff });
  settings.role[6] = c.pos; settings.venue[6] = VENUE_FOR[ph];
  teams = [matchEntries(c, L.myClub), matchEntries(c, opp)];
  clubs = [CLUBS[L.myClub], CLUBS[opp]];
  careerMatch.bench = c.starter ? null : teams[0][0]; // the lineup leaves you out and you wait on the sideline
  renderMatchup();
  if (careerMatch.bench) $('#mu-you').appendChild(el('p', 'rot-note rtg-bench-note', `<b>${escHtml(careerName(c))} starts on the bench.</b> At ${trustOf(c)}% team trust the coach sends you on for ${rivalStarter(c).mon.name} when ${callInText(c, FMT[ph].target)}`));
  $('#mu-meta').textContent = `${ROUND_NAMES[ph]}${ph === 'regular' ? `, week ${L.week + 1}` : ''} · ${careerMatch.home ? 'Home' : 'Away'} · ${VENUES[VENUE_FOR[ph]].name} · You play ${ROLES[c.pos].name} · ${cap(c.diff)} · ${matchFormat()} · Coach's goal: ${goalText(coachGoal(c))}`;
  MU_BACK.innerHTML = '<span aria-hidden="true">◀</span> Career'; MU_BACK.dataset.back = 'scr-rtg-hub';
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
  MU_BACK.innerHTML = MU_BACK_TEXT; MU_BACK.dataset.back = 'scr-pick';
  $('#res-xp').hidden = true;
  hubTab = 'home'; renderHub(); show('scr-rtg-hub');
}
MU_BACK.addEventListener('click', () => { if (careerMatch) careerBack(); });
// Called by showResult in game.js when your career match ends.
function careerMatchOver() {
  const m = careerMatch, c = careers[m.slot]; if (!c || m.done) return;
  m.done = true;
  const me = G.rookie || G.all[0].find(p => p.human), won = G.winner === 0, played = !G.rookie || G.rookie.on;
  const sets = G.setLog.map(([x, y]) => (m.home ? [x, y] : [y, x])); // home side first
  const goal = c.goal, met = goal && played && (me.stats[goal.stat] || 0) >= goal.n;
  const bonus = met ? Math.round(GOAL_XP * (m.ph === 'regular' ? 1 : 1.5)) : 0;
  const xp = (played ? matchXp(c, me.stats, won, m.ph) : BENCH_XP) + bonus;
  c.xp += xp; c.xpEarned += xp;
  if (m.ph === 'regular') realStats(c, m.opp);
  const log = careerLog(c);
  if (played) { log.gp++; for (const k of [...STAT_LINE, 'att']) log[k] += me.stats[k] || 0; }
  c.goal = null;
  const tc = trustChange(c, me.stats, won, played, goal), was = trustOf(c);
  c.trust = clamp(was + tc.d, 0, 100);
  const d = trustOf(c) - was, bad = played ? tc.why : [];
  let trust = ` · Team trust ${d >= 0 ? '+' : ''}${d}% (${trustOf(c)}%)${bad.length ? `<br><span class="rtg-trust-loss">Lost trust: ${bad.join('; ')}.</span>` : ''}`;
  if (promote(c)) trust += ` · <b class="rtg-up-msg">You earned a starting spot!</b>`;
  finishRound(c, sets);
  saveCareers();
  $('#res-xp').hidden = false;
  const goalLine = goal ? `<br>Coach's goal, ${goalText(goal)}: ${met ? `<b class="rtg-up-msg">done, +${bonus} XP</b>` : `missed (${played ? me.stats[goal.stat] || 0 : 0} of ${goal.n})`}` : '';
  $('#res-xp').innerHTML = `<b>+${xp} XP</b> for ${escHtml(careerName(c))}${played ? '' : ' for being there (you did not come on)'}${m.ph === 'regular' ? '' : ' (playoff bonus included)'}${trust}${goalLine}`;
}

// ---------- the hub's league panels ----------
function renderNext(c) {
  const info = $('#hub-next-info'), btn = $('#hub-next'), L = c.league;
  btn.disabled = false;
  if (!L) {
    info.innerHTML = '<p class="settings-note">Rookies join through the draft. Ten clubs pick, the lowest rated first, and each takes the best prospect left. Where you go depends on your stats.</p>';
    btn.innerHTML = '<span aria-hidden="true">▶</span> Go to the draft'; btn.onclick = () => { joinLeague(c); saveCareers(); openDraft(); };
    return;
  }
  const ph = phaseOf(L), g = myGame(L);
  if (ph === 'done') {
    const champ = CLUBS[L.champion], won = L.champion === L.myClub;
    const aw = L.awards || [], mine = aw.filter(a => a.key === 'you');
    $('#aw-season').textContent = `Season ${c.season}`;
    $('#hub-awards').innerHTML = aw.map(a => `<li class="${a.key === 'you' ? 'you' : ''}"><b>${a.name}</b><span>${a.key === 'you' ? escHtml(careerName(c)) : lineName(L, a.key)} · ${CLUBS[a.club].abbr} · ${a.what}</span></li>`).join('');
    info.innerHTML = `<div class="rtg-champ">${crestImg(L.champion, 48)}<p><b>${won ? 'Champions!' : `${champ.name} win the title`}</b><span>Final: ${CLUBS[L.po.final[0]].name} ${setLine(L.po.finalRes)} ${CLUBS[L.po.final[1]].name}</span></p></div>
      ${aw.length ? `<p class="settings-note">${mine.length ? `You won ${mine.map(a => a.name.toLowerCase()).join(' and ')}! ` : ''}The season awards are on the Awards tab.</p>` : ''}`;
    const offers = L.offers || [];
    if (offers.length) {
      const box = el('div', 'rtg-offers', `<h4 class="rtg-aw-h">Offers from other clubs</h4>`);
      for (const o of offers) {
        const b = el('button', 'rtg-build', `<b>${crestImg(o.club, 20)} Sign with the ${CLUBS[o.club].name}</b><span>Team rating ${clubOvr(c, o.club)} · ${o.start ? 'you would start' : `on the bench behind ${starterAt(c, o.club).mon.name}`} · season ${c.season + 1}</span>`);
        b.type = 'button'; b.addEventListener('click', () => acceptOffer(c, o));
        box.appendChild(b);
      }
      info.appendChild(box);
    }
    btn.innerHTML = `<span aria-hidden="true">▶</span> ${offers.length ? `Stay with the ${CLUBS[L.myClub].abbr}: ` : ''}Start season ${c.season + 1}`;
    btn.onclick = () => startNextSeason(c);
    return;
  }
  const label = ph === 'regular' ? `Week ${L.week + 1} of ${WEEKS}` : ROUND_NAMES[ph];
  if (g) {
    const home = g.h === L.myClub, opp = home ? g.a : g.h;
    info.innerHTML = `<p class="rtg-round">${label}</p><div class="rtg-vs">${crestImg(L.myClub, 40)}<b>${CLUBS[L.myClub].abbr}</b><span>${home ? 'vs' : 'at'}</span><b>${CLUBS[opp].abbr}</b>${crestImg(opp, 40)}</div>
      <p class="settings-note">${home ? 'Home' : 'Away'} against ${CLUBS[opp].name} (team rating ${clubOvr(c, opp)}). ${ph === 'regular' ? 'Best of 3 sets to 15.' : 'Best of 3 sets to 25.'}</p>
      <p class="rtg-goal"><b>Coach's goal:</b> ${goalText(coachGoal(c))} (+${Math.round(GOAL_XP * (ph === 'regular' ? 1 : 1.5))} XP, +${GOAL_TRUST}% trust)</p>
      ${c.starter ? '' : `<p class="settings-note rtg-bench-line">On the bench behind ${rivalStarter(c).mon.name} (OVR ${rivalStarter(c).ovr}); the coach calls you in mid-match. You start at ${TRUST_START}% team trust, or at ${TRUST_OVR}% once your OVR reaches ${rivalStarter(c).ovr}.</p>`}`;
    btn.innerHTML = '<span aria-hidden="true">▶</span> Play match'; btn.onclick = setupCareerMatch;
  } else { // your club is out: the rest of the playoffs are simulated
    info.innerHTML = `<p class="rtg-round">${label}</p><p class="settings-note">${CLUBS[L.myClub].name} did not make it this far. Watch the other results come in.</p>`;
    btn.innerHTML = `<span aria-hidden="true">▶</span> Simulate the ${ph === 'semi' ? 'semi-finals' : 'final'}`;
    btn.onclick = () => { finishRound(c, null); saveCareers(); renderHub(); };
  }
}
let toast2Timer = 0;
function toast2(text) { // a short note floating over the bottom of the hub, so it never pushes the tab's content down
  let p = $('#hub-toast');
  if (!p) { p = el('p', 'rtg-toast hub-toast'); p.id = 'hub-toast'; p.setAttribute('role', 'status'); $('#rtg-hub').appendChild(p); }
  p.textContent = text; p.hidden = false;
  clearTimeout(toast2Timer); toast2Timer = setTimeout(() => { p.hidden = true; }, 6000);
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
  const line = (label, short, h, a, res) => {
    const home = h === L.myClub, opp = home ? a : h, li = el('li', res ? (homeWon(res) === home ? 'w' : 'l') : '');
    const r = res ? `<b>${homeWon(res) === home ? 'W' : 'L'}</b> <span class="sc-pts">${setLine(res, !home)}</span>` : '';
    li.innerHTML = `<span class="rtg-wk"><span class="vh">${label}</span><span aria-hidden="true">${short}</span></span><span class="rtg-club">${home ? 'vs' : 'at'} ${crestImg(opp, 20)}<span class="sc-full">${CLUBS[opp].name}</span><span class="sc-abbr">${CLUBS[opp].abbr}</span></span><span class="rtg-r">${r}</span>`;
    sched.appendChild(li);
  };
  L.weeks.forEach((wk, wi) => { const i = wk.findIndex(p => p.includes(L.myClub)); line(`Week ${wi + 1}`, `W${wi + 1}`, ...wk[i], L.results[wi][i]); });
  if (L.po) {
    L.po.semis.forEach(([h, a], i) => { if (h === L.myClub || a === L.myClub) line('Semi-final', 'SF', h, a, L.po.semiRes[i]); });
    if (L.po.final && L.po.final.includes(L.myClub)) line('Final', 'F', ...L.po.final, L.po.finalRes);
  }
  const now = sched.querySelector('li:not(.w):not(.l)'); if (now) now.classList.add('now');
  sched.style.setProperty('--rows', Math.ceil(sched.children.length / 2)); // fills down the first column, then the second
  const t2 = t[L.myClub]; $('#sched-rec').textContent = `Record ${t2.w}-${t2.l}`;
}

// ===================== stats, awards and coach goals =====================
const STAT_LINE = ['kills', 'aces', 'blocks', 'digs', 'ast'];
const blankLine = club => ({ club, gp: 0, kills: 0, aces: 0, blocks: 0, digs: 0, ast: 0 });
// Add one match to a player's season line. Players are keyed by Pokémon (no Pokémon is on two clubs); you are 'you'.
function addLine(L, key, club, st) {
  const ln = L.ps[key] || (L.ps[key] = blankLine(club));
  ln.club = club; ln.gp++;
  for (const k of STAT_LINE) ln[k] += st[k] || 0;
}
// Simulated matches get stat lines too, so the awards cover the whole league. Each point a team wins is a kill (55%),
// an ace (7%), a block (10%) or an error by the other side (28%), and goes to a player picked by role and rating;
// 85% of kills come from a set, credited to the setter. Digs: about one per point the other side wins, mostly to the
// libero and the outsides.
function simStats(c, h, a, sets) {
  const L = c.league, pts = [0, 0];
  for (const [x, y] of sets) { pts[0] += x; pts[1] += y; }
  [h, a].forEach((id, t) => {
    const lu = lineup(clubEntries(L, id), null, c.pos, 6), st = lu.map(() => ({ kills: 0, aces: 0, blocks: 0, digs: 0, ast: 0 }));
    const pick = w => { const ws = lu.map(w), sum = ws.reduce((x, y) => x + y, 0); let r = Math.random() * sum, i = 0; while ((r -= ws[i]) > 0 && i < ws.length - 1) i++; return i; };
    const W = {
      kills: ({ entry: e, role }) => e.r.pwr * ({ OH: 1, OPP: 1.2, MB: 0.6, S: 0.05 }[role] || 0),
      aces: ({ entry: e, role }) => (role === 'L' ? 0 : e.r.pwr),
      blocks: ({ entry: e, role }) => e.r.jmp * ({ MB: 1.5, OPP: 0.8, OH: 0.5, S: 0.3 }[role] || 0),
      digs: ({ entry: e, role }) => e.r.def * ({ L: 1.6, OH: 1, S: 0.5, OPP: 0.4, MB: 0.3 }[role] || 0.4),
    };
    const setter = lu.findIndex(x => x.role === 'S');
    for (let i = 0; i < pts[t]; i++) {
      const r = Math.random();
      if (r < 0.55) { st[pick(W.kills)].kills++; if (setter >= 0 && Math.random() < 0.85) st[setter].ast++; }
      else if (r < 0.62) st[pick(W.aces)].aces++;
      else if (r < 0.72) st[pick(W.blocks)].blocks++;
    }
    for (let i = 0; i < pts[1 - t]; i++) if (Math.random() < 0.9) st[pick(W.digs)].digs++;
    lu.forEach((x, i) => addLine(L, String(x.entry.mon.id), id, st[i]));
  });
}
// Your match: the real box score of everyone who took the court. You only count if you came on.
function realStats(c, oppId) {
  const L = c.league;
  for (let s = 0; s < 2; s++) for (const p of G.all[s]) {
    if (p === G.rookie && !p.on) continue;
    addLine(L, p.entry.career ? 'you' : String(p.mon.id), s === 0 ? L.myClub : oppId, p.stats);
  }
}
// Your career log: one line per season, including the playoffs.
function careerLog(c) {
  c.log = c.log || {};
  return c.log[c.season] || (c.log[c.season] = { ...blankLine(c.league ? c.league.myClub : null), att: 0, finish: null });
}
const lineName = (L, key) => (key === 'you' ? null : BY_ID.get(Number(key)).name);
// Season awards from the regular-season lines. A player needs 6 matches (about half the season) to qualify.
// Most valuable player: the most per match of 3 x (kills + aces + blocks) + digs + half the assists. Rookie of the Year:
// the league's only first-year player is you, so it is yours if you finish your first season as a starter.
const AWARDS = [
  { id: 'mvp', name: 'Most valuable player', val: l => (3 * (l.kills + l.aces + l.blocks) + l.digs + 0.5 * l.ast) / l.gp, fmt: l => `${((3 * (l.kills + l.aces + l.blocks) + l.digs + 0.5 * l.ast) / l.gp).toFixed(1)} a match` },
  { id: 'kills', name: 'Top scorer', val: l => l.kills, fmt: l => `${l.kills} kills` },
  { id: 'aces', name: 'Top server', val: l => l.aces, fmt: l => `${l.aces} aces` },
  { id: 'blocks', name: 'Top blocker', val: l => l.blocks, fmt: l => `${l.blocks} blocks` },
  { id: 'digs', name: 'Top digger', val: l => l.digs, fmt: l => `${l.digs} digs` },
  { id: 'ast', name: 'Top setter', val: l => l.ast, fmt: l => `${l.ast} assists` },
];
function endSeason(c) {
  const L = c.league, lines = Object.entries(L.ps).filter(([, l]) => l.gp >= 6);
  L.awards = AWARDS.map(a => {
    if (!lines.length) return null;
    const [key, l] = lines.reduce((x, y) => (a.val(y[1]) > a.val(x[1]) ? y : x));
    return { id: a.id, name: a.name, key, club: l.club, what: a.fmt(l) };
  }).filter(Boolean);
  const first = c.draftPick && c.draftPick.season === c.season;
  if (first && c.starter) L.awards.push({ id: 'roy', name: 'Rookie of the Year', key: 'you', club: L.myClub, what: 'won a starting spot in year one' });
  c.trophies = c.trophies || [];
  for (const a of L.awards) if (a.key === 'you') c.trophies.push({ season: c.season, title: a.name, club: L.myClub });
  if (L.champion === L.myClub) c.trophies.push({ season: c.season, title: 'Champion', club: L.myClub });
  const t = standings(c)[L.myClub], log = careerLog(c), div = divTable(c, divOf(L.myClub)).findIndex(r => r.id === L.myClub) + 1;
  makeClubOffers(c);
  log.rec = `${t.w}-${t.l}`;
  log.finish = L.champion === L.myClub ? 'Champion' : L.po.final.includes(L.myClub) ? 'Lost the final'
    : L.po.semis.flat().includes(L.myClub) ? 'Lost a semi-final' : `${['1st', '2nd', '3rd', '4th', '5th'][div - 1]} in the ${DIV_NAMES[divOf(L.myClub)].split(' ')[0]}`;
}

// Coach goals: before each match the coach sets one goal for your position. Off the bench (fewer minutes) it is half
// as big, in the playoffs (sets to 25) half as big again. Meeting it gives GOAL_XP and GOAL_TRUST.
const GOALS = { OH: [['kills', 5], ['digs', 5]], OPP: [['kills', 5], ['aces', 2]], MB: [['blocks', 2], ['kills', 3]], S: [['ast', 12], ['aces', 1]], L: [['digs', 4]] };
const GOAL_NAMES = { kills: ['kill', 'kills'], digs: ['dig', 'digs'], aces: ['ace', 'aces'], blocks: ['block', 'blocks'], ast: ['assist', 'assists'] };
const GOAL_XP = 15, GOAL_TRUST = 2;
const goalText = g => `${g.n} ${GOAL_NAMES[g.stat][g.n === 1 ? 0 : 1]}`;
function roundKey(L) { const ph = phaseOf(L); return `${ph}-${ph === 'regular' ? L.week : 0}`; }
function coachGoal(c) { // the goal for the coming match, set once and saved so a reload does not change it
  const L = c.league, key = `${c.season}-${roundKey(L)}`;
  if (c.goal && c.goal.key === key) return c.goal;
  const [stat, base] = pickOne(GOALS[c.pos]), ph = phaseOf(L);
  let n = c.starter ? base : Math.ceil(base / 2);
  if (ph !== 'regular') n = Math.round(n * 1.5);
  c.goal = { key, stat, n: Math.max(1, n) };
  saveCareers();
  return c.goal;
}

// ---------- the draft show ----------
let draftTimer = null;
function openDraft() {
  const c = careers[slot], L = c.league;
  $('#draft-sub').textContent = `Season ${c.season} · ${L.draft.length} clubs, one pick each, the lowest-rated club first. Clubs take the best prospect left.`;
  const list = $('#draft-list'); list.innerHTML = '';
  L.draft.forEach((d, i) => {
    const li = el('li', 'rtg-pick' + (d.you ? ' you' : ''));
    const mon = BY_ID.get(d.mon);
    li.innerHTML = `<span class="rtg-pick-n">${i + 1}</span><span class="rtg-club">${crestImg(d.club, 24)}${CLUBS[d.club].name}</span>
      <span class="rtg-pick-who">${portrait(mon, 96, 40).outerHTML}<span><b>${d.you ? escHtml(careerName(c)) : mon.name}</b><i>${ROLES[d.pos].short} · OVR ${d.ovr}${d.you ? ' · YOU' : ''}</i></span></span>`;
    list.appendChild(li);
  });
  $('#draft-go').hidden = true; $('#draft-skip').hidden = false;
  $('#draft-result').textContent = '';
  show('scr-rtg-draft');
  revealPick(0, reduceMotion.matches ? 0 : 650);
}
function revealPick(i, wait) {
  clearTimeout(draftTimer);
  const rows = $('#draft-list').children, c = careers[slot];
  if (i >= rows.length || !c) { draftDone(); return; }
  rows[i].classList.add('shown');
  if (rows[i].classList.contains('you')) {
    Sfx.point(true);
    $('#draft-result').textContent = `With pick ${i + 1}, the ${CLUBS[c.league.myClub].name} select ${careerName(c)}!`;
  }
  draftTimer = setTimeout(() => revealPick(i + 1, wait), rows[i].classList.contains('you') ? wait * 2.5 : wait);
}
function draftDone() {
  clearTimeout(draftTimer);
  for (const r of $('#draft-list').children) r.classList.add('shown');
  const c = careers[slot];
  $('#draft-result').textContent = `With pick ${c.draftPick.n}, the ${CLUBS[c.league.myClub].name} select ${careerName(c)}!`;
  $('#draft-skip').hidden = true; $('#draft-go').hidden = false;
  $('#draft-go').textContent = `Join the ${CLUBS[c.league.myClub].name}`;
  $('#draft-go').focus();
}
$('#draft-skip').addEventListener('click', draftDone);
$('#draft-go').addEventListener('click', () => { clearTimeout(draftTimer); hubTab = 'home'; renderHub(); show('scr-rtg-hub'); });

// ---------- the career stats page ----------
const LEADS = [['kills', 'Kills'], ['aces', 'Aces'], ['blocks', 'Blocks'], ['digs', 'Digs'], ['ast', 'Assists']];
function renderStats(c) { // the Stats tab: your season, the league leaders, trophy case and a line per season
  const L = c.league, mine = (c.log || {})[c.season] || blankLine(null);
  $('#stats-season').textContent = `Season ${c.season}`;
  const SHORT = { gp: 'GP', kills: 'K', aces: 'ACE', blocks: 'BLK', digs: 'DIG', ast: 'AST' };
  $('#my-line').innerHTML = [['Matches', 'gp'], ...LEADS.map(([k, n]) => [n, k])].map(([n, k]) => `<li><small><span class="ml-full">${n}</span><span class="ml-abbr" aria-hidden="true">${SHORT[k]}</span></small><b>${mine[k]}</b></li>`).join('');
  $('#leaders-wrap').hidden = !L;
  if (L) {
    const lines = Object.entries(L.ps || {});
    $('#leaders').innerHTML = LEADS.map(([k, name]) => {
      const ranked = lines.filter(([, l]) => l[k] > 0).sort((a, b) => b[1][k] - a[1][k]);
      const you = ranked.findIndex(([key]) => key === 'you');
      const rows = ranked.slice(0, 3).map(([key, l], i) => `<li class="${key === 'you' ? 'you' : ''}"><i>${i + 1}</i>${crestImg(l.club, 20)}<span>${key === 'you' ? escHtml(careerName(c)) : lineName(L, key)}</span><b>${l[k]}</b></li>`).join('');
      const yours = you >= 3 ? `<p class="leader-you">You: ${ranked[you][1][k]}, ${you + 1}${['th', 'st', 'nd', 'rd'][(you + 1) % 10 < 4 && Math.floor((you + 1) / 10) % 10 !== 1 ? (you + 1) % 10 : 0]} in the league</p>` : '';
      return `<div class="leader"><h4>${name}</h4>${rows ? `<ol>${rows}</ol>${yours}` : '<p class="settings-note">No matches played yet.</p>'}</div>`;
    }).join('');
  }
  const dp = c.draftPick;
  $('#stats-sub').textContent = `${dp ? `Drafted with pick ${dp.n} by the ${CLUBS[dp.club].name} in season ${dp.season}.`
    : c.league ? `Plays for the ${CLUBS[c.league.myClub].name}.` : 'Not drafted yet.'} ${c.xpEarned} XP earned so far.`;
  // one entry per kind of trophy, with the seasons it was won, so the case stays one row however long the career runs
  const tro = c.trophies || [], titles = tro.filter(t => t.title === 'Champion').length, kinds = [];
  for (const t of tro) { let k = kinds.find(x => x.title === t.title); if (!k) kinds.push(k = { title: t.title, won: [] }); k.won.push(`S${t.season} ${CLUBS[t.club].abbr}`); }
  $('#stats-trophies').innerHTML = kinds.length
    ? kinds.map(k => `<li class="${k.title === 'Champion' ? 'champ' : ''}"><b>${k.title}${k.won.length > 1 ? ` ×${k.won.length}` : ''}</b><span>${k.won.join(', ')}</span></li>`).join('')
    : '<li class="none">Nothing yet. Titles and season awards will show here.</li>';
  const seasons = Object.keys(c.log || {}).map(Number).sort((a, b) => a - b), tot = { gp: 0, kills: 0, aces: 0, blocks: 0, digs: 0, ast: 0 };
  for (const n of seasons) for (const k in tot) tot[k] += c.log[n][k];
  // the table shows a page of seasons that fits the tab (fitHistory sets histRows); the totals count every season
  const pages = Math.max(0, seasons.length - histRows); histEnd = Math.min(Math.max(histEnd, 0), pages);
  const shown = seasons.slice(Math.max(0, seasons.length - histRows - histEnd), seasons.length - histEnd);
  $('#hist-pager').hidden = seasons.length <= histRows;
  $('#hist-range').textContent = shown.length ? `Seasons ${shown[0]}-${shown[shown.length - 1]} of ${seasons.length}` : '';
  $('#hist-old').disabled = histEnd >= pages; $('#hist-new').disabled = histEnd <= 0;
  const rows = shown.map(n => {
    const l = c.log[n];
    return `<tr><th scope="row">${n}</th><td class="rtg-club">${l.club ? `${crestImg(l.club, 20)}${CLUBS[l.club].abbr}` : '-'}</td><td>${l.gp}</td><td>${l.kills}</td><td>${l.aces}</td><td>${l.blocks}</td><td>${l.digs}</td><td>${l.ast}</td><td class="hist-rec">${l.rec || (n === c.season ? 'In progress' : '-')}</td><td>${l.finish || ''}</td></tr>`;
  }).join('');
  $('#stats-table').innerHTML = `<caption class="vh">Season by season</caption>
    <thead><tr><th scope="col"><abbr title="Season">S</abbr></th><th scope="col">Club</th><th scope="col" title="Matches you played in">GP</th><th scope="col">K</th><th scope="col">ACE</th><th scope="col">BLK</th><th scope="col">DIG</th><th scope="col">AST</th><th scope="col" class="hist-rec" title="Club's regular-season record">Record</th><th scope="col">Finish</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><th scope="row">Total</th><td></td><td>${tot.gp}</td><td>${tot.kills}</td><td>${tot.aces}</td><td>${tot.blocks}</td><td>${tot.digs}</td><td>${tot.ast}</td><td class="hist-rec"></td><td>${titles ? `${titles} title${titles > 1 ? 's' : ''}` : ''}</td></tr></tfoot>`;
}
let histRows = 10, histEnd = 0; // seasons per page of the history table, and how many of the newest are paged past
// Show as many seasons as fit in the Career tab without it scrolling: start from 10 and drop a row while the pane overflows.
function fitHistory() {
  const c = careers[slot], pane = $('#pane-career'); if (!c || pane.hidden) return;
  histRows = 10; renderStats(c);
  while (histRows > 1 && pane.scrollHeight > pane.clientHeight + 1) { histRows--; renderStats(c); }
}
$('#hist-old').addEventListener('click', () => { histEnd += histRows; renderStats(careers[slot]); });
$('#hist-new').addEventListener('click', () => { histEnd -= histRows; renderStats(careers[slot]); });
let fitTimer = 0;
addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitHistory, 150); });

// ===================== training drills =====================
// One drill between matches, on the real match engine through the tutorial's drill mode (soft serves, clean passes
// and sets from the computer, no score). Each drill trains one stat and plays at the position that uses it most.
// A rally is a rep, scored 0 to 1 from your timing (PERFECT 1, GOOD 0.7, OK 0.4, WEAK 0.1, too long or missed 0).
// After DRILL_REPS reps the average sets the reward: 70 or more raises the stat by 2, 35 or more by 1.
const DRILL_REPS = 6;
const DRILLS = {
  serve: { stat: 'pwr', name: 'Serving', role: 'OPP', serve: 'you', ev: 'serve',
    text: 'Serve 6 balls. Hold left click to toss and let go as it drops back to your hand. Better timing scores more, an ace scores full marks and a fault scores nothing.' },
  pass: { stat: 'def', name: 'Passing', role: 'OH', serve: 'them', mine: true, ev: 'pass',
    text: 'They serve 6 balls at you. Get to the green carets, hold left click and let go as the ball arrives.' },
  block: { stat: 'jmp', name: 'Blocking', role: 'MB', serve: 'us', ev: 'block',
    text: 'Your side serves and they attack. Stand at the net, jump just after their hitter and right click. A stuff block scores most, a touch scores well and a block put up at the net scores a little.' },
  set: { stat: 'skl', name: 'Setting', role: 'S', serve: 'them', ev: 'set',
    text: 'They serve and your team passes to you. Point at a hitter and press E as the ball arrives. Every set scores half marks, and a set that becomes a kill scores full marks.' },
  dive: { stat: 'spd', name: 'Diving', role: 'L', serve: 'them', ev: 'pass',
    text: 'Chase down every ball as the libero. Right click to dive: a pass after a dive scores most, a plain pass scores a little.' },
};
const repScore = q => (q == null ? 0.2 : q >= 1 ? 1 : q >= 0.65 ? 0.7 : q >= 0.3 ? 0.4 : q > -0.4 ? 0.1 : 0);
const drillKey = c => `${c.season}-${roundKey(c.league)}`;
function startDrill(kind) {
  const c = careers[slot], L = c.league, D = DRILLS[kind];
  Sfx.init();
  const opp = pickOne(Object.keys(CLUBS).filter(id => id !== L.myClub)); // a sparring partner
  TUT = { mode: 6, roles: [D.role], ri: 0, saved: JSON.parse(JSON.stringify(settings)),
    steps: [{ title: D.name, text: D.text, ev: D.ev, serve: D.serve, mine: !!D.mine }], si: 0, marks: [], moved: 0, hitters: new Set(), wait: false, endAt: null,
    drill: { kind, slot, reps: [], cur: null, oppSpike: false, setBy: false, done: false, result: null } };
  Object.assign(settings, { mode: 6, diff: 'easy', target: 25, sets: 1 });
  settings.role[6] = D.role; settings.venue[6] = 'arena';
  teams = [[youEntry(c), ...clubEntries(L, L.myClub)], clubEntries(L, opp)];
  clubs = [CLUBS[L.myClub], CLUBS[opp]];
  startMatch(); renderCoach();
}
function drillEvent(ev, d) {
  const D = TUT.drill, k = D.kind; if (D.done) return;
  const best = v => { D.cur = Math.max(D.cur ?? 0, v); };
  if (k === 'serve' && ev === 'serve') best(repScore(d.q));
  else if (k === 'pass' && ev === 'pass' && d.first) best(repScore(d.q));
  else if (k === 'block') { if (ev === 'block') best(d.stuff ? 1 : 0.75); else if (ev === 'blockup' && d.net) best(0.35); }
  else if (k === 'set' && ev === 'set') { D.setBy = true; best(0.5); }
  else if (k === 'dive') { if (ev === 'pass') best(d.dove ? Math.max(0.5, repScore(d.q)) : repScore(d.q) * 0.4); else if (ev === 'dive') best(0.15); }
}
function drillRally(w, key) {
  const D = TUT.drill; if (D.done) return;
  let count = true;
  if (D.kind === 'serve') {
    if (key === 'aces' && w === 0) D.cur = 1;
    else if (w === 1 && G.lastAttack && G.lastAttack.type === 'serve') D.cur = 0; // a fault: they won it without attacking
  } else if (D.kind === 'block') count = D.oppSpike;     // only rallies where they attacked
  else if (D.kind === 'set') { count = D.setBy; if (D.setBy && w === 0 && key === 'kills' && G.lastAttack && G.lastAttack.setter && G.lastAttack.setter.human) D.cur = 1; }
  else if (D.kind === 'dive' || D.kind === 'pass') count = D.cur != null || D.kind === 'pass'; // passing: a serve you miss counts as 0
  if (count) D.reps.push(D.cur ?? 0);
  D.cur = null; D.oppSpike = false; D.setBy = false;
  if (D.reps.length >= DRILL_REPS) drillFinish(); else renderCoach();
}
function drillFinish() {
  const D = TUT.drill, c = careers[D.slot], st = DRILLS[D.kind].stat;
  const score = Math.round(D.reps.reduce((a, b) => a + b, 0) / D.reps.length * 100);
  const want = score >= 70 ? 2 : score >= 35 ? 1 : 0, room = c.cap[st] - c.r[st], gain = Math.min(want, room);
  const xp = (want - gain) * 8 + (want ? 0 : 5); // at the cap, the points come as XP instead; a poor drill still gives 5
  c.r[st] += gain; c.xp += xp; c.xpEarned += xp;
  const tr = drillTrust(score); c.trust = clamp(trustOf(c) + tr, 0, 100);
  c.drill = { key: drillKey(c), kind: D.kind, score, gain, xp, trust: tr };
  promote(c); saveCareers();
  D.done = true; D.result = c.drill;
  TUT.wait = true; G.paused = true;
  Sfx.point(gain > 0);
  renderCoach();
  const b = $('#coach .cta'); if (b) b.focus({ preventScroll: true });
}
function drillQuit() { // back to the hub; an unfinished drill gives nothing and can be tried again
  const keep = { camMode: settings.camMode, zoom: settings.zoom, serve: settings.serve };
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, TUT.saved, keep);
  TUT = null; G = null;
  $('#coach').hidden = true;
  saveSettings(); renderHub(); show('scr-rtg-hub');
}
const drillResultText = r => `${DRILLS[r.kind].name}: ${r.score}/100, ${r.gain ? `+${r.gain} ${DRILLS[r.kind].stat.toUpperCase()}` : 'no stat gain'}${r.xp ? `, +${r.xp} XP` : ''}${r.trust ? `, +${r.trust}% team trust` : ''}`;
function renderDrillCoach(box) {
  const D = TUT.drill, info = DRILLS[D.kind];
  const reps = Array.from({ length: DRILL_REPS }, (_, i) => {
    const v = D.reps[i], now = i === D.reps.length && !D.done;
    return `<li class="${v != null ? (v >= 0.4 ? 'done' : 'low') : ''}${now ? ' now' : ''}"><i aria-hidden="true">${i + 1}</i><span>Rep ${i + 1}${v != null ? `: ${Math.round(v * 100)}` : now ? ' (now)' : ''}</span></li>`;
  }).join('');
  const body = D.done
    ? `<p class="coach-done">Drill done</p><p>${drillResultText(D.result)}.</p><div class="coach-actions"><button type="button" class="cta small" data-tut="menu">Back to career</button></div>`
    : `<p class="coach-now">${info.text}</p><div class="coach-actions"><button type="button" class="ghost small" data-tut="quit">End drill</button></div><p class="coach-kicker">Ending early gives nothing, and you can try again.</p>`;
  box.innerHTML = `<p class="coach-kicker">Training · trains ${info.stat.toUpperCase()} · rep ${Math.min(D.reps.length + 1, DRILL_REPS)} of ${DRILL_REPS}</p>
    <h2>${info.name}</h2><ol class="coach-steps">${reps}</ol>${body}`;
}
function renderTraining(c) {
  const box = $('#hub-train'), wrap = $('#hub-train-wrap'), L = c.league;
  wrap.hidden = !L || phaseOf(L) === 'done';
  if (wrap.hidden) return;
  box.innerHTML = '';
  if (c.drill && c.drill.key === drillKey(c)) {
    box.appendChild(el('p', 'rtg-goal', `<b>Done for now.</b> ${drillResultText(c.drill)}. The next drill opens after your next match.`));
    return;
  }
  for (const [kind, d] of Object.entries(DRILLS)) {
    const b = el('button', 'rtg-build rtg-drill', `<i class="drill-stat" aria-hidden="true">${d.stat.toUpperCase()}</i><b>${d.name}</b><span>${c.r[d.stat]} / ${c.cap[d.stat]}<span class="dr-role"> · as ${ROLES[d.role].name.toLowerCase()}</span></span>`);
    b.setAttribute('aria-label', `${d.name} drill: trains ${d.stat.toUpperCase()}, now ${c.r[d.stat]} of ${c.cap[d.stat]}, plays as ${ROLES[d.role].name.toLowerCase()}`);
    b.type = 'button'; b.addEventListener('click', () => startDrill(kind));
    box.appendChild(b);
  }
}

// ===================== between seasons: aging, rosters and offers =====================
// Aging: you grow through season 6 and hold in 7 and 8. From season 9 every stat drops each off-season, by 1 in
// season 9, 2 in season 10 and so on.
const AGE_FROM = 9;
const ageLabel = n => (n === 1 ? 'Rookie' : n <= 6 ? `Year ${n}` : n <= 8 ? `Year ${n}, prime` : `Year ${n}, veteran`);
function ageStats(c) {
  if (c.season < AGE_FROM) return 0;
  const drop = c.season - AGE_FROM + 1;
  for (const k of STAT_IDS) c.r[k] = Math.max(20, c.r[k] - drop);
  return drop;
}
// Each club replaces its lowest-rated player with a free Pokémon near its own average (give or take 4), so ratings
// drift from season to season.
function churnRosters(c) {
  const L = c.league, used = new Set([c.mon, ...Object.values(L.clubs).flat()]);
  for (const id of Object.keys(L.clubs)) {
    const ros = L.clubs[id], avg = clubAvg(L, id), target = avg + (Math.random() - 0.5) * 8;
    const worst = ros.reduce((a, b) => (BY_ID.get(b).ovr < BY_ID.get(a).ovr ? b : a));
    const near = DEX.filter(m => !m.leg && !used.has(m.id)).sort((a, b) => Math.abs(a.ovr - target) - Math.abs(b.ovr - target)).slice(0, 5);
    if (!near.length) continue;
    const m = pickOne(near);
    ros[ros.indexOf(worst)] = m.id; used.add(m.id); used.delete(worst);
  }
}
// Offers: once your OVR is OFFER_OVR or more, one or two other clubs (the stronger ones more often) make an offer at
// the end of the season. Each says whether you would start there.
const OFFER_OVR = 60;
function starterAt(c, id) { // the starter you would have to beat at club id
  const fit = ROLES[c.pos].fit, at = lineup(clubEntries(c.league, id), null, c.pos, 6).filter(x => x.role === c.pos);
  return at.reduce((a, b) => (fit(b.entry.r) < fit(a.entry.r) ? b : a)).entry;
}
function makeClubOffers(c) {
  const L = c.league; L.offers = [];
  if (careerOvr(c) < OFFER_OVR) return;
  const others = Object.keys(CLUBS).filter(id => id !== L.myClub), n = 1 + (Math.random() < 0.5 ? 1 : 0);
  while (L.offers.length < n && others.length) {
    const ws = others.map(id => Math.max(1, clubOvr(c, id) - 50)), sum = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum, i = 0; while ((r -= ws[i]) > 0 && i < ws.length - 1) i++;
    const id = others.splice(i, 1)[0];
    L.offers.push({ club: id, start: careerOvr(c) >= starterAt(c, id).ovr });
  }
}
function acceptOffer(c, o) {
  const L = c.league;
  L.myClub = o.club; c.starter = o.start; c.trust = Math.round(trustOf(c) * 0.3); L.offers = []; // new teammates: most of the trust is earned again
  startNextSeason(c, `You signed with the ${CLUBS[o.club].name}. ${o.start ? 'You start from day one, but your new teammates still have to learn to trust you.' : 'You start on the bench and earn your spot again.'}`);
}
function startNextSeason(c, note = '') {
  c.season++;
  churnRosters(c);
  const drop = ageStats(c);
  newSeason(c); saveCareers(); renderHub();
  const msg = [note, drop ? `Age is catching up: -${drop} to every stat this season.` : c.season === AGE_FROM - 1 ? 'Your prime: from next season your stats start to drop with age.' : ''].filter(Boolean).join(' ');
  if (msg) toast2(msg);
}

// ===================== retiring and the Hall of Fame =====================
const HOF_KEY = 'volleydex-rtg-hof';
function loadHof() { try { const a = JSON.parse(localStorage.getItem(HOF_KEY)); return Array.isArray(a) ? a.filter(h => h && BY_ID.has(h.mon)) : []; } catch (e) { return []; } }
function retire(i) {
  const c = careers[i]; if (!c) return;
  const tot = { gp: 0, kills: 0, aces: 0, blocks: 0, digs: 0, ast: 0 }, clubsPlayed = [];
  for (const l of Object.values(c.log || {})) { for (const k in tot) tot[k] += l[k] || 0; if (l.club && !clubsPlayed.includes(l.club)) clubsPlayed.push(l.club); }
  const hof = loadHof();
  hof.unshift({ name: careerName(c), mon: c.mon, pos: c.pos, build: buildName(c), seasons: c.season, peak: Math.max(c.peak || 0, careerOvr(c)),
    clubs: clubsPlayed, tot, titles: (c.trophies || []).filter(t => t.title === 'Champion').length,
    awards: (c.trophies || []).filter(t => t.title !== 'Champion').map(t => `${t.title} (season ${t.season})`), retired: Date.now() });
  try { localStorage.setItem(HOF_KEY, JSON.stringify(hof.slice(0, 50))); } catch (e) {}
  careers[i] = null; saveCareers();
}
function renderHof() {
  const hof = loadHof(), box = $('#rtg-hof'), wrap = $('#rtg-hof-wrap');
  wrap.hidden = !hof.length; box.innerHTML = '';
  for (const h of hof) {
    const li = el('li', 'panel rtg-hof-row'), mon = BY_ID.get(h.mon);
    li.appendChild(portrait(mon, 96, 56));
    li.appendChild(el('div', 'ri-text', `<b>${escHtml(h.name)}</b><span>${ROLES[h.pos].name} · ${h.build} · ${h.seasons} season${h.seasons === 1 ? '' : 's'} · peak OVR ${h.peak}</span>
      <span>${h.clubs.map(id => CLUBS[id].abbr).join(', ')} · ${h.tot.gp} matches, ${h.tot.kills} K, ${h.tot.aces} ACE, ${h.tot.blocks} BLK, ${h.tot.digs} DIG, ${h.tot.ast} AST</span>
      <span class="rtg-hof-tro">${h.titles ? `${h.titles} title${h.titles > 1 ? 's' : ''}` : 'No titles'}${h.awards.length ? ` · ${h.awards.join(', ')}` : ''}</span>`));
    box.appendChild(li);
  }
}
$('#hub-retire').addEventListener('click', () => {
  const c = careers[slot]; if (!c) return;
  $('#rtg-ret-text').textContent = `${careerName(c)} leaves the court for good after ${c.season} season${c.season === 1 ? '' : 's'}. The career goes into the Hall of Fame and slot ${slot + 1} becomes free.`;
  $('#rtg-ret-dlg').showModal();
});
$('#rtg-ret-dlg').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.close(); });
$('#rtg-ret-yes').addEventListener('click', () => { retire(slot); $('#rtg-ret-dlg').close(); renderSlots(); show('scr-rtg'); });
