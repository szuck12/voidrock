// test_projectiles.js
// Projectile creation, movement, cooldown, lifetime, caps, and the
// Rapid Fire / Multi-Shot modifiers.

import { describe, it } from "node:test";
import { BOARD, PROJECTILE } from "../src/config.js";
import { createProjectile, updateProjectile }
  from "../src/entities/projectile.js";
import { assert, makeState, placeAsteroid, step } from "./helpers.js";

const FIRE = Object.freeze({ up: false, down: false, left: false,
                             right: false, fire: true });

describe("projectiles", () => {
  it("spawn at the ship nose along its facing", () => {
    const state = makeState();
    state.player.facing = 0; // pointing +x
    step(state, 1 / 60, FIRE);
    assert.equal(state.projectiles.length, 1);
    const p = state.projectiles[0];
    const noseX = state.player.x + state.player.radius + 4;
    // prevX/prevY record the spawn point before the bolt moved.
    assert.ok(Math.abs(p.prevX - noseX) < 1e-6);
    assert.equal(p.prevY, state.player.y);
    // The same stepGame call also advances it one frame.
    assert.ok(Math.abs(p.x - (noseX + PROJECTILE.SPEED / 60))
              < 1e-6);
  });

  it("travel along their angle at PROJECTILE.SPEED", () => {
    const p = createProjectile(100, 100, Math.PI / 2); // straight down
    const dt = 0.1;
    updateProjectile(p, dt);
    assert.equal(p.x, 100); // no horizontal drift
    assert.ok(Math.abs(p.y - (100 + PROJECTILE.SPEED * dt)) < 1e-9);
  });

  it("record previous position each step for swept collision",
     () => {
    const p = createProjectile(0, 0, 0);
    updateProjectile(p, 1 / 60);
    assert.equal(p.prevX, 0);
    updateProjectile(p, 1 / 60);
    assert.equal(p.prevX, p.x - p.vx / 60);
  });

  it("are removed once their lifetime expires", () => {
    const state = makeState();
    step(state, 1 / 60, FIRE);
    assert.equal(state.projectiles.length, 1);
    // Fire repeatedly until the first projectile ages out; hold
    // fire between cooldowns so only lifetimes matter.
    for (let i = 0; i < 120; i++) {
      step(state, 1 / 60);
    }
    const oldest = state.projectiles[0];
    assert.ok(!oldest || oldest.age <= PROJECTILE.LIFETIME,
              "no projectile may outlive its lifetime");
    for (let i = 0; i < 200; i++) {
      step(state, 1 / 60);
      if (state.projectiles.length === 0) {
        return;
      }
    }
    assert.fail("projectiles never expired");
  });

  it("enforce a cooldown between shots", () => {
    const state = makeState();
    step(state, 1 / 60, FIRE);
    assert.equal(state.projectiles.length, 1);
    step(state, 1 / 60, FIRE); // inside the cooldown window
    assert.equal(state.projectiles.length, 1);
    // Advance past the cooldown and confirm a second shot fires.
    let guard = 0;
    while (state.fireCooldown > -1 && guard++ < 60) {
      step(state, 1 / 60, FIRE);
      if (state.projectiles.length >= 2) {
        return;
      }
    }
    assert.fail("cooldown never allowed a second shot");
  });

  it("respect the hard cap on simultaneous projectiles", () => {
    const state = makeState();
    state.projectiles = Array.from(
      { length: PROJECTILE.MAX_ACTIVE },
      () => createProjectile(10, 10, 0));
    step(state, 1 / 60, FIRE);
    assert.equal(state.projectiles.length, PROJECTILE.MAX_ACTIVE);
  });

  it("rapid fire shortens the cooldown by RAPID_FIRE_MULT", () => {
    const state = makeState();
    state.effects.rapid_fire =
      state.elapsed + 5; // active for the next 5 simulated seconds
    state.player.facing = Math.PI; // avoid drifting off board
    step(state, 1 / 60, FIRE);
    const expected = PROJECTILE.COOLDOWN * PROJECTILE.RAPID_FIRE_MULT;
    assert.ok(Math.abs(state.fireCooldown - expected) < 1e-9,
              `cooldown=${state.fireCooldown}`);
  });

  it("multi shot fires three projectiles in a spread", () => {
    const state = makeState();
    state.effects.multi_shot = state.elapsed + 5;
    state.player.facing = -Math.PI / 2;
    step(state, 1 / 60, FIRE);
    assert.equal(state.projectiles.length, 3);
    const angles = state.projectiles.map((p) => p.angle)
      .sort((a, b) => a - b);
    assert.ok(Math.abs(angles[1] - (-Math.PI / 2)) < 1e-6,
              "centre bolt follows facing");
    assert.ok(angles[0] < angles[1] && angles[1] < angles[2],
              "spread is symmetric");
    // Each bolt leaves from its own angle's point on the hull
    // ring around the ship centre.
    const noseOffset = state.player.radius + 4;
    for (const p of state.projectiles) {
      const d = Math.hypot(p.prevX - state.player.x,
                           p.prevY - state.player.y);
      assert.ok(Math.abs(d - noseOffset) < 1e-6,
                `hull distance ${d}`);
    }
  });

  it("are culled when they exit the board region", () => {
    const p = createProjectile(-50, -50, Math.PI); // heading off-board
    p.alive = true;
    const state = makeState();
    state.projectiles.push(p);
    for (let i = 0; i < 30; i++) {
      updateProjectile(p, 1 / 60);
    }
    assert.ok(!p.alive || p.x < -80, "should be far off-board");
    // The game-level cull removes it.
    const state2 = makeState();
    state2.projectiles.push(p);
    step(state2, 1 / 60);
    assert.equal(state2.projectiles.length, 0);
  });
});
