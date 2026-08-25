// test_difficulty.js
// Difficulty curve behaviour: monotonic progression, interpolation,
// and integration effects on spawn frequency and asteroid speed.

import { describe, it } from "node:test";
import { ASTEROID, DIFFICULTY } from "../src/config.js";
import { createAsteroid } from "../src/entities/asteroid.js";
import { calculateDifficulty, unlockedSpecials }
  from "../src/systems/difficulty.js";
import { updateSpawning } from "../src/systems/spawner.js";
import { assert, makeState, rng } from "./helpers.js";

describe("difficulty curve", () => {
  it("spawn interval shrinks as time passes", () => {
    for (let t = 0; t <= 320; t += 10) {
      const d = calculateDifficulty(t);
      const later = calculateDifficulty(t + 5);
      assert.ok(later.spawnInterval <= d.spawnInterval + 1e-9,
                `t=${t}: ${d.spawnInterval} -> ` +
                `${later.spawnInterval}`);
    }
  });

  it("asteroid speed multiplier never decreases", () => {
    let prev = 0;
    for (let t = 0; t <= 400; t += 5) {
      const mult = calculateDifficulty(t).speedMult;
      assert.ok(mult >= prev - 1e-9, `regressed at t=${t}`);
      prev = mult;
    }
  });

  it("special chance never decreases", () => {
    let prev = 0;
    for (let t = 0; t <= 400; t += 5) {
      const chance = calculateDifficulty(t).specialChance;
      assert.ok(chance >= prev - 1e-9, `regressed at t=${t}`);
      prev = chance;
    }
  });

  it("interpolates linearly between keyframes", () => {
    const [a, b] = [DIFFICULTY.KEYFRAMES[0],
                    DIFFICULTY.KEYFRAMES[1]];
    const mid = calculateDifficulty((a.t + b.t) / 2);
    assert.ok(Math.abs(mid.spawnInterval -
                       (a.spawnInterval + b.spawnInterval) / 2)
              < 1e-9);
    assert.ok(Math.abs(mid.speedMult -
                       (a.speedMult + b.speedMult) / 2) < 1e-9);
  });

  it("holds the final keyframe forever after the last threshold",
     () => {
    const last = DIFFICULTY.KEYFRAMES[DIFFICULTY.KEYFRAMES.length - 1];
    const far = calculateDifficulty(last.t + 10000);
    assert.equal(far.spawnInterval, last.spawnInterval);
    assert.equal(far.speedMult, last.speedMult);
    assert.equal(far.specialChance, last.specialChance);
  });
});

describe("difficulty integration", () => {
  function spawnsInWindow(startElapsed, seconds) {
    const state = makeState();
    state.elapsed = startElapsed;
    let spawned = 0;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      const before = state.asteroids.length;
      updateSpawning(state, 1 / 60);
      if (state.asteroids.length > before) {
        spawned++;
      }
    }
    return spawned;
  }

  it("spawns asteroids more frequently late game than early",
     () => {
    const early = spawnsInWindow(0, 30);
    const late = spawnsInWindow(200, 30);
    assert.ok(late > early * 1.2,
              `early=${early} late=${late}`);
  });

  it("caps total asteroids at MAX_COUNT under sustained spawning",
     () => {
    const state = makeState();
    state.elapsed = 300;
    let peak = 0;
    for (let i = 0; i < 60 * 120; i++) {
      updateSpawning(state, 1 / 60);
      peak = Math.max(peak, state.asteroids.length);
    }
    assert.ok(peak <= ASTEROID.MAX_COUNT, `peak=${peak}`);
  });

  it("speedMult flows into spawned asteroid velocities", () => {
    function rolledSpeed(elapsedOffset) {
      const r2 = rng(555);
      return createAsteroid({
        level: 3,
        x: -20,
        y: 300,
        angle: 0,
        type: "normal",
        speedMult: calculateDifficulty(elapsedOffset).speedMult,
        rng: r2,
      });
    }
    const slow = rolledSpeed(0);
    const fast = rolledSpeed(300);
    const speedOf = (a) => Math.sqrt(a.vx ** 2 + a.vy ** 2);
    const ratio = speedOf(fast) / speedOf(slow);
    const expected = calculateDifficulty(300).speedMult /
                     calculateDifficulty(0).speedMult;
    assert.ok(Math.abs(ratio - expected) < expected * 0.01 + 1e-9,
              `ratio=${ratio} expected=${expected}`);
  });

  it("unlocks specials strictly in order over one run", () => {
    const seen = [];
    let lastLen = 0;
    for (let t = 0; t <= 200; t += 0.5) {
      const list = unlockedSpecials(t);
      if (list.length !== lastLen) {
        seen.push(list[list.length - 1]);
        lastLen = list.length;
      }
    }
    assert.deepEqual(seen, ["bronze", "gold"]);
  });
});
