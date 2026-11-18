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
- A spike goes to the most open spot on its own. Hold left or right to aim it across, forward for a short shot, or back to hit deep.
- Rally scoring to 11, 15 or 21, win by 2.

## Draft

1. Choose one of 8 Pokémon to control: Pikachu, Bulbasaur, Charmander, Squirtle, Eevee, Machop, Jigglypuff or Psyduck. As captain it gets +14 to every rating.
2. Each round shows 3 random Pokémon from the 151. Pick one. You get 2 rerolls per draft.
3. The rival team is built to a similar rating, adjusted for the difficulty you chose.

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

The game is drawn at 480 x 270 and scaled up with hard pixel edges. The Pokémon are the Black/White sprites from the [PokeAPI sprites collection](https://github.com/PokeAPI/sprites): front sprites for the other team, full-body back sprites for yours (`sprites/`, with each sprite's visible area in `sprites.js`). Fonts are Press Start 2P and VT323, both under the SIL Open Font License (`fonts/`).

Fan project. Not affiliated with Nintendo, Game Freak or The Pokémon Company. Pokémon and its sprites belong to them.
