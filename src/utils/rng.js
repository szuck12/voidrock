// rng.js
// Seeded pseudo-random number generation for deterministic gameplay.
//
// All game randomness flows through an injected rng function so that
// tests can reproduce exact sequences.  The default factory uses
// mulberry32, a small, fast, well-distributed 32-bit generator.

/**
 * Create a seeded random number generator.
 *
 * Args:
 *     seed: 32-bit unsigned integer seed.
 *
 * Returns:
 *     Function producing uniform floats in [0, 1). Two generators
 *     created with the same seed produce identical sequences.
 */
export function createRng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform float in [min, max).
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *     min: Lower bound (inclusive).
 *     max: Upper bound (exclusive).
 *
 * Returns:
 *     A random float in [min, max).
 */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/**
 * Uniform integer in [min, max] inclusive.
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *     min: Lower bound (inclusive).
 *     max: Upper bound (inclusive).
 *
 * Returns:
 *     A random integer in [min, max].
 */
export function intInRange(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

/**
 * Pick a key from `weights` proportionally to its weight value.
 * Keys with zero or negative weight are never picked; an empty
 * eligible set returns null.
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *     weights: Object mapping keys to numeric weights.
 *
 * Returns:
 *     The selected key, or null when no positive weight exists.
 */
export function pickWeighted(rng, weights) {
  let total = 0;
  for (const key of Object.keys(weights)) {
    if (weights[key] > 0) {
      total += weights[key];
    }
  }
  if (total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (const key of Object.keys(weights)) {
    const w = weights[key];
    if (w <= 0) {
      continue;
    }
    roll -= w;
    if (roll < 0) {
      return key;
    }
  }
  // Floating-point residue: fall back to the last eligible key.
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  return keys[keys.length - 1];
}
