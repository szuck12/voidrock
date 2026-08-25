// helpers.js
// Shared deterministic fixtures for the Voidrock test suite.
//
// Every test runs against a seeded RNG and explicit dt stepping;
// nothing depends on wall-clock time or real randomness.

import assert from "node:assert/strict";
import { ASTEROID, BOARD, POWERUP } from "../src/config.js";
import { createInitialState, startNewRun, stepGame }
  from "../src/game.js";
import { createRng } from "../src/utils/rng.js";

export { assert };

/** Default idle input (no keys held). */
export const IDLE_INPUT = Object.freeze({
  up: false, down: false, left: false, right: false, fire: false,
});

/**
 * Build a fresh playing state with a fixed seed.
 *
 * Args:
 *     seed: RNG seed; defaults to a constant for reproducibility.
 *     bestScore: Optional session best to carry in.
 *
 * Returns:
 *     Game state in the "playing" phase.
 */
export function makeState(seed = 1234, bestScore = 0) {
  const state = createInitialState({ seed, bestScore });
  startNewRun(state);
  return state;
}

/**
 * Step the game once with an input object.
 *
 * Args:
 *     state: Game state.
 *     dt: Seconds to advance.
 *     input: Input flags; defaults to idle.
 */
export function step(state, dt = 1 / 60, input = IDLE_INPUT) {
  stepGame(state, input, dt);
}

/**
 * Advance the game by many fixed steps.
 *
 * Args:
 *     state: Game state.
 *     seconds: Total time to simulate.
 *     input: Input flags held for the whole duration.
 *     stepSize: Fixed dt per step.
 */
export function advance(state, seconds, input = IDLE_INPUT,
                        stepSize = 1 / 60) {
  const steps = Math.round(seconds / stepSize);
  for (let i = 0; i < steps; i++) {
    stepGame(state, input, stepSize);
  }
}

/**
 * Insert an asteroid at an exact position with exact velocity,
 * bypassing spawn randomness.  Used to stage collision scenarios.
 *
 * Args:
 *     state: Game state to append into.
 *     options: level, x, y, vx, vy, type, entered.
 *
 * Returns:
 *     The asteroid object inserted.
 */
export function placeAsteroid(state, {
  level = 3,
  x = BOARD.WIDTH / 2,
  y = BOARD.HEIGHT / 2,
  vx = 0,
  vy = 0,
  type = "normal",
  entered = true,
} = {}) {
  const asteroid = {
    type,
    level,
    x,
    y,
    vx,
    vy,
    radius: ASTEROID.RADII[level],
    angle: Math.atan2(vy, vx),
    shape: [1, 1, 1, 1, 1, 1, 1, 1],
    spin: 0,
    rotation: 0,
    age: 0,
    entered,
    alive: true,
  };
  state.asteroids.push(asteroid);
  return asteroid;
}

/**
 * Insert a power-up at an exact position.
 *
 * Args:
 *     state: Game state to append into.
 *     type: Power-up type key.
 *     x: Position X.
 *     y: Position Y.
 *
 * Returns:
 *     The power-up object inserted.
 */
export function placePowerUp(state, type, x, y) {
  const p = {
    type,
    x,
    y,
    radius: POWERUP.RADIUS,
    bornAt: state.elapsed,
    alive: true,
  };
  state.powerups.push(p);
  return p;
}

/**
 * Create an isolated seeded rng for direct calls.
 *
 * Args:
 *     seed: Seed value.
 *
 * Returns:
 *     rng function.
 */
export function rng(seed = 99) {
  return createRng(seed);
}
