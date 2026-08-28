// powerups.js
// Power-up spawning, collection, and temporary-effect bookkeeping.
//
// Design rules (enforced here, not by callers):
//   * Spawns run on an independent time schedule with jitter; a
//     spawn or collection never triggers the next spawn.
//   * At most MAX_ON_SCREEN power-ups exist at once.
//   * Extra Life is eligible only when lives < MAX and no Extra
//     Life is already on the field.
//   * Duplicate power-ups cannot spawn when already active or on
//     the board.
//   * Power-ups unlock progressively: standard power-ups from the
//     start, 3x after its unlock time, 5x after 3x unlocks.
//   * Spawn frequency increases gradually over time.
//   * Effects store absolute expiry times on state.elapsed, so
//     pausing naturally freezes them.

import { BOARD, LIVES, POWERUP, POWERUP_TYPES } from "../config.js";
import { pickWeighted, range } from "../utils/rng.js";
import { circlesOverlap, distance } from "../utils/math.js";

/**
 * Types that apply a timed effect on state.effects.  Extra Life
 * is instantaneous rather than timed.
 */
const TIMED_TYPES = [
  "speed_boost",
  "points_boost",
  "slow_asteroids",
  "protective_border",
  "rapid_fire",
  "multi_shot",
  "score_3x",
  "score_5x",
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
 *     type: Power-up type key (POWERUP_TYPES keys).
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
 * Rules applied:
 *   - Extra Life: zeroed when lives >= MAX or already on field.
 *   - Duplicate exclusion: if a type is already active as an effect
 *     or already present on the board, its weight is zeroed.
 *   - Unlock gating: types with an unlockTime are only available
 *     after that time.
 *   - Frequency scaling: weights grow with elapsed time to
 *     increase overall spawn frequency.
 *
 * Args:
 *     state: Game state to inspect.
 *
 * Returns:
 *     Copy of weights with ineligible types removed.
 */
export function eligibleWeights(state) {
  const weights = {};
  const elapsed = state.elapsed;

  for (const [type, def] of Object.entries(POWERUP_TYPES)) {
    // Unlock gating
    if (def.unlockTime != null && elapsed < def.unlockTime) {
      continue;
    }

    // Extra Life eligibility
    if (type === "extra_life") {
      if (state.lives >= LIVES.MAX) {
        continue;
      }
      if (state.powerups.some((p) => p.type === "extra_life")) {
        continue;
      }
    }

    // Duplicate exclusion: skip if already active or on board
    if (TIMED_TYPES.includes(type)) {
      if (effectActive(state, type)) {
        continue;
      }
    }
    if (state.powerups.some((p) => p.type === type)) {
      continue;
    }

    // Progressive frequency scaling: base weight grows by ~50% at
    // 5 min and ~100% at 10 min.
    const freqScale = 1 + elapsed / 600;
    weights[type] = def.weight * freqScale;
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
  const margin = POWERUP.SPAWN_MARGIN;
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
  const def = POWERUP_TYPES[type];
  if (!def || def.duration <= 0) {
    return;
  }
  state.effects[type] = state.elapsed + def.duration;
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
