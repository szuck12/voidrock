// test_player.js
// Player creation, movement physics, board bounds, facing, and the
// invulnerability timer.

import { describe, it } from "node:test";
import { BOARD, LIVES, PLAYER } from "../src/config.js";
import { createPlayer, clampToBoard, updatePlayer }
  from "../src/entities/player.js";
import { assert, makeState, step } from "./helpers.js";

const RIGHT = Object.freeze({ up: false, down: false, left: false,
                              right: true, fire: false });
const UP_RIGHT = Object.freeze({ up: true, down: false, left: false,
                                 right: true, fire: false });

function speedOf(player) {
  return Math.sqrt(player.vx * player.vx + player.vy * player.vy);
}

describe("player", () => {
  it("starts a run with exactly 3 lives (the maximum)", () => {
    const state = makeState();
    assert.equal(state.lives, LIVES.STARTING);
    assert.equal(state.lives, LIVES.MAX);
  });

  it("defaults to the board centre", () => {
    const p = createPlayer();
    assert.equal(p.x, BOARD.WIDTH / 2);
    assert.equal(p.y, BOARD.HEIGHT / 2);
  });

  it("accelerates while a move key is held", () => {
    const p = createPlayer();
    updatePlayer(p, RIGHT, 0.1);
    assert.ok(p.vx > 0, "velocity should grow rightward");
    const movedBefore = p.x;
    updatePlayer(p, RIGHT, 0.1);
    assert.ok(p.x > movedBefore);
  });

  it("reaches an equilibrium cruise speed instead of growing", () => {
    const p = createPlayer();
    // One second of held input from centre: reaches cruise but
    // cannot yet reach a wall (travel ~= 250px of 464 available).
    for (let i = 0; i < 60; i++) {
      updatePlayer(p, RIGHT, 1 / 60);
    }
    // Terminal speed is ACCELERATION / DAMPING (~300 px/s); the
    // hard cap must not be exceeded either.
    assert.ok(speedOf(p) <= PLAYER.MAX_SPEED + 1e-6);
    assert.ok(speedOf(p) > 200,
              `expected cruising, got ${speedOf(p)}`);
  });

  it("decays to rest when input stops", () => {
    const p = createPlayer();
    for (let i = 0; i < 120; i++) {
      updatePlayer(p, RIGHT, 1 / 60);
    }
    for (let i = 0; i < 240; i++) {
      updatePlayer(p, { up: false, down: false, left: false,
                        right: false, fire: false }, 1 / 60);
    }
    assert.equal(speedOf(p), 0);
  });

  it("does not move faster diagonally than straight", () => {
    const straight = createPlayer();
    const diagonal = createPlayer();
    for (let i = 0; i < 300; i++) {
      updatePlayer(straight, RIGHT, 1 / 60);
      updatePlayer(diagonal, UP_RIGHT, 1 / 60);
    }
    assert.ok(Math.abs(speedOf(straight) - speedOf(diagonal)) < 5,
              `straight=${speedOf(straight)} ` +
              `diag=${speedOf(diagonal)}`);
  });

  it("never leaves the board on any edge", () => {
    const cases = [
      { left: true }, { right: true }, { up: true }, { down: true },
    ];
    for (const flags of cases) {
      const p = createPlayer(BOARD.WIDTH / 2, BOARD.HEIGHT / 2);
      const input = { up: false, down: false, left: false,
                      right: false, fire: false, ...flags };
      for (let i = 0; i < 600; i++) {
        updatePlayer(p, input, 1 / 30); // big steps stress bounds
        assert.ok(p.x - p.radius >= -1e-9, "left bound");
        assert.ok(p.x + p.radius <= BOARD.WIDTH + 1e-9, "right");
        assert.ok(p.y - p.radius >= -1e-9, "top bound");
        assert.ok(p.y + p.radius <= BOARD.HEIGHT + 1e-9, "bottom");
      }
    }
  });

  it("clampToBoard() pulls an out-of-bounds ship fully inside",
     () => {
    const p = createPlayer(-50, BOARD.HEIGHT + 50);
    clampToBoard(p);
    assert.equal(p.x, PLAYER.RADIUS);
    assert.equal(p.y, BOARD.HEIGHT - PLAYER.RADIUS);
  });

  it("holds its facing when no input is held", () => {
    const state = makeState();
    state.player.facing = 0.75;
    for (let i = 0; i < 30; i++) {
      step(state, 1 / 60);
    }
    assert.equal(state.player.facing, 0.75);
  });

  it("turns to face the held movement direction", () => {
    const p = createPlayer();
    p.facing = -Math.PI / 2; // pointing up
    for (let i = 0; i < 120; i++) {
      updatePlayer(p, RIGHT, 1 / 60);
    }
    // Facing should converge on 0 (rightward).
    assert.ok(Math.abs(p.facing % (Math.PI * 2)) < 0.05 ||
              Math.abs(Math.abs(p.facing % (Math.PI * 2)) -
                       Math.PI * 2) < 0.05,
              `facing=${p.facing}`);
  });

  it("invulnerability counts down to exactly zero", () => {
    const p = createPlayer();
    p.invulnerableFor = PLAYER.INVULNERABLE_DURATION;
    const dt = 0.5;
    let guard = 0;
    while (p.invulnerableFor > 0 && guard++ < 100) {
      updatePlayer(p, { up: false, down: false, left: false,
                        right: false, fire: false }, dt);
    }
    assert.equal(p.invulnerableFor, 0);
    assert.ok(guard <= Math.ceil(
      PLAYER.INVULNERABLE_DURATION / dt) + 1);
  });
});
