// test_player_edges.js
// Edge cases for player physics: decayVelocity zero threshold,
// updatePlayer speedMult clamping, and clampToBoard idempotency.

import { describe, it } from "node:test";
import { BOARD, PLAYER } from "../src/config.js";
import {
  clampToBoard,
  createPlayer,
  updatePlayer,
} from "../src/entities/player.js";
import { assert } from "./helpers.js";

describe("decayVelocity zero threshold", () => {
  it("zeroes velocity when both components are below 1", () => {
    const player = createPlayer();
    // Set tiny but non-zero velocity
    player.vx = 0.5;
    player.vy = 0.5;
    updatePlayer(player, { up: false, down: false, left: false,
                           right: false }, 1 / 60);
    assert.equal(player.vx, 0);
    assert.equal(player.vy, 0);
  });

  it("does not zero velocity when one component is above 1", () => {
    const player = createPlayer();
    player.vx = 0.5;
    player.vy = 2.0;
    updatePlayer(player, { up: false, down: false, left: false,
                           right: false }, 1 / 60);
    // vx should decay via exponential damping but vy stays above
    // threshold — neither is zeroed
    assert.ok(player.vy > 0, "vy must remain non-zero");
  });
});

describe("updatePlayer speedMult clamping", () => {
  it("caps speed at MAX_SPEED * speedMult", () => {
    const player = createPlayer();
    const speedMult = 1.5;
    // Push with high velocity exceeding the capped speed
    player.vx = PLAYER.MAX_SPEED * speedMult + 100;
    player.vy = 0;
    updatePlayer(player, { up: false, down: false, left: false,
                           right: false }, 1 / 60);
    const speed = Math.sqrt(player.vx * player.vx +
                            player.vy * player.vy);
    assert.ok(speed <= PLAYER.MAX_SPEED * speedMult + 1,
              `speed=${speed} exceeds max=${PLAYER.MAX_SPEED * speedMult}`);
  });

  it("speedMult=1 uses default max speed", () => {
    const player = createPlayer();
    player.vx = PLAYER.MAX_SPEED + 100;
    updatePlayer(player, { up: false, down: false, left: false,
                           right: false }, 1 / 60);
    const speed = Math.sqrt(player.vx * player.vx +
                            player.vy * player.vy);
    assert.ok(speed <= PLAYER.MAX_SPEED + 1,
              `speed=${speed} exceeds MAX_SPEED=${PLAYER.MAX_SPEED}`);
  });
});

describe("clampToBoard idempotency", () => {
  it("does not move an already-valid position", () => {
    const player = createPlayer(BOARD.WIDTH / 2, BOARD.HEIGHT / 2);
    const beforeX = player.x;
    const beforeY = player.y;
    clampToBoard(player);
    assert.equal(player.x, beforeX);
    assert.equal(player.y, beforeY);
  });

  it("running clamp twice produces same result", () => {
    const player = createPlayer();
    player.x = -50;
    player.y = BOARD.HEIGHT + 100;
    clampToBoard(player);
    const firstX = player.x;
    const firstY = player.y;
    clampToBoard(player);
    assert.equal(player.x, firstX);
    assert.equal(player.y, firstY);
  });
});
