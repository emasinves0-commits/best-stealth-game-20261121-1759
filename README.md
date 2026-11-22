# The Last Light — best-stealth-game-20261121-1759

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/emasinves0-commits/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/emasinves0-commits/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/reward)

## The Last Light

You are the last light-keeper of a dead lighthouse. Night is falling, the storm is not
going anywhere, and the beacon is the only thing between you and the guards' red vision.

Stay in shadow. Read the rotating yellow beam. Walk between its sweeps. When the red cone
of a guard opens on you, your suspicion meter ticks up — and as soon as you vanish into
darkness again, it falls back to zero.

### Three levels, one rule

1. **Dermaga** — the dock. The beacon sweeps the coast; the guard patrols the jetty.
   Yellow beam = danger. Red cone = sight. Dark pockets = safe.
2. **Ruang Penjaga** — the guard room. A camera watches from the west wall and a safe
   hides a three-digit code. Read the code, type it into the keypad, and open the hatch.
3. **Ruang Lampu** — the light room. The beacon sits here and sweeps fast. Three guards
   patrol the spiral stairs; the hatch at the top is the only way out.

### The rule of the light

The lighthouse beam is the level jam: a warm yellow wedge that sweeps 360 degrees and
lit-tests the whole scene. Guards never see the player through walls — only where the beam
hits, in line of sight. The beam is bright yellow, the guards are sharp red, so the two
light sources are never mixed up.

A guard's suspicion bar rises when you are lit and inside its red cone, and falls as soon as
you drop back into darkness. The alarm is a warning, never an instant death: it fills while
you are seen, decays when you hide, and the exit locks for a moment after the wail so you
can finally stand in the dark.

### Controls

| Key / action      | Purpose                         |
| ----------------- | ------------------------------- |
| `WASD` / arrows   | walk                            |
| mouse (drag)      | step the shooter to a spot      |
| `Enter` / click   | confirm (interact with keypad)  |
| `P`               | pause / resume                  |

Screenplay style, pure canvas + WebAudio, no library, no network.

### Build

The game is a static folder (`game/`) served by `serve.ts`; this entry's Node program
copies it to the output directory and writes `dossier.json`.

```sh
node serve.ts          # open http://localhost:8080
node main.ts           # copies game/ + screenshots/ and writes /output/dossier.json
```

Screenshots live in `screenshots/` — first by name is the cover. The first build run is
deterministic: two runs of `main.ts` write byte-identical `dossier.json`.
