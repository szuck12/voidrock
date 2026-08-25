// config.js
// Centralized gameplay constants and tunable balance values.
//
// Every gameplay number lives here so the game can be balanced
// without touching logic code.  Systems read from this module and
// must never hard-code their own copies of these values.

/** Logical playfield size in pixels. The canvas scales around it. */
export const BOARD = Object.freeze({
  WIDTH: 960,
  HEIGHT: 640,
});

/** Player ship tuning. */
export const PLAYER = Object.freeze({
  RADIUS: 13,
  ACCELERATION: 1800, // px/s^2 applied while a move key is held
  MAX_SPEED: 380, // px/s hard cap
  DAMPING: 6.0, // exponential velocity decay factor (per second)
  TURN_SPEED: 14, // rad/s toward the target facing angle
  START_FACING: -Math.PI / 2, // pointing up
  INVULNERABLE_DURATION: 2.0, // s of safety after losing a life
});

/** Lives. */
export const LIVES = Object.freeze({
  STARTING: 3,
  MAX: 3,
});

/** Projectile tuning. */
export const PROJECTILE = Object.freeze({
  SPEED: 620, // px/s
  LIFETIME: 0.8, // s; also caps range (~496 px)
  COOLDOWN: 0.22, // s between shots
  RADIUS: 3,
  MAX_ACTIVE: 40, // hard cap preventing unbounded accumulation
  RAPID_FIRE_MULT: 0.45, // cooldown multiplier while Rapid Fire is on
  MULTI_EXTRA: 2, // extra projectiles fired by Multi-Shot
  MULTI_SPREAD: 0.16, // rad between Multi-Shot projectiles
});

/** Asteroid geometry, movement, and spawning. */
export const ASTEROID = Object.freeze({
  RADII: Object.freeze({ 3: 38, 2: 23, 1: 12 }), // by size level
  BASE_SPEED: 70, // px/s at large size, before difficulty scaling
  SPEED_PER_LEVEL: 30, // smaller levels are proportionally faster
  SPEED_VARIANCE: 0.35, // +/- fraction applied to spawn speed
  MIN_PLAYER_DISTANCE: 150, // px; spawns never start on the player
  EDGE_MARGIN: 60, // max depth inside the board for a spawn point
  SPLIT_COUNT: 2, // children produced when a hit asteroid splits
  CHILD_ANGLE_SPREAD: Math.PI / 4, // min divergence between children
  CHILD_SPEED_BOOST: 1.12, // slight speed-up inherited on split
  MAX_COUNT: 24, // cap on simultaneous asteroids
  OFFBOARD_MARGIN: 80, // px past the board before removal
  ENTER_GRACE_SECONDS: 3, // s an off-board asteroid may linger
});

/** Scoring rules. */
export const SCORING = Object.freeze({
  BASE_HIT_SCORE: 10, // every asteroid hit scores this, any size
  TIME_SCORE_PER_SECOND: 1, // survival score accrual rate
  POINTS_BOOST_MULT: 2, // multiplier while Points Boost is active
  SPECIAL_MULT: Object.freeze({
    normal: 1,
    bronze: 2,
    silver: 3,
    gold: 5,
  }),
});

/**
 * Special asteroid unlock schedule (seconds of elapsed game time).
 * Order matters: bronze must unlock before silver, silver before
 * gold.  Verified by tests (see tests/test_config.js).
 */
export const SPECIAL = Object.freeze({
  UNLOCK_TIMES: Object.freeze({
    bronze: 25,
    silver: 65,
    gold: 115,
  }),
  // Relative weights used once a special asteroid is rolled.
  TYPE_WEIGHTS: Object.freeze({
    bronze: 0.58,
    silver: 0.3,
    gold: 0.12,
  }),
});

/**
 * Difficulty keyframes over elapsed time (seconds). Values are
 * linearly interpolated between entries; the last entry holds
 * forever. spawnInterval is seconds between asteroid spawns,
 * speedMult scales asteroid speed, specialChance is the
 * probability that a spawned asteroid is special.
 */
export const DIFFICULTY = Object.freeze({
  KEYFRAMES: Object.freeze([
    Object.freeze({ t: 0, spawnInterval: 2.4, speedMult: 1.0, specialChance: 0.03 }),
    Object.freeze({ t: 30, spawnInterval: 2.05, speedMult: 1.1, specialChance: 0.05 }),
    Object.freeze({ t: 60, spawnInterval: 1.75, speedMult: 1.22, specialChance: 0.08 }),
    Object.freeze({ t: 100, spawnInterval: 1.45, speedMult: 1.36, specialChance: 0.11 }),
    Object.freeze({ t: 150, spawnInterval: 1.18, speedMult: 1.52, specialChance: 0.14 }),
    Object.freeze({ t: 220, spawnInterval: 0.95, speedMult: 1.72, specialChance: 0.17 }),
    Object.freeze({ t: 300, spawnInterval: 0.78, speedMult: 1.95, specialChance: 0.2 }),
  ]),
});

/** Power-up system tuning and per-type definitions. */
export const POWERUP = Object.freeze({
  SPAWN_INTERVAL: 14, // mean seconds between spawn attempts
  SPAWN_JITTER: 4, // +/- uniform jitter on the interval
  LIFETIME: 12, // s before an uncollected power-up disappears
  MAX_ON_SCREEN: 2,
  RADIUS: 16,
  MIN_PLAYER_DISTANCE: 90, // px; never spawn on top of the ship

  DURATIONS: Object.freeze({
    speed_boost: 6,
    points_boost: 15,
    slow_asteroids: 6,
    protective_border: 10,
    rapid_fire: 8,
    multi_shot: 8,
  }),

  // Effect magnitudes.
  SPEED_BOOST_MULT: 1.5, // thrust/top-speed multiplier while boosting
  SLOW_ASTEROID_FACTOR: 0.45, // asteroid displacement factor while slow

  // Base selection weights; eligibility may zero individual types
  // (e.g. Extra Life while already at maximum lives).
  WEIGHTS: Object.freeze({
    speed_boost: 20,
    points_boost: 18,
    slow_asteroids: 16,
    protective_border: 16,
    rapid_fire: 14,
    multi_shot: 10,
    extra_life: 8,
  }),
});

/** Particle effects. */
export const PARTICLES = Object.freeze({
  MAX: 320,
  BURST_BY_LEVEL: Object.freeze({ 3: 26, 2: 16, 1: 10 }),
  LIFETIME: 0.55, // s
  SPEED: 220, // px/s burst speed scale
});

/** Screen shake. */
export const SHAKE = Object.freeze({
  HIT_DURATION: 0.08, // s of shake after a split/destroy
  DEATH_DURATION: 0.35, // s of shake after losing a life
  MAGNITUDE: 5, // px
});
