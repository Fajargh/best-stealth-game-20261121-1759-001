// Guards: patrol routes you can learn, a vision cone that reacts to cover,
// and four states — patrol, curious, searching, chasing — so getting spotted
// is a scare with a way back, not an instant fail.
import {
  TILE, GUARD_PATROL, GUARD_CURIOUS, GUARD_CHASE, GUARD_RANGE, GUARD_FOV,
  GUARD_RADIUS, SPOT_CLOSE_REVEAL, SEARCH_LOOK_TIME, CHASE_GIVE_UP,
} from "./config.js";
import { walkableForGuard } from "./levels.js";
import {
  angleDifference, clampAngle, distance, hasLineOfSight, slideMove,
  tileCenterX, tileCenterY,
} from "./physics.js";

export const STATE_PATROL = "patrol";
export const STATE_CURIOUS = "curious";
export const STATE_SEARCH = "search";
export const STATE_CHASE = "chase";

/** A guard standing at its first waypoint, facing along its patrol. */
export function createGuard(route, random) {
  const [c, r] = route.waypoints[0];
  const after = route.waypoints[1] ?? route.waypoints[0];
  const facing = Math.atan2(
    tileCenterY(after[1]) - tileCenterY(r),
    tileCenterX(after[0]) - tileCenterX(c),
  );
  return {
    def: route,
    x: tileCenterX(c),
    y: tileCenterY(r),
    angle: facing,
    state: STATE_PATROL,
    waypointIndex: 1,
    pause: route.pause,
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
  const gap = distance(guard.x, guard.y, playerX, playerY);
  if (gap > GUARD_RANGE) return 0;
  if (playerInBush && gap > SPOT_CLOSE_REVEAL) return 0;
  const toPlayer = Math.atan2(playerY - guard.y, playerX - guard.x);
  if (Math.abs(angleDifference(guard.angle, toPlayer)) > GUARD_FOV / 2) return 0;
  if (!hasLineOfSight(level, guard.x, guard.y, playerX, playerY)) return 0;
  return 1 - gap / GUARD_RANGE;
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
  let near = 0;
  let nearDist = Infinity;
  for (let i = 0; i < waypoints.length; i += 1) {
    const gap = distance(
      guard.x, guard.y,
      tileCenterX(waypoints[i][0]), tileCenterY(waypoints[i][1]),
    );
    if (gap < nearDist) {
      nearDist = gap;
      near = i;
    }
  }
  guard.waypointIndex = (near + 1) % waypoints.length;
  guard.pauseLeft = 0;
}

/**
 * Advance one guard a step. `world` carries the level, the player, the
 * shared random source and an `onStep` callback for footstep sounds.
 * Returns "caught" when this guard reaches the player while chasing.
 */
export function updateGuard(guard, dt, world) {
  const route = guard.def;
  const level = world.level;
  let pace = 0;
  let destX = guard.x;
  let destY = guard.y;

  if (guard.state === STATE_PATROL) {
    const mark = route.waypoints[guard.waypointIndex];
    destX = tileCenterX(mark[0]);
    destY = tileCenterY(mark[1]);
    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      guard.angle += guard.scanDir * dt * 0.9;
      const tooFar = guard.angle > Math.PI * 0.75 || guard.angle < -Math.PI * 0.75;
      if (tooFar) guard.scanDir *= -1;
    } else if (distance(guard.x, guard.y, destX, destY) < 6) {
      guard.waypointIndex = (guard.waypointIndex + 1) % route.waypoints.length;
      guard.pauseLeft = guard.pause;
      guard.scanDir = world.random() > 0.5 ? 1 : -1;
    } else {
      pace = GUARD_PATROL;
    }
  } else if (guard.state === STATE_CURIOUS) {
    destX = guard.investigateX;
    destY = guard.investigateY;
    if (distance(guard.x, guard.y, destX, destY) < 10) {
      guard.state = STATE_SEARCH;
      guard.searchLeft = SEARCH_LOOK_TIME;
    } else {
      pace = GUARD_CURIOUS;
    }
  } else if (guard.state === STATE_SEARCH) {
    guard.searchLeft -= dt;
    guard.angle += dt * 1.6;
    if (guard.searchLeft <= 0) sendToPatrol(guard, route.waypoints);
  } else if (guard.state === STATE_CHASE) {
    destX = guard.lastSeenX;
    destY = guard.lastSeenY;
    guard.chaseLeft -= dt;
    if (guard.chaseLeft <= 0) {
      guard.state = STATE_SEARCH;
      guard.searchLeft = SEARCH_LOOK_TIME;
      guard.investigateX = guard.lastSeenX;
      guard.investigateY = guard.lastSeenY;
    } else {
      pace = GUARD_CHASE;
    }
  }

  if (pace > 0) {
    const gap = distance(guard.x, guard.y, destX, destY);
    const stride = Math.min(pace * dt, gap);
    const mx = ((destX - guard.x) / (gap || 1)) * stride;
    const my = ((destY - guard.y) / (gap || 1)) * stride;
    const [px, py] = slideMove(level, guard.x, guard.y, mx, my, GUARD_RADIUS, walkableForGuard);
    const moved = Math.atan2(py - guard.y, px - guard.x) || guard.angle;
    guard.angle = clampAngle(moved);
    guard.x = px;
    guard.y = py;
    // Footsteps: the sound that tells you where a guard is.
    guard.stepT -= dt;
    if (guard.stepT <= 0) {
      guard.stepT = 0.42;
      const close = distance(guard.x, guard.y, world.player.x, world.player.y) < 340;
      if (close && world.onStep) world.onStep(guard);
    }
  }

  const caught = guard.state === STATE_CHASE
    && distance(guard.x, guard.y, world.player.x, world.player.y) < 26;
  if (caught) return "caught";
  return null;
}

/** The tile under the guard, for the "standing in a bush" style checks. */
export function guardTile(guard) {
  return [Math.floor(guard.x / TILE), Math.floor(guard.y / TILE)];
}
