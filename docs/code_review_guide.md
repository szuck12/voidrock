# Code Review Guide

Expectations for reviewing (and self-reviewing) changes to
VoidRock.  This document covers what to check, why each check
matters, and the architectural context behind the rules.

For the full architecture description, see `architecture.md`.

---

## Before Requesting Review

- `npm test` passes with zero failures.
- New behaviour has tests that fail without the change.
- CHANGELOG.md and TODO.md updated when applicable (see the
  dedicated guides).
- Lines stay within 80 columns; file headers follow
  `docs/commenting_guidelines.md`.

---

## Architecture Overview

VoidRock separates concerns into three layers:

| Layer | Modules | May import |
| --- | --- | --- |
| **Config** | `config.js` | Nothing (leaf) |
| **Game logic** | `entities/`, `systems/`, `game.js` | Config, utils, sibling logic |
| **Browser** | `main.js`, `render.js`, `hud.js`, `input.js` | Config, game logic |

Game logic modules must never import DOM or browser globals.
`main.js` is the only module that interfaces with the browser
environment.  This separation makes every scenario exactly
reproducible in tests.

---

## Checklist

### Determinism

This project's core promise is reproducible simulation.  Reject:

- `Math.random()`, `Date.now()`, or `performance.now()` anywhere
  outside `main.js`.
- Wall-clock dependence in `src/` logic modules.
- Iteration over object key order where spawn/roll order matters.
  Use arrays or `pickWeighted` for ordered selection.

**Why**: Determinism is the foundation of the test suite (223
reproducible tests) and the planned replay-sharing feature.  A
single `Math.random()` call in game logic breaks every test that
depends on seeded behaviour.

### Architecture Boundaries

- Logic modules (`entities/`, `systems/`, `game.js`) must not
  import DOM or browser globals.
- Rendering reads state only — it never mutates it.
- All tunables belong in `config.js`; reject raw magic numbers in
  gameplay code unless locally justified.
- `main.js` must not contain game logic; it orchestrates and
  delegates.

**Why**: The boundary enables testing without mocks.  If a logic
module imports the DOM, it cannot run in Node.js.  If rendering
mutates state, the simulation is no longer pure.

### State Model

- All mutable run state lives on the object returned by
  `createInitialState()`.
- No module-level mutable variables in game logic.
- New state fields must appear in `architecture.md`'s state model
  table.
- The `effects` object stores absolute expiry times, not countdown
  timers.

**Why**: A single state object makes the game inspectable,
testable, and serialisable.  Module-level state would create
hidden coupling and break test isolation.

### Collision Correctness

- **Collision order**: player collisions iterate a snapshot of the
  asteroid list; children spawned mid-step must never resolve in
  the same frame.
- **One-score-per-shot**: any new projectile interaction must keep
  the dead-before-scoring invariant.
- **Swept segment**: new projectile types must use
  `prevX`/`prevY` for collision, not just current position.
- **Circle-circle**: player and power-up collisions use squared
  distances (avoids `sqrt` per check per frame).

**Why**: These invariants prevent the most common gameplay bugs:
double-scoring, tunneling, cascade kills, and frame-rate-
dependent behaviour.

### Entity Lifecycle

- Every entity needs an `alive` flag.
- Spawners must respect entity count caps (asteroids: 24,
  projectiles: 40, power-ups: 2, particles: 320).
- Culling must remove dead and off-board entities every step.
- New entity types need both a creation function and an update
  function.

**Why**: Without caps, sustained gameplay causes unbounded memory
growth.  Without culling, dead entities accumulate and slow the
loop.

### Effect Expiry

- Timed effects use absolute expiry times (`elapsed + duration`),
  not countdown timers decremented by `dt`.
- Effect expiry runs every step, after scoring and before player
  collisions.
- Expired effects are deleted from `state.effects`.

**Why**: Absolute expiry means pausing the game freezes all
effects naturally.  Countdown timers would continue decrementing
if dt is passed during pause, breaking the pause invariant.

### Config Discipline

- Every gameplay number lives in `config.js`.
- Config objects are deeply frozen with `Object.freeze`.
- New constants are documented with a comment explaining purpose
  and units.
- Derived values (like `POWERUP.DURATIONS`) may exist but must be
  generated from static data.

**Why**: Centralised config makes balancing trivial and prevents
the drift where different modules hard-code different values for
the same concept.

### Tests

- Prefer asserting exact values from seeded runs over ranges.
- Fixed-step helpers (`advance`) quantise to whole frames — do not
  nudge by sub-frame epsilons smaller than one step.
- A bug fix lands together with the regression test that caught it.
- New features ship with tests covering: normal operation, edge
  cases, and expiry/transition behaviour.
- Use `makeState()` for setup — never `Math.random()` or
  `Date.now()`.

**Why**: The test suite is the project's safety net.  Exact
assertions catch regressions that range assertions miss.  Seeded
determinism ensures tests pass identically on every machine.

---

## Common Issues

These are the most frequent review findings:

1. **Magic numbers in logic code** — move to `config.js`.
2. **Missing `alive` flag check** — entities without it cannot be
   safely culled.
3. **Countdown timers instead of absolute expiry** — breaks pause
   freezing.
4. **Mutation in render functions** — must be read-only.
5. **Missing snapshot iteration** — player collision loop must copy
   the asteroid array to prevent cascade kills.

---

## Review Tone

Comments address the code, not the author.  Propose alternatives
with rationale; approve when the checklist is satisfied even if a
stylistic preference differs.

When requesting changes, reference the specific invariant or rule
being violated.  For example:

- "This magic number should live in `config.js` per the config
  discipline rule."
- "This needs snapshot iteration to prevent cascade kills — see
  `resolvePlayerCollisions` for the pattern."
- "This effect should use absolute expiry for pause safety."
