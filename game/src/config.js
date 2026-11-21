// Tuning and look for Emberlight Heist: one place for every number the other
// files share, so a balance change never means hunting through the game.
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;

// Player movement, pixels per second.
export const PLAYER_WALK = 125;
export const PLAYER_RUN = 190;
export const PLAYER_RADIUS = 13;

// Guard movement, pixels per second.
export const GUARD_PATROL = 52;
export const GUARD_CURIOUS = 88;
export const GUARD_CHASE = 138;
export const GUARD_RADIUS = 14;

// Vision: how far a guard sees, how wide its cone is (radians), and how fast
// being seen fills the alarm meter (per second, scaled by closeness).
export const GUARD_RANGE = 265;
export const GUARD_FOV = 1.25;
export const SPOT_RATE_NEAR = 78;
export const SPOT_RATE_FAR = 26;
export const SPOT_BUSH_FACTOR = 0.14;
export const SPOT_RUN_FACTOR = 1.45;
export const SPOT_CLOSE_REVEAL = 72;
export const METER_DECAY = 34;
export const METER_SUSPICIOUS = 35;

// Guard behaviour timings, in seconds.
export const SEARCH_LOOK_TIME = 2.4;
export const CHASE_GIVE_UP = 2.6;
export const ALERT_MEMORY = 4.0;

// Noise: running is heard this far away (pixels); a heard guard investigates.
export const NOISE_RADIUS = 235;

// Scoring.
export const GEM_SCORE = 100;
export const LEVEL_BONUS = 250;
export const TIME_BONUS_PER_SECOND = 4;
export const TIME_BONUS_CAP = 240;

export const STEP = 1 / 60;
export const BEST_KEY = 'emberlight-heist-best';

// Colours, kept in one place so the night palette stays consistent.
export const COLORS = {
  floorA: '#1b2436',
  floorB: '#182031',
  floorEdge: '#232f47',
  wall: '#3a4663',
  wallTop: '#4d5c82',
  crate: '#7a5a34',
  crateEdge: '#a97e47',
  bush: '#1f5c33',
  bushLeaf: '#2e8b4d',
  bushDark: '#143d22',
  exit: '#39d98a',
  exitGlow: '#1d7a4e',
  gem: '#ffd34d',
  player: '#7ef3ff',
  playerDark: '#1fb6d6',
  guard: '#ff6b5e',
  guardDark: '#c93a30',
  cone: 'rgba(255, 214, 90, 0.20)',
  coneEdge: 'rgba(255, 214, 90, 0.45)',
  coneAlert: 'rgba(255, 80, 60, 0.22)',
  lampGlow: 'rgba(255, 196, 90, 0.10)',
  hudBack: 'rgba(8, 12, 24, 0.82)',
  text: '#e8eefc',
  textDim: '#9fb0d0',
  danger: '#ff5a4e',
  warn: '#ffc93d',
  ok: '#39d98a',
};
