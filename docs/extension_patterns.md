# Extension Patterns

This document provides templates and patterns for extending
VoidRock's game logic.  Each section walks through the
architecture's conventions for a specific kind of extension, with
concrete code templates and checklists.

For the complete step-by-step recipe for new power-ups specifically,
see `adding_powerup.md`.  This document covers the broader patterns:
new entities, new systems, new config groups, and new rendering
elements.

---

## Adding a New Entity

Every entity lives in `src/entities/` and follows the same pattern:
a creation function and an update function, both operating on a
plain state object.

### Template

```js
// entities/asteroid.js (existing) — follow this structure

import { CONFIG_GROUP } from "../config.js";

/**
 * Create a new entity.
 *
 * Args:
 *     options: Configuration for this instance.
 *
 * Returns:
 *     Entity state object with position, velocity, radius,
 *     age, and alive fields.
 */
export function createEntity(options) {
  const { x, y, angle, rng } = options;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: CONFIG_GROUP.RADIUS,
    age: 0,
    alive: true,
  };
}

/**
 * Advance the entity one step.
 *
 * Args:
 *     entity: Entity state (mutated in place).
 *     dt: Elapsed seconds.
 */
export function updateEntity(entity, dt) {
  entity.age += dt;
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
}
```

### Rules

- **Plain objects only**: no classes, no prototypes, no `new`.
- **`alive` flag**: every entity must have an `alive` boolean.
  Systems set it to `false`; culling filters remove it.
- **No DOM access**: entity modules import only `config.js` and
  `utils/`.
- **Config centralisation**: all tuning values live in `config.js`,
  not in the entity file.

### Integrating into stepGame

1. Import the creation and update functions in `game.js`.
2. Add the entity array to `createInitialState()`:
   ```js
   entities: [],
   ```
3. Add an update loop in `stepGame()` at the correct position in
   the step order.
4. Add a culling step to remove dead/off-board entities.

---

## Adding a New System

Systems live in `src/systems/` and implement a single game
mechanic.  They import entities, config, and other systems as
needed.

### Template

```js
// systems/scoring.js (existing) — follow this structure

import { CONFIG_GROUP } from "../config.js";

/**
 * Run one step of the system.
 *
 * Args:
 *     state: Game state (mutated as documented).
 */
export function updateSystem(state) {
  // Read state, compute, mutate state.
}
```

### Rules

- **Import only from allowed modules**: `config.js`, `utils/`,
  `entities/`, and sibling systems.
- **No DOM or browser globals**: the system must be testable with
  `makeState()` alone.
- **Document mutations**: the JSDoc should list which state fields
  are mutated.
- **Respect invariants**: follow the determinism, one-projectile-
  one-hit, and bounded-count invariants as applicable.

### Integration into stepGame

The position in `stepGame()` matters.  The current order:

```
movement → shooting → projectile motion → spawning →
asteroid motion → culling → projectile collisions →
power-up collection → power-up spawning → power-up expiry →
time scoring → effect expiry → player collisions
```

A new system should be inserted at the point that respects its
dependencies.  For example, a system that destroys entities must
run before the culling step.  A system that reads entity positions
must run after movement.

---

## Adding a New Config Group

New tunables go in `src/config.js`.  Follow the existing pattern:

### Template

```js
/**
 * Description of what this group controls.
 */
export const NEW_GROUP = Object.freeze({
  /** Explanation of this constant. */
  CONSTANT_NAME: value,

  /** Nested object with its own constants. */
  SUB_GROUP: Object.freeze({
    NESTED_CONSTANT: value,
  }),
});
```

### Rules

- **Deep freeze**: every object must be wrapped in `Object.freeze`.
  Nested objects need nested freezes.
- **Document every constant**: each field gets a comment explaining
  its purpose and units.
- **No computed values**: config exports are static data.  Derived
  values (like `POWERUP.DURATIONS`) may exist but must be
  generated from the static data, not from runtime state.

### Updating tests

If the new config group is used by existing systems, some tests
may assert exact values and need updating.  Run `npm test` after
any config change to catch these.

---

## Adding a New Rendering Element

Render functions live in `src/render.js` and follow this pattern:

### Template

```js
/**
 * Draw the new element.
 *
 * Args:
 *     ctx: Canvas context (already scaled to board pixels).
 *     elementData: State to draw.
 *     t: Wall-clock seconds for animations.
 */
function drawNewElement(ctx, elementData, t) {
  ctx.save();
  // Drawing operations
  ctx.restore();
}
```

### Rules

- **Read state, draw geometry, mutate nothing**: the renderer is
  pure presentation.
- **Save/restore**: every draw function wraps its work in
  `ctx.save()` and `ctx.restore()`.
- **Board coordinates**: all drawing uses the 960 × 640 logical
  space.  The device-pixel-ratio transform is applied by `main.js`.
- **Colour constants**: define palette objects at module scope with
  `Object.freeze`.  The accent colour is `#7ef9ff` (cyan).

### Integration into render()

Add the call in `render()` at the appropriate position in the
drawing order:

```
stars → power-ups → asteroids → projectiles → particles →
player → shield → border
```

Elements that should appear behind others go earlier in the list.
Elements that should appear on top go later.

---

## Adding a New HUD Chip

Power-up countdown chips are managed by `src/hud.js`.

### Steps

1. Add the effect key to the `CHIP_KEYS` array in `hud.js`:
   ```js
   const CHIP_KEYS = [
     "speed_boost",
     // ... existing keys ...
     "new_effect",  // add here
   ];
   ```

2. Add the corresponding CSS class in `styles.css`:
   ```css
   .chip-new_effect { border-color: #yourcolour; }
   ```

3. The chip will automatically appear when the effect is active
   and show a countdown label from `POWERUP_TYPES[type].label`.

---

## Adding a New Test Pattern

### Parameterised testing

Iterate over config values to test all combinations:

```js
it("every size awards correct base score", () => {
  const expected = { 3: 10, 2: 15, 1: 20 };
  for (const [level, points] of Object.entries(expected)) {
    assert.equal(calculateAsteroidScore(Number(level), "normal",
                 false, false, false), points);
  }
});
```

### Monotonicity scanning

Loop over a time or level range and assert non-decreasing
behaviour:

```js
let prev = -Infinity;
for (let t = 0; t <= 400; t += 5) {
  const value = systemUnderTest(t);
  assert.ok(value >= prev - 1e-9, `regressed at t=${t}`);
  prev = value;
}
```

### Integration duration testing

Run the full game loop for a duration and check aggregate
properties:

```js
const state = makeState();
for (let i = 0; i < 60 * 60; i++) {
  stepGame(state, IDLE_INPUT, 1 / 60);
}
assert.ok(state.score > 0, "score must accrue over time");
assert.ok(state.asteroids.length <= ASTEROID.MAX_COUNT);
```

### Event emission testing

Check the `state.events` array for expected events:

```js
loseLife(state);
const deathEvents = state.events.filter((e) => e.kind === "death");
assert.equal(deathEvents.length, 1);
assert.equal(deathEvents[0].x, state.respawnX);
```

---

## Common Pitfalls

### Mutating stored velocities

When adding a speed-modifying effect, scale *displacement*, not
the stored velocity:

```js
// Correct: displacement scales, velocity stays constant
const factor = effectActive(state, "slow_asteroids") ? 0.45 : 1;
asteroid.x += asteroid.vx * dt * factor;
asteroid.y += asteroid.vy * dt * factor;

// Wrong: mutating velocity breaks when effect expires
asteroid.vx *= 0.45;
```

The Slow Asteroids power-up follows this pattern.  When the effect
expires, asteroids instantly resume normal speed with zero
bookkeeping.

### Forgetting to bound entity counts

Every array that grows over time needs a cap:

```js
// In stepGame or the relevant system
if (state.newEntities.length >= MAX_COUNT) {
  return; // don't spawn more
}
```

Without a cap, sustained gameplay causes unbounded memory growth
and degrading frame rates.

### Breaking the step order

If your system depends on another system's output, it must run
*after* that system in `stepGame`.  If other systems depend on
your output, it must run *before* them.  Document the dependency
in a comment above the call.

### Adding state without documenting it

Every field added to the state object must appear in
`architecture.md`'s state model table.  Every field read by tests
must be documented in the test file's header comment.

---

## Checklist for Any Extension

- [ ] Config constants in `config.js`, deeply frozen
- [ ] Entity or system module in the correct directory
- [ ] Integration into `stepGame()` at the correct step position
- [ ] State fields documented in `architecture.md`
- [ ] Rendering in `render.js` (if visual)
- [ ] HUD integration in `hud.js` (if player-facing)
- [ ] Tests in `tests/test_<module>.js`
- [ ] All 223 existing tests still pass
- [ ] `docs/game_mechanics.md` updated with new values
- [ ] `README.md` project structure updated (if new files added)
- [ ] `CHANGELOG.md` entry under `[Unreleased]`
- [ ] `TODO.md` tracking item checked off (if applicable)
