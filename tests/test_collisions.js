// test_collisions.js
// Direct unit tests for collision primitives, destroyAsteroid,
// particle spawning, shield+multiplier combos, and event emission.

import { describe, it } from "node:test";
import { PARTICLES, SCORING, SHAKE } from "../src/config.js";
import {
  projectileHitsAsteroid,
  resolvePlayerCollisions,
  destroyAsteroid,
  loseLife,
} from "../src/systems/collisions.js";
import { applyPowerUp } from "../src/systems/powerups.js";
import { calculateAsteroidScore } from "../src/systems/scoring.js";
import {
  advance,
  assert,
  makeState,
  placeAsteroid,
  step,
} from "./helpers.js";

describe("projectileHitsAsteroid", () => {
  it("detects hit when projectile path crosses asteroid", () => {
    const proj = { x: 110, y: 100, prevX: 90, prevY: 100, radius: 3 };
    const ast = { x: 100, y: 100, radius: 12 };
    assert.equal(projectileHitsAsteroid(proj, ast), true);
  });

  it("misses when path is outside radius", () => {
    const proj = { x: 110, y: 50, prevX: 90, prevY: 50, radius: 3 };
    const ast = { x: 100, y: 100, radius: 12 };
    assert.equal(projectileHitsAsteroid(proj, ast), false);
  });

  it("handles zero-length segment (stationary projectile)", () => {
    const proj = { x: 100, y: 100, prevX: 100, prevY: 100, radius: 3 };
    const ast = { x: 105, y: 100, radius: 12 };
    assert.equal(projectileHitsAsteroid(proj, ast), true);
  });

  it("detects exact-touch (distance equals sum of radii)", () => {
    const proj = { x: 115, y: 100, prevX: 115, prevY: 100, radius: 3 };
    const ast = { x: 100, y: 100, radius: 12 };
    // Distance = 15, rSum = 15, should hit
    assert.equal(projectileHitsAsteroid(proj, ast), true);
  });
});

describe("destroyAsteroid direct", () => {
  it("marks asteroid dead and emits particles", () => {
    const state = makeState();
    const a = placeAsteroid(state, { level: 2, x: 400, y: 300 });
    const particlesBefore = state.particles.length;
    destroyAsteroid(state, a);
    assert.equal(a.alive, false);
    assert.ok(state.particles.length > particlesBefore,
              "particles must be emitted");
  });

  it("spawns children for non-small asteroids", () => {
    const state = makeState();
    const a = placeAsteroid(state, { level: 3, x: 400, y: 300 });
    destroyAsteroid(state, a);
    const children = state.asteroids.filter((c) => c.alive);
    assert.equal(children.length, 2, "large splits into two");
  });

  it("does not spawn children for small asteroids", () => {
    const state = makeState();
    const a = placeAsteroid(state, { level: 1, x: 400, y: 300 });
    destroyAsteroid(state, a);
    const children = state.asteroids.filter((c) => c.alive);
    assert.equal(children.length, 0, "small produces no children");
  });

  it("sets shakeTimer to HIT_DURATION", () => {
    const state = makeState();
    state.shakeTimer = 0;
    const a = placeAsteroid(state, { level: 2, x: 400, y: 300 });
    destroyAsteroid(state, a);
    assert.equal(state.shakeTimer, SHAKE.HIT_DURATION);
  });
});

describe("spawnBurst via destroyAsteroid", () => {
  it("creates correct particle count for each level", () => {
    for (const [level, expected] of Object.entries(PARTICLES.BURST_BY_LEVEL)) {
      const state = makeState();
      const a = placeAsteroid(state, { level: Number(level),
                                       x: 400, y: 300 });
      destroyAsteroid(state, a);
      // Particles are pushed, so count should be at least expected
      // (could be more if previous particles exist)
      assert.ok(state.particles.length >= expected,
                `level ${level}: expected >= ${expected}, ` +
                `got ${state.particles.length}`);
    }
  });

  it("caps at PARTICLES.MAX when pool is full", () => {
    const state = makeState();
    // Fill the particle pool to max
    state.particles.length = PARTICLES.MAX;
    const a = placeAsteroid(state, { level: 3, x: 400, y: 300 });
    destroyAsteroid(state, a);
    assert.equal(state.particles.length, PARTICLES.MAX,
                 "must not exceed PARTICLES.MAX");
  });

  it("applies correct colorKey to particles", () => {
    const state = makeState();
    const a = placeAsteroid(state, { level: 2, x: 400, y: 300,
                                     type: "bronze" });
    destroyAsteroid(state, a);
    const newParticles = state.particles.slice(
      state.particles.length - PARTICLES.BURST_BY_LEVEL[2]);
    for (const pt of newParticles) {
      assert.equal(pt.colorKey, "bronze");
    }
  });
});

describe("shield + multiplier combos", () => {
  function shieldScore(type, level, boost, m3, m5) {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    if (boost) state.effects.points_boost = state.elapsed + 10;
    if (m3) state.effects.score_3x = state.elapsed + 10;
    if (m5) state.effects.score_5x = state.elapsed + 10;
    placeAsteroid(state, { x: state.player.x, y: state.player.y,
                           level, type });
    const before = state.score;
    step(state, 1 / 60);
    return state.score - before;
  }

  it("shield + points_boost awards correct score", () => {
    // Large normal = 10, with points_boost = 20
    assert.equal(shieldScore("normal", 3, true, false, false), 20);
  });

  it("shield + 3x awards triple score", () => {
    // Large normal = 10, with 3x = 30
    assert.equal(shieldScore("normal", 3, false, true, false), 30);
  });

  it("shield + 5x awards quintuple score", () => {
    // Large normal = 10, with 5x = 50
    assert.equal(shieldScore("normal", 3, false, false, true), 50);
  });

  it("shield + all multipliers combined", () => {
    // Small gold with points_boost + 3x + 5x:
    // 20 * 4 * 2 * 3 * 5 = 2400
    assert.equal(shieldScore("gold", 1, true, true, true), 2400);
  });
});

describe("event emission", () => {
  it("loseLife emits death event with correct position", () => {
    const state = makeState();
    state.player.x = 200;
    state.player.y = 300;
    loseLife(state);
    const deathEvents = state.events.filter((e) => e.kind === "death");
    assert.equal(deathEvents.length, 1);
    assert.equal(deathEvents[0].x, 200);
    assert.equal(deathEvents[0].y, 300);
  });

  it("resolvePlayerCollisions no-op during menu phase", () => {
    const state = makeState();
    state.phase = "menu";
    placeAsteroid(state, { x: state.player.x, y: state.player.y });
    resolvePlayerCollisions(state);
    assert.equal(state.lives, 3, "must not lose life in menu");
  });

  it("resolvePlayerCollisions no-op during game_over phase", () => {
    const state = makeState();
    state.phase = "game_over";
    state.lives = 0;
    placeAsteroid(state, { x: state.player.x, y: state.player.y });
    resolvePlayerCollisions(state);
    assert.equal(state.lives, 0, "must not change in game_over");
  });
});
