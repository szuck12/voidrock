// test_config.js
// Sanity tests for the centralized configuration: ordering rules
// and invariants that other systems rely on.

import { describe, it } from "node:test";
import {
  ASTEROID,
  BOARD,
  DIFFICULTY,
  LIVES,
  PLAYER,
  POWERUP,
  PROJECTILE,
  SCORING,
  SPECIAL,
} from "../src/config.js";
import { assert } from "./helpers.js";

describe("config sanity", () => {
  it("scores special multipliers normal < bronze < silver < gold",
     () => {
    const m = SCORING.SPECIAL_MULT;
    assert.equal(m.normal, 1);
    assert.equal(m.bronze, 2);
    assert.equal(m.silver, 3);
    assert.equal(m.gold, 5);
    assert.ok(m.normal < m.bronze && m.bronze < m.silver &&
              m.silver < m.gold);
  });

  it("unlocks specials strictly in bronze, silver, gold order",
     () => {
    const { bronze, silver, gold } = SPECIAL.UNLOCK_TIMES;
    assert.ok(bronze > 0, "bronze unlock must be after game start");
    assert.ok(bronze < silver, "bronze must unlock before silver");
    assert.ok(silver < gold, "silver must unlock before gold");
  });

  it("starts and caps lives at 3", () => {
    assert.equal(LIVES.STARTING, 3);
    assert.equal(LIVES.MAX, 3);
  });

  it("keeps asteroid radii positive and decreasing with level",
     () => {
    for (const level of [1, 2, 3]) {
      assert.ok(ASTEROID.RADII[level] > 0);
    }
    assert.ok(ASTEROID.RADII[3] > ASTEROID.RADII[2]);
    assert.ok(ASTEROID.RADII[2] > ASTEROID.RADII[1]);
  });

  it("defines all seven power-up types with weights and durations",
     () => {
    const types = Object.keys(POWERUP.WEIGHTS).sort();
    assert.deepEqual(types, [
      "extra_life",
      "multi_shot",
      "points_boost",
      "protective_border",
      "rapid_fire",
      "slow_asteroids",
      "speed_boost",
    ]);
    // Extra Life is instantaneous; every other type needs a
    // duration.
    const timed = types.filter((t) => t !== "extra_life");
    for (const type of timed) {
      assert.ok(POWERUP.DURATIONS[type] > 0, `${type} duration`);
    }
    for (const [type, weight] of Object.entries(POWERUP.WEIGHTS)) {
      assert.ok(weight > 0, `${type} weight`);
    }
  });

  it("limits simultaneous power-ups to the 1-2 range", () => {
    assert.ok(POWERUP.MAX_ON_SCREEN >= 1);
    assert.ok(POWERUP.MAX_ON_SCREEN <= 2);
  });

  it("difficulty keyframes are time-sorted and trend monotonically",
     () => {
    const frames = DIFFICULTY.KEYFRAMES;
    assert.ok(frames.length >= 2);
    for (let i = 1; i < frames.length; i++) {
      assert.ok(frames[i].t > frames[i - 1].t, "sorted by time");
      assert.ok(frames[i].spawnInterval <= frames[i - 1].spawnInterval,
                "spawning accelerates");
      assert.ok(frames[i].speedMult >= frames[i - 1].speedMult,
                "asteroids speed up");
      assert.ok(frames[i].specialChance >= frames[i - 1].specialChance,
                "specials grow more common");
    }
  });

  it("special asteroid chance stays rare at every keyframe", () => {
    for (const frame of DIFFICULTY.KEYFRAMES) {
      assert.ok(frame.specialChance <= 0.25,
                `chance ${frame.specialChance} at t=${frame.t}`);
    }
  });

  it("projectile cap bounds accumulation and cooldown is positive",
     () => {
    assert.ok(PROJECTILE.MAX_ACTIVE > 0);
    assert.ok(PROJECTILE.COOLDOWN > 0);
    assert.ok(PROJECTILE.LIFETIME > 0);
    assert.ok(PROJECTILE.RAPID_FIRE_MULT < 1,
              "rapid fire must shorten cooldown");
  });

  it("player tuning values are positive", () => {
    for (const key of ["RADIUS", "ACCELERATION", "MAX_SPEED",
                       "DAMPING", "TURN_SPEED",
                       "INVULNERABLE_DURATION"]) {
      assert.ok(PLAYER[key] > 0, key);
    }
  });

  it("board dimensions are sane", () => {
    assert.ok(BOARD.WIDTH >= 600 && BOARD.HEIGHT >= 400);
  });
});
