// Emberlight Heist — the hand-in program. It copies this repository's
// game/ and screenshots/ into the grader's output directory and writes
// dossier.json there using the vendored make.fun library. Node 22, standard
// library only, no network. Outside the grader, MAKEFUN_OUTPUT_DIR takes
// the place of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync(join(here, "game"), join(out, "game"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(here, "screenshots"))) {
  cpSync(join(here, "screenshots"), join(out, "screenshots"), { recursive: true });
}

// These caps are the scorer's own: no more than 4 screenshots, none over
// 256 KiB; game/ no more than 993 files and 48 MiB, every path at most
// 1000 bytes; the dossier text at most 160 KiB. An entry that breaks one
// is refused here first, exactly as the scorer would refuse it.
// The grader runs this program twice and both runs must write the same
// bytes: copying files and building the dossier from them is deterministic,
// so a second run reproduces the first byte for byte.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, "dossier.json"), dossier);
