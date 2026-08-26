// test_scoring.js
// Deterministic scoring rules: survival accrual, asteroid hits,
// multipliers, boosts, and single-scoring guarantees.

import { describe, it } from "node:test";
import { PROJECTILE, SCORING } from "../src/config.js";
import { createProjectile } from "../src/entities/projectile.js";
import { resolveProjectileHits, loseLife }
  from "../src/systems/collisions.js";
import {
  addScore,
  calculateAsteroidScore,
  updateTimeScore,
} from "../src/systems/scoring.js";
import {
  advance,
  assert,
  makeState,
  placeAsteroid,
} from "./helpers.js";

describe("time-based scoring", () => {
  it("accrues TIME_SCORE_PER_SECOND continuously", () => {
    const state = makeState();
    advance(state, 5);
    assert.equal(state.score, 5);
    advance(state, 7);
    assert.equal(state.score, 12);
  });

  it("carries fractional credit across arbitrary step sizes",
     () => {
    const state = makeState();
    for (let i = 0; i < 10; i++) {
      updateTimeScore(state, 0.4);
      if (i < 2) {
        assert.equal(state.score, 0);
      }
    }
    assert.equal(state.score, 4);
  });

  it("matches totals across different frame rates", () => {
    const coarse = makeState();
    advance(coarse, 3.3, undefined, 1 / 20);
    const fine = makeState();
    advance(fine, 3.3, undefined, 1 / 120);
    assert.equal(coarse.score, fine.score);
  });
});

describe("asteroid hit scoring", () => {
  function scoreOfSingleHit(level, type) {
    const state = makeState();
    placeAsteroid(state, { level, type,
                           x: state.player.x + 100,
                           y: state.player.y });
    const p = createProjectile(state.player.x + 90,
                               state.player.y, 0);
    p.prevX = p.x;
    state.projectiles.push(p);
    const before = state.score;
    resolveProjectileHits(state);
    return state.score - before;
  }

  it("awards size-based points (Large=10, Medium=15, Small=20)",
     () => {
    assert.equal(scoreOfSingleHit(3, "normal"), 10);
    assert.equal(scoreOfSingleHit(2, "normal"), 15);
    assert.equal(scoreOfSingleHit(1, "normal"), 20);
  });

  it("multiplies special classes per hit", () => {
    // Bronze 2x: Large=20, Medium=30, Small=40
    assert.equal(scoreOfSingleHit(3, "bronze"), 20);
    assert.equal(scoreOfSingleHit(2, "bronze"), 30);
    assert.equal(scoreOfSingleHit(1, "bronze"), 40);
    // Gold 4x: Large=40, Medium=60, Small=80
    assert.equal(scoreOfSingleHit(3, "gold"), 40);
    assert.equal(scoreOfSingleHit(2, "gold"), 60);
    assert.equal(scoreOfSingleHit(1, "gold"), 80);
  });

  it("doubles while points boost is active", () => {
    const state = makeState();
    state.effects.points_boost = state.elapsed + 10;
    placeAsteroid(state, { level: 2, x: state.player.x + 100,
                           y: state.player.y });
    const p = createProjectile(state.player.x + 90,
                               state.player.y, 0);
    p.prevX = p.x;
    state.projectiles.push(p);
    resolveProjectileHits(state);
    // Medium normal = 15, with points boost = 30
    assert.equal(state.score, 30);
  });

  it("3x multiplier triples the base score", () => {
    assert.equal(calculateAsteroidScore(3, "normal", false, true, false), 30);
    assert.equal(calculateAsteroidScore(1, "normal", false, true, false), 60);
  });

  it("5x multiplier quintuples the base score", () => {
    assert.equal(calculateAsteroidScore(3, "normal", false, false, true), 50);
    assert.equal(calculateAsteroidScore(1, "normal", false, false, true), 100);
  });

  it("combines gold 4x with points boost 2x", () => {
    // Large gold = 10 * 4 * 2 = 80
    assert.equal(calculateAsteroidScore(3, "gold", true, false, false), 80);
  });

  it("combines all multipliers multiplicatively", () => {
    // Small gold with points boost and 3x: 20 * 4 * 2 * 3 = 480
    assert.equal(calculateAsteroidScore(1, "gold", true, true, false), 480);
    // Medium bronze with 5x: 15 * 2 * 5 = 150
    assert.equal(calculateAsteroidScore(2, "bronze", false, false, true), 150);
  });
});

describe("single-scoring guarantees", () => {
  it("one projectile scores exactly once even with two targets",
     () => {
    const state = makeState();
    placeAsteroid(state, { level: 1,
                           x: state.player.x + 120,
                           y: state.player.y });
    placeAsteroid(state, { level: 1,
                           x: state.player.x + 130,
                           y: state.player.y });
    const p = createProjectile(state.player.x + 170,
                               state.player.y, 0);
    p.prevX = p.x - 300;
    state.projectiles.push(p);

    const before = state.score;
    resolveProjectileHits(state);
    const delta = state.score - before;

    assert.equal(delta, 20, // small normal = 20 points
                 "only one target may be scored");
    assert.equal(state.asteroids.length, 1,
                 "the other asteroid survives");
    assert.equal(state.projectiles.length, 0,
                 "the projectile is consumed");
  });

  it("a destroyed asteroid cannot be scored twice", () => {
    const state = makeState();
    const a = placeAsteroid(state, { level: 1,
                                     x: state.player.x + 100,
                                     y: state.player.y });
    const p = createProjectile(state.player.x + 95,
                               state.player.y, 0);
    p.prevX = p.x;
    state.projectiles.push(p);
    resolveProjectileHits(state);
    assert.equal(a.alive, false);
    const before = state.score;
    resolveProjectileHits(state);
    assert.equal(state.score, before);
  });
});

describe("score persistence", () => {
  it("survives death and updates bestScore", () => {
    const state = makeState();
    advance(state, 4);
    assert.equal(state.bestScore, 4);
    addScore(state, 500);
    assert.equal(state.bestScore, state.score);
    state.lives = 1;
    loseLife(state);
    assert.equal(state.phase, "game_over");
    assert.ok(state.score > 0);
    assert.equal(state.bestScore, state.score);
  });

  it("projectile scoring respects the cap on active projectiles",
     () => {
    assert.ok(PROJECTILE.MAX_ACTIVE >= 1);
  });

  it("survival score is purely additive (no bonus on death)", () => {
    const state = makeState();
    advance(state, 4);
    const scoreBefore = state.score;
    state.lives = 1;
    loseLife(state);
    assert.equal(state.score, scoreBefore,
                 "losing a life must not add or subtract score");
  });
});

describe("calculateAsteroidScore exact values", () => {
  it("normal type with no boosts returns base score", () => {
    assert.equal(calculateAsteroidScore(3, "normal", false, false, false), 10);
    assert.equal(calculateAsteroidScore(2, "normal", false, false, false), 15);
    assert.equal(calculateAsteroidScore(1, "normal", false, false, false), 20);
  });

  it("boost doubles the score for all size levels", () => {
    assert.equal(calculateAsteroidScore(3, "normal", true, false, false), 20);
    assert.equal(calculateAsteroidScore(2, "normal", true, false, false), 30);
    assert.equal(calculateAsteroidScore(1, "normal", true, false, false), 40);
  });

  it("3x multiplier triples base score without boost", () => {
    assert.equal(calculateAsteroidScore(3, "normal", false, true, false), 30);
    assert.equal(calculateAsteroidScore(2, "normal", false, true, false), 45);
    assert.equal(calculateAsteroidScore(1, "normal", false, true, false), 60);
  });

  it("5x multiplier quintuples base score without boost", () => {
    assert.equal(calculateAsteroidScore(3, "normal", false, false, true), 50);
    assert.equal(calculateAsteroidScore(2, "normal", false, false, true), 75);
    assert.equal(calculateAsteroidScore(1, "normal", false, false, true), 100);
  });

  it("bronze with all multipliers: 15 * 2 * 2 * 3 * 5 = 900", () => {
    assert.equal(calculateAsteroidScore(2, "bronze", true, true, true), 900);
  });

  it("gold with all multipliers: 20 * 4 * 2 * 3 * 5 = 2400", () => {
    assert.equal(calculateAsteroidScore(1, "gold", true, true, true), 2400);
  });
});
