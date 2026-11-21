// Guards: patrol routes you can learn, a vision cone that reacts to cover,
// and four states — patrol, curious, searching, chasing — so getting spotted
// is a scare with a way back, not an instant fail.
import {
  TILE, GUARD_PATROL, GUARD_CURIOUS, GUARD_CHASE, GUARD_RANGE, GUARD_FOV,
  GUARD_RADIUS, SPOT_CLOSE_REVEAL, SEARCH_LOOK_TIME, CHASE_GIVE_UP,
} from './config.js';
import { walkableForGuard } from './levels.js';
import {
  angleDifference, clampAngle, distance, hasLineOfSight, slideMove,
  tileCenterX, tileCenterY,
} from './physics.js';

export const STATE_PATROL = 'patrol';
export const STATE_CURIOUS = 'curious';
export const STATE_SEARCH = 'search';
export const STATE_CHASE = 'chase';

/** A guard standing at its first waypoint, facing along its patrol. */
export function createGuard(def, random) {
  const [col, row] = def.waypoints[0];
  const next = def.waypoints[1] ?? def.waypoints[0];
  return {
    def,
    x: tileCenterX(col),
    y: tileCenterY(row),
    angle: Math.atan2(tileCenterY(next[1]) - tileCenterY(row), tileCenterX(next[0]) - tileCenterX(col)),
    state: STATE_PATROL,
    waypointIndex: 1,
    pause: def.pause,
    pauseLeft: 0,
    searchLeft: 0,
    chaseLeft: 0,
    loseSight: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    investigateX: 0,
    investigateY: 0,
    stepT: random() * 0.4,
    scanDir: 1,
    wobble: random() * Math.PI * 2,
  };
}

/**
 * How clearly this guard sees the player right now, 0 (not at all) to 1
 * (right in front of it). Bushes hide the player unless the guard is close
 * enough to part the leaves.
 */
export function guardSeesPlayer(guard, level, playerX, playerY, playerInBush) {
  const dist = distance(guard.x, guard.y, playerX, playerY);
  if (dist > GUARD_RANGE) return 0;
  if (playerInBush && dist > SPOT_CLOSE_REVEAL) return 0;
  const toPlayer = Math.atan2(playerY - guard.y, playerX - guard.x);
  if (Math.abs(angleDifference(guard.angle, toPlayer)) > GUARD_FOV / 2) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, playerX, playerY)) return 0;
  return 1 - dist / GUARD_RANGE;
}

/** Send a guard to look at a spot (a noise, or a glimpse of the player). */
export function sendToInvestigate(guard, x, y) {
  if (guard.state === STATE_CHASE) return;
  guard.state = STATE_CURIOUS;
  guard.investigateX = x;
  guard.investigateY = y;
  guard.searchLeft = 0;
}

/** Send a guard after the player in earnest. */
export function sendToChase(guard, x, y) {
  guard.state = STATE_CHASE;
  guard.lastSeenX = x;
  guard.lastSeenY = y;
  guard.chaseLeft = CHASE_GIVE_UP + 1.5;
  guard.loseSight = 0;
}

/** Drop a guard back to its patrol route, from the nearest waypoint. */
export function sendToPatrol(guard, waypoints) {
  guard.state = STATE_PATROL;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < waypoints.length; i += 1) {
    const d = distance(guard.x, guard.y, tileCenterX(waypoints[i][0]), tileCenterY(waypoints[i][1]));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  guard.waypointIndex = (best + 1) % waypoints.length;
  guard.pauseLeft = 0;
}

/**
 * Advance one guard a step. `world` carries the level, the player, the
 * shared random source and an `onStep` callback for footstep sounds.
 * Returns 'caught' when this guard reaches the player while chasing.
 */
export function updateGuard(guard, dt, world) {
  const def = guard.def;
  const level = world.level;
  let speed = 0;
  let targetX = guard.x;
  let targetY = guard.y;

  if (guard.state === STATE_PATROL) {
    const wp = def.waypoints[guard.waypointIndex];
    targetX = tileCenterX(wp[0]);
    targetY = tileCenterY(wp[1]);
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      guard.angle += guard.scanDir * dt * 0.9;
      if (guard.angle > Math.PI * 0.75 || guard.angle < -Math.PI * 0.75) guard.scanDir *= -1;
    } else if (distance(guard.x, guard.y, targetX, targetY) < 6) {
      guard.waypointIndex = (guard.waypointIndex + 1) % def.waypoints.length;
      guard.pauseLeft = guard.pause;
      guard.scanDir = world.random() > 0.5 ? 1 : -1;
    } else {
      speed = GUARD_PATROL;
    }
  } else if (guard.state === STATE_CURIOUS) {
    targetX = guard.investigateX;
    targetY = guard.investigateY;
    if (distance(guard.x, guard.y, targetX, targetY) < 10) {
      guard.state = STATE_SEARCH;
      guard.searchLeft = SEARCH_LOOK_TIME;
    } else {
      speed = GUARD_CURIOUS;
    }
  } else if (guard.state === STATE_SEARCH) {
    guard.searchLeft -= dt;
    guard.angle += dt * 1.6;
    if (guard.searchLeft <= 0) sendToPatrol(guard, def.waypoints);
  } else if (guard.state === STATE_CHASE) {
    targetX = guard.lastSeenX;
    targetY = guard.lastSeenY;
    guard.chaseLeft -= dt;
    if (guard.chaseLeft <= 0) {
      guard.state = STATE_SEARCH;
      guard.searchLeft = SEARCH_LOOK_TIME;
      guard.investigateX = guard.lastSeenX;
      guard.investigateY = guard.lastSeenY;
    } else {
      speed = GUARD_CHASE;
    }
  }

  if (speed > 0) {
    const d = distance(guard.x, guard.y, targetX, targetY);
    const step = Math.min(speed * dt, d);
    const dx = ((targetX - guard.x) / (d || 1)) * step;
    const dy = ((targetY - guard.y) / (d || 1)) * step;
    const [nx, ny] = slideMove(level, guard.x, guard.y, dx, dy, GUARD_RADIUS, walkableForGuard);
    guard.angle = clampAngle(Math.atan2(ny - guard.y, nx - guard.x) || guard.angle);
    guard.x = nx;
    guard.y = ny;
    // Footsteps: the sound that tells you where a guard is.
    guard.stepT -= dt;
    if (guard.stepT <= 0) {
      guard.stepT = 0.42;
      if (distance(guard.x, guard.y, world.player.x, world.player.y) < 340 && world.onStep) {
        world.onStep(guard);
      }
    }
  }

  if (guard.state === STATE_CHASE && distance(guard.x, guard.y, world.player.x, world.player.y) < 26) {
    return 'caught';
  }
  return null;
}

/** The tile under the guard, for the "standing in a bush" style checks. */
export function guardTile(guard) {
  return [Math.floor(guard.x / TILE), Math.floor(guard.y / TILE)];
}
