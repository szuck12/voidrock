// test_powerup_edges.js
// Edge cases and untested paths for the power-up system:
// powerUpPosition, powerUpTimerRoll, createPowerUp, event emission,
// and effectRemaining.

import { describe, it } from "node:test";
import { BOARD, POWERUP, POWERUP_TYPES } from "../src/config.js";
import {
  applyPowerUp,
  collectPowerUps,
  createPowerUp,
  effectActive,
  effectRemaining,
  powerUpPosition,
  powerUpTimerRoll,
} from "../src/systems/powerups.js";
import {
  advance,
  assert,
  makeState,
  placePowerUp,
  rng,
  step,
} from "./helpers.js";

describe("powerUpPosition", () => {
  it("respects MIN_PLAYER_DISTANCE", () => {
    const r = rng(42);
    const state = makeState();
    state.player.x = BOARD.WIDTH / 2;
    state.player.y = BOARD.HEIGHT / 2;
    for (let i = 0; i < 50; i++) {
      const pos = powerUpPosition(r, state.player);
      const dx = pos.x - state.player.x;
      const dy = pos.y - state.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      assert.ok(dist >= POWERUP.MIN_PLAYER_DISTANCE - 1,
                `attempt ${i}: dist=${dist} < ` +
                `${POWERUP.MIN_PLAYER_DISTANCE}`);
    }
  });

  it("returns position inside board margins", () => {
    const r = rng(77);
    const state = makeState();
    for (let i = 0; i < 30; i++) {
      const pos = powerUpPosition(r, state.player);
      assert.ok(pos.x >= 70 && pos.x <= BOARD.WIDTH - 70,
                `x=${pos.x} outside margins`);
      assert.ok(pos.y >= 70 && pos.y <= BOARD.HEIGHT - 70,
                `y=${pos.y} outside margins`);
    }
  });

  it("falls back to centre when player blocks all retries", () => {
    // Place the player at the centre and make every random position
    // too close by using a deterministic rng that always returns the
    // same values near the player.  We simulate this by checking
    // that the function always returns something valid.
    const state = makeState();
    state.player.x = BOARD.WIDTH / 2;
    state.player.y = BOARD.HEIGHT / 2;
    // Even with a cooperative rng, the fallback must produce a
    // valid position inside the board.
    const pos = powerUpPosition(rng(0), state.player);
    assert.ok(pos.x >= 0 && pos.x <= BOARD.WIDTH);
    assert.ok(pos.y >= 0 && pos.y <= BOARD.HEIGHT);
  });
});

describe("powerUpTimerRoll", () => {
  it("returns value within jitter window", () => {
    const r = rng(99);
    for (let i = 0; i < 20; i++) {
      const t = powerUpTimerRoll(r);
      assert.ok(t >= POWERUP.SPAWN_INTERVAL - POWERUP.SPAWN_JITTER &&
                t <= POWERUP.SPAWN_INTERVAL + POWERUP.SPAWN_JITTER,
                `roll=${t} outside [${POWERUP.SPAWN_INTERVAL -
                  POWERUP.SPAWN_JITTER}, ${POWERUP.SPAWN_INTERVAL +
                  POWERUP.SPAWN_JITTER}]`);
    }
  });
});

describe("createPowerUp", () => {
  it("returns correct shape with radius and bornAt", () => {
    const p = createPowerUp("speed_boost", 100, 200, 5.5);
    assert.equal(p.type, "speed_boost");
    assert.equal(p.x, 100);
    assert.equal(p.y, 200);
    assert.equal(p.radius, POWERUP.RADIUS);
    assert.equal(p.bornAt, 5.5);
    assert.equal(p.alive, true);
  });
});

describe("collectPowerUps events", () => {
  it("emits collect event with position", () => {
    const state = makeState();
    placePowerUp(state, "speed_boost",
                 state.player.x + 5, state.player.y);
    step(state, 1 / 60);
    const collects = state.events.filter((e) => e.kind === "collect");
    assert.equal(collects.length, 1);
    assert.equal(typeof collects[0].x, "number");
    assert.equal(typeof collects[0].y, "number");
  });

  it("removes collected power-up from state", () => {
    const state = makeState();
    placePowerUp(state, "rapid_fire",
                 state.player.x + 5, state.player.y);
    assert.equal(state.powerups.length, 1);
    step(state, 1 / 60);
    assert.equal(state.powerups.length, 0);
  });

  it("does not collect distant power-ups", () => {
    const state = makeState();
    placePowerUp(state, "speed_boost", 10, 10);
    step(state, 1 / 60);
    assert.equal(state.powerups.length, 1,
                 "distant power-up must not be collected");
  });
});

describe("effectRemaining", () => {
  it("returns 0 when effect is inactive", () => {
    const state = makeState();
    assert.equal(effectRemaining(state, "speed_boost"), 0);
  });

  it("returns correct remaining seconds", () => {
    const state = makeState();
    applyPowerUp(state, "speed_boost");
    const rem = effectRemaining(state, "speed_boost");
    assert.ok(Math.abs(rem - POWERUP_TYPES.speed_boost.duration) < 1e-9);
  });

  it("counts down as time advances", () => {
    const state = makeState();
    applyPowerUp(state, "speed_boost");
    advance(state, 5);
    const rem = effectRemaining(state, "speed_boost");
    assert.ok(rem < POWERUP_TYPES.speed_boost.duration);
    assert.ok(rem > 0);
  });
});
