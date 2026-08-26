// test_game_flow.js
// Whole-game flow: phases, lives and death, game-over gating,
// restart semantics, pause, and end-to-end survival scoring.

import { describe, it } from "node:test";
import { BOARD, LIVES, POWERUP } from "../src/config.js";
import { createInitialState, startNewRun, stepGame, togglePause }
  from "../src/game.js";
import { resolvePlayerCollisions }
  from "../src/systems/collisions.js";
import {
  advance,
  assert,
  makeState,
  placeAsteroid,
  step,
} from "./helpers.js";

describe("game start", () => {
  it("begins in the menu phase with a fresh state", () => {
    const s = createInitialState({ seed: 9 });
    assert.equal(s.phase, "menu");
    assert.equal(s.score, 0);
    assert.equal(s.lives, LIVES.STARTING);
    assert.equal(s.asteroids.length, 0);
  });

  it("startNewRun moves to playing and resets run state", () => {
    const s = createInitialState({ seed: 9, bestScore: 40 });
    startNewRun(s);
    assert.equal(s.phase, "playing");
    assert.equal(s.lives, LIVES.STARTING);
    assert.equal(s.elapsed, 0);
    assert.equal(s.bestScore, 40);
  });
});

describe("lives and death", () => {
  it("loses exactly one life per collision", () => {
    const state = makeState();
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    resolvePlayerCollisions(state);
    assert.equal(state.lives, LIVES.MAX - 1);
  });

  it("invulnerability prevents instant multi-life loss", () => {
    const state = makeState();
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    resolvePlayerCollisions(state);
    assert.ok(state.player.invulnerableFor > 0);
    // Same overlapping asteroid still there; second call is safe.
    resolvePlayerCollisions(state);
    assert.equal(state.lives, LIVES.MAX - 1);
  });

  it("reaches game over only when the last life is lost", () => {
    // With two or one lives remaining a collision must keep
    // playing; only the transition to zero ends the run.
    for (const startingLives of [2, 3]) {
      const state = makeState();
      state.lives = startingLives;
      placeAsteroid(state, { x: state.player.x,
                             y: state.player.y });
      resolvePlayerCollisions(state);
      assert.equal(state.phase, "playing");
      assert.equal(state.lives, startingLives - 1);
    }

    const final = makeState();
    final.lives = 1;
    placeAsteroid(final, { x: final.player.x, y: final.player.y });
    resolvePlayerCollisions(final);
    assert.equal(final.phase, "game_over");
    assert.equal(final.lives, 0);
  });

  it("death repositions the ship to the respawn point", () => {
    const state = makeState();
    state.player.x = BOARD.WIDTH - 30;
    state.player.invulnerableFor = 0;
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    resolvePlayerCollisions(state);
    assert.equal(state.player.x, state.respawnX);
    assert.equal(state.player.y, state.respawnY);
    assert.equal(state.player.vx, 0);
    assert.equal(state.player.vy, 0);
  });
});

describe("game over", () => {
  it("freezes gameplay systems at zero lives", () => {
    const state = makeState();
    advance(state, 3); // some score and elapsed time
    state.lives = 1;
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    step(state, 1 / 60); // collision -> game over this step

    assert.equal(state.phase, "game_over");
    const frozenScore = state.score;
    const frozenElapsed = state.elapsed;
    const asteroidCount = state.asteroids.length;

    advance(state, 5);
    assert.equal(state.score, frozenScore);
    assert.equal(state.elapsed, frozenElapsed);
    assert.equal(state.asteroids.length, asteroidCount);
  });

  it("restart resets the run but keeps the best score", () => {
    const state = makeState(1234, 100);
    advance(state, 6); // +6 survival score
    addScorePoints(state, 250); // best becomes 256
    state.effects.speed_boost = state.elapsed + 5;
    state.powerups.push(makePowerUpStub(state));

    startNewRun(state);

    assert.equal(state.phase, "playing");
    assert.equal(state.score, 0);
    assert.equal(state.lives, LIVES.STARTING);
    assert.equal(state.elapsed, 0);
    assert.equal(state.asteroids.length, 0);
    assert.equal(state.projectiles.length, 0);
    assert.equal(state.powerups.length, 0);
    assert.deepEqual(state.effects, {});
    // Best score is session-persistent across restarts.
    assert.equal(state.bestScore, 256);
  });

  /**
   * Add points through the public scoring path.
   *
   * Args:
   *     state: Game state.
   *     points: Points to add.
   */
  function addScorePoints(state, points) {
    state.score += points;
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
    }
  }

  /**
   * Build a minimal power-up stub for reset checks.
   *
   * Args:
   *     state: Game state providing elapsed/rng context.
   *
   * Returns:
   *     Power-up-like object.
   */
  function makePowerUpStub(state) {
    return { type: "speed_boost", x: 10, y: 10,
             radius: POWERUP.RADIUS, bornAt: state.elapsed,
             alive: true };
  }
});

describe("pause", () => {
  it("toggles between playing and paused", () => {
    const state = makeState();
    togglePause(state);
    assert.equal(state.phase, "paused");
    togglePause(state);
    assert.equal(state.phase, "playing");
  });

  it("pausing freezes elapsed time and spawning", () => {
    const state = makeState();
    togglePause(state);
    const before = state.elapsed;
    advance(state, 2);
    assert.equal(state.elapsed, before);
    togglePause(state);
    advance(state, 2);
    assert.ok(state.elapsed > before);
  });
});

describe("survival integration", () => {
  it("a hands-off run accrues time score and asteroids arrive",
     () => {
    const state = makeState();
    advance(state, 20);
    // Time score accrues regardless of dodging skill; collisions
    // never subtract.
    assert.ok(state.score >= 18,
              `score=${state.score} (collisions may have ended ` +
              "time accrual)");
    assert.ok(state.asteroids.length > 0 || state.spawnTimer < 2.4,
              "spawning must be underway");
  });

  it("long runs keep entity counts bounded", () => {
    const state = makeState();
    // Keep the ship permanently invulnerable so this test
    // exercises entity bookkeeping, not dodge skill.
    for (let i = 0; i < Math.round(90 * 60); i++) {
      state.player.invulnerableFor = 1;
      stepGame(state, { up: false, down: false, left: false,
                        right: false, fire: false }, 1 / 60);
    }
    assert.ok(state.projectiles.length <= 41);
    assert.ok(state.particles.length <= 320);
    assert.ok(state.asteroids.length <= 32,
              `asteroids=${state.asteroids.length}`);
    assert.equal(state.phase, "playing",
                 "invulnerable ships cannot die");
  });

  it("stepGame ignores input when not playing", () => {
    const state = createInitialState({ seed: 5 });
    const input = { up: true, down: true, left: true,
                    right: true, fire: true };
    stepGame(state, input, 1 / 60);
    assert.equal(state.phase, "menu");
    assert.equal(state.projectiles.length, 0);
  });
});

describe("restart exact state", () => {
  it("restart sets elapsed to zero", () => {
    const state = makeState();
    advance(state, 20);
    startNewRun(state);
    assert.equal(state.elapsed, 0);
  });

  it("restart sets spawnTimer to initial value", () => {
    const state = makeState();
    advance(state, 20);
    const depleted = state.spawnTimer;
    startNewRun(state);
    assert.ok(state.spawnTimer > depleted,
              `spawnTimer ${state.spawnTimer} should be > ` +
              `depleted value ${depleted}`);
  });

  it("restart clears projectiles array", () => {
    const state = makeState();
    state.projectiles.push({ x: 100, y: 100, vx: 10, vy: 0 });
    state.projectiles.push({ x: 200, y: 200, vx: 0, vy: 10 });
    startNewRun(state);
    assert.equal(state.projectiles.length, 0);
  });

  it("restart clears events array", () => {
    const state = makeState();
    state.events.push({ kind: "death", x: 100, y: 100 });
    startNewRun(state);
    assert.equal(state.events.length, 0);
  });

  it("restart clears particles array", () => {
    const state = makeState();
    state.particles.push({ x: 50, y: 50, vx: 10, vy: 10,
                           age: 0, lifetime: 1, colorKey: "normal" });
    startNewRun(state);
    assert.equal(state.particles.length, 0);
  });
});
