# Commenting Guidelines

Comments in VoidRock follow a consistent discipline.  The goal: a
reader should understand *why* from prose and *what* from code,
never the reverse.

---

## 1. File Headers

Every source file starts with an 80-column banner naming the file
and summarising its single responsibility, plus any design rules
the file enforces:

```js
// collisions.js
// Collision resolution between projectiles, asteroids, the player,
// and power-ups.
//
// Correctness rules:
//   * Projectile vs asteroid uses a swept segment test so fast
//     shots cannot tunnel through an asteroid between frames.
//   * One projectile resolves against at most one asteroid (the
//     nearest along its path), so a single shot can never score
//     twice.
```

- Two lines minimum: filename and purpose.
- Additional lines for correctness rules or design invariants
  when non-obvious.
- The banner is a comment, not a docstring — use `//`, not `/** */`.

---

## 2. Docstrings

Exported functions carry a JSDoc-style block with `Args:` and
`Returns:` sections, one short line stating purpose first:

```js
/**
 * Roll a spawn-interval delay (used for both the first spawn and
 * each reload of the schedule).
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *
 * Returns:
 *     SPAWN_INTERVAL plus uniform +/- SPAWN_JITTER seconds.
 */
export function powerUpTimerRoll(rng) { ... }
```

### Rules

- **Document units** on anything time- or pixel-based (`s`, `px`,
  `rad`).
- **Document mutability**: state-mutating functions say so
  (`state (mutated: `score`, `bestScore`)`).
- **Document the return value** when non-obvious.
- **Internal helpers** get the same treatment when non-obvious;
  trivial one-liners may be omitted entirely.

### When to add `@throws`

Only when the function throws in a way that callers must handle:

```js
/**
 * Pick a weighted random key from the weights map.
 *
 * Returns:
 *     The chosen key, or null when nothing is eligible.
 */
export function pickWeighted(rng, weights) { ... }
```

No function in VoidRock currently throws — prefer returning
sentinels (like `null`) over exceptions.

---

## 3. Inline Comments

Inline comments explain constraints, not mechanics:

```js
// One projectile, one hit: mark it dead before scoring so no
// code path can credit it again.
p.alive = false;
```

### What inline comments should explain

- **Ordering**: "Reload first: the schedule must not depend on
  what happens during the spawn itself."
- **Invariants**: "This asteroid has `entered = true`, so it will
  be culled if it drifts outside the margin."
- **Non-obvious trade-offs**: "Compare squared values to avoid a
  sqrt per check per frame."
- **Config references**: When a magic-looking number is actually a
  config constant, note the reference.

### What inline comments should not explain

- Restating the code (`// increment i`, `// add to score`).
- History or authorship (that is what git and CHANGELOG are for).
- Disabled code — delete it; git remembers.
- Type information already covered by JSDoc or obvious from
  context.

---

## 4. Block / Section Comments

For multi-step algorithms, use a block comment above the code
block:

```js
// -------------------------------------------------------------------
// stepGame execution order:
// 1. Clear events, update particles, decrement shake
// 2. If not playing, return early
// 3. Movement → shooting → projectiles → spawning → asteroids
// 4. Culling → collisions → power-ups → scoring → effects
// -------------------------------------------------------------------
```

Use horizontal rule comments (`// ---...---`) to separate major
sections within a file.  Keep them under 80 columns.

---

## 5. TODO / FIXME Markers

Standardise markers for incomplete or flagged code:

```js
// TODO: implement asteroid health system for multi-hit rocks
// FIXME: edge case where spawn position overlaps player at high
//        difficulty (see test_difficulty.js edge case)
```

- `TODO` for planned work.
- `FIXME` for known bugs or limitations.
- Keep markers under 80 columns.
- Remove markers when the work is done — do not leave zombies.

---

## 6. Vertical Spacing

Use blank lines to separate logical sections for readability:

- **One blank line** between import groups (config, entities,
  systems, utils).
- **One blank line** between function definitions.
- **One blank line** between logical phases within a function
  (input validation, computation, mutation).

```js
function resolvePlayerCollisions(state) {
  if (state.phase !== "playing") {
    return;
  }

  const borderActive = effectActive(state, "protective_border");

  // Iterate a snapshot: split children must not resolve in
  // the same frame they were created.
  const rocks = [...state.asteroids];
  for (const a of rocks) {
    // ...
  }
}
```

---

## 7. Line Length

Keep every line, comments included, within 80 columns.  When a
comment would exceed the limit:

- Break it onto a separate line above the code.
- Wrap long docstring lines.
- Use parentheses for implicit line continuation when needed.

```js
// Good — broken before 80 chars
// This is a longer explanation that would exceed 80 characters
// so it goes on its own line above the code instead.
state.projectiles = state.projectiles.filter((p) => p.alive);

// Bad — exceeds limit
state.projectiles = state.projectiles.filter((p) => p.alive); // filter out dead projectiles
```

---

## 8. README Project Structure Tree

The file tree in the **Project Structure** section of `README.md`
must list files in alphabetical order within each directory.  This
avoids PR drift where new files are appended at the end.

When adding a new file to the tree:
- Insert it in the correct alphabetical position, not at the end.
- Match the indentation style of neighbouring entries.
