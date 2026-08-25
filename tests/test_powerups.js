// test_powerups.js
// Power-up scheduling, eligibility, collection, effect durations,
// and per-type behaviour.

import { describe, it } from "node:test";
import { BOARD, LIVES, POWERUP } from "../src/config.js";
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
    // One-second polls; the spawn lands on the first poll at or
    // after the rolled timer expiry.
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
    // Fill the field so spawns are blocked.
    placePowerUp(state, "speed_boost", 100, 100);
    placePowerUp(state, "rapid_fire", 800, 500);
    const max = POWERUP.SPAWN_INTERVAL + POWERUP.SPAWN_JITTER;
    // Force the timer to fire (slight overshoot exercises the
    // sub-frame remainder carry).
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
    // Simulate ~40 seconds; collect everything instantly each
    // step so any collection-triggered scheduling would distort
    // the cadence.
    for (let i = 0; i < 40; i++) {
      const before = state.powerups.length;
      updatePowerUpSpawning(state, 1);
      if (state.powerups.length > before) {
        spawns++;
        state.powerups.length = 0; // instant "collection"
      }
    }
    // Expect roughly 40 / 14 ~= 2-3 spawns; at least 2 proves the
    // timer keeps running after each spawn/collection cycle.
    assert.ok(spawns >= 2 && spawns <= 4, `spawns=${spawns}`);
  });

  it("spawn positions keep a minimum distance from the player",
     () => {
    const r = rng(31);
    const player = { x: BOARD.WIDTH / 2, y: BOARD.HEIGHT / 2 };
    // Reuse the internal position chooser via repeated scheduler
    // runs is heavy; test the distance invariant through the
    // public scheduler instead by forcing many rolls.
    for (let i = 0; i < 50; i++) {
      const state = makeState(1000 + i);
      state.player.x = player.x;
      state.player.y = player.y;
      state.powerUpTimer = 0.0001;
      updatePowerUpSpawning(state, 1);
      if (state.powerups.length === 0) {
        continue; // blocked roll (capacity/eligibility)
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
    assert.equal(weights.extra_life, POWERUP.WEIGHTS.extra_life);
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
    const duration = POWERUP.DURATIONS.speed_boost;
    assert.ok(effectActive(state, "speed_boost"));
    assert.ok(Math.abs(effectRemaining(state, "speed_boost") -
                       duration) < 1e-9);
    advance(state, duration - 0.5);
    assert.ok(effectActive(state, "speed_boost"));
    // One extra frame past the boundary: advance() quantises to
    // whole steps, and expiry is "at or after" the duration.
    advance(state, 0.5 + 1 / 60);
    assert.equal(effectActive(state, "speed_boost"), false);
  });

  it("expireEffects() removes expired entries from state", () => {
    const state = makeState();
    applyPowerUp(state, "points_boost");
    advance(state, POWERUP.DURATIONS.points_boost + 0.01);
    expireEffects(state);
    assert.equal(state.effects.points_boost, undefined);
  });

  it("each configured duration matches its config value", () => {
    const state = makeState();
    for (const [type, duration] of
         Object.entries(POWERUP.DURATIONS)) {
      const s = makeState();
      applyPowerUp(s, type);
      assert.ok(Math.abs(effectRemaining(s, type) - duration)
                < 1e-9, `${type} duration`);
    }
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
    // A projectile sweeping straight through its centre.
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
    // Freeze the spawner so no fresh power-ups confound the count.
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
    step(state, 1); // one whole second of slow movement
    const travelled = Math.abs(a.x - xBefore);
    const expected = 100 * POWERUP.SLOW_ASTEROID_FACTOR;
    assert.ok(Math.abs(travelled - expected) < 1e-6,
              `travelled=${travelled} expected=${expected}`);
    // Velocity is preserved so expiry restores full speed.
    assert.equal(a.vx, 100);

    // Newly spawned asteroids during the effect are slowed
    // identically (the factor is global).
    const b = placeAsteroid(state, { x: 500, y: 500,
                                     vx: 200, vy: 0 });
    const bx = b.x;
    step(state, 1);
    assert.ok(Math.abs((b.x - bx) - 200 *
                       POWERUP.SLOW_ASTEROID_FACTOR) < 1e-6);
  });

  it("slow asteroids expires and restores normal speed", () => {
    const state = makeState();
    applyPowerUp(state, "slow_asteroids");
    advance(state, POWERUP.DURATIONS.slow_asteroids + 0.01);
    assert.equal(effectActive(state, "slow_asteroids"), false);
    const a = placeAsteroid(state, { x: 200, y: 200,
                                     vx: 100, vy: 0 });
    const x0 = a.x;
    step(state, 1);
    assert.ok(Math.abs(a.x - (x0 + 100)) < 1e-6,
              "full speed restored after expiry");
  });

  it("protective border prevents life loss on collision",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    placeAsteroid(state, { x: state.player.x,
                           y: state.player.y });
    step(state, 1 / 60);
    assert.equal(state.lives, LIVES.MAX,
                 "no life lost under the border");
    // The border destroys the offending asteroid instead.
    assert.equal(state.asteroids.length, 2,
                 "split children replace the destroyed rock");
    assert.equal(state.score, 10, "border kill still scores");
  });

  it("protective border expires after its duration", () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    const duration = POWERUP.DURATIONS.protective_border;
    advance(state, duration - 0.5);
    assert.equal(effectActive(state, "protective_border"), true);
    advance(state, 0.5);
    assert.equal(effectActive(state, "protective_border"), false);
  });

  it("collisions cost lives normally once the border expires",
     () => {
    const state = makeState();
    applyPowerUp(state, "protective_border");
    advance(state, POWERUP.DURATIONS.protective_border + 0.05);
    loseLife(state);
    assert.equal(state.lives, LIVES.MAX - 1);
  });

  it("speed boost raises the ship's cruise speed", () => {
    // One second of held input from centre reaches cruise without
    // touching a wall (walls zero the into-wall velocity).
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

  /**
   * Hold right for n frames on a state.
   *
   * Args:
   *     state: Game state.
   *     frames: Number of 1/60s steps.
   */
  function runRight(state, frames) {
    for (let i = 0; i < frames; i++) {
      step(state, 1 / 60, { up: false, down: false, left: false,
                            right: true, fire: false });
    }
  }

  it("points boost lasts its configured 15 seconds", () => {
    const state = makeState();
    applyPowerUp(state, "points_boost");
    advance(state, POWERUP.DURATIONS.points_boost - 0.5);
    assert.ok(effectActive(state, "points_boost"));
    advance(state, 0.5);
    assert.equal(effectActive(state, "points_boost"), false);
  });
});
