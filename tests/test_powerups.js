// test_powerups.js
// Power-up scheduling, eligibility, collection, effect durations,
// and per-type behaviour.

import { describe, it } from "node:test";
import { BOARD, LIVES, POWERUP, POWERUP_TYPES } from "../src/config.js";
import {
  applyPowerUp,
  collectPowerUps,
  eligibleWeights,
  effectActive,
  effectRemaining,
  expireEffects,
  powerUpTimerRoll,
  updatePowerUpSpawning,
} from "../src/systems/powerups.js";
import { resolveProjectileHits, loseLife }
  from "../src/systems/collisions.js";
import {
  advance,
  assert,
  makeState,
  placeAsteroid,
  placePowerUp,
  rng,
  step,
} from "./helpers.js";

describe("power-up spawn scheduling", () => {
  it("spawns on an independent timer within the jitter window",
     () => {
    const state = makeState();
    const min = POWERUP.SPAWN_INTERVAL - POWERUP.SPAWN_JITTER;
    const max = POWERUP.SPAWN_INTERVAL + POWERUP.SPAWN_JITTER;
    let spawnedAt = -1;
    for (let t = 1; t <= max + 1 && spawnedAt < 0; t++) {
      const before = state.powerups.length;
      updatePowerUpSpawning(state, 1);
      if (state.powerups.length > before) {
        spawnedAt = t;
      }
    }
    assert.ok(spawnedAt >= min && spawnedAt <= max,
              `first spawn at ${spawnedAt}s, ` +
              `expected within [${min}, ${max}]`);
  });

  it("reloads the schedule even when nothing spawns (at capacity)",
     () => {
    const state = makeState();
    placePowerUp(state, "speed_boost", 100, 100);
    placePowerUp(state, "rapid_fire", 800, 500);
    const max = POWERUP.SPAWN_INTERVAL + POWERUP.SPAWN_JITTER;
    state.powerUpTimer = 0.0001;
    updatePowerUpSpawning(state, 1);
    assert.equal(state.powerups.length, 2,
                 "no third power-up may spawn");
    assert.ok(state.powerUpTimer > 0 && state.powerUpTimer <= max,
              `timer reloaded to ${state.powerUpTimer}`);
  });

  it("keeps spawning on cadence independent of collection", () => {
    const state = makeState();
    let spawns = 0;
    for (let i = 0; i < 40; i++) {
      const before = state.powerups.length;
      updatePowerUpSpawning(state, 1);
      if (state.powerups.length > before) {
        spawns++;
        state.powerups.length = 0;
      }
    }
    assert.ok(spawns >= 2 && spawns <= 4, `spawns=${spawns}`);
  });

  it("spawn positions keep a minimum distance from the player",
     () => {
    const r = rng(31);
    const player = { x: BOARD.WIDTH / 2, y: BOARD.HEIGHT / 2 };
    for (let i = 0; i < 50; i++) {
      const state = makeState(1000 + i);
      state.player.x = player.x;
      state.player.y = player.y;
      state.powerUpTimer = 0.0001;
      updatePowerUpSpawning(state, 1);
      if (state.powerups.length === 0) {
        continue;
      }
      const p = state.powerups[state.powerups.length - 1];
      const dx = p.x - state.player.x;
      const dy = p.y - state.player.y;
      assert.ok(Math.sqrt(dx * dx + dy * dy) >=
                POWERUP.MIN_PLAYER_DISTANCE - 1e-6);
    }
  });
});

describe("power-up eligibility", () => {
  it("extra life is ineligible at full lives", () => {
    const state = makeState();
    assert.equal(state.lives, LIVES.MAX);
    const weights = eligibleWeights(state);
    assert.equal(weights.extra_life, undefined);
  });

  it("extra life becomes eligible below full lives", () => {
    const state = makeState();
    state.lives = LIVES.MAX - 1;
    const weights = eligibleWeights(state);
    assert.ok(weights.extra_life > 0, "extra life should have weight");
  });

  it("only one extra life may exist on the field at a time",
     () => {
    const state = makeState();
    state.lives = LIVES.MAX - 1;
    placePowerUp(state, "extra_life", 200, 200);
    const weights = eligibleWeights(state);
    assert.equal(weights.extra_life, undefined,
                 "a second extra life must not be spawnable");
  });

  it("active effect prevents same power-up from spawning", () => {
    const state = makeState();
    state.effects.speed_boost = state.elapsed + 10;
    const weights = eligibleWeights(state);
    assert.equal(weights.speed_boost, undefined,
                 "active speed_boost blocks new speed_boost");
  });

  it("board presence prevents same power-up from spawning",
     () => {
    const state = makeState();
    placePowerUp(state, "rapid_fire", 300, 200);
    const weights = eligibleWeights(state);
    assert.equal(weights.rapid_fire, undefined,
                 "rapid_fire on board blocks new rapid_fire");
  });

  it("3x power-up is locked before its unlock time", () => {
    const state = makeState();
    state.elapsed = 30; // before 60s unlock
    const weights = eligibleWeights(state);
    assert.equal(weights.score_3x, undefined,
                 "3x must be locked early");
  });

  it("3x power-up becomes available after unlock time", () => {
    const state = makeState();
    state.elapsed = 70; // after 60s unlock
    const weights = eligibleWeights(state);
    assert.ok(weights.score_3x > 0, "3x should be available");
  });

  it("5x power-up is locked before 3x unlocks", () => {
    const state = makeState();
    state.elapsed = 100; // after 3x (60s) but before 5x (120s)
    const weights = eligibleWeights(state);
    assert.equal(weights.score_5x, undefined,
                 "5x must be locked before 120s");
  });

  it("5x power-up becomes available after its unlock time", () => {
    const state = makeState();
    state.elapsed = 130; // after 120s
    const weights = eligibleWeights(state);
    assert.ok(weights.score_5x > 0, "5x should be available");
  });

  it("5x weight is less than 3x weight (rarer)", () => {
    const state = makeState();
    state.elapsed = 150; // both unlocked
    const weights = eligibleWeights(state);
    assert.ok(weights.score_5x < weights.score_3x,
              `5x=${weights.score_5x} 3x=${weights.score_3x}`);
  });

  it("spawn frequency scales with elapsed time", () => {
    const early = makeState();
    early.elapsed = 0;
    const earlyWeights = eligibleWeights(early);

    const late = makeState();
    late.elapsed = 600;
    const lateWeights = eligibleWeights(late);

    // At 600s, freqScale = 1 + 600/600 = 2.0
    const ratio = lateWeights.speed_boost / earlyWeights.speed_boost;
    assert.ok(Math.abs(ratio - 2.0) < 0.01,
              `frequency ratio=${ratio}`);
  });
});

describe("power-up application", () => {
  it("extra life grants exactly one life", () => {
    const state = makeState();
    state.lives = 1;
    applyPowerUp(state, "extra_life");
    assert.equal(state.lives, 2);
  });

  it("extra life can never exceed MAX_LIVES", () => {
    const state = makeState();
    assert.equal(state.lives, LIVES.MAX);
    applyPowerUp(state, "extra_life");
    assert.equal(state.lives, LIVES.MAX);
  });

  it("timed effects expire exactly after their duration",
     () => {
    const state = makeState();
    applyPowerUp(state, "speed_boost");
    const duration = POWERUP_TYPES.speed_boost.duration;
    assert.ok(effectActive(state, "speed_boost"));
    assert.ok(Math.abs(effectRemaining(state, "speed_boost") -
                       duration) < 1e-9);
    advance(state, duration - 0.5);
    assert.ok(effectActive(state, "speed_boost"));
    advance(state, 0.5 + 1 / 60);
    assert.equal(effectActive(state, "speed_boost"), false);
  });

  it("expireEffects() removes expired entries from state", () => {
    const state = makeState();
    applyPowerUp(state, "points_boost");
    advance(state, POWERUP_TYPES.points_boost.duration + 0.01);
    expireEffects(state);
    assert.equal(state.effects.points_boost, undefined);
  });

  it("each configured duration matches its POWERUP_TYPES value",
     () => {
    for (const [type, def] of Object.entries(POWERUP_TYPES)) {
      if (def.duration <= 0) {
        continue; // skip instant effects
      }
      const s = makeState();
      applyPowerUp(s, type);
      assert.ok(Math.abs(effectRemaining(s, type) - def.duration)
                < 1e-9, `${type} duration`);
    }
  });

  it("shield lasts 10 seconds", () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    assert.equal(POWERUP_TYPES.protective_border.duration, 10);
    advance(state, 9);
    assert.ok(effectActive(state, "protective_border"));
    advance(state, 1.5);
    assert.equal(effectActive(state, "protective_border"), false);
  });

  it("3x lasts 8 seconds", () => {
    const state = makeState();
    applyPowerUp(state, "score_3x");
    assert.equal(POWERUP_TYPES.score_3x.duration, 8);
    advance(state, 7.5);
    assert.ok(effectActive(state, "score_3x"));
    advance(state, 1);
    assert.equal(effectActive(state, "score_3x"), false);
  });

  it("5x lasts 6 seconds", () => {
    const state = makeState();
    applyPowerUp(state, "score_5x");
    assert.equal(POWERUP_TYPES.score_5x.duration, 6);
    advance(state, 5.5);
    assert.ok(effectActive(state, "score_5x"));
    advance(state, 1);
    assert.equal(effectActive(state, "score_5x"), false);
  });
});

describe("power-up collection", () => {
  it("requires physical contact with the ship", () => {
    const state = makeState();
    const far = placePowerUp(state, "speed_boost",
                             BOARD.WIDTH - 60, 60);
    step(state, 1 / 60);
    assert.equal(state.powerups.includes(far), true,
                 "distant power-ups stay put");
    assert.equal(effectActive(state, "speed_boost"), false);
  });

  it("collects and applies on ship overlap", () => {
    const state = makeState();
    placePowerUp(state, "slow_asteroids",
                 state.player.x + 5, state.player.y);
    step(state, 1 / 60);
    assert.equal(state.powerups.length, 0);
    assert.equal(effectActive(state, "slow_asteroids"), true);
  });

  it("cannot be destroyed or triggered by projectiles", () => {
    const state = makeState();
    const pu = placePowerUp(state, "points_boost",
                            BOARD.WIDTH / 2, 300);
    const projectile = {
      x: pu.x - 30,
      y: pu.y,
      prevX: pu.x - 30,
      prevY: pu.y,
      vx: 600,
      vy: 0,
      angle: 0,
      radius: 3,
      age: 0,
      alive: true,
    };
    state.projectiles.push(projectile);
    resolveProjectileHits(state);
    assert.equal(state.powerups.includes(pu), true,
                 "projectiles must not destroy power-ups");
  });

  it("uncollected power-ups expire after their field lifetime",
     () => {
    const state = makeState();
    placePowerUp(state, "rapid_fire", 400, 300);
    state.powerUpTimer = Infinity;
    advance(state, 1);
    assert.equal(state.powerups.length, 1,
                 "still fresh after one second");
    advance(state, POWERUP.LIFETIME + 1);
    assert.equal(state.powerups.length, 0,
                 "stale power-ups must disappear");
  });

  it("slow asteroids scales asteroid displacement while active",
     () => {
    const state = makeState();
    const a = placeAsteroid(state, { x: 200, y: 200,
                                     vx: 100, vy: 0 });
    applyPowerUp(state, "slow_asteroids");
    const xBefore = a.x;
    step(state, 1);
    const travelled = Math.abs(a.x - xBefore);
    const expected = 100 * POWERUP.SLOW_ASTEROID_FACTOR;
    assert.ok(Math.abs(travelled - expected) < 1e-6,
              `travelled=${travelled} expected=${expected}`);
    assert.equal(a.vx, 100);
  });

  it("slow asteroids expires and restores normal speed", () => {
    const state = makeState();
    applyPowerUp(state, "slow_asteroids");
    advance(state, POWERUP_TYPES.slow_asteroids.duration + 0.01);
    assert.equal(effectActive(state, "slow_asteroids"), false);
    const a = placeAsteroid(state, { x: 200, y: 200,
                                     vx: 100, vy: 0 });
    const x0 = a.x;
    step(state, 1);
    assert.ok(Math.abs(a.x - (x0 + 100)) < 1e-6,
              "full speed restored after expiry");
  });

  it("protective border prevents life loss on collision", () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    const beforeCount = state.asteroids.length;
    step(state, 1 / 60);
    assert.equal(state.lives, LIVES.MAX,
                 "no life lost under the border");
  });

  it("shield destroys asteroids on contact and awards points",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    const a = placeAsteroid(state, { x: state.player.x,
                                     y: state.player.y,
                                     level: 3, type: "normal" });
    const before = state.score;
    step(state, 1 / 60);
    // The asteroid should be destroyed immediately
    assert.equal(a.alive, false,
                 "asteroid must be destroyed by shield contact");
    // Normal hit score should be awarded (large normal = 10)
    assert.ok(state.score > before,
              "shield must award hit points on destruction");
  });

  it("shield awards normal hit score on asteroid destruction",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    const before = state.score;
    step(state, 1 / 60);
    assert.ok(state.score > before,
              "shield must score on asteroid destruction");
  });

  it("shield splits large asteroids into two medium children",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y, level: 3 });
    step(state, 1 / 60);
    // Should have 2 medium children (level 2)
    const mediums = state.asteroids.filter((a) => a.level === 2);
    assert.equal(mediums.length, 2,
                 "large asteroid must split into two mediums");
  });

  it("shield destroys small asteroids outright with no children",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y, level: 1 });
    step(state, 1 / 60);
    // No children should remain from a small asteroid
    const children = state.asteroids.filter((a) =>
      a.x === state.player.x && a.y === state.player.y);
    assert.equal(children.length, 0,
                 "small asteroid must not produce children");
  });

  it("protective border expires after its duration", () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    const duration = POWERUP_TYPES.protective_border.duration;
    advance(state, duration - 0.5);
    assert.equal(effectActive(state, "protective_border"), true);
    advance(state, 0.5);
    assert.equal(effectActive(state, "protective_border"), false);
  });

  it("collisions cost lives normally once the border expires",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    advance(state, POWERUP_TYPES.protective_border.duration + 0.05);
    loseLife(state);
    assert.equal(state.lives, LIVES.MAX - 1);
  });

  it("speed boost raises the ship's cruise speed", () => {
    const boosted = makeState();
    applyPowerUp(boosted, "speed_boost");
    runRight(boosted, 60);
    const plain = makeState();
    runRight(plain, 60);
    const speedOf = (s) => Math.sqrt(s.player.vx ** 2 +
                                     s.player.vy ** 2);
    assert.ok(speedOf(boosted) > speedOf(plain) * 1.3,
              `boosted=${speedOf(boosted)} ` +
              `plain=${speedOf(plain)}`);
  });

  function runRight(state, frames) {
    for (let i = 0; i < frames; i++) {
      step(state, 1 / 60, { up: false, down: false, left: false,
                            right: true, fire: false });
    }
  }

  it("points boost lasts its configured 10 seconds", () => {
    const state = makeState();
    applyPowerUp(state, "points_boost");
    advance(state, POWERUP_TYPES.points_boost.duration - 0.5);
    assert.ok(effectActive(state, "points_boost"));
    advance(state, 0.5);
    assert.equal(effectActive(state, "points_boost"), false);
  });

  it("score_3x activates and applies correctly", () => {
    const state = makeState();
    applyPowerUp(state, "score_3x");
    assert.ok(effectActive(state, "score_3x"));
    assert.equal(effectRemaining(state, "score_3x"),
                 POWERUP_TYPES.score_3x.duration);
  });

  it("score_5x activates and applies correctly", () => {
    const state = makeState();
    applyPowerUp(state, "score_5x");
    assert.ok(effectActive(state, "score_5x"));
    assert.equal(effectRemaining(state, "score_5x"),
                 POWERUP_TYPES.score_5x.duration);
  });
});
