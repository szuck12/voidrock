// difficulty.js
// Time-based difficulty scaling and special asteroid availability.
//
// Difficulty is driven purely by elapsed game time (not score) and
// is expressed as three interpolated values: asteroid spawn
// interval, asteroid speed multiplier, and the probability that a
// spawned asteroid is special.  Special classes unlock in a fixed
// order (bronze -> gold) at configured times.

import { DIFFICULTY, SPECIAL } from "../config.js";

/**
 * Interpolate difficulty values at an elapsed time.
 *
 * Values are linearly interpolated between DIFFICULTY.KEYFRAMES;
 * times before the first frame use the first frame, times after
 * the last use the last (the curve holds at max difficulty).
 *
 * Args:
 *     elapsed: Seconds of elapsed game time.
 *
 * Returns:
 *     Object with `spawnInterval` (s), `speedMult`, and
 *     `specialChance` (probability, 0..1).
 */
export function calculateDifficulty(elapsed) {
  const frames = DIFFICULTY.KEYFRAMES;
  if (elapsed <= frames[0].t) {
    return pickFrame(frames[0]);
  }
  const last = frames[frames.length - 1];
  if (elapsed >= last.t) {
    return pickFrame(last);
  }
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (elapsed >= a.t && elapsed <= b.t) {
      const f = (elapsed - a.t) / (b.t - a.t);
      return {
        spawnInterval: a.spawnInterval +
          (b.spawnInterval - a.spawnInterval) * f,
        speedMult: a.speedMult + (b.speedMult - a.speedMult) * f,
        specialChance: a.specialChance +
          (b.specialChance - a.specialChance) * f,
      };
    }
  }
  return pickFrame(last); // unreachable; satisfies strict flows
}

/**
 * Copy a keyframe into a plain result object.
 *
 * Args:
 *     frame: A DIFFICULTY.KEYFRAMES entry.
 *
 * Returns:
 *     Mutable shallow copy of the frame's values.
 */
function pickFrame(frame) {
  return {
    spawnInterval: frame.spawnInterval,
    speedMult: frame.speedMult,
    specialChance: frame.specialChance,
  };
}

/**
 * Whether a special asteroid class has unlocked by a given time.
 *
 * Args:
 *     type: Special class ("bronze" or "gold").
 *     elapsed: Seconds of elapsed game time.
 *
 * Returns:
 *     true when elapsed is at or beyond the class unlock time.
 */
export function canSpawnSpecial(type, elapsed) {
  return elapsed >= SPECIAL.UNLOCK_TIMES[type];
}

/**
 * Ordered list of special classes that are unlocked so far.
 *
 * The order is always bronze < gold because unlock times are
 * strictly increasing (enforced by tests), so callers can rely
 * on index 0 being bronze.
 *
 * Args:
 *     elapsed: Seconds of elapsed game time.
 *
 * Returns:
 *     Array of unlocked special class names in unlock order.
 */
export function unlockedSpecials(elapsed) {
  const order = ["bronze", "gold"];
  return order.filter((type) => canSpawnSpecial(type, elapsed));
}

/**
 * Roll whether a spawned asteroid is special, and which class.
 *
 * A special asteroid only appears when the roll passes the current
 * special chance AND at least one class has unlocked.  The class
 * is then chosen proportionally to SPECIAL.TYPE_WEIGHTS restricted
 * to unlocked classes — gold stays rare both because of its
 * smaller weight and its late unlock.
 *
 * Args:
 *     elapsed: Seconds of elapsed game time.
 *     rng: Random source returning floats in [0, 1).
 *
 * Returns:
 *     "normal" or one of the unlocked special class names.
 */
export function rollSpecialType(elapsed, rng) {
  const chance = calculateDifficulty(elapsed).specialChance;
  if (rng() >= chance) {
    return "normal";
  }
  const unlocked = unlockedSpecials(elapsed);
  if (unlocked.length === 0) {
    return "normal";
  }
  let total = 0;
  for (const type of unlocked) {
    total += SPECIAL.TYPE_WEIGHTS[type];
  }
  let roll = rng() * total;
  for (const type of unlocked) {
    roll -= SPECIAL.TYPE_WEIGHTS[type];
    if (roll < 0) {
      return type;
    }
  }
  return unlocked[unlocked.length - 1];
}
