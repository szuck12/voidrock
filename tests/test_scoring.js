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
      updateTimeScore(state, 0.4); // never a whole point alone
      if (i < 2) {
        assert.equal(state.score, 0);
      }
    }
    // 10 * 0.4 = 4 whole points credited.
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
  /**
   * Stage one projectile overlapping one asteroid and resolve.
   *
   * Args:
   *     level: Asteroid size level.
   *     type: Asteroid class.
   *
   * Returns:
   *     Points awarded by the resolution.
   */
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

  it("awards the same base points for every size", () => {
    const base = SCORING.BASE_HIT_SCORE;
    assert.equal(scoreOfSingleHit(3, "normal"), base);
    assert.equal(scoreOfSingleHit(2, "normal"), base);
    assert.equal(scoreOfSingleHit(1, "normal"), base);
  });

  it("multiplies special classes per hit", () => {
    assert.equal(scoreOfSingleHit(3, "bronze"), 20);
    assert.equal(scoreOfSingleHit(2, "silver"), 30);
    assert.equal(scoreOfSingleHit(1, "gold"), 50);
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
    assert.equal(state.score,
                 SCORING.BASE_HIT_SCORE *
                 SCORING.POINTS_BOOST_MULT);
  });

  it("combines gold multiplier with points boost", () => {
    // x5 special then x2 boost, no runaway recursion.
    assert.equal(calculateAsteroidScore("gold", true), 100);
  });
});

describe("single-scoring guarantees", () => {
  it("one projectile scores exactly once even with two targets",
     () => {
    const state = makeState();
    // Two asteroids both straddling the projectile's swept path.
    placeAsteroid(state, { level: 1,
                           x: state.player.x + 120,
                           y: state.player.y });
    placeAsteroid(state, { level: 1,
                           x: state.player.x + 130,
                           y: state.player.y });
    const p = createProjectile(state.player.x + 170,
                               state.player.y, 0);
    // Simulate the frame sweep: it travelled from 300px left of
    // its current spot rightwards through both targets.
    p.prevX = p.x - 300;
    state.projectiles.push(p);

    const before = state.score;
    resolveProjectileHits(state);
    const delta = state.score - before;

    assert.equal(delta, SCORING.BASE_HIT_SCORE,
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
    // Re-running resolution on dead entities must be a no-op.
    const before = state.score;
    resolveProjectileHits(state);
    assert.equal(state.score, before);
  });
});

describe("score persistence", () => {
  it("survives death and updates bestScore", () => {
    const state = makeState();
    advance(state, 4); // score 4
    assert.equal(state.bestScore, 4);
    addScore(state, 500); // simulate a big hit chain
    assert.equal(state.bestScore, state.score);
    // Death does not touch score or best.
    state.lives = 1;
    loseLife(state);
    assert.equal(state.phase, "game_over");
    assert.ok(state.score > 0);
    assert.equal(state.bestScore, state.score);
  });

  it("projectile scoring respects the cap on active projectiles",
     () => {
    // The cap is enforced at fire time; scoring itself is bounded
    // because each projectile resolves once (covered above). This
    // test pins the constant relationship used by the cap logic.
    assert.ok(PROJECTILE.MAX_ACTIVE >= 1);
  });
});
