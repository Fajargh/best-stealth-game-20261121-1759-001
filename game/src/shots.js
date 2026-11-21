// Screenshot scenes: each one plays the real rules forward from a fresh
// level with a simple autopilot, so every frame is what a short game really
// looks like — and the same seed always gives the same frame.
import { STEP, TILE } from './config.js';
import { findTiles, tileAt } from './levels.js';
import { distance, tileCenterX, tileCenterY, tileOf } from './physics.js';
import { STATE_CHASE } from './guards.js';
import {
  SCREEN_PLAY, SCREEN_LEVEL_DONE, SCREEN_CAUGHT, SCREEN_WON,
  findPath, loadLevel, stepWorld,
} from './world.js';

const SAMPLE = STEP;

/** The nearest bush tile to the player, within `maxDist` pixels, or null. */
function nearestBush(world, maxDist) {
  const bushes = findTiles(world.level, 'B');
  let best = null;
  let bestDist = maxDist;
  for (const [c, r] of bushes) {
    const d = distance(world.player.x, world.player.y, tileCenterX(c), tileCenterY(r));
    if (d < bestDist) {
      bestDist = d;
      best = [c, r];
    }
  }
  return best;
}

/** Steer the autopilot for one step. Returns the input for stepWorld. */
function autopilotInput(world, mode, hiding) {
  const player = world.player;
  const chaserNear = world.guards.some(
    (g) => g.state === STATE_CHASE && distance(g.x, g.y, player.x, player.y) < 180,
  );
  if (mode === 'reckless') {
    return { mx: 0, my: 0, running: true, click: null, retarget: 'exit' };
  }
  if (world.meter > 45 && !hiding.value) {
    const bush = nearestBush(world, 280);
    if (bush) {
      hiding.value = true;
      return { mx: 0, my: 0, running: false, click: { x: tileCenterX(bush[0]), y: tileCenterY(bush[1]) }, retarget: null };
    }
  }
  if (hiding.value) {
    if (world.meter < 12) hiding.value = false;
    return { mx: 0, my: 0, running: false, click: null, retarget: null };
  }
  return { mx: 0, my: 0, running: chaserNear, click: null, retarget: 'next' };
}

function retarget(world, what) {
  const player = world.player;
  const [pc, pr] = tileOf(player.x, player.y);
  if (what === 'exit') {
    const [ec, er] = findTiles(world.level, 'E')[0];
    const path = findPath(world.level, pc, pr, ec, er);
    if (path && path.length > 0) {
      player.path = path;
      player.pathIndex = 0;
    }
    return;
  }
  // Next objective: the nearest ember still on the floor, else the exit.
  let target = null;
  let bestDist = Infinity;
  for (const gem of world.gems) {
    if (gem.taken) continue;
    const d = distance(player.x, player.y, gem.x, gem.y);
    if (d < bestDist) {
      bestDist = d;
      target = gem;
    }
  }
  const dest = target ?? world.exit;
  const [tc, tr] = tileOf(dest.x, dest.y);
  const path = findPath(world.level, pc, pr, tc, tr);
  if (path && path.length > 0) {
    player.path = path;
    player.pathIndex = 0;
  }
}

/** Play forward for up to `seconds`, stopping early when `stopWhen` says so. */
function drive(world, seconds, mode, stopWhen) {
  const hiding = { value: false };
  const limit = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < limit; i += 1) {
    if (world.state !== SCREEN_PLAY) break;
    if (stopWhen && stopWhen(world)) break;
    const input = autopilotInput(world, mode, hiding);
    // Only pick a new destination when the last one is finished: re-planning
    // every step would restart the path and the player would never arrive.
    if (!world.player.path && !hiding.value) {
      if (input.retarget) retarget(world, input.retarget);
      else if (mode === 'smart') retarget(world, 'next');
    }
    stepWorld(world, SAMPLE, { mx: input.mx, my: input.my, running: input.running, click: input.click });
  }
}

/**
 * Stage the named scene on a fresh level one and return the screen to draw.
 * cover: a mid-game sneak with cones, cover and the exit in view.
 * patrol: early play, guards on their rounds, alarm still at zero.
 * alert: a reckless dash that trips the alarm — guards in chase.
 * win: a careful full clear of level one, shown on the level-clear screen.
 */
export function stageShot(name, world) {
  loadLevel(world, 0);
  world.state = SCREEN_PLAY;
  world.events.length = 0;
  if (name === 'patrol') {
    drive(world, 6, 'smart');
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    // A reckless dash straight at the nearest guard's cone: walk into its
    // line of sight and stay there until the alarm trips, then run.
    loadLevel(world, 0);
    world.state = SCREEN_PLAY;
    world.events.length = 0;
    drive(world, 3, 'smart');
    let chased = false;
    for (let t = 0; t < 40 && world.state === SCREEN_PLAY; t += 0.25) {
      if (world.guards.some((g) => g.state === STATE_CHASE)) {
        chased = true;
        break;
      }
      let nearest = world.guards[0];
      let nearestDist = Infinity;
      for (const g of world.guards) {
        const d = distance(g.x, g.y, world.player.x, world.player.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = g;
        }
      }
      // Step into the spot 110 px in front of the guard, where its cone is.
      const tx = nearest.x + Math.cos(nearest.angle) * 110;
      const ty = nearest.y + Math.sin(nearest.angle) * 110;
      const [pc, pr] = tileOf(world.player.x, world.player.y);
      const [tc, tr] = tileOf(tx, ty);
      const path = findPath(world.level, pc, pr, tc, tr);
      if (path && path.length > 0) {
        world.player.path = path;
        world.player.pathIndex = 0;
      }
      for (let i = 0; i < Math.floor(0.25 / SAMPLE); i += 1) {
        if (world.state !== SCREEN_PLAY) break;
        stepWorld(world, SAMPLE, { mx: 0, my: 0, running: false, click: null });
      }
    }
    if (chased) drive(world, 0.9, 'reckless');
    return { screen: world.state === SCREEN_PLAY ? SCREEN_PLAY : world.state, best: 0 };
  }
  if (name === 'win') {
    drive(world, 300, 'smart', (w) => w.state === SCREEN_LEVEL_DONE || w.state === SCREEN_WON);
    if (world.state === SCREEN_LEVEL_DONE || world.state === SCREEN_WON) {
      return { screen: world.state, best: world.score };
    }
    return { screen: SCREEN_PLAY, best: world.score };
  }
  // cover
  drive(world, 16, 'smart');
  return { screen: SCREEN_PLAY, best: 0 };
}
