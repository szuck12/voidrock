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
    // Normal: size-based, no multiplier
    assert.equal(calculateAsteroidScore(3, "normal", false, false, false), 10);
    // Bronze: 2x
    assert.equal(calculateAsteroidScore(3, "bronze", false, false, false), 20);
    // Gold: 4x
    assert.equal(calculateAsteroidScore(3, "gold", false, false, false), 40);
  });

  it("multipliers apply on top of size-based scoring", () => {
    // Small gold = 20 * 4 = 80
    assert.equal(calculateAsteroidScore(1, "gold", false, false, false), 80);
    // Medium bronze = 15 * 2 = 30
    assert.equal(calculateAsteroidScore(2, "bronze", false, false, false), 30);
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

  it("only bronze is available before gold unlocks", () => {
    const t = (SPECIAL.UNLOCK_TIMES.bronze +
               SPECIAL.UNLOCK_TIMES.gold) / 2;
    assert.deepEqual(unlockedSpecials(t), ["bronze"]);
    const counts = tally(t, 3000);
    assert.ok(counts.normal > 0);
    assert.equal(counts.gold, undefined);
  });

  it("gold is unavailable until its unlock time passes", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold - 10;
    assert.deepEqual(unlockedSpecials(t), ["bronze"]);
    const counts = tally(t, 4000);
    assert.equal(counts.gold, undefined);
  });

  it("both classes are available after the final unlock", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 60;
    assert.deepEqual(unlockedSpecials(t), ["bronze", "gold"]);
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
    assert.equal(canSpawnSpecial("bronze", 59.9), false);
    assert.equal(canSpawnSpecial("bronze", 60), true);
    assert.equal(canSpawnSpecial("gold", 60), false);
    assert.equal(canSpawnSpecial("gold", 120), true);
  });
});

describe("special asteroid rarity", () => {
  it("bronze outweighs gold among specials", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 100;
    const counts = tally(t, 60000);
    const bronzeShare = counts.bronze / 60000;
    const goldShare = counts.gold / 60000;
    assert.ok(bronzeShare > goldShare,
              `bronze=${bronzeShare} gold=${goldShare}`);
  });

  it("specials stay a small minority even late game", () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 100;
    const counts = tally(t, 60000);
    const specialTotal =
      (counts.bronze || 0) + (counts.gold || 0);
    assert.ok(specialTotal / 60000 < 0.25,
              `special share=${specialTotal / 60000}`);
  });

  it("special frequency grows with elapsed time", () => {
    const early = tally(35, 20000);
    const late = tally(250, 20000);
    const share = (c) =>
      ((c.bronze || 0) + (c.gold || 0)) / 20000;
    assert.ok(share(late) > share(early),
              `early=${share(early)} late=${share(late)}`);
  });

  it("difficulty specialChance feeds rollSpecialType directly",
     () => {
    const t = SPECIAL.UNLOCK_TIMES.gold + 20;
    const expectedChance = calculateDifficulty(t).specialChance;
    const counts = tally(t, 40000);
    const specialRate = ((counts.bronze || 0) +
      (counts.gold || 0)) / 40000;
    assert.ok(specialRate < expectedChance * 2 &&
              specialRate > expectedChance * 0.3,
              `rate=${specialRate} chance=${expectedChance}`);
  });
});
