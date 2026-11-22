// The world: one level at a time, the player sneaking through it, the alarm
// meter that decides whether the guards are calm, curious or chasing, and
// the score. No drawing here — render.js paints what this file decides.
import {
  TILE, VIEW_W, VIEW_H, PLAYER_WALK, PLAYER_RUN, PLAYER_RADIUS,
  SPOT_RATE_NEAR, SPOT_RATE_FAR, SPOT_BUSH_FACTOR, SPOT_RUN_FACTOR,
  METER_DECAY, METER_SUSPICIOUS, NOISE_RADIUS, GEM_SCORE, LEVEL_BONUS,
  TIME_BONUS_PER_SECOND, TIME_BONUS_CAP, CHASE_GIVE_UP,
} from "./config.js";
import { LEVELS, findTiles, tileAt, walkableForPlayer } from "./levels.js";
import {
  createGuard, guardSeesPlayer, sendToChase, sendToInvestigate, updateGuard,
  STATE_CHASE, STATE_PATROL,
} from "./guards.js";
import { distance, slideMove, tileCenterX, tileCenterY, tileOf } from "./physics.js";

export const SCREEN_TITLE = "title";
export const SCREEN_PLAY = "play";
export const SCREEN_PAUSED = "paused";
export const SCREEN_LEVEL_DONE = "levelDone";
export const SCREEN_CAUGHT = "caught";
export const SCREEN_WON = "won";

/** A fresh world, sitting on the title screen of level one. */
export function createWorld(random) {
  const w = {
    random,
    levelIndex: 0,
    level: LEVELS[0],
    guards: [],
    gems: [],
    exit: { x: 0, y: 0 },
    player: {
      x: 0, y: 0, angle: 0, moving: false, running: false,
      inBush: false, path: null, pathIndex: 0,
    },
    meter: 0,
    score: 0,
    gemsGot: 0,
    time: 0,
    levelTime: 0,
    state: SCREEN_TITLE,
    events: [],
    noiseRings: [],
    noiseT: 0,
    onStep: null,
    message: "",
    messageT: 0,
  };
  loadLevel(w, 0);
  return w;
}

/** Put the player, guards, gems and exit on the given level. */
export function loadLevel(w, index) {
  w.levelIndex = index;
  w.level = LEVELS[index];
  const [sc, sr] = findTiles(w.level, "P")[0];
  w.player.x = tileCenterX(sc);
  w.player.y = tileCenterY(sr);
  w.player.angle = 0;
  w.player.path = null;
  w.player.pathIndex = 0;
  w.guards = w.level.guards.map((def) => createGuard(def, w.random));
  w.gems = findTiles(w.level, "*").map(([c, r]) => ({
    x: tileCenterX(c),
    y: tileCenterY(r),
    taken: false,
    phase: w.random() * Math.PI * 2,
  }));
  const [dc, dr] = findTiles(w.level, "E")[0];
  w.exit = { x: tileCenterX(dc), y: tileCenterY(dr) };
  w.meter = 0;
  w.levelTime = 0;
  w.noiseRings = [];
  w.message = w.level.intro;
  w.messageT = 5;
}

export function levelName(w) {
  return w.level.name;
}

/** Breadth-first path over walkable tiles, as a list of pixel waypoints. */
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  if (!walkableForPlayer(tileAt(level, toCol, toRow))) return null;
  const id = (c, r) => `${c},${r}`;
  const came = new Map();
  const frontier = [[fromCol, fromRow]];
  came.set(id(fromCol, fromRow), null);
  while (frontier.length > 0) {
    const [c, r] = frontier.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let node = [c, r];
      while (node) {
        path.unshift([tileCenterX(node[0]), tileCenterY(node[1])]);
        node = came.get(id(node[0], node[1]));
      }
      return path.slice(1);
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkableForPlayer(tileAt(level, nc, nr))) continue;
      if (came.has(id(nc, nr))) continue;
      came.set(id(nc, nr), [c, r]);
      frontier.push([nc, nr]);
    }
  }
  return null;
}

/** Point the player at a clicked spot: they walk there by the shortest route. */
export function clickToMove(w, x, y) {
  const [fc, fr] = tileOf(w.player.x, w.player.y);
  const [tc, tr] = tileOf(x, y);
  const path = findPath(w.level, fc, fr, tc, tr);
  if (path && path.length > 0) {
    w.player.path = path;
    w.player.pathIndex = 0;
  }
}

function standingInBush(w) {
  const [c, r] = tileOf(w.player.x, w.player.y);
  return tileAt(w.level, c, r) === "B";
}

/**
 * One fixed step of play. `input` is { mx, my, running, click } where mx/my
 * is the keyboard direction (-1..1 each) and click is a world point or null.
 * Events land in w.events for main.js to turn into sound and speech.
 */
export function stepWorld(w, dt, input) {
  if (w.state !== SCREEN_PLAY) return;
  w.time += dt;
  w.levelTime += dt;
  if (w.messageT > 0) w.messageT -= dt;
  const player = w.player;

  if (input.click) clickToMove(w, input.click.x, input.click.y);

  // Steering: keys drive the player directly; a click lays down a path
  // that the player follows until a key is pressed.
  let mx = input.mx;
  let my = input.my;
  if (mx === 0 && my === 0 && player.path) {
    const target = player.path[player.pathIndex];
    if (!target) {
      player.path = null;
    } else if (distance(player.x, player.y, target[0], target[1]) < 8) {
      player.pathIndex += 1;
    } else {
      const d = distance(player.x, player.y, target[0], target[1]);
      mx = (target[0] - player.x) / d;
      my = (target[1] - player.y) / d;
    }
  } else if (mx !== 0 || my !== 0) {
    player.path = null;
  }
  const len = Math.hypot(mx, my);
  player.moving = len > 0.01;
  player.running = Boolean(input.running) && player.moving;
  if (player.moving) {
    const pace = player.running ? PLAYER_RUN : PLAYER_WALK;
    const vx = (mx / (len || 1)) * pace * dt;
    const vy = (my / (len || 1)) * pace * dt;
    const [px, py] = slideMove(w.level, player.x, player.y, vx, vy, PLAYER_RADIUS, walkableForPlayer);
    if (px !== player.x || py !== player.y) {
      player.angle = Math.atan2(py - player.y, px - player.x);
    }
    player.x = px;
    player.y = py;
  }
  player.inBush = standingInBush(w);

  // Running is loud: every beat it rings out and nearby guards come to look.
  if (player.running && player.moving) {
    w.noiseT -= dt;
    if (w.noiseT <= 0) {
      w.noiseT = 0.42;
      w.noiseRings.push({ x: player.x, y: player.y, t: 0 });
      w.events.push({ type: "noise" });
      for (const guard of w.guards) {
        if (distance(guard.x, guard.y, player.x, player.y) < NOISE_RADIUS) {
          sendToInvestigate(guard, player.x, player.y);
        }
      }
    }
  }
  for (const ring of w.noiseRings) ring.t += dt;
  w.noiseRings = w.noiseRings.filter((ring) => ring.t < 0.9);

  // Spotting: each guard that can see the player fills the meter; unseen,
  // it drains, and a low meter means the guards calm back down.
  let eyes = 0;
  let best = 0;
  const seers = [];
  for (const guard of w.guards) {
    const see = guardSeesPlayer(guard, w.level, player.x, player.y, player.inBush);
    if (see > 0) {
      eyes += 1;
      best = Math.max(best, see);
      seers.push(guard);
      if (guard.state === STATE_CHASE) {
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.chaseLeft = CHASE_GIVE_UP;
      }
    }
  }
  if (eyes > 0) {
    const fill = (SPOT_RATE_FAR + (SPOT_RATE_NEAR - SPOT_RATE_FAR) * best)
      * (player.running ? SPOT_RUN_FACTOR : 1)
      * (player.inBush ? SPOT_BUSH_FACTOR : 1);
    const was = w.meter;
    w.meter = Math.min(100, w.meter + fill * dt);
    if (was < METER_SUSPICIOUS && w.meter >= METER_SUSPICIOUS) {
      w.events.push({ type: "spotted" });
      for (const guard of seers) {
        if (guard.state === STATE_PATROL) sendToInvestigate(guard, player.x, player.y);
      }
    }
    if (w.meter >= 100) {
      for (const guard of w.guards) {
        if (guardSeesPlayer(guard, w.level, player.x, player.y, player.inBush) > 0) {
          if (guard.state !== STATE_CHASE) w.events.push({ type: "alarm" });
          sendToChase(guard, player.x, player.y);
        }
      }
    }
  } else {
    w.meter = Math.max(0, w.meter - METER_DECAY * dt);
  }

  // Guards move; a chasing guard that reaches the player ends the level.
  for (const guard of w.guards) {
    if (updateGuard(guard, dt, w) === "caught") {
      w.state = SCREEN_CAUGHT;
      w.events.push({ type: "caught" });
      return;
    }
  }

  // Embers: walk over one to pocket it.
  for (const gem of w.gems) {
    if (!gem.taken && distance(player.x, player.y, gem.x, gem.y) < 24) {
      gem.taken = true;
      w.gemsGot += 1;
      w.score += GEM_SCORE;
      w.events.push({ type: "gem" });
    }
  }

  // The exit: reach the green door unseen — or at least reach it.
  if (distance(player.x, player.y, w.exit.x, w.exit.y) < 26) {
    const bonus = Math.min(
      TIME_BONUS_CAP,
      Math.max(0, Math.round((w.level.parSeconds - w.levelTime) * TIME_BONUS_PER_SECOND)),
    );
    w.score += LEVEL_BONUS + bonus;
    if (w.levelIndex + 1 >= LEVELS.length) {
      w.state = SCREEN_WON;
      w.events.push({ type: "won" });
    } else {
      w.state = SCREEN_LEVEL_DONE;
      w.events.push({ type: "levelDone", timeBonus: bonus });
    }
  }
}

/** Start (or restart) the current level from its title state. */
export function startLevel(w) {
  loadLevel(w, w.levelIndex);
  w.state = SCREEN_PLAY;
  w.events.push({ type: "start" });
}

/** Move on after a finished level, or replay it after being caught. */
export function advanceWorld(w) {
  if (w.state === SCREEN_LEVEL_DONE) {
    loadLevel(w, w.levelIndex + 1);
    w.state = SCREEN_PLAY;
    w.events.push({ type: "start" });
  } else if (w.state === SCREEN_CAUGHT) {
    loadLevel(w, w.levelIndex);
    w.state = SCREEN_PLAY;
    w.events.push({ type: "start" });
  }
}

export { VIEW_W, VIEW_H };
