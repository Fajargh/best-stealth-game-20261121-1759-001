// The world: one level at a time, the player sneaking through it, the alarm
// meter that decides whether the guards are calm, curious or chasing, and
// the score. No drawing here — render.js paints what this file decides.
import {
  TILE, VIEW_W, VIEW_H, PLAYER_WALK, PLAYER_RUN, PLAYER_RADIUS,
  SPOT_RATE_NEAR, SPOT_RATE_FAR, SPOT_BUSH_FACTOR, SPOT_RUN_FACTOR,
  METER_DECAY, METER_SUSPICIOUS, NOISE_RADIUS, GEM_SCORE, LEVEL_BONUS,
  TIME_BONUS_PER_SECOND, TIME_BONUS_CAP, CHASE_GIVE_UP,
} from './config.js';
import { LEVELS, findTiles, tileAt, walkableForPlayer } from './levels.js';
import { createGuard, guardSeesPlayer, sendToChase, sendToInvestigate, updateGuard, STATE_CHASE, STATE_PATROL } from './guards.js';
import { distance, slideMove, tileCenterX, tileCenterY, tileOf } from './physics.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_DONE = 'levelDone';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WON = 'won';

/** A fresh world, sitting on the title screen of level one. */
export function createWorld(random) {
  const world = {
    random,
    levelIndex: 0,
    level: LEVELS[0],
    guards: [],
    gems: [],
    exit: { x: 0, y: 0 },
    player: { x: 0, y: 0, angle: 0, moving: false, running: false, inBush: false, path: null, pathIndex: 0 },
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
    message: '',
    messageT: 0,
  };
  loadLevel(world, 0);
  return world;
}

/** Put the player, guards, gems and exit on the given level. */
export function loadLevel(world, index) {
  world.levelIndex = index;
  world.level = LEVELS[index];
  const [pc, pr] = findTiles(world.level, 'P')[0];
  world.player.x = tileCenterX(pc);
  world.player.y = tileCenterY(pr);
  world.player.angle = 0;
  world.player.path = null;
  world.player.pathIndex = 0;
  world.guards = world.level.guards.map((def) => createGuard(def, world.random));
  world.gems = findTiles(world.level, '*').map(([c, r]) => ({
    x: tileCenterX(c),
    y: tileCenterY(r),
    taken: false,
    phase: world.random() * Math.PI * 2,
  }));
  const [ec, er] = findTiles(world.level, 'E')[0];
  world.exit = { x: tileCenterX(ec), y: tileCenterY(er) };
  world.meter = 0;
  world.levelTime = 0;
  world.noiseRings = [];
  world.message = world.level.intro;
  world.messageT = 5;
}

export function levelName(world) {
  return world.level.name;
}

/** Breadth-first path over walkable tiles, as a list of pixel waypoints. */
export function findPath(level, fromCol, fromRow, toCol, toRow) {
  if (!walkableForPlayer(tileAt(level, toCol, toRow))) return null;
  const key = (c, r) => `${c},${r}`;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = [c, r];
      while (cur) {
        path.unshift([tileCenterX(cur[0]), tileCenterY(cur[1])]);
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path.slice(1);
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (!walkableForPlayer(tileAt(level, nc, nr))) continue;
      if (prev.has(key(nc, nr))) continue;
      prev.set(key(nc, nr), [c, r]);
      queue.push([nc, nr]);
    }
  }
  return null;
}

/** Point the player at a clicked spot: they walk there by the shortest route. */
export function clickToMove(world, x, y) {
  const [pc, pr] = tileOf(world.player.x, world.player.y);
  const [tc, tr] = tileOf(x, y);
  const path = findPath(world.level, pc, pr, tc, tr);
  if (path && path.length > 0) {
    world.player.path = path;
    world.player.pathIndex = 0;
  }
}

function playerInBush(world) {
  const [c, r] = tileOf(world.player.x, world.player.y);
  return tileAt(world.level, c, r) === 'B';
}

/**
 * One fixed step of play. `input` is { mx, my, running, click } where mx/my
 * is the keyboard direction (-1..1 each) and click is a world point or null.
 * Events land in world.events for main.js to turn into sound and speech.
 */
export function stepWorld(world, dt, input) {
  if (world.state !== SCREEN_PLAY) return;
  world.time += dt;
  world.levelTime += dt;
  if (world.messageT > 0) world.messageT -= dt;
  const player = world.player;

  if (input.click) clickToMove(world, input.click.x, input.click.y);

  // Movement: keyboard steers directly; a click sets a path the player
  // follows until a key is pressed.
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
  const mag = Math.hypot(mx, my);
  player.moving = mag > 0.01;
  player.running = Boolean(input.running) && player.moving;
  if (player.moving) {
    const speed = player.running ? PLAYER_RUN : PLAYER_WALK;
    const dx = (mx / (mag || 1)) * speed * dt;
    const dy = (my / (mag || 1)) * speed * dt;
    const [nx, ny] = slideMove(world.level, player.x, player.y, dx, dy, PLAYER_RADIUS, walkableForPlayer);
    if (nx !== player.x || ny !== player.y) player.angle = Math.atan2(ny - player.y, nx - player.x);
    player.x = nx;
    player.y = ny;
  }
  player.inBush = playerInBush(world);

  // Running is loud: every beat it rings out and nearby guards come to look.
  if (player.running && player.moving) {
    world.noiseT -= dt;
    if (world.noiseT <= 0) {
      world.noiseT = 0.42;
      world.noiseRings.push({ x: player.x, y: player.y, t: 0 });
      world.events.push({ type: 'noise' });
      for (const guard of world.guards) {
        if (distance(guard.x, guard.y, player.x, player.y) < NOISE_RADIUS) {
          sendToInvestigate(guard, player.x, player.y);
        }
      }
    }
  }
  for (const ring of world.noiseRings) ring.t += dt;
  world.noiseRings = world.noiseRings.filter((ring) => ring.t < 0.9);

  // Detection: every guard that can see the player fills the meter; unseen,
  // it drains, and a low meter means the guards calm back down.
  let seenBy = 0;
  let bestSee = 0;
  const seeingGuards = [];
  for (const guard of world.guards) {
    const see = guardSeesPlayer(guard, world.level, player.x, player.y, player.inBush);
    if (see > 0) {
      seenBy += 1;
      bestSee = Math.max(bestSee, see);
      seeingGuards.push(guard);
      if (guard.state === STATE_CHASE) {
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.chaseLeft = CHASE_GIVE_UP;
      }
    }
  }
  if (seenBy > 0) {
    const rate = (SPOT_RATE_FAR + (SPOT_RATE_NEAR - SPOT_RATE_FAR) * bestSee)
      * (player.running ? SPOT_RUN_FACTOR : 1)
      * (player.inBush ? SPOT_BUSH_FACTOR : 1);
    const before = world.meter;
    world.meter = Math.min(100, world.meter + rate * dt);
    if (before < METER_SUSPICIOUS && world.meter >= METER_SUSPICIOUS) {
      world.events.push({ type: 'spotted' });
      for (const guard of seeingGuards) {
        if (guard.state === STATE_PATROL) sendToInvestigate(guard, player.x, player.y);
      }
    }
    if (world.meter >= 100) {
      for (const guard of world.guards) {
        if (guardSeesPlayer(guard, world.level, player.x, player.y, player.inBush) > 0) {
          if (guard.state !== STATE_CHASE) world.events.push({ type: 'alarm' });
          sendToChase(guard, player.x, player.y);
        }
      }
    }
  } else {
    world.meter = Math.max(0, world.meter - METER_DECAY * dt);
  }

  // Guards move; a chasing guard that reaches the player ends the level.
  for (const guard of world.guards) {
    if (updateGuard(guard, dt, world) === 'caught') {
      world.state = SCREEN_CAUGHT;
      world.events.push({ type: 'caught' });
      return;
    }
  }

  // Embers: walk over one to pocket it.
  for (const gem of world.gems) {
    if (!gem.taken && distance(player.x, player.y, gem.x, gem.y) < 24) {
      gem.taken = true;
      world.gemsGot += 1;
      world.score += GEM_SCORE;
      world.events.push({ type: 'gem' });
    }
  }

  // The exit: reach the green door unseen — or at least reach it.
  if (distance(player.x, player.y, world.exit.x, world.exit.y) < 26) {
    const timeBonus = Math.min(TIME_BONUS_CAP, Math.max(0, Math.round((world.level.parSeconds - world.levelTime) * TIME_BONUS_PER_SECOND)));
    world.score += LEVEL_BONUS + timeBonus;
    if (world.levelIndex + 1 >= LEVELS.length) {
      world.state = SCREEN_WON;
      world.events.push({ type: 'won' });
    } else {
      world.state = SCREEN_LEVEL_DONE;
      world.events.push({ type: 'levelDone', timeBonus });
    }
  }
}

/** Start (or restart) the current level from its title state. */
export function startLevel(world) {
  loadLevel(world, world.levelIndex);
  world.state = SCREEN_PLAY;
  world.events.push({ type: 'start' });
}

/** Move on after a finished level, or replay it after being caught. */
export function advanceWorld(world) {
  if (world.state === SCREEN_LEVEL_DONE) {
    loadLevel(world, world.levelIndex + 1);
    world.state = SCREEN_PLAY;
    world.events.push({ type: 'start' });
  } else if (world.state === SCREEN_CAUGHT) {
    loadLevel(world, world.levelIndex);
    world.state = SCREEN_PLAY;
    world.events.push({ type: 'start' });
  }
}

export { VIEW_W, VIEW_H };
