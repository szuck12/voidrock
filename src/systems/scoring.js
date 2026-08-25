// scoring.js
// Deterministic score calculation and accrual.
//
// All scoring flows through this module so the rules are central,
// testable, and free of hidden multipliers.  Rules:
//   * every hit on any asteroid scores BASE_HIT_SCORE (size does
//     not matter),
//   * special asteroid classes multiply each hit
//     (bronze 2x, silver 3x, gold 5x),
//   * an active Points Boost doubles the final value,
//   * surviving accrues TIME_SCORE_PER_SECOND continuously.

import { SCORING } from "../config.js";

/**
 * Compute the points awarded for one hit on an asteroid.
 *
 * Args:
 *     specialType: Asteroid class ("normal", "bronze", "silver",
 *         or "gold").
 *     boostActive: Whether the Points Boost power-up is active.
 *
 * Returns:
 *     Integer points for the hit. Example with base 10: a silver
 *     asteroid hit while boosting scores 10 * 3 * 2 = 60.
 */
export function calculateAsteroidScore(specialType, boostActive) {
  const mult = SCORING.SPECIAL_MULT[specialType] ?? 1;
  const boost = boostActive ? SCORING.POINTS_BOOST_MULT : 1;
  return Math.round(SCORING.BASE_HIT_SCORE * mult * boost);
}

/**
 * Accrue survival score for one step.
 *
 * Fractional credit carries across steps so arbitrary frame rates
 * produce identical totals; whole points are credited only when
 * the carry reaches 1.0.
 *
 * Args:
 *     state: Game state (mutated: `score`, `timeScoreCarry`).
 *     dt: Elapsed seconds in this step.
 */
export function updateTimeScore(state, dt) {
  state.timeScoreCarry += dt * SCORING.TIME_SCORE_PER_SECOND;
  if (state.timeScoreCarry >= 1) {
    const whole = Math.floor(state.timeScoreCarry);
    state.timeScoreCarry -= whole;
    addScore(state, whole);
  }
}

/**
 * Add points to the current run's score and track the session best.
 *
 * Args:
 *     state: Game state (mutated: `score`, `bestScore`).
 *     points: Points to add (must be non-negative).
 */
export function addScore(state, points) {
  state.score += points;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
  }
}
