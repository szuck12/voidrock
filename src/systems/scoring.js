// scoring.js
// Deterministic score calculation and accrual.
//
// All scoring flows through this module so the rules are central,
// testable, and free of hidden multipliers.  Rules:
//   * every hit scores SIZE_SCORE[asteroid.level] (size matters),
//   * special asteroid classes multiply each hit
//     (bronze 2x, gold 4x),
//   * active score power-ups (Points Boost, 3x, 5x) multiply
//     multiplicatively,
//   * surviving accrues TIME_SCORE_PER_SECOND continuously.

import { SCORING } from "../config.js";

/**
 * Compute the points awarded for one hit on an asteroid.
 *
 * The base score depends on asteroid size (level).  Multipliers
 * are applied in order: special class, then any active score
 * power-ups.  All multipliers are applied multiplicatively.
 *
 * Args:
 *     level: Asteroid size level (3=large, 2=medium, 1=small).
 *     specialType: Asteroid class ("normal", "bronze", or "gold").
 *     boostActive: Whether the Points Boost power-up is active.
 *     scoreMult3x: Whether the 3x power-up is active.
 *     scoreMult5x: Whether the 5x power-up is active.
 *
 * Returns:
 *     Integer points for the hit.
 */
export function calculateAsteroidScore(level, specialType, boostActive,
                                      scoreMult3x, scoreMult5x) {
  const base = SCORING.SIZE_SCORE[level] ?? SCORING.SIZE_SCORE[3];
  const specialMult = SCORING.SPECIAL_MULT[specialType] ?? 1;
  const boost = boostActive ? SCORING.POINTS_BOOST_MULT : 1;
  const mult3 = scoreMult3x ? 3 : 1;
  const mult5 = scoreMult5x ? 5 : 1;
  return Math.round(base * specialMult * boost * mult3 * mult5);
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
