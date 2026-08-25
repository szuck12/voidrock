// test_asteroids.js
// Asteroid spawn placement, split progression, movement, and
// off-board culling.

import { describe, it } from "node:test";
import { ASTEROID, BOARD } from "../src/config.js";
import { createAsteroid, splitAsteroid, updateAsteroid }
  from "../src/entities/asteroid.js";
import {
  assert,
  makeState,
  placeAsteroid,
  rng,
  step,
} from "./helpers.js";
import {
  pickSpawnEdge,
  pickSpawnSize,
  spawnAngle,
  spawnPosition,
  updateSpawning,
} from "../src/systems/spawner.js";

describe("asteroid spawning", () => {
  it("uses all four edges: top, bottom, left, and right", () => {
    const r = rng(7);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(pickSpawnEdge(r));
    }
    assert.deepEqual([...seen].sort(),
                     ["bottom", "left", "right", "top"]);
  });

  it("bottom-edge spawns sit at the bottom and head upward-ish",
     () => {
    const r = rng(24);
    for (let i = 0; i < 100; i++) {
      const pos = spawnPosition("bottom", r, null);
      assert.ok(pos.y >= BOARD.HEIGHT - ASTEROID.EDGE_MARGIN,
                `y=${pos.y}`);
      assert.ok(pos.x > 0 && pos.x < BOARD.WIDTH);
      const a = spawnAngle("bottom", r);
      assert.ok(Math.sin(a) < -0.3, "must move into the board");
    }
  });

  it("top-edge spawns sit at the top and head downward-ish", () => {
    const r = rng(21);
    for (let i = 0; i < 100; i++) {
      const pos = spawnPosition("top", r, null);
      assert.ok(pos.y <= ASTEROID.EDGE_MARGIN, `y=${pos.y}`);
      assert.ok(pos.x > 0 && pos.x < BOARD.WIDTH);
      const a = spawnAngle("top", r);
      assert.ok(Math.sin(a) > 0.3, "must move into the board");
    }
  });

  it("left-edge spawns sit left and head rightward-ish", () => {
    const r = rng(22);
    for (let i = 0; i < 100; i++) {
      const pos = spawnPosition("left", r, null);
      assert.ok(pos.x <= ASTEROID.EDGE_MARGIN, `x=${pos.x}`);
      assert.ok(pos.y >= 0 && pos.y < BOARD.HEIGHT);
      const a = spawnAngle("left", r);
      assert.ok(Math.cos(a) > 0.3, "must move into the board");
    }
  });

  it("right-edge spawns sit right and head leftward-ish", () => {
    const r = rng(23);
    for (let i = 0; i < 100; i++) {
      const pos = spawnPosition("right", r, null);
      assert.ok(pos.x >= BOARD.WIDTH - ASTEROID.EDGE_MARGIN);
      const a = spawnAngle("right", r);
      assert.ok(Math.cos(a) < -0.3, "must move into the board");
    }
  });

  it("never spawns directly on top of the player", () => {
    const player = createAsteroidPlayerStandIn();
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = rng(seed * 1337);
      for (let i = 0; i < 300; i++) {
        for (const edge of ["top", "bottom", "left", "right"]) {
          const pos = spawnPosition(edge, r, player);
          const dx = pos.x - player.x;
          const dy = pos.y - player.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          assert.ok(dist >= ASTEROID.MIN_PLAYER_DISTANCE - 1e-6,
                    `dist=${dist} seed=${seed}`);
        }
      }
    }
  });

  function createAsteroidPlayerStandIn() {
    return { x: BOARD.WIDTH / 2, y: BOARD.HEIGHT / 2 };
  }

  it("respects the MAX_COUNT cap", () => {
    const state = makeState();
    state.spawnTimer = 0;
    while (state.asteroids.length < ASTEROID.MAX_COUNT) {
      placeAsteroid(state, {
        x: -20,
        y: BOARD.HEIGHT / 2,
        vx: 50,
        vy: 0,
        entered: false,
      });
    }
    updateSpawning(state, 1);
    assert.ok(state.asteroids.length <= ASTEROID.MAX_COUNT);
  });

  it("spawned asteroids have valid non-zero velocity", () => {
    const state = makeState();
    state.spawnTimer = 0;
    updateSpawning(state, 1);
    assert.ok(state.asteroids.length >= 1);
    const a = state.asteroids[state.asteroids.length - 1];
    const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
    assert.ok(speed > 0, "asteroid must move");
  });

  it("pickSpawnSize produces all three size levels", () => {
    const r = rng(99);
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(pickSpawnSize(r));
    }
    assert.deepEqual([...seen].sort(), [1, 2, 3]);
  });

  it("pickSpawnSize respects configured weight distribution", () => {
    const r = rng(88);
    const counts = { 1: 0, 2: 0, 3: 0 };
    const total = 10000;
    for (let i = 0; i < total; i++) {
      counts[pickSpawnSize(r)]++;
    }
    // 50% large, 30% medium, 20% small with ±5% tolerance
    const largeRatio = counts[3] / total;
    const medRatio = counts[2] / total;
    const smallRatio = counts[1] / total;
    assert.ok(largeRatio > 0.44 && largeRatio < 0.56,
              `large=${largeRatio}`);
    assert.ok(medRatio > 0.24 && medRatio < 0.36,
              `medium=${medRatio}`);
    assert.ok(smallRatio > 0.14 && smallRatio < 0.26,
              `small=${smallRatio}`);
  });
});

describe("asteroid splitting", () => {
  it("large splits into two medium asteroids", () => {
    const parent = placeAsteroid(makeState(), { level: 3 });
    const children = splitAsteroid(parent, rng(5));
    assert.equal(children.length, 2);
    for (const child of children) {
      assert.equal(child.level, 2);
      assert.equal(child.radius, ASTEROID.RADII[2]);
    }
  });

  it("medium splits into two small asteroids", () => {
    const parent = placeAsteroid(makeState(), { level: 2 });
    const children = splitAsteroid(parent, rng(6));
    assert.equal(children.length, 2);
    assert.ok(children.every((c) => c.level === 1));
  });

  it("small asteroids are destroyed outright (no children)", () => {
    const parent = placeAsteroid(makeState(), { level: 1 });
    assert.deepEqual(splitAsteroid(parent, rng(8)), []);
  });

  it("children inherit the special asteroid type", () => {
    for (const type of ["bronze", "gold"]) {
      const parent = placeAsteroid(makeState(),
                                   { level: 3, type });
      const children = splitAsteroid(parent, rng(9));
      assert.ok(children.every((c) => c.type === type),
                `${type} children keep type`);
    }
  });

  it("children diverge with valid, non-zero velocities", () => {
    const parent = placeAsteroid(makeState(),
                                 { level: 3, vx: 60, vy: 0 });
    const children = splitAsteroid(parent, rng(10));
    const [a, b] = children;
    for (const child of [a, b]) {
      const speed = Math.sqrt(child.vx ** 2 + child.vy ** 2);
      assert.ok(speed > 0, "child must move");
    }
    const angleOf = (c) => Math.atan2(c.vy, c.vx);
    let diff = Math.abs(angleOf(a) - angleOf(b));
    if (diff > Math.PI) {
      diff = Math.PI * 2 - diff;
    }
    assert.ok(diff > 0.2, `divergence=${diff}`);
  });

  it("full progression stays bounded (7 asteroids total)", () => {
    const state = makeState();
    placeAsteroid(state, { level: 3 });
    let frontier = [state.asteroids.pop()];
    let total = 1;
    while (frontier.length > 0) {
      const next = [];
      for (const a of frontier) {
        const children = splitAsteroid(a, rng(11));
        next.push(...children);
        total += children.length;
      }
      frontier = next;
    }
    assert.equal(total, 7); // 1 + 2 + 4
  });
});

describe("asteroid movement and culling", () => {
  it("moves by velocity times dt (times slow factor)", () => {
    const a = placeAsteroid(makeState(), { vx: 120, vy: -40 });
    const x0 = a.x;
    updateAsteroid(a, 0.5, 1);
    assert.ok(Math.abs(a.x - (x0 + 60)) < 1e-9);
  });

  it("slow factor scales displacement without touching velocity",
     () => {
    const a = placeAsteroid(makeState(), { vx: 100, vy: 0 });
    const x0 = a.x;
    updateAsteroid(a, 1, 0.5);
    assert.ok(Math.abs((a.x - x0) - 50) < 1e-9);
    assert.equal(a.vx, 100, "velocity must remain unscaled");
  });

  it("inbound asteroids outside the board are kept until entering",
     () => {
    const state = makeState();
    placeAsteroid(state, {
      x: -40,
      y: BOARD.HEIGHT / 2,
      vx: 60,
      vy: 0,
      entered: false,
    });
    step(state, 1 / 60);
    assert.equal(state.asteroids.length, 1, "kept while inbound");
  });

  it("entered asteroids that exit the far side are removed", () => {
    const state = makeState();
    placeAsteroid(state, {
      x: BOARD.WIDTH + 30,
      y: BOARD.HEIGHT / 2,
      vx: 120,
      vy: 0,
      entered: true,
    });
    step(state, 0.25);
    assert.equal(state.asteroids.length, 1,
                 "kept inside the margin band");
    step(state, 0.25);
    assert.equal(state.asteroids.length, 0);
  });

  it("off-board asteroids older than the grace period are culled",
     () => {
    const state = makeState();
    const stray = placeAsteroid(state, {
      x: BOARD.WIDTH + 200,
      y: -200,
      vx: 0,
      vy: 0,
      entered: false,
    });
    stray.age = ASTEROID.ENTER_GRACE_SECONDS + 1;
    step(state, 1 / 60);
    assert.equal(state.asteroids.length, 0);
  });
});
