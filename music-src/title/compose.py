"""Tram to Match Point: the VolleyDex title theme.  python compose.py writes song.json beside it.

Every note is written here; musiclib.expression only adds small player-like deviations afterwards."""
import os
import sys

HERE = {os.path.normcase(os.path.realpath(d)) for d in (os.path.dirname(os.path.abspath(__file__)), os.path.dirname(os.path.realpath(__file__)))}
sys.path[:] = [p for p in sys.path if os.path.normcase(os.path.realpath(p or os.curdir)) not in HERE]
import json  # noqa: E402
from pathlib import Path  # noqa: E402

SKILL = Path.home() / '.claude/plugins/cache/music-skill/music-skill/0.10.0/skills/music-production/scripts'
sys.path.insert(0, str(SKILL))
from musiclib.builder import Song  # noqa: E402
from musiclib import expression  # noqa: E402

ROOT = Path(__file__).resolve().parent
SEED = 1771372610
song = Song('Tram to Match Point', bars=72, tempo=116.0, meter=(4, 4), tail_seconds=4.5,
            config=Path.home() / '.music-skill/local-config.json')

# ---------------------------------------------------------------- form
SECTIONS = [
    ('cot', 4, 'Waking on the cot, frowning: arpeggiated G, A, Bm, A with a sleepy two-note sigh; no drums. Plays once, before the loop.'),
    ('tram', 16, 'The tram to the arena: the six-note hook as a sentence (idea, repeat, continuation, cadence) over a clattering eighth-note bass.'),
    ('nod', 16, 'A teammate nods: the hook again with an off-beat answering line in the second pulse, and a different cadence.'),
    ('funnel', 16, 'Fans trickle in and funnel through the gates: B minor, long notes, sixteenth trickle, the bittersweet Gm; drums build from hats to a snare roll.'),
    ('birthday', 16, "The captain's birthday: the hook with the second pulse in thirds beside it, full drums and crashes. The high point."),
    ('winch', 4, 'The scoreboard winched to the rafters: a melody and bass that ratchet up a step a bar to the dominant, back into the tram.'),
]
for ident, bars, intent in SECTIONS:
    song.section(ident, bars, intent=intent)
START = {}
b = 1
for ident, bars, _ in SECTIONS:
    START[ident] = b
    b += bars

PROG = {
    'cot': ['G', 'A', 'Bm', 'A'],
    'tram': ['Dmaj7', 'A', 'Bm', 'G', 'Dmaj7', 'A', 'G', 'A', 'Dmaj7', 'A', 'Bm', 'G', 'Em7', 'A7', 'D', 'D'],
    'nod': ['Dmaj7', 'A', 'Bm', 'G', 'Dmaj7', 'A', 'G', 'A', 'Dmaj7', 'A', 'Bm', 'G', 'Em7', 'A7', 'Bm', 'A'],
    'funnel': ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#', 'G', 'Gm', 'D/F#', 'Bm', 'Em', 'G', 'A', 'A'],
    'birthday': ['Dmaj7', 'A', 'Bm', 'G', 'Dmaj7', 'A', 'G', 'A', 'Dmaj7', 'A', 'Bm', 'G', 'Em7', 'A7', 'D', 'D'],
    'winch': ['G', 'A', 'Bm', 'A'],
}
for ident, chords_ in PROG.items():
    for k, sym in enumerate(chords_):
        song.harmony(START[ident] + k, 1, sym)

# chord tones as pitch classes (root first) and the bass note's pitch class
PC = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def tones(sym):
    main, _, slash = sym.partition('/')
    root = main[:2] if len(main) > 1 and main[1] in '#b' else main[:1]
    q = main[len(root):]
    r = PC[root]
    third = 3 if q.startswith('m') and not q.startswith('maj') else 4
    out = [r, (r + third) % 12, (r + 7) % 12]
    if q.endswith('maj7'):
        out.append((r + 11) % 12)
    elif q.endswith('7'):
        out.append((r + 10) % 12)
    bass = PC[slash] if slash else r
    return out, bass


def in_range(pc, lo):
    """The pitch of pitch class pc at or above lo."""
    p = lo + ((pc - lo) % 12)
    return p


# ---------------------------------------------------------------- parts
# Revision 2: the handheld-RPG sound the person asked for (the chip version was too techno and too high): brass for
# the tune, a horn answering, strings and a harp underneath, a plucked bass, a light kit and timpani; the melody an
# octave lower and the tempo slower.
from musiclib.voicing import voice_lead  # noqa: E402

lead = song.part('lead', 'melody', 'default 0:56', keys=(55, 82), mix={'level_dbfs': -17, 'reverb_db': -17, 'pan': 0})
horn = song.part('horn', 'counter', 'default 0:60', keys=(50, 74), mix={'level_dbfs': -22, 'reverb_db': -15, 'pan': -0.3})
strings = song.part('strings', 'harmony', 'default 0:49', keys=(48, 72), mix={'level_dbfs': -25, 'reverb_db': -14, 'pan': 0.25, 'width': 0.8})
harp = song.part('harp', 'rhythm', 'default 0:46', keys=(45, 84), mix={'level_dbfs': -25, 'reverb_db': -15, 'pan': 0.35})
bass = song.part('bass', 'bass', 'default 0:33', keys=(28, 55), mix={'level_dbfs': -21, 'reverb_db': None})
kit = song.part('kit', 'drums', 'default 128:0', mix={'level_dbfs': -24, 'reverb_db': -22, 'bus': 'drums'})
timp = song.part('timp', 'drums', 'default 0:47', keys=(38, 57), drums=False, mix={'level_dbfs': -26, 'reverb_db': -14, 'bus': 'drums'})

HOOK_ON = [1, 1.5, 2, 3, 3.5, 4]
HOOK_LEN = [0.5, 0.5, 1, 0.5, 0.5, 1]
DOWN = 12   # the melody an octave below the chip version


def line(part, bar, notes, vel, gate=0.9, shift=0):
    for beat, pitch, beats in notes:
        part.note(bar, beat, pitch - shift, beats, velocity=vel, gate=gate)


def hook(part, bar, pitches, vel, shift=0):
    line(part, bar, list(zip(HOOK_ON, pitches, HOOK_LEN)), vel, shift=shift)


H1 = [78, 81, 86, 85, 81, 78]
H2 = [76, 81, 85, 83, 81, 76]
H3 = [78, 83, 86, 85, 83, 78]
THEME = [
    H1, H2, H3,
    [(1, 86, 1.5), (2.5, 83, 0.5), (3, 81, 1), (4, 79, 0.5), (4.5, 81, 0.5)],
    H1, H2,
    [(1, 86, 0.5), (1.5, 83, 0.5), (2, 86, 0.5), (2.5, 83, 0.5), (3, 79, 1), (4, 83, 1)],
    [(1, 81, 2), (3, 83, 0.5), (3.5, 85, 0.5), (4, 88, 1)],
    H1, H2, H3,
    [(1, 86, 1.5), (2.5, 88, 0.5), (3, 90, 1), (4, 88, 0.5), (4.5, 86, 0.5)],
    [(1, 79, 0.5), (1.5, 83, 0.5), (2, 88, 1), (3, 86, 0.5), (3.5, 83, 0.5), (4, 79, 1)],
    [(1, 81, 0.5), (1.5, 85, 0.5), (2, 88, 1), (3, 85, 0.5), (3.5, 81, 0.5), (4, 79, 1)],
    [(1, 78, 2), (3, 74, 0.5), (3.5, 78, 0.5), (4, 81, 1)],
    [(1, 86, 3), (4.5, 81, 0.5)],
]
NOD_END = [
    [(1, 78, 1), (2, 83, 1), (3, 86, 1.5), (4.5, 85, 0.5)],
    [(1, 81, 2), (3, 76, 1), (4, 73, 0.5), (4.5, 76, 0.5)],
]


def theme(part, start, vel, end=None, shift=DOWN):
    bars = THEME[:14] + (end or THEME[14:])
    for k, m in enumerate(bars):
        v = vel + (4 if k % 4 == 0 else 0)
        if isinstance(m[0], int):
            hook(part, start + k, m, v, shift=shift)
        else:
            line(part, start + k, m, v, shift=shift)


theme(lead, START['tram'], 84)
theme(lead, START['nod'], 86, end=NOD_END)
FUNNEL = [
    [(1, 74, 2), (3, 73, 1), (4, 71, 1)], [(1, 71, 3), (4, 74, 1)], [(1, 78, 2), (3, 76, 1), (4, 74, 1)], [(1, 73, 3), (4, 69, 1)],
    [(1, 74, 2), (3, 76, 1), (4, 78, 1)], [(1, 79, 3), (4, 78, 0.5), (4.5, 76, 0.5)], [(1, 76, 2), (3, 79, 1), (4, 83, 1)], [(1, 82, 3), (4, 78, 1)],
    [(1, 79, 2), (3, 83, 1), (4, 86, 1)], [(1, 82, 3), (4, 79, 1)], [(1, 78, 2), (3, 81, 1), (4, 86, 1)], [(1, 83, 3), (4, 78, 1)],
    [(1, 79, 1), (2, 83, 1), (3, 88, 2)], [(1, 86, 2), (3, 83, 1), (4, 79, 1)], [(1, 81, 4)], [(1, 81, 0.5), (1.5, 85, 0.5), (2, 88, 2)],
]
for k, m in enumerate(FUNNEL):   # the funnel's long line on the horn first, the trumpet taking it over at bar 9
    line(horn if k < 8 else lead, START['funnel'] + k, m, 78 + (k // 4) * 4, gate=0.96, shift=DOWN)
theme(lead, START['birthday'], 96)
WINCH = [
    [(1, 74, 0.5), (1.5, 76, 0.5), (2, 78, 0.5), (2.5, 79, 0.5), (3, 83, 2)],
    [(1, 76, 0.5), (1.5, 78, 0.5), (2, 79, 0.5), (2.5, 81, 0.5), (3, 85, 2)],
    [(1, 78, 0.5), (1.5, 79, 0.5), (2, 81, 0.5), (2.5, 83, 0.5), (3, 86, 2)],
    [(1, 85, 1), (2, 81, 1), (3, 88, 1), (4, 85, 0.5), (4.5, 81, 0.5)],
]
for k, m in enumerate(WINCH):
    line(lead, START['winch'] + k, m, 84 + k * 3, shift=DOWN)


# horn: the cot's sigh, the nod's answers on beats 2 and 4, the birthday's line beside the tune
line(horn, START['cot'] + 2, [(1, 62, 2), (3, 59, 2)], 70, gate=0.97)
line(horn, START['cot'] + 3, [(1, 61, 2), (3, 57, 2)], 68, gate=0.97)
for k, sym in enumerate(PROG['nod']):
    bar = START['nod'] + k
    ts, _ = tones(sym)
    third, fifth = in_range(ts[1], 55), in_range(ts[2], 55)
    horn.note(bar, 2, third, 1, velocity=72, gate=0.85)
    horn.note(bar, 4, fifth, 1, velocity=70, gate=0.85)


def third_below(p, sym):
    ts, _ = tones(sym)
    for d in (3, 4, 5, 7):
        if (p - d) % 12 in ts[:3]:
            return p - d
    return p - 3


for n in [n for n in lead.track['notes'] if (START['birthday'] - 1) * 4 <= n['on'] < (START['winch'] - 1) * 4]:
    bar = int(n['on'] // 4) + 1
    beat = n['on'] - (bar - 1) * 4 + 1
    q = third_below(n['pitch'], PROG['birthday'][bar - START['birthday']])
    if q >= 50:
        horn.note(bar, beat, q, n['duration'], velocity=74, gate=0.9)


# strings: the harmony, voiced to move as little as possible and kept under the tune
order = [(ident, k, sym) for ident in PROG for k, sym in enumerate(PROG[ident])]
symbols = [sym for _, _, sym in order]
tune = {}
for part_ in (lead, horn):
    for n in part_.track['notes']:
        tune.setdefault(int(n['on'] // 4), []).append(n['pitch'])
against = [tune.get(START[ident] + k - 1, []) for ident, k, _ in order]
voicings = voice_lead(symbols, voices=3, low=55, high=70, against=against)
held = {}   # a tone the next chord shares is held over the change, not struck again
for (ident, k, sym), v in zip(order, voicings):
    bar = START[ident] + k
    vel = {'cot': 60, 'tram': 66, 'nod': 68, 'funnel': 60 if k < 8 else 68, 'birthday': 76, 'winch': 72}[ident]
    now = {}
    for p in v:
        if p in held and k % 4 != 0:
            held[p]['duration'] += 4
            now[p] = held[p]
        else:
            ident_ = strings.note(bar, 1, p, 4, velocity=vel, gate=0.99)
            now[p] = next(n for n in strings.track['notes'] if n['id'] == ident_)
    held = now


# harp: broken chords in eighths (sixteenths for the funnel's trickle), the bounce under the tune
for ident, chords_ in PROG.items():
    if ident == 'cot':
        continue
    for k, sym in enumerate(chords_):
        bar = START[ident] + k
        ts, _ = tones(sym)
        r = in_range(ts[0], 50)
        t, f = in_range(ts[1], r), in_range(ts[2], r)
        if ident == 'funnel':
            figure, step = [r, f, r + 12, t + 12] * 4, 0.25
            vel = 50 + (k // 4) * 5
        else:
            figure, step = [r, f, r + 12, t + 12, f + 12, t + 12, r + 12, f], 0.5
            vel = 62 if ident != 'birthday' else 68
        for j, p in enumerate(figure):
            harp.note(bar, 1 + j * step, p, step * 1.5 if j < len(figure) - 1 else step, velocity=vel - (0 if j % 2 == 0 else 6), gate=0.9)
for k, sym in enumerate(PROG['cot']):   # the cot: one slow rising arpeggio a bar
    ts, _ = tones(sym)
    r = in_range(ts[0], 50)
    for j, p in enumerate([r, in_range(ts[2], r), r + 12, in_range(ts[2], r) + 12]):
        harp.note(START['cot'] + k, 1 + j, p, 1.5 if j < 3 else 1, velocity=56, gate=0.95)


# bass: plucked, bouncing on root, fifth and octave
for ident, chords_ in PROG.items():
    for k, sym in enumerate(chords_):
        bar = START[ident] + k
        ts, bpc = tones(sym)
        r = in_range(bpc, 33)
        f = in_range(ts[2], r + 1)
        if f > 55:
            f -= 12
        o = r + 12 if r + 12 <= 50 else f   # no octave above D3, where the bass sample stretches
        if ident == 'cot' or (ident == 'funnel' and k < 8):
            v = 56 if ident == 'cot' else 72   # softer under the intro's sigh
            bass.note(bar, 1, r, 2, velocity=v, gate=0.95)
            bass.note(bar, 3, f, 2, velocity=v - 4, gate=0.95)
        elif ident == 'winch':
            walk = [[r, r + 2, r + 4, r + 5], [r, r + 2, r + 4, r + 5], [r, r + 1, r + 3, r + 5], [r, r + 2, r + 4, r + 4]][k]
            for j, p in enumerate(walk):
                bass.note(bar, 1 + j, p, 0.9, velocity=80, gate=0.9)
        else:
            for beat, p, d, v in [(1, r, 1, 84), (2.5, r, 0.5, 70), (3, f, 1, 80), (4, o, 0.5, 74), (4.5, f, 0.5, 70)]:
                bass.note(bar, beat, p, d, velocity=v, gate=0.88)


# kit (General MIDI keys) and timpani
KICK, SNARE, SIDE, HAT, OPEN, CRASH, RIDE, TAMB = 36, 38, 37, 42, 46, 49, 51, 54
TOMS = [41, 43, 45, 47, 48, 50]


def hits(bar, slots, d=0.25):
    for beat, p, v in slots:
        kit.note(bar, beat, p, d, velocity=v)


BOUNCE = [(1, KICK, 92), (1, HAT, 58), (1.5, HAT, 44), (2, SNARE, 74), (2, HAT, 54), (2.5, KICK, 64), (2.5, HAT, 44),
          (3, KICK, 86), (3, HAT, 56), (3.5, HAT, 44), (4, SNARE, 76), (4, TAMB, 50), (4.5, HAT, 46)]
for k in range(16):
    bar = START['tram'] + k
    slots = list(BOUNCE) + ([(1, CRASH, 84)] if k == 0 else [])
    if k % 4 == 3:
        slots += [(4.5, SNARE, 58), (4.75, SNARE, 66)]
    hits(bar, slots)
for k in range(16):
    bar = START['nod'] + k
    slots = [s for s in BOUNCE if s[1] != HAT] + [(b_, RIDE, 50 if b_ % 1 == 0 else 40) for b_ in (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5)]
    slots += [(1, CRASH, 84)] if k == 0 else []
    if k % 4 == 3:
        slots += [(4.5, TOMS[3], 62), (4.75, TOMS[1], 66)]
    hits(bar, slots)
for k in range(16):
    bar = START['funnel'] + k
    if k < 8:
        hits(bar, [(1, KICK, 60)] + [(1 + j * 0.5, HAT, 36 + (j % 2) * 6) for j in range(8)] + [(3, SIDE, 48)])
    elif k < 12:
        hits(bar, [(1, KICK, 78), (2, SIDE, 56), (3, KICK, 74), (4, SIDE, 58)] + [(1 + j * 0.5, HAT, 44) for j in range(8)])
    else:
        step = 0.5 if k < 14 else 0.25
        n = int(4 / step)
        hits(bar, [(1 + j * step, SNARE, 52 + int(36 * ((k - 12) * n + j) / (4 * n))) for j in range(n)])
for k in range(16):
    bar = START['birthday'] + k
    slots = list(BOUNCE) + [(3.5, KICK, 60)]
    if k % 4 == 0:
        slots += [(1, CRASH, 92)]
    if k % 4 == 3:
        slots += [(4.25, TOMS[4], 64), (4.5, TOMS[2], 70), (4.75, TOMS[0], 76)]
    hits(bar, slots)
for k in range(4):
    bar = START['winch'] + k
    if k < 3:
        hits(bar, [(1, KICK, 86), (2, SNARE, 70), (3, KICK, 80), (4, SNARE, 72), (4.5, TOMS[k + 1], 70), (4.75, TOMS[k + 2], 74)]
             + [(1 + j * 0.5, HAT, 48) for j in range(8)])
    else:   # the last bar: a snare roll that climbs into the loop
        hits(bar, [(1, KICK, 86), (3, KICK, 80)] + [(1 + j * 0.25, SNARE, 56 + j * 2) for j in range(16)])

# timpani: the funnel's last roll, the birthday's phrase downbeats, the winch's rise to A
for j in range(16):
    timp.note(START['funnel'] + 15, 1 + j * 0.25, 45, 0.25, velocity=50 + j * 3, gate=1.0)
timp.note(START['tram'], 1, 38, 2, velocity=86, gate=1.0)   # the loop starts with the timpani the winch ends on
for k in range(0, 16, 4):
    ts, _ = tones(PROG['birthday'][k])
    timp.note(START['birthday'] + k, 1, in_range(ts[0], 38), 2, velocity=96, gate=1.0)
for k, p in enumerate([43, 45, 47, 45]):
    timp.note(START['winch'] + k, 1, p, 1, velocity=72 + k * 6, gate=1.0)


# ---------------------------------------------------------------- the project's other fields
assoc = json.loads((ROOT / 'association.json').read_text(encoding='utf-8'))
song.project['style'] = 'game/overworld'
song.project['loop'] = {'start_bar': 4}
song.project['mix'].update({'mono_below_hz': 100})
song.project['version'] = '2.0'
song.project['brief'] = ('The title-screen and menu theme of VolleyDex, a Gen 1 Pokemon volleyball game: one long main theme, '
                         'looping, heard while the player browses menus. Revision 2: warm handheld-RPG sound, lower and slower (the chiptune first version was too techno and too high).')
song.project['association'] = {
    'source': assoc['source'], 'seed': assoc['seed'], 'words': assoc['words'],
    'whole': ("Match day. A rookie wakes on a cot with a frown of nerves and rides the tram to the arena, a sandwich and a "
              "pomegranate in the kit bag. Fans trickle in and funnel through the gates. A teammate gives a nod and a hand "
              "on the shoulder; it is the captain's birthday, and the hexagon scoreboard is winched up to the rafters."),
    'gives': [
        {'level': 'form', 'what': 'cot (intro, once), tram, nod, funnel, birthday, winch: the morning to the first serve, then the loop', 'where': 'all sections'},
        {'level': 'melody', 'what': 'the hexagon: a six-note hook; shoulder to shoulder: the second pulse in thirds beside it at the birthday', 'where': 'tram, nod, birthday'},
        {'level': 'harmony', 'what': 'the pomegranate: a bittersweet borrowed G minor in the funnel; the frown: the cot sits on Bm and A before D arrives', 'where': 'cot, funnel bar 10'},
        {'level': 'rhythm', 'what': "the tram's clatter in the bass's eighths; the nod on the off-beats; the trickle in sixteenths; the winch as a ratchet", 'where': 'tram, nod, funnel, winch'},
        {'level': 'sounds', 'what': 'the sandwich: the trumpet between the harp and strings above and the plucked bass below; the shoulder: the horn beside it', 'where': 'all sections'},
    ],
}
song.project['plan'] = {
    'identity': 'A six-note D-major hook on trumpet stated as a sentence over a bouncing bass and harp, answered by a horn, then sung in thirds at the high point.',
    'high_point': {'section': 'birthday', 'means': 'the hook with the horn in thirds, timpani on the phrase downbeats, the fullest kit, the loudest trumpet'},
    'sections': [
        {'section': 'cot', 'sounds': ['horn', 'strings', 'harp', 'bass'], 'leads': 'horn', 'dynamics': 'softer', 'differs': 'no drums and no trumpet: a slow harp, held strings and a sigh on the horn'},
        {'section': 'tram', 'sounds': ['lead', 'strings', 'harp', 'bass', 'kit', 'timp'], 'leads': 'lead', 'dynamics': 'louder', 'differs': 'the hook and the groove arrive'},
        {'section': 'nod', 'sounds': ['lead', 'horn', 'strings', 'harp', 'bass', 'kit'], 'leads': 'lead', 'harmony': 'faster', 'differs': 'the horn answers on beats 2 and 4, the ride takes over from the hats; a deceptive turn and a half cadence end it'},
        {'section': 'funnel', 'sounds': ['lead', 'horn', 'strings', 'harp', 'bass', 'kit', 'timp'], 'leads': 'horn', 'dynamics': 'softer', 'differs': 'B minor, the long line on the horn then the trumpet, a sixteenth harp trickle and drums that build to a snare and timpani roll'},
        {'section': 'birthday', 'sounds': ['lead', 'horn', 'strings', 'harp', 'bass', 'kit', 'timp'], 'leads': 'lead', 'dynamics': 'louder', 'differs': 'the hook in thirds with the horn, timpani and the fullest kit: the high point'},
        {'section': 'winch', 'sounds': ['lead', 'strings', 'harp', 'bass', 'kit', 'timp'], 'leads': 'lead', 'differs': 'a rising sequence and walking bass to the dominant, back into the tram'},
    ],
}
song.project['decisions'] = [
    'revision 2: the person found the chiptune version too techno and too high, and chose a warm handheld-RPG sound: brass, horn, strings, harp, plucked bass, a light kit, the tune an octave lower, 116 BPM.',
    'tempo: 116 BPM; 72 bars, the loop from bar 5 (68 bars, about 140.7 s).',
    'vertical: bars 69 and 71, the trumpet climbs the scale in eighths through the harp chord tones (F#-G over G, G over F# in Bm): passing tones, meant.',
    'clash:horn.horn_b037_t096_p61+strings.strings_b037_t000_p62: the horn C#4 under the strings D4 is the passing tone of its stepwise D, C#, B line into the funnel, one beat long.',
    'parallels: the horn shadows the trumpet in thirds at the birthday; the single octave with the bass at bar 59 beat 4 is one passing eighth of that shadow.',
]

expression.apply(song.project, overrides={
    'bass': {'vel_pct': 2.0},
}, seed=SEED, drift='time')

print(song.save(ROOT / 'song.json'))
