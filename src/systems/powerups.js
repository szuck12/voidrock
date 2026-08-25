// powerups.js
// Power-up spawning, collection, and temporary-effect bookkeeping.
//
// Design rules (enforced here, not by callers):
//   * Spawns run on an independent time schedule with jitter; a
//     spawn or collection never triggers the next spawn.
//   * At most MAX_ON_SCREEN power-ups exist at once.
//   * Extra Life is eligible only when lives < MAX and no Extra
//     Life is already on the field.
//   * Effects store absolute expiry times on state.elapsed, so
//     pausing naturally freezes them.

import { BOARD, LIVES, POWERUP } from "../config.js";
import { pickWeighted, range } from "../utils/rng.js";
import { circlesOverlap, distance } from "../utils/math.js";

/** Display metadata for HUD and rendering. */
export const POWERUP_META = Object.freeze({
  speed_boost: { label: "SPEED" },
  points_boost: { label: "POINTS 2X" },
  extra_life: { label: "EXTRA LIFE" },
  slow_asteroids: { label: "SLOW AST" },
  protective_border: { label: "BORDER" },
  rapid_fire: { label: "RAPID" },
  multi_shot: { label: "MULTI" },
});

/**
 * Types that apply a timed effect on state.effects.  Extra Life is
 * instantaneous rather than timed.
 */
const TIMED_TYPES = [
  "speed_boost",
  "points_boost",
  "slow_asteroids",
  "protective_border",
  "rapid_fire",
  "multi_shot",
];

/**
 * Roll a spawn-interval delay (used for both the first spawn and
 * each reload of the schedule).
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *
 * Returns:
 *     SPAWN_INTERVAL plus uniform +/- SPAWN_JITTER seconds.
 */
export function powerUpTimerRoll(rng) {
  return POWERUP.SPAWN_INTERVAL +
    range(rng, -POWERUP.SPAWN_JITTER, POWERUP.SPAWN_JITTER);
}

/**
 * Whether a timed effect is currently active.
 *
 * Args:
 *     state: Game state to inspect.
 *     type: Timed effect name (see TIMED_TYPES).
 *
 * Returns:
 *     true while `state.elapsed` is before the effect's expiry.
 */
export function effectActive(state, type) {
  return state.effects[type] != null && state.elapsed < state.effects[type];
}

/**
 * Seconds remaining on an effect (0 when inactive).
 *
 * Args:
 *     state: Game state to inspect.
 *     type: Timed effect name.
 *
 * Returns:
 *   Remaining seconds, floored at zero.
 */
export function effectRemaining(state, type) {
  if (!effectActive(state, type)) {
    return 0;
  }
  return state.effects[type] - state.elapsed;
}

/**
 * Create a power-up entity.
 *
 * Args:
 *     type: Power-up type key (POWERUP.WEIGHTS keys).
 *     x: Position X.
 *     y: Position Y.
 *     bornAt: Elapsed game time at creation, used for the pulse
 *         animation and lifetime countdown.
 *
 * Returns:
 *     Power-up state object.
 */
export function createPowerUp(type, x, y, bornAt) {
  return {
    type,
    x,
    y,
    radius: POWERUP.RADIUS,
    bornAt,
    alive: true,
  };
}

/**
 * Build the eligibility-weighted pool for the next spawn.
 *
 * Extra Life's weight is zeroed while the player has maximum lives
 * or another Extra Life is already on the field, which prevents
 * spawning rather than merely hiding it.
 *
 * Args:
 *     state: Game state to inspect.
 *
 * Returns:
 *     Copy of POWERUP.WEIGHTS with ineligible types removed.
 */
export function eligibleWeights(state) {
  const weights = { ...POWERUP.WEIGHTS };
  const extraLifeOnField = state.powerups.some(
    (p) => p.type === "extra_life"
  );
  const livesFull = state.lives >= LIVES.MAX;
  if (extraLifeOnField || livesFull) {
    delete weights.extra_life;
  }
  return weights;
}

/**
 * Choose a spawn position for a new power-up.
 *
 * Random point inside a comfortable margin of the board, rejecting
 * positions too close to the player so pickups are deliberate.
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *     player: Player state for distance rejection.
 *
 * Returns:
 *     Spawn position {x, y}.
 */
export function powerUpPosition(rng, player) {
  const margin = 70;
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = range(rng, margin, BOARD.WIDTH - margin);
    const y = range(rng, margin, BOARD.HEIGHT - margin);
    if (!player ||
        distance(x, y, player.x, player.y) >= POWERUP.MIN_PLAYER_DISTANCE) {
      return { x, y };
    }
  }
  // Player is sprawling across the random area; centre fallback.
  return { x: BOARD.WIDTH / 2, y: margin };
}

/**
 * Run one step of power-up spawning.
 *
 * The timer counts down independently of anything happening in the
 * game; when it expires a power-up spawns only if capacity and
 * eligibility allow, and the timer reloads regardless of whether
 * anything spawned.
 *
 * Args:
 *     state: Game state (mutated: `powerups`, `powerUpTimer`).
 *     dt: Elapsed seconds.
 */
export function updatePowerUpSpawning(state, dt) {
  state.powerUpTimer -= dt;
  if (state.powerUpTimer > 0) {
    return;
  }

  // Reload first: the schedule must not depend on what happens
  // during the spawn itself.
  state.powerUpTimer += powerUpTimerRoll(state.rng);

  if (state.powerups.length >= POWERUP.MAX_ON_SCREEN) {
    return;
  }

  const weights = eligibleWeights(state);
  let total = 0;
  for (const key of Object.keys(weights)) {
    total += weights[key];
  }
  if (total <= 0) {
    return;
  }
  const type = pickWeighted(state.rng, weights);
  if (!type) {
    return;
  }

  const pos = powerUpPosition(state.rng, state.player);
  state.powerups.push(createPowerUp(type, pos.x, pos.y, state.elapsed));
}

/**
 * Expire uncollected power-ups past their field lifetime.
 *
 * Args:
 *     state: Game state (mutated: `powerups`).
 */
export function expirePowerUps(state) {
  state.powerups = state.powerups.filter((p) =>
    state.elapsed - p.bornAt <= POWERUP.LIFETIME);
}

/**
 * Apply a collected power-up to a game state.
 *
 * Timed effects set their expiry as elapsed + configured duration
 * (refreshing any existing instance).  Extra Life increments
 * lives but can never exceed LIVES.MAX.
 *
 * Args:
 *     state: Game state (mutated: `effects`, possibly `lives`).
 *     type: Power-up type being applied.
 */
export function applyPowerUp(state, type) {
  if (type === "extra_life") {
    state.lives = Math.min(LIVES.MAX, state.lives + 1);
    return;
  }
  const duration = POWERUP.DURATIONS[type];
  if (duration == null) {
    return;
  }
  state.effects[type] = state.elapsed + duration;
}

/**
 * Clear expired timed effects.
 *
 * Args:
 *     state: Game state (mutated: `effects`).
 */
export function expireEffects(state) {
  for (const type of TIMED_TYPES) {
    if (state.effects[type] != null && !effectActive(state, type)) {
      delete state.effects[type];
    }
  }
}

/**
 * Detect ship overlap with power-ups and collect them.
 *
 * Collection requires physical contact between the ship circle and
 * the power-up circle; projectiles never interact with power-ups.
 * Each collected power-up is marked dead and its effect applied.
 *
 * Args:
 *     state: Game state (mutated: `powerups`, `lives`, `events`).
 */
export function collectPowerUps(state) {
  const player = state.player;
  state.powerups = state.powerups.filter((p) => {
    const hit = circlesOverlap(player.x, player.y, player.radius,
                               p.x, p.y, p.radius);
    if (hit) {
      applyPowerUp(state, p.type);
      state.events.push({ kind: "collect", x: p.x, y: p.y });
    }
    return !hit;
  });
}
