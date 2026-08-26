// game.js
// Game-state model and the deterministic simulation step.
//
// All mutable run state lives in one plain object created by
// createInitialState().  Systems mutate it through small, ordered
// functions driven by stepGame(), which takes explicit input and a
// fixed delta time.  Nothing here touches the DOM, Canvas, or wall
// clocks, so the full game is reproducible in tests.

import { ASTEROID, BOARD, LIVES, PLAYER, POWERUP, PROJECTILE }
  from "./config.js";
import { createPlayer, updatePlayer } from "./entities/player.js";
import { createProjectile, updateProjectile } from "./entities/projectile.js";
import { updateAsteroid } from "./entities/asteroid.js";
import { calculateDifficulty } from "./systems/difficulty.js";
import { updateSpawning } from "./systems/spawner.js";
import {
  collectPowerUps,
  effectActive,
  expireEffects,
  expirePowerUps,
  powerUpTimerRoll,
  updatePowerUpSpawning,
} from "./systems/powerups.js";
import { resolvePlayerCollisions, resolveProjectileHits }
  from "./systems/collisions.js";
import { updateTimeScore } from "./systems/scoring.js";
import { createRng } from "./utils/rng.js";

/**
 * Create the initial game state (menu phase).
 *
 * Args:
 *     options: Optional overrides.
 *     options.seed: RNG seed for deterministic runs.
 *     options.bestScore: Session best score carried across runs.
 *
 * Returns:
 *     The complete game state object.  Persistent values (score,
 *     lives, elapsed time, entities, effects, timers) all live on
 *     this object; there is no hidden global state.
 */
export function createInitialState(options = {}) {
  const seed = options.seed != null ? options.seed : (Date.now() >>> 0);
  const rng = createRng(seed);
  const player = createPlayer();
  return {
    phase: "menu", // menu | playing | paused | game_over
    rng,
    player,
    respawnX: BOARD.WIDTH / 2,
    respawnY: BOARD.HEIGHT / 2,
    asteroids: [],
    projectiles: [],
    powerups: [],
    particles: [],
    events: [],
    effects: {},
    score: 0,
    bestScore: options.bestScore || 0,
    lives: LIVES.STARTING,
    elapsed: 0,
    timeScoreCarry: 0,
    fireCooldown: 0,
    spawnTimer: calculateDifficulty(0).spawnInterval,
    powerUpTimer: powerUpTimerRoll(rng),
    shakeTimer: 0,
    stars: makeStars(rng),
  };
}

/**
 * Begin a fresh run from an existing state object.
 *
 * Resets every run-scoped value while preserving the session best
 * score and the RNG stream.  Used for both first start and restart.
 *
 * Args:
 *     state: Game state (mutated in place).
 */
export function startNewRun(state) {
  state.phase = "playing";
  Object.assign(state.player, createPlayer(state.respawnX, state.respawnY));
  state.player.x = state.respawnX;
  state.player.y = state.respawnY;
  state.asteroids = [];
  state.projectiles = [];
  state.powerups = [];
  state.particles = [];
  state.events = [];
  state.effects = {};
  state.score = 0;
  state.lives = LIVES.STARTING;
  state.elapsed = 0;
  state.timeScoreCarry = 0;
  state.fireCooldown = 0;
  state.spawnTimer = calculateDifficulty(0).spawnInterval;
  state.powerUpTimer = powerUpTimerRoll(state.rng);
  state.shakeTimer = 0;
}

/**
 * Toggle between playing and paused phases.
 *
 * Args:
 *     state: Game state (mutated: `phase`).
 */
export function togglePause(state) {
  if (state.phase === "playing") {
    state.phase = "paused";
  } else if (state.phase === "paused") {
    state.phase = "playing";
  }
}

/**
 * Advance the simulation by one step.
 *
 * Full gameplay systems run only in the playing phase; particles
 * continue to decay during game over so explosions finish
 * gracefully.  Order matters: movement -> shooting -> projectile
 * motion -> spawning -> asteroid motion -> culling -> collisions ->
 * pickups -> scoring -> effect expiry -> presentation bookkeeping.
 *
 * Args:
 *     state: Game state (mutated).
 *     input: Object with boolean up/down/left/right/fire flags.
 *     dt: Elapsed seconds (clamped by the caller to avoid spiral
 *         of death after tab switches).
 */
export function stepGame(state, input, dt) {
  // Presentation events are consumed once per step; clear last
  // step's events at entry so renderers always see fresh ones.
  state.events.length = 0;

  updateParticles(state, dt);
  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
  }

  if (state.phase !== "playing") {
    return;
  }

  state.elapsed += dt;

  updateMovement(state, input, dt);
  updateShooting(state, input, dt);

  for (const p of state.projectiles) {
    updateProjectile(p, dt);
  }

  updateSpawning(state, dt);

  const slowFactor =
    effectActive(state, "slow_asteroids")
      ? POWERUP.SLOW_ASTEROID_FACTOR
      : 1;
  for (const a of state.asteroids) {
    updateAsteroid(a, dt, slowFactor);
  }

  cullProjectiles(state);
  cullAsteroids(state);

  resolveProjectileHits(state);
  collectPowerUps(state);
  updatePowerUpSpawning(state, dt);
  expirePowerUps(state);

  updateTimeScore(state, dt);
  expireEffects(state);

  resolvePlayerCollisions(state);
}

/**
 * Update ship movement with active speed modifiers.
 *
 * Args:
 *     state: Game state (mutated: `player`).
 *     input: Input flags.
 *     dt: Elapsed seconds.
 */
function updateMovement(state, input, dt) {
  const mult = effectActive(state, "speed_boost")
    ? POWERUP.SPEED_BOOST_MULT
    : 1;
  updatePlayer(state.player, input, dt, mult);
  const moving = input.up || input.down || input.left || input.right;
  state.player.thrusting = moving;
}

/**
 * Handle firing: cooldown gating, cap enforcement, and the Rapid
 * Fire / Multi-Shot modifiers.
 *
 * Args:
 *     state: Game state (mutated: `projectiles`, `fireCooldown`).
 *     input: Input flags (`fire` requests a shot).
 *     dt: Elapsed seconds.
 */
function updateShooting(state, input, dt) {
  if (state.fireCooldown > 0) {
    state.fireCooldown -= dt;
  }
  if (!input.fire || state.fireCooldown > 0) {
    return;
  }
  if (state.projectiles.length >= PROJECTILE.MAX_ACTIVE) {
    return;
  }

  const rapid = effectActive(state, "rapid_fire");
  const multi = effectActive(state, "multi_shot");
  const noseOffset = state.player.radius + 4;
  const baseAngle = state.player.facing;
  const angles = multi ? multiAngles(baseAngle) : [baseAngle];

  for (const angle of angles) {
    state.projectiles.push(createProjectile(
      state.player.x + Math.cos(angle) * noseOffset,
      state.player.y + Math.sin(angle) * noseOffset,
      angle));
  }

  state.fireCooldown = rapid
    ? PROJECTILE.COOLDOWN * PROJECTILE.RAPID_FIRE_MULT
    : PROJECTILE.COOLDOWN;
}

/**
 * Angles fired by Multi-Shot: centre plus symmetric spread pairs.
 *
 * Args:
 *     base: Ship facing angle.
 *
 * Returns:
 *     Array of fire angles centred on the facing direction.
 */
function multiAngles(base) {
  const angles = [];
  for (let i = -1; i <= 1; i++) {
    angles.push(base + i * PROJECTILE.MULTI_SPREAD);
  }
  return angles;
}

/**
 * Remove projectiles that expired or left the board area.
 *
 * Args:
 *     state: Game state (mutated: `projectiles`).
 */
function cullProjectiles(state) {
  const m = ASTEROID.OFFBOARD_MARGIN;
  state.projectiles = state.projectiles.filter((p) =>
    p.alive &&
    p.x >= -m && p.x <= BOARD.WIDTH + m &&
    p.y >= -m && p.y <= BOARD.HEIGHT + m);
}

/**
 * Remove asteroids that drifted off-board and will not return.
 *
 * Asteroids spawn just outside the board, so newcomers inside the
 * margin band are kept until they enter; once an asteroid has
 * entered, exiting the band removes it.  As a safety valve against
 * split children being knocked outward before ever entering,
 * asteroids older than ENTER_GRACE_SECONDS that never entered are
 * also removed — entity counts stay bounded in all cases.
 *
 * Args:
 *     state: Game state (mutated: `asteroids`).
 */
function cullAsteroids(state) {
  const m = ASTEROID.OFFBOARD_MARGIN;
  const grace = ASTEROID.ENTER_GRACE_SECONDS;
  state.asteroids = state.asteroids.filter((a) => {
    const inside = a.x >= -m && a.x <= BOARD.WIDTH + m &&
                   a.y >= -m && a.y <= BOARD.HEIGHT + m;
    if (inside) {
      a.entered = true;
      return true;
    }
    return !a.entered && a.age <= grace;
  });
}

/**
 * Advance particles one step: move, age, and drop dead ones.
 *
 * Args:
 *     state: Game state (mutated: `particles`).
 *     dt: Elapsed seconds.
 */
function updateParticles(state, dt) {
  let alive = false;
  for (const pt of state.particles) {
    pt.age += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    if (pt.age < pt.lifetime) {
      alive = true;
    }
  }
  if (!alive && state.particles.length > 0) {
    state.particles = [];
  } else {
    state.particles = state.particles.filter((pt) => pt.age < pt.lifetime);
  }
}

/**
 * Generate the static starfield used by the renderer.
 *
 * Args:
 *     rng: Random source for star placement.
 *
 * Returns:
 *     Array of star descriptors ({x, y, size, twinklePhase}).
 */
function makeStars(rng) {
  const stars = [];
  const count = 90;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng() * BOARD.WIDTH,
      y: rng() * BOARD.HEIGHT,
      size: rng() < 0.85 ? 1 : 2,
      twinklePhase: rng() * Math.PI * 2,
    });
  }
  return stars;
}
