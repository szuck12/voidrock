# Commenting Guidelines

Comments in Voidrock follow the same discipline as quant_lab.
The goal: a reader should understand *why* from prose and *what*
from code, never the reverse.

## File Headers

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
```

## Docstrings

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
```

* Document **units** on anything time- or pixel-based (`s`, `px`).
* Document **mutability**: state-mutating functions say so
  (`state (mutated: `score`)`).
* Internal helpers get the same treatment when non-obvious;
  trivial one-liners may be omitted entirely.

## Inline Comments

Inline comments explain constraints, not mechanics:

```js
// One projectile, one hit: mark it dead before scoring so no
// code path can credit it again.
p.alive = false;
```

Good inline comments justify:

* ordering ("Reload first: the schedule must not depend on ...")
* magic numbers that survive as locals (though most live in
  `config.js`)
* deliberate trade-offs and invariants

## What Not to Comment

* Restating the code (`// increment i`).
* History or authorship (that is what git and CHANGELOG are for).
* Disabled code — delete it; git remembers.

## Line Length

Keep every line, comments included, within 80 columns.
