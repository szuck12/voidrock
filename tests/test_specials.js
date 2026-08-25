// test_specials.js
// Special asteroid classes: score multipliers, unlock progression,
// rarity, and frequency growth over time.

import { describe, it } from "node:test";
import { SCORING, SPECIAL } from "../src/config.js";
import {
  canSpawnSpecial,
  calculateDifficulty,
  rollSpecialType,
  unlockedSpecials,
} from "../src/systems/difficulty.js";
import { calculateAsteroidScore }
  from "../src/systems/scoring.js";
import { assert, rng } from "./helpers.js";

/**
 * Tally roll results across many draws at a fixed elapsed time.
 *
 * Args:
 *     elapsed: Simulated game time in seconds.
 *     rolls: Number of draws.
 *
 * Returns:
 *     Object mapping rolled type to count.
 */
function tally(elapsed, rolls) {
  const r = rng(4242);
  const counts = {};
  for (let i = 0; i < rolls; i++) {
    const type = rollSpecialType(elapsed, r);
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

describe("special asteroid scoring", () => {
  it("awards base x multiplier per hit for each class", () => {
    assert.equal(calculateAsteroidScore("normal", false), 10);
    assert.equal(calculateAsteroidScore("bronze", false), 20);
    assert.equal(calculateAsteroidScore("silver", false), 30);
    assert.equal(calculateAsteroidScore("gold", false), 50);
  });

  it("multipliers apply regardless of asteroid size", () => {
    // Scoring is size-blind: only the class multiplies.
    assert.equal(SCORING.BASE_HIT_SCORE *
                 SCORING.SPECIAL_MULT.gold, 50);
  });
});

describe("special asteroid unlocking", () => {
  it("no specials can spawn before the bronze unlock time",
     () => {
    const before = SPECIAL.UNLOCK_TIMES.bronze - 5;
    assert.deepEqual(unlockedSpecials(before), []);
    const counts = tally(before, 2000);
    assert.deepEqual(Object.keys(counts), ["normal"]);
  });

  it("only bronze is available between bronze and silver unlocks",
     () => {
    const t = (SPECIAL.UNLOCK_TIMES.bronze +
               SPECIAL.UNLOCK_TIMES.silver) / 2;
    assert.deepEqual(unlockedSpecials(t), ["bronze"]);
    const counts = tally(t, 3000);
    assert.ok(counts.normal > 0);
    assert.equal(counts.silver, undefined);
    assert.equal(counts.gold, undefined);
  });

  it("gold is unavailable until its unlock time passes", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold - 10;
    assert.deepEqual(unlockedSpecials(t), ["bronze", "silver"]);
    const counts = tally(t, 4000);
    assert.equal(counts.gold, undefined);
  });

  it("all classes are available after the final unlock", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 60;
    assert.deepEqual(unlockedSpecials(t),
                     ["bronze", "silver", "gold"]);
    // With enough rolls every class eventually appears.
    const r = rng(777);
    let sawGold = false;
    for (let i = 0; i < 60000 && !sawGold; i++) {
      if (rollSpecialType(t, r) === "gold") {
        sawGold = true;
      }
    }
    assert.ok(sawGold, "gold must be reachable");
  });

  it("canSpawnSpecial() gates each class independently", () => {
    assert.equal(canSpawnSpecial("bronze", 24.9), false);
    assert.equal(canSpawnSpecial("bronze", 25), true);
    assert.equal(canSpawnSpecial("silver", 25), false);
    assert.equal(canSpawnSpecial("silver", 65), true);
    assert.equal(canSpawnSpecial("gold", 65), false);
    assert.equal(canSpawnSpecial("gold", 115), true);
  });
});

describe("special asteroid rarity", () => {
  it("bronze outweighs silver outweighs gold among specials",
     () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 100;
    const counts = tally(t, 60000);
    const bronzeShare = counts.bronze / 60000;
    const silverShare = counts.silver / 60000;
    const goldShare = counts.gold / 60000;
    assert.ok(bronzeShare > silverShare,
              `bronze=${bronzeShare} silver=${silverShare}`);
    assert.ok(silverShare > goldShare,
              `silver=${silverShare} gold=${goldShare}`);
  });

  it("specials stay a small minority even late game", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 100;
    const counts = tally(t, 60000);
    const specialTotal =
      (counts.bronze || 0) + (counts.silver || 0) + (counts.gold || 0);
    assert.ok(specialTotal / 60000 < 0.25,
              `special share=${specialTotal / 60000}`);
  });

  it("special frequency grows with elapsed time", () => {
    const early = tally(35, 20000);
    const late = tally(250, 20000);
    const share = (c) =>
      ((c.bronze || 0) + (c.silver || 0) + (c.gold || 0)) / 20000;
    assert.ok(share(late) > share(early),
              `early=${share(early)} late=${share(late)}`);
  });

  it("difficulty specialChance feeds rollSpecialType directly",
     () => {
    // At zero chance-equivalent early times with unlocks active
    // there would still be no specials; verify the chance value
    // used comes from the difficulty curve by checking a mid
    // window's empirical rate roughly tracks the curve.
    const t = SPECIAL.UNLOCK_TIMES.silver + 20;
    const expectedChance = calculateDifficulty(t).specialChance;
    const counts = tally(t, 40000);
    const specialRate = ((counts.bronze || 0) +
      (counts.silver || 0) + (counts.gold || 0)) / 40000;
    assert.ok(specialRate < expectedChance * 2 &&
              specialRate > expectedChance * 0.3,
              `rate=${specialRate} chance=${expectedChance}`);
  });
});
