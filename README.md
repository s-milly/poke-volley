# VolleyDex

Draft-based volleyball with Gen 1 Pokémon, played in the browser. Pick the Pokémon you control, draft teammates from random offers based on their stats, then play a 2 v 2 or 6 v 6 match. The camera sits behind your team, looking at the net.

## Play

Open `index.html` in a browser, or serve the folder (for example `python3 -m http.server`) and go to `http://localhost:8000`. There is no build step and nothing to install. It also works on GitHub Pages.

| Key | Action |
| --- | --- |
| W A S D or arrow keys | Move around your half of the court |
| Space | Jump |
| J or left click | Serve. In the air: spike. On the ground: tip the ball over |
| K or Shift | Arm your Type Spike when the meter is full |
| P or Esc | Pause |
| M | Sound on or off |

Phones get an on-screen pad.

- Touch the ball without pressing a key and you pass it to a teammate automatically. Each side gets 3 touches.
- An orange ring on the sand shows where the ball will land on your side. When a teammate sets you, a green ring shows where to jump.
- To block, stand at the net and jump just after the other team's hitter jumps. A red ring at the net shows where to stand and flashes JUMP when it is time. If you touch the spike you either stuff it back for a point or pop it up for your team to play.
- A spike goes to the most open spot on its own. Hold left or right to aim it across, forward for a short shot, or back to hit deep.
- Rally scoring to 11, 15 or 25, win by 2.
- Choose your team and the rival's (or a random rival) from 10 clubs named after the Gen 1 towns, such as the Cerulean Tides (CER) and the Vermilion Volts (VER).
- A TV-style scoreboard in the top left shows each club's code, sets won and the points in the current set, plus who is serving and how many touches have been used.
- Play one set, best of 3 (first to 2 sets) or best of 5 (first to 3 sets). If a best of 5 reaches 2-2, the fifth set is played to 15, win by 2.

## Draft

The title screen only asks for team size (2 v 2 or 6 v 6) and shows the current match settings in a short summary. Teams, venue, time of day, difficulty, points and sets are on the Match settings screen, and all of them have defaults.


1. Choose your position, then pick the Pokémon you control from three random offers suited to that position (you can ask for new offers twice). As captain it gets +14 to every rating.
2. Each round shows 3 random Pokémon from the 151. Pick one. You get 2 rerolls per draft.
3. The rival team is built to a similar rating, adjusted for the difficulty you chose.

## Positions and rotations

You pick your position before the draft, and the three Pokémon offered to you are drawn from the ones whose stats suit that position best. Your teammates fill the other roles, each given to the Pokémon whose stats suit it best.

**6 v 6** uses a 5-1 system: a Setter, two Outside hitters (OH), two Middle blockers (MB), an Opposite (OPP) and a Libero (L). You draft six teammates: five on court plus the libero.

- Each team starts in the order zone 1 Setter, zone 2 OH, zone 3 MB, zone 4 OPP, zone 5 OH, zone 6 MB. Zones 4, 3 and 2 are the front row (left to right, facing the net) and 5, 6 and 1 are the back row. That puts each player opposite their partner: the two OHs, the two MBs, and the Setter and Opposite.
- Zone 1 serves. When a team wins back the serve, it rotates one zone clockwise. The matchup screen shows the starting rotation, and during a match the bottom of the screen shows your role, zone and row.
- **Serve receive:** three passers (both OHs and the back-row MB) stand in a W. The setter hides near the net and runs to the target once the ball is served.
- **Switching:** once the ball is in play, everyone moves to their specialty spot. In the front row the OH goes left, the MB middle and the S or OPP right. In the back row the S or OPP goes right back, the OH middle back and the MB left back.
- **Offense:** the first pass goes to the setter's target, just right of center at the net. The setter picks a play: the high OUTSIDE set to the left, the fast QUICK to the middle when the pass is good, the BACK SET to the opposite on the right, or the PIPE to the back-row OH. Players near the net close in behind the hitter to cover a blocked ball.
- **Defense:** when the other team sets its hitter, the MB slides along the net to form a double block with the wing on that side. The other front-row player drops back for tips, and the back row spreads around the edge of the court, leaning toward the hitter.
- **Back-row rule:** back-row players may only spike from behind the attack line (the inner lines, a third of the way back).
- **Libero:** the libero always replaces whichever middle blocker is in the back row, so only one middle is on court for each team at any time. There is always exactly one back-row middle, so the libero stays on and the two middles take turns on the bench, swapping every third rotation. Each swap happens between rallies: the middle coming off and the one coming on walk to the substitution zone (the bench-side sideline between the attack line and the net), pause, swap, and head to the bench and the court. Both teams' benches are on that sideline, each on its own half. The libero passes, digs and serves when it reaches zone 1, but cannot block or attack a ball above the net. It has a purple ring.
- **Overlap rule:** when the ball is served, each front-row player must be nearer the net than the back-row player behind them (4 ahead of 5, 3 ahead of 6, 2 ahead of 1), and each row must keep its left-to-right order. The server is exempt. The computer always lines up legally; before each serve a green YOUR SPOT ring shows where you belong, and if you are out of order when the ball is served your team loses the point.
- If you are the setter, the arrow you hold when you set picks the play: left for the outside, up for the quick, right for the back set, down for the pipe. Hold nothing and the play is picked for you.

**2 v 2** uses beach roles. The **Blocker** takes the net on defense and blocks; the **Defender** stays back to dig. On serve receive both pass side by side, and whoever does not pass the first ball sets it.

## Venues

Pick a venue on the title screen. The stands are drawn in 3D with the court, and the crowd jumps up and raises its arms after every point.

**6 v 6 (indoor):**
- **Classic arena:** stands on three sides, LED boards around an orange court.
- **Mega bowl:** a huge two-deck arena, with a lower bowl, a concourse with an LED ribbon board, and a steep upper deck rising to the roof (almost 3,000 fans).
- **Championship night:** a dark, packed bowl, the crowd split into blue and red halves, phone lights and lasers.

**2 v 2 (beach):** pick a layout and a time of day (Day, Sunset or Night).
- **Bleachers:** wooden bleachers along the sand.
- **Pro tour stadium:** tall grandstands on both sides, sponsor boards and corner flags.
- **Boardwalk:** fans standing three deep behind a rope line, umbrellas, a lifeguard tower and string lights.

Day has drifting clouds, sailboats and gulls past an island lighthouse. Sunset has an orange sky and golden light. Night has twinkling stars, a moon over the water, a sweeping lighthouse beam, city lights on the horizon, light poles at the corners and phone lights in the crowd.

Every venue has a referee stand at the net. The arenas also have a far wall with lit suites, exit signs, banners and a video board showing the score, plus a scorer's table and team benches. The beaches have palm trees, coolers and surfboards.

## Ratings

Each rating comes from the Pokémon's base stats.

- **SPD** (Speed): how fast it runs.
- **JMP** (Speed and Attack, lower for heavy Pokémon): how high it jumps.
- **PWR** (Attack and Sp. Atk): how hard it spikes and serves.
- **DEF** (HP and Defense): how cleanly it receives hard hits.
- **SKL** (Sp. Atk and Sp. Def): how accurately it sets.

The overall rating (OVR) is a weighted average of the five. Body size comes from each Pokémon's height.

## Files

- `index.html`, `style.css`: menus, draft and result screens.
- `game.js`: ratings, draft, 3D physics, computer players and the canvas renderer.
- `sprites/`, `sprites.js`: front and back sprites and their visible areas.
- `fonts/`: the two pixel fonts and their licenses.
- `data.js`: the 151 Pokémon (stats, types, height, weight, Pokédex color), generated from the PokeAPI data files.

## Testing

`index.html?auto=1&fast=6&mode=2` lets the computer draft and play both sides at 6x speed. `mode` can be 2 or 6, `diff` can be easy, normal or hard.

## Art

The game is drawn at 960 x 540 and scaled up with hard pixel edges, with the HUD and pixel font on a 480 x 270 grid. The Pokémon are the Black/White sprites from the [PokeAPI sprites collection](https://github.com/PokeAPI/sprites): front sprites for the other team, full-body back sprites for yours (`sprites/`, with each sprite's visible area in `sprites.js`). Fonts are Press Start 2P and VT323, both under the SIL Open Font License (`fonts/`).

Fan project. Not affiliated with Nintendo, Game Freak or The Pokémon Company. Pokémon and its sprites belong to them.
