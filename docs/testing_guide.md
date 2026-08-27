# Testing Guide

VoidRock's test suite uses Node's built-in `node:test` runner.
Every gameplay scenario is deterministic: seeded RNG, fixed-step
simulation, and explicit assertions against exact values.  This
document explains how the suite is structured, how to write new
tests, and the patterns that keep results reproducible.

---

## Running the Tests

```bash
# Full suite via npm (recommended)
npm test

# Full suite via the convenience runner (indented TAP output)
node run_tests.js

# A single test file
node --test tests/test_scoring.js

# A single test by name (grep)
node --test --test-name-pattern "calculates size" tests/test_scoring.js
```

The `npm test` command runs `node --test tests/test_*.js`, which
discovers all test files alphabetically.  Exit code 0 means all
tests pass.

---

## Test File Structure

Every test file follows this template:

```js
// test_example.js
// One-line description of what this file covers.

import { describe, it } from "node:test";
import { assert } from "./helpers.js";
// Import the functions under test from src/.

describe("feature group", () => {
  it("does the expected thing", () => {
    // Arrange: create state, entities, or values
    // Act: call the function under test
    // Assert: check exact expected outcomes
  });

  it("handles the edge case", () => {
    // ...
  });
});
```

### Naming conventions

- Test files: `tests/test_<module>.js` matching the source module
  name.  Examples: `test_scoring.js`, `test_collisions.js`.
- Edge-case files: `tests/test_<module>_edges.js` for boundary
  conditions and error paths that would clutter the main file.
- Describe blocks: group by function or feature area.
- It blocks: state the behaviour being verified as a complete
  sentence.

---

## Deterministic Testing with helpers.js

The `tests/helpers.js` module provides the shared foundation that
every test file imports.

### makeState(seed?, bestScore?)

Creates a fresh game state in the `"playing"` phase with a fixed
RNG seed.  Default seed is `1234` for reproducibility.

```js
const state = makeState();        // seed 1234, bestScore 0
const state = makeState(5678);    // seed 5678
const state = makeState(1234, 500); // seed 1234, bestScore 500
```

### step(state, dt?, input?)

Steps the game forward by `dt` seconds (default 1/60) with the
given input flags (default idle — no keys held).

```js
step(state);                  // one idle frame
step(state, 1 / 30);         // half-second idle
step(state, 1 / 60, { up: true, fire: true }); // shoot while thrusting
```

### advance(state, seconds, input?, stepSize?)

Runs the game for a total number of seconds by calling `stepGame`
in a loop with fixed `stepSize` (default 1/60).  Quantises to
whole frames — do not rely on sub-frame precision smaller than one
step.

```js
advance(state, 10);           // 10 seconds at 60 fps
advance(state, 5, { right: true }, 1 / 30); // 5s at 30 fps
```

### placeAsteroid(state, options)

Injects an asteroid at an exact position with exact velocity,
bypassing the spawner entirely.  Used to stage collision scenarios.

```js
placeAsteroid(state, {
  level: 3,
  x: state.player.x + 50,
  y: state.player.y,
  vx: -200,
  vy: 0,
  type: "normal",
});
```

All fields except `level`, `x`, `y`, `vx`, `vy` have sensible
defaults.  The asteroid is pushed into `state.asteroids` and
returned.

### placePowerUp(state, type, x, y)

Injects a power-up at an exact position.

```js
placePowerUp(state, "speed_boost", 300, 200);
```

### rng(seed)

Creates an isolated seeded RNG for direct calls.  Useful for
testing RNG utilities or for generating values in test setup
without affecting the game's RNG stream.

```js
const r = rng(99);
const value = r(); // float in [0, 1)
```

### IDLE_INPUT

A frozen object with all input flags set to `false`.  Use it when
an input argument is required but no input should be active.

---

## Test Patterns by Module

### Collision tests (test_collisions.js)

Test both the low-level primitives and the high-level resolution
functions.

**Direct primitive testing** — call `projectileHitsAsteroid` with
hand-built geometry objects:

```js
const proj = { x: 110, y: 100, prevX: 90, prevY: 100, radius: 3 };
const ast = { x: 100, y: 100, radius: 12 };
assert.equal(projectileHitsAsteroid(proj, ast), true);
```

**Fixture-based collision staging** — use `placeAsteroid` to inject
an asteroid at the player's position, then step once:

```js
const state = makeState();
placeAsteroid(state, { x: state.player.x, y: state.player.y });
step(state, 1 / 60);
assert.equal(state.lives, LIVES.MAX - 1);
```

**Shield + multiplier combos** — create a helper that applies the
shield, optional score multipliers, places an asteroid on the
player, and returns the score delta:

```js
function shieldScore(type, level, boost, m3, m5) {
  const state = makeState();
  applyPowerUp(state, "protective_border");
  if (boost) state.effects.points_boost = state.elapsed + 10;
  placeAsteroid(state, { x: state.player.x, y: state.player.y,
                         level, type });
  const before = state.score;
  step(state, 1 / 60);
  return state.score - before;
}
assert.equal(shieldScore("gold", 1, true, true, true), 2400);
```

### Power-up tests (test_powerups.js)

The largest test file (32 tests).  Covers scheduling, eligibility,
application, collection, and per-type behaviour.

**Duration testing** — apply an effect, advance near expiry, assert
active; advance past, assert inactive:

```js
const state = makeState();
applyPowerUp(state, "speed_boost");
advance(state, POWERUP_TYPES.speed_boost.duration - 0.5);
assert.ok(effectActive(state, "speed_boost"));
advance(state, 0.5 + 1 / 60);
assert.equal(effectActive(state, "speed_boost"), false);
```

**Eligibility testing** — manipulate state fields to make types
eligible or ineligible, then check `eligibleWeights()`:

```js
const state = makeState();
state.lives = LIVES.MAX;
const weights = eligibleWeights(state);
assert.equal(weights.extra_life, undefined);
```

**Field behaviour** — verify slow asteroids scale displacement but
not velocity:

```js
const state = makeState();
const a = placeAsteroid(state, { x: 200, y: 200, vx: 100, vy: 0 });
applyPowerUp(state, "slow_asteroids");
step(state, 1);
assert.ok(Math.abs(a.x - 200 - 100 * POWERUP.SLOW_ASTEROID_FACTOR) < 1e-6);
assert.equal(a.vx, 100); // velocity preserved
```

### Difficulty tests (test_difficulty.js)

Tests the difficulty curve for monotonicity, interpolation, and
integration effects.

**Monotonicity scanning** — loop over time values and assert
non-decreasing properties:

```js
for (let t = 0; t <= 400; t += 5) {
  const mult = calculateDifficulty(t).speedMult;
  assert.ok(mult >= prev - 1e-9, `regressed at t=${t}`);
  prev = mult;
}
```

**Integration testing** — run the actual spawner system for a
duration and count spawns:

```js
function spawnsInWindow(startElapsed, seconds) {
  const state = makeState();
  state.elapsed = startElapsed;
  let spawned = 0;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const before = state.asteroids.length;
    updateSpawning(state, 1 / 60);
    if (state.asteroids.length > before) spawned++;
  }
  return spawned;
}
const early = spawnsInWindow(0, 30);
const late = spawnsInWindow(200, 30);
assert.ok(late > early * 1.2);
```

### Scoring tests (test_scoring.js)

Tests exact score values for all multiplier combinations.

**Frame-rate independence** — run the same scenario at different
step sizes and assert equal totals:

```js
const coarse = makeState();
advance(coarse, 3.3, undefined, 1 / 20);
const fine = makeState();
advance(fine, 3.3, undefined, 1 / 120);
assert.equal(coarse.score, fine.score);
```

**Single-scoring guarantee** — fire a projectile through two
asteroids, verify only one is scored:

```js
placeAsteroid(state, { level: 1, x: player.x + 120, y: player.y });
placeAsteroid(state, { level: 1, x: player.x + 130, y: player.y });
const p = createProjectile(player.x + 170, player.y, 0);
p.prevX = p.x - 300;
state.projectiles.push(p);
resolveProjectileHits(state);
assert.equal(state.score - before, 20); // only one scored
```

### Math utility tests (test_math.js)

Pure function testing with no state setup.  Classic boundary-value
testing:

```js
assert.equal(clamp(5, 0, 10), 5);
assert.equal(clamp(-1, 0, 10), 0);
assert.equal(clamp(11, 0, 10), 10);
```

Degenerate input testing:

```js
// Zero-length segment falls back to point distance
const d = pointSegmentDistance(3, 4, 0, 0, 0, 0);
assert.equal(d, 5);
```

### RNG tests (test_rng.js)

Tests determinism, distribution, and boundary behaviour:

```js
// Identical seeds produce identical sequences
const a = createRng(42);
const b = createRng(42);
for (let i = 0; i < 100; i++) {
  assert.equal(a(), b());
}
```

---

## Adding a New Test File

1. Create `tests/test_<module>.js`.
2. Import `describe`, `it` from `node:test`.
3. Import `assert` and any helpers from `./helpers.js`.
4. Import the functions under test from `src/`.
5. Write `describe`/`it` blocks following the patterns above.
6. Verify it appears in `npm test` output (the glob `test_*.js`
   picks it up automatically).
7. Run `node --test tests/test_<module>.js` during development.

### Checklist for new tests

- [ ] Every test uses `makeState()` or `rng()` — no
      `Math.random()` or `Date.now()`.
- [ ] Assertions compare exact values, not ranges (except where
      floating-point tolerance is explicit with an epsilon).
- [ ] `advance()` quantises to whole frames — no sub-frame nudges
      smaller than one `stepSize`.
- [ ] Test file starts with a one-line comment describing its
      scope.
- [ ] Describe blocks group by function or feature.
- [ ] Each `it` block states the expected behaviour as a sentence.

---

## Common Pitfalls

### Floating-point tolerance

Use explicit epsilon for floating-point comparisons:

```js
assert.ok(Math.abs(actual - expected) < 1e-9);
```

Never use `assert.equal` for floating-point results — it uses
`===` which fails on tiny rounding differences.

### Frame quantisation

`advance(state, seconds)` calls `stepGame` in a loop with
`Math.round(seconds / stepSize)` iterations.  This means the
actual elapsed time may differ by up to half a step from the
requested duration.  Do not test for sub-step precision.

### State snapshot vs reference

`placeAsteroid` returns a reference to the pushed object.  If the
object is later removed from the array (by filtering), the variable
still holds the old reference.  Check `.alive` or array membership
to verify current status:

```js
const a = placeAsteroid(state, { x: 400, y: 300 });
step(state, 1 / 60); // may destroy a
assert.equal(a.alive, false); // check the flag, not the array
```

### Effect timing

Timed effects use absolute expiry (`state.elapsed + duration`).
When testing expiry, advance past the duration and then call
`expireEffects(state)` if you need the entry cleaned up:

```js
advance(state, duration + 0.01);
expireEffects(state);
assert.equal(state.effects.speed_boost, undefined);
```

### Phase guards

Many functions early-return when `state.phase !== "playing"`.
If a test needs to verify non-playing behaviour, set the phase
manually:

```js
state.phase = "menu";
resolvePlayerCollisions(state); // no-op in menu
assert.equal(state.lives, 3);
```

---

## Test Coverage Summary

The suite currently has **223 tests** across **16 files**:

| File | Tests | Module(s) tested |
| --- | --- | --- |
| `test_asteroids.js` | 17 | `entities/asteroid.js`, `systems/spawner.js` |
| `test_collisions.js` | 13 | `systems/collisions.js`, `systems/powerups.js`, `systems/scoring.js` |
| `test_config.js` | 8 | `config.js` |
| `test_difficulty.js` | 10 | `systems/difficulty.js`, `systems/spawner.js` |
| `test_game_edges.js` | 8 | `game.js` (edge cases) |
| `test_game_flow.js` | 16 | `game.js` (phases, restart, pause) |
| `test_math.js` | 9 | `utils/math.js` |
| `test_player.js` | 12 | `entities/player.js` |
| `test_player_edges.js` | 6 | `entities/player.js` (edge cases) |
| `test_powerup_edges.js` | 10 | `systems/powerups.js` (edge cases) |
| `test_powerups.js` | 32 | `systems/powerups.js` |
| `test_projectiles.js` | 10 | `entities/projectile.js` |
| `test_rng.js` | 8 | `utils/rng.js` |
| `test_scoring.js` | 16 | `systems/scoring.js`, `systems/collisions.js` |
| `test_specials.js` | 10 | `systems/difficulty.js` (special asteroids) |
| `helpers.js` | 0 | (shared test utilities) |

### What is not tested

- `main.js` — browser-only bootstrap; requires DOM environment.
- `render.js` — Canvas drawing; requires visual verification.
- `hud.js` — DOM synchronisation; requires document mocks.
- `input.js` — keyboard listeners; requires browser event
  environment.

These modules are covered by code review and manual testing in the
browser.  They contain minimal logic and are thin wrappers around
DOM APIs.
