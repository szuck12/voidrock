// test_game_edges.js
// Edge cases in game state management: phase guards, state reset,
// particle lifecycle, shake timer, and init determinism.

import { describe, it } from "node:test";
import { LIVES, PARTICLES, SHAKE } from "../src/config.js";
import {
  createInitialState,
  startNewRun,
  stepGame,
  togglePause,
} from "../src/game.js";
import {
  advance,
  assert,
  makeState,
  placeAsteroid,
  step,
} from "./helpers.js";

describe("togglePause phase guards", () => {
  it("no-op during menu phase", () => {
    const state = makeState();
    state.phase = "menu";
    togglePause(state);
    assert.equal(state.phase, "menu");
  });

  it("no-op during game_over phase", () => {
    const state = makeState();
    state.phase = "game_over";
    togglePause(state);
    assert.equal(state.phase, "game_over");
  });
});

describe("createInitialState", () => {
  it("uses provided seed for determinism", () => {
    const a = createInitialState({ seed: 42 });
    const b = createInitialState({ seed: 42 });
    // Same seed should produce identical RNG sequences
    const seqA = Array.from({ length: 5 }, () => a.rng());
    const seqB = Array.from({ length: 5 }, () => b.rng());
    assert.deepEqual(seqA, seqB);
  });

  it("uses provided bestScore", () => {
    const state = createInitialState({ seed: 1, bestScore: 999 });
    assert.equal(state.bestScore, 999);
  });

  it("defaults bestScore to 0 when not provided", () => {
    const state = createInitialState({ seed: 1 });
    assert.equal(state.bestScore, 0);
  });
});

describe("startNewRun state reset", () => {
  it("clears effects array", () => {
    const state = makeState();
    state.effects.speed_boost = 99;
    state.effects.protective_border = 88;
    startNewRun(state);
    assert.deepEqual(state.effects, {});
  });

  it("clears powerups array", () => {
    const state = makeState();
    state.powerups.push({ type: "test", x: 0, y: 0 });
    startNewRun(state);
    assert.equal(state.powerups.length, 0);
  });

  it("resets score to zero", () => {
    const state = makeState();
    state.score = 500;
    startNewRun(state);
    assert.equal(state.score, 0);
  });

  it("resets lives to STARTING", () => {
    const state = makeState();
    state.lives = 1;
    startNewRun(state);
    assert.equal(state.lives, LIVES.STARTING);
  });
});

describe("particle lifecycle", () => {
  it("particles continue during game_over for visual continuity",
     () => {
    const state = makeState();
    // Manually add a particle with a long lifetime
    state.particles.push({
      x: 100, y: 100, vx: 10, vy: 10,
      age: 0, lifetime: 5, colorKey: "normal",
    });
    state.phase = "game_over";
    step(state, 1);
    // Particle should still exist (age 1 < lifetime 5)
    assert.equal(state.particles.length, 1);
  });

  it("expired particles are removed", () => {
    const state = makeState();
    state.particles.push({
      x: 100, y: 100, vx: 0, vy: 0,
      age: 4.9, lifetime: 5, colorKey: "normal",
    });
    step(state, 0.2);
    assert.equal(state.particles.length, 0,
                 "expired particle must be culled");
  });
});

describe("shakeTimer", () => {
  it("counts down each step", () => {
    const state = makeState();
    state.shakeTimer = 0.5;
    step(state, 0.1);
    assert.ok(state.shakeTimer < 0.5);
    assert.ok(state.shakeTimer > 0);
  });

  it("stops at zero, never negative", () => {
    const state = makeState();
    state.shakeTimer = 0.01;
    step(state, 1);
    assert.equal(state.shakeTimer, 0);
  });
});
