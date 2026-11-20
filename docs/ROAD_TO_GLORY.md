# Road to Glory: design draft

A single-player career in 6 v 6. You create one rookie Pokémon, get drafted onto a club, earn a starting spot, and play seasons until you retire. Items marked **(proposal)** are suggestions not yet agreed.

## Creating your player

1. **Pick a Pokémon.** Choose any of the 151, or press Random. Species is only the look: sprite, size and type (the type effect on perfect spikes). Stats do not come from the species in this mode.
2. **Pick a position:** OH, MB, OPP, S or L.
3. **Pick a build.** Choose one of that position's archetypes, or Custom.
4. **Pick a difficulty:** Easy, Normal or Hard. It can be changed at any time from the career menu.
5. **Name it** (optional) and choose a save slot (1 to 3).

Every rookie starts at OVR 41 to 43. Starters in the league will be in the 60s to 80s **(proposal)**. Stats use the game's existing 20 to 99 scale.

### Archetypes

Each archetype does three things:
- sets the **starting stats**,
- sets the **stat caps** (how high each stat can grow),
- gives one **perk**.

Archetypes:

| Position | Archetype | Leans toward | Lower cap on | Perk |
| --- | --- | --- | --- | --- |
| OH | Power Hitter | PWR, JMP | SKL | Heavier spikes from the left side |
| OH | All-Rounder | DEF, PWR | none, all caps moderate | Wider window for a good pass |
| MB | Wall | JMP, PWR | SPD, SKL | Wider block reach |
| MB | Quick Hitter | SPD, JMP | DEF | Quicker quick-set spikes |
| OPP | Cannon | PWR, JMP | DEF | Harder topspin serve |
| OPP | Server | PWR, SKL | JMP | More accurate float serve |
| S | Floor General | SKL, SPD | PWR | Sets land closer to the hitter's spot |
| S | Jump Setter | SKL, JMP | DEF | Faster quick sets |
| L | Digger | DEF, SPD | PWR, JMP | Wider dig reach |
| L | Speedster | SPD, DEF | PWR | Faster chase to the ball |

**Custom build:** spread 214 starting points across the five stats yourself, between 30 and 56 in each. Every cap is 88, and there is no perk.

**Archetype numbers:** every stat starts at 39. The main stat gets +14 and the second +9, and each weak stat gets -4. Caps are 99 on the main stat, 94 on the second, 72 on the weak ones and 85 on the rest. The All-Rounder instead gets +8 DEF, +6 PWR and +3 on everything else, with every cap at 90.

## Growth

- **XP from matches.** 10 XP for playing and 10 for a win, plus your box score: 2 per kill, 3 per ace, 3 per block, 1.5 per dig and 0.5 per assist. Middles get 1.4 times the box score share, setters 1.2 times and liberos 3 times, because the box score counts less of what they do. Playoff matches give 1.5 times the total. A bench player who doesn't come in earns a small amount for being there.
- **Coach goals.** Before each match the coach sets one goal for your position (OH: 5 kills or 5 digs; OPP: 5 kills or 2 aces; MB: 2 blocks or 3 kills; S: 12 assists or 1 ace; L: 4 digs). Off the bench it is half as big, and in the playoffs half as big again. Meeting it gives 15 XP (22 in the playoffs) and, while you are on the bench, 10 coach's trust. The goal is saved, so reloading does not change it.
- **Training.** One drill between matches, on the real match engine with a soft sparring partner. Five drills, one per stat, each played at the position that uses it most: Serving (PWR, as opposite), Passing (DEF, as outside hitter), Blocking (JMP, as middle), Setting (SKL, as setter) and Diving (SPD, as libero). A drill is 6 reps (rallies), each scored from your timing; an average of 70 or more raises the stat by 2, 35 or more by 1. At the cap the points come as XP (8 each), and a poor drill still gives 5 XP. Ending a drill early gives nothing and it can be tried again.
- **Spending.** You spend XP on the stat of your choice. A point costs 5 XP while the stat is in the 30s, plus 2 more for each band of ten above that (7 in the 40s, 9 in the 50s, up to 17 in the 90s). No stat can pass its cap.
- **Aging.** You grow through about season 6 and hold steady in seasons 7 and 8. From season 9, every stat drops at the start of the season: 1 in season 9, 2 in season 10, and so on.

## The league

- **Clubs.** The 10 existing clubs named after the Gen 1 towns. Between seasons each club swaps its lowest-rated player for a free Pokémon near its own average (give or take 4), so ratings drift.
- **Divisions.** Two divisions of 5 clubs: the West (Pallet, Viridian, Pewter, Cinnabar, Fuchsia) and the East (Cerulean, Vermilion, Lavender, Celadon, Saffron).
- **Rosters.** Each club has 7 Pokémon, no Pokémon is on two clubs, and none share your species. Club ratings are spread from about 56 to 76.
- **Season.** 13 regular-season matches: the 4 other clubs in your division home and away (8), and the 5 clubs in the other division once (5).
- **Playoffs.** The top 2 in each division go through **(proposal)**. The semi-finals are each division winner against the other division's runner-up, then the final.
- **Match length.** Regular season: best of 3 sets to 15. Playoffs: best of 3 sets to 25.
- **Other results.** Matches between other clubs are simulated rally by rally from the two team ratings, so the standings table is real.
- **Venues.** Regular season in the Classic arena, semi-finals in the Mega bowl, the final at Championship night.
- **Venue.** The final is played in the championship arena.

## Draft

A short draft show before season 1. Ten prospects, one pick per club: you and nine others rated 33 to 46. Clubs pick from the lowest team rating up (there are no standings yet in season 1), and each takes the best prospect left by OVR plus a little scouting noise, so where you go depends on your stats. A new rookie (41 to 43) usually goes in the first five picks, to a weaker club. The picks are revealed one at a time, or all at once with "Show every pick". The other prospects are part of the show only and do not join the rosters.
## Transfers

Once your OVR is 60 or more, one or two other clubs (stronger clubs more often) make an offer at the end of the season. Each offer says whether you would start there or come off the bench. Signing moves you before the next season starts; staying is the default.
## Playing time

- **Starting out.** You start on the bench, including in season 1, behind the weaker of your club's starters at your position.
- **Earning the spot.** You become a starter when either:
  - the coach's trust reaches 100. Each match you come on for gives 10, plus 1.5 per point of your box score share (up to 25), plus 10 for a win, plus 10 for a met coach's goal. That is about 20 to 35 a match, so three to five matches and never fewer than two;
  - or your OVR reaches the starter's. A new rookie is 11 to 18 OVR behind.
  Once you start, you keep the spot.
- **Coming in.** You wait on the sideline. At a dead ball the coach sends you on in place of that starter, with the usual walk to the sub zone, when:
  - your team lost the set before (you come in at the start of the next one),
  - your team is 5 points behind after at least 6 points,
  - or either team reaches 10 points (17 in a set to 25) in set 2 or later.
  Once you are on, you stay on.
- **Bench matches.** By default you watch the match until you come on. "Sim to when I play" runs it 12 times faster, without sound, until the coach calls you. A match where you never come on gives 5 XP.

## Rewards and records

- **Season awards** from regular-season stats, for players with at least 6 matches: Most valuable player (most per match of 3 x (kills + aces + blocks) + digs + half the assists), Top scorer, Top server, Top blocker, Top digger and Top setter. Simulated matches get stat lines too, so the whole league counts: each point is a kill (55%), an ace (7%), a block (10%) or an error by the other side, credited by role and rating.
- **Rookie of the Year** goes to you if you finish your first season as a starter (you are the league's only first-year player).
- **Trophy case:** your awards and titles.
- **Stats tab:** your numbers this season, the league's top 3 in kills, aces, blocks, digs and assists (regular season, every club; if you are outside the top 3 your own place shows), the trophy case, and a line per season (matches played, kills, aces, blocks, digs, assists, your club's record and finish) with career totals. The season lines count playoffs; the awards and leaders do not.
- **Retire.** You can retire at any time from the hub (with a confirmation). Retiring frees the slot and adds the career to the Hall of Fame on the Road to Glory screen: name, position and build, seasons, peak OVR, clubs, career totals, titles and awards (the 50 most recent).
## The career hub

The hub keeps your player card beside four tabs, under a strip with the season at a glance (week, record, division place, status, XP to spend):
- **Home:** this week's tasks. 1. Train: one optional drill before the match. 2. Play the match (or join the draft, follow the playoffs, or start the next season). The list starts again each week.
- **Upgrades:** spend XP on your stats. The tab shows your XP when you can afford a point.
- **Standings:** both division tables and your schedule.
- **Stats:** see Rewards and records. Career facts, difficulty and Retire are at the bottom.

## Saves

Three save slots in localStorage. Each slot holds one career.
