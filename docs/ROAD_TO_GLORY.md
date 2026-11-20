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
- **Coach goals.** Before each match the coach sets one goal, such as 3 aces or 10 digs. Meeting it gives bonus XP.
- **Training.** One drill between matches. Pick from serve targets, passing, block timing or spike accuracy. Your drill score sets how much XP you get **(proposal: the XP goes into the stat the drill trains)**.
- **Spending.** You spend XP on the stat of your choice. A point costs 5 XP while the stat is in the 30s, plus 2 more for each band of ten above that (7 in the 40s, 9 in the 50s, up to 17 in the 90s). No stat can pass its cap.
- **Aging.** You grow through about season 6 and hold steady in seasons 7 and 8. From season 9, every stat drops a little each off-season, and the drop gets larger each year.

## The league

- **Clubs.** The 10 existing clubs named after the Gen 1 towns. Each has a team rating, and they improve or decline from season to season.
- **Divisions.** Two divisions of 5 clubs: the West (Pallet, Viridian, Pewter, Cinnabar, Fuchsia) and the East (Cerulean, Vermilion, Lavender, Celadon, Saffron).
- **Rosters.** Each club has 7 Pokémon, no Pokémon is on two clubs, and none share your species. Club ratings are spread from about 56 to 76.
- **Season.** 13 regular-season matches: the 4 other clubs in your division home and away (8), and the 5 clubs in the other division once (5).
- **Playoffs.** The top 2 in each division go through **(proposal)**. The semi-finals are each division winner against the other division's runner-up, then the final.
- **Match length.** Regular season: best of 3 sets to 15. Playoffs: best of 3 sets to 25.
- **Other results.** Matches between other clubs are simulated rally by rally from the two team ratings, so the standings table is real.
- **Venues.** Regular season in the Classic arena, semi-finals in the Mega bowl, the final at Championship night.
- **Venue.** The final is played in the championship arena.

## Draft

The draft is a short show before season 1. Clubs pick in reverse order of last season's standings. Your draft position depends on your build and stats, so a rookie usually goes to a weak club.

## Transfers

Once your rating is high enough, other clubs make offers between seasons. You can accept or turn them down. Your club never trades you without asking.

## Playing time

- **Starting out.** You start on the bench, including in season 1. With good play you can win a starting spot within a few matches.
- **Coming in.** The coach puts you in during a match, for example when a starter has a bad set or the team is behind.
- **Bench matches.** By default you watch the match until you are put in, then you play. A "Sim to when I play" button runs the match at high speed until you come in.

## Rewards and records

- **Season awards:** MVP, Rookie of the Year, top server, top blocker, top digger and others. They go in the trophy case.
- **Career stats page:** totals and season-by-season lines for kills, aces, blocks, digs and assists.
- **Retire.** You can retire at any time. Retiring ends the career and adds it to a Hall of Fame list of past careers.

## Saves

Three save slots in localStorage. Each slot holds one career.
