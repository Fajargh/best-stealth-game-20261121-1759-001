// Small geometry helpers the guards and the player share: moving a circle
// through the tile grid without clipping walls, and testing a line of sight.
import { TILE, COLS, ROWS } from "./config.js";
import { blocksSight, tileAt } from "./levels.js";

export function tileCenterX(col) {
  return col * TILE + TILE / 2;
}

export function tileCenterY(row) {
  return row * TILE + TILE / 2;
}

export function tileOf(x, y) {
  return [Math.floor(x / TILE), Math.floor(y / TILE)];
}

export function clampAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDifference(from, to) {
  return clampAngle(to - from);
}

export function distance(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

/**
 * Move a circle (x, y, radius) by (dx, dy) through the grid, sliding along
 * solid tiles instead of stopping dead. `walkable` decides which tiles are
 * solid for this mover (players and guards disagree about hedges).
 * Returns the new [x, y].
 */
export function slideMove(level, x, y, dx, dy, radius, walkable) {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    const tx = x + dx;
    if (!circleHitsSolid(level, tx, y, radius, walkable)) nx = tx;
  }
  if (dy !== 0) {
    const ty = y + dy;
    if (!circleHitsSolid(level, nx, ty, radius, walkable)) ny = ty;
  }
  return [nx, ny];
}

function circleHitsSolid(level, x, y, radius, walkable) {
  const c0 = Math.max(0, Math.floor((x - radius) / TILE));
  const c1 = Math.min(COLS - 1, Math.floor((x + radius) / TILE));
  const r0 = Math.max(0, Math.floor((y - radius) / TILE));
  const r1 = Math.min(ROWS - 1, Math.floor((y + radius) / TILE));
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (walkable(tileAt(level, col, row))) continue;
      const nearX = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const nearY = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const ox = x - nearX;
      const oy = y - nearY;
      if (ox * ox + oy * oy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * True when nothing sight-blocking stands between the two points.
 * Samples the segment finely enough that a crate edge cannot be skipped.
 */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const len = distance(x0, y0, x1, y1);
  const n = Math.max(1, Math.ceil(len / 6));
  for (let i = 1; i < n; i += 1) {
    const f = i / n;
    const x = x0 + (x1 - x0) * f;
    const y = y0 + (y1 - y0) * f;
    const [col, row] = tileOf(x, y);
    if (blocksSight(tileAt(level, col, row))) return false;
  }
  return true;
}

/**
 * How far a sight ray travels from (x, y) along `angle` before it hits a
 * sight-blocking tile, capped at `maxDist`. Used to draw vision cones that
 * wrap around cover instead of painting through walls.
 */
export function rayDistance(level, x, y, angle, maxDist) {
  const stride = 6;
  const dx = Math.cos(angle) * stride;
  const dy = Math.sin(angle) * stride;
  let gone = 0;
  let cx = x;
  let cy = y;
  while (gone < maxDist) {
    cx += dx;
    cy += dy;
    gone += stride;
    const [col, row] = tileOf(cx, cy);
    const outside = col < 0 || row < 0 || col >= COLS || row >= ROWS;
    if (outside) return gone;
    if (blocksSight(tileAt(level, col, row))) return gone;
  }
  return maxDist;
}
