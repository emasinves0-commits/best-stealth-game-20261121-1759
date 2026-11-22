// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// ----------------------------------------------------------------------
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Entry: "The Last Light" — best-stealth-game-20261121-1759
// A first-person stealth game in three levels: the dock (Dermaga), the guard room, and the light
// room. The player stays in shadow, reads the rotating lighthouse beam and never runs while a red
// cone of suspicion is open. game/ holds the playable game as static files a desktop browser
// loads offline (game/index.html plus its ES modules), standard library only, no library and no
// network. This program copies game/ and the four screenshots/ beside this file into the output
// directory and writes /output/dossier.json, the summary the judge reads, built by the vendored
// make.fun library. The four screenshots are validated to be present BEFORE they are copied, so a
// half-captured set can never be scored.

// --- The four required screenshots -----------------------------------------
// Name-sort order makes the first by name the cover. This entry's screenshots:
//   01-cover.png  the title / first impression
//   02-play.png   a moment of movement
//   03-play.png   a second moment, different pose
//   04-end.png    the level-3 victory screen
// The entry refuses to hand in unless all four sit beside this file, so a
// half-captured set can never be scored.
const requiredShots = ['01-cover', '02-play', '03-play', '04-end'];
for (const shot of requiredShots) {
  const shotPath = join(here, 'screenshots', `${shot}.png`);
  if (!existsSync(shotPath)) {
    throw new Error(`entry main.ts: screenshot missing: ${shotPath}`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);


