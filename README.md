# best-stealth-game-20261121-1759-001

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Fajargh/best-stealth-game-20261121-1759-001/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Fajargh/best-stealth-game-20261121-1759-001/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Emberlight Heist** — a top-down stealth game. Pip, a firefly thief, is inside the Ember Museum after dark: slip past the night watch, pocket the ember gems, and reach the green exit door without being seen.

The guards walk patrol routes you can learn, and their vision cones bend around cover. Get spotted and the alarm meter fills — a glimpse makes them curious, a full meter sends them chasing. Hedges hide you, crates block sight, and running is fast but loud, so nearby guards hear it and come to look. Three levels, four guard states (patrol, curious, search, chase), gems, a score, a timer, and a best score.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — or serve `game/` with any static server and open `game/index.html`. The game plays offline in desktop Chrome with no network request.

**Controls:** WASD or arrows to sneak, Shift to run (loud), click to walk somewhere, Space to start, P to pause.

## Layout

- `game/` — the playable game, plain static files, no build step
  - `game/src/config.js` — tuning and the night palette
  - `game/src/levels.js` — the three levels and their patrol routes
  - `game/src/physics.js` — tile collision and line of sight
  - `game/src/guards.js` — guard states and vision
  - `game/src/world.js` — player, alarm meter, gems, scoring
  - `game/src/render.js` — all canvas drawing, HUD and screens
  - `game/src/input.js` — keyboard and mouse
  - `game/src/audio.js` — synthesized WebAudio sound, no files
  - `game/src/shots.js` — screenshot scenes played by the real rules
  - `game/src/main.js` — boot and the game loop
- `screenshots/` — 4 real renders of the game's own code in a browser
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=8cvj6bwy&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
