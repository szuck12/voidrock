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
  POWERUP_TYPES,
  PROJECTILE,
  SCORING,
  SPECIAL,
} from "../src/config.js";
import { assert } from "./helpers.js";

describe("config sanity", () => {
  it("scores special multipliers normal < bronze < gold", () => {
    const m = SCORING.SPECIAL_MULT;
    assert.equal(m.normal, 1);
    assert.equal(m.bronze, 2);
    assert.equal(m.gold, 4);
    assert.ok(m.normal < m.bronze && m.bronze < m.gold);
  });

  it("unlocks specials strictly in bronze then gold order", () => {
    const { bronze, gold } = SPECIAL.UNLOCK_TIMES;
    assert.ok(bronze > 0, "bronze unlock must be after game start");
    assert.ok(bronze < gold, "bronze must unlock before gold");
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

  it("defines size-based scoring (Large=10, Medium=15, Small=20)",
     () => {
    assert.equal(SCORING.SIZE_SCORE[3], 10);
    assert.equal(SCORING.SIZE_SCORE[2], 15);
    assert.equal(SCORING.SIZE_SCORE[1], 20);
  });

  it("size weights sum to 100 and cover all three levels", () => {
    const w = ASTEROID.SIZE_WEIGHTS;
    assert.equal(w[3], 50);
    assert.equal(w[2], 30);
    assert.equal(w[1], 20);
    assert.equal(w[3] + w[2] + w[1], 100);
  });

  it("defines all power-up types with weights and durations",
     () => {
    const types = Object.keys(POWERUP_TYPES).sort();
    assert.ok(types.includes("extra_life"));
    assert.ok(types.includes("speed_boost"));
    assert.ok(types.includes("points_boost"));
    assert.ok(types.includes("slow_asteroids"));
    assert.ok(types.includes("protective_border"));
    assert.ok(types.includes("rapid_fire"));
    assert.ok(types.includes("multi_shot"));
    assert.ok(types.includes("score_3x"));
    assert.ok(types.includes("score_5x"));
    // Every type needs a positive weight.
    for (const [type, def] of Object.entries(POWERUP_TYPES)) {
      assert.ok(def.weight > 0, `${type} weight`);
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
