// The three levels of Emberlight Heist. Every map is 24 x 15 tiles:
//   # wall (blocks movement and sight)
//   . floor
//   C crate (cover: blocks movement and sight)
//   B bush hedge (cover: blocks sight; the player can hide inside, guards cannot enter)
//   * ember gem (optional pickup, +100)
//   E exit door (reach it to finish the level)
//   P player start
// Guards patrol between waypoint tiles; each segment is a straight, clear
// corridor, so a guard never has to pathfind around a corner.
export const LEVELS = [
  {
    name: "The Moonlit Gallery",
    intro: "Slip past the night watch. Grab embers if you dare — then reach the green door.",
    parSeconds: 75,
    lamps: [[6, 4], [17, 4], [6, 11], [17, 11]],
    guards: [
      { waypoints: [[3, 2], [20, 2]], pause: 1.2 },
      { waypoints: [[20, 5], [20, 11]], pause: 1.6 },
    ],
    map: [
      "########################",
      "#P....B......C.....*..E#",
      "#......................#",
      "#..C.....####.....B....#",
      "#......................#",
      "#....B........C....*...#",
      "#..........#####.......#",
      "#..C.................B.#",
      "#.......C.......B......#",
      "#......................#",
      "#..B.....####....C.....#",
      "#..................*...#",
      "#....C......B..........#",
      "#......................#",
      "########################",
    ],
  },
  {
    name: "The Crate Yard",
    intro: "Crates everywhere, three guards, and no patience. Bushes hide you — if you stay still.",
    parSeconds: 90,
    lamps: [[5, 3], [12, 7], [19, 3], [5, 12], [19, 12]],
    guards: [
      { waypoints: [[1, 2], [5, 2]], pause: 1.0 },
      { waypoints: [[13, 5], [18, 5]], pause: 1.4 },
      { waypoints: [[5, 9], [5, 12]], pause: 1.2 },
    ],
    map: [
      "########################",
      "#P..B...C......B...*..E#",
      "#.....####.........###.#",
      "#..C........B.....#....#",
      "#....####......C..#..B.#",
      "#..B......C........#...#",
      "#.....######...B...#.*.#",
      "#..C.......#...........#",
      "#.....B....#....C....B.#",
      "#..........#......####.#",
      "#..C....B...#....#.....#",
      "#......####....C.#..C..#",
      "#..B........B....#.....#",
      "#....C......*.....B..*.#",
      "########################",
    ],
  },
  {
    name: "The Ember Vault",
    intro: "Four guards watch the vault. The ember gem is close — the door is closer. Choose.",
    parSeconds: 105,
    lamps: [[4, 2], [12, 6], [20, 2], [4, 12], [20, 12]],
    guards: [
      { waypoints: [[2, 3], [6, 3]], pause: 0.9 },
      { waypoints: [[9, 2], [9, 5]], pause: 1.1 },
      { waypoints: [[14, 12], [18, 12]], pause: 1.3 },
      { waypoints: [[19, 13], [22, 13]], pause: 1.0 },
    ],
    map: [
      "########################",
      "#P...C....B.....C...*E.#",
      "#..#####....####...##..#",
      "#......#...#....#..#...#",
      "#..B...#...#..C.#..#.B.#",
      "#......#...#....#..#...#",
      "#..C...#.B.#....#..#...#",
      "#......#...#....#..#...#",
      "#..B...#...#..C.#..#...#",
      "#..#####...#....#..#...#",
      "#......B...#....#..#.C.#",
      "#..C....#####..###..#..#",
      "#......*....B......#.*.#",
      "#....B.....C.....B.....#",
      "########################",
    ],
  },
];

// Tile helpers shared by the world, the guards and the renderer.
export function tileAt(level, col, row) {
  if (col < 0 || row < 0 || col >= 24 || row >= 15) return "#";
  return level.map[row][col];
}

export function isWallTile(ch) {
  return ch === "#";
}

export function isCoverTile(ch) {
  return ch === "#" || ch === "C";
}

/** Blocks a guard's line of sight: walls, crates and tall hedges. */
export function blocksSight(ch) {
  return ch === "#" || ch === "C" || ch === "B";
}

/** A tile the player can walk on (bushes included — that is where you hide). */
export function walkableForPlayer(ch) {
  return ch !== "#" && ch !== "C";
}

/** A tile a guard can walk on (hedges are solid to guards). */
export function walkableForGuard(ch) {
  return ch !== "#" && ch !== "C" && ch !== "B";
}

/** Find every tile holding `ch` in the map, as [col, row] pairs. */
export function findTiles(level, ch) {
  const found = [];
  for (let row = 0; row < level.map.length; row += 1) {
    for (let col = 0; col < level.map[row].length; col += 1) {
      if (level.map[row][col] === ch) found.push([col, row]);
    }
  }
  return found;
}
