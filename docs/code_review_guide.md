# Code Review Guide

Expectations for reviewing (and self-reviewing) changes to
VoidRock.

## Before Requesting Review

* `npm test` passes with zero failures.
* New behaviour has tests that fail without the change.
* CHANGELOG.md and TODO.md updated when applicable (see the
  dedicated guides).
* Lines stay within 80 columns; file headers follow
  `docs/commenting_guidelines.md`.

## Checklist

### Determinism

This project's core promise is reproducible simulation. Reject:

* `Math.random()`, `Date.now()`, or `performance.now()` anywhere
  outside `main.js`.
* Wall-clock dependence in `src/` logic modules.
* Iteration over object key order where spawn/roll order matters.

### Architecture Boundaries

* Logic modules (`entities/`, `systems/`, `game.js`) must not
  import DOM or browser globals.
* Rendering reads state only — it never mutates it.
* All tunables belong in `config.js`; reject raw magic numbers in
  gameplay code unless locally justified.

### Correctness Hotspots

* **Collision order**: player collisions iterate a snapshot of the
  asteroid list; children spawned mid-step must never resolve in
  the same frame.
* **One-score-per-shot**: any new projectile interaction must keep
  the dead-before-scoring invariant.
* **Effect expiry**: timed effects compare against `state.elapsed`,
  so pause-safe semantics hold; do not introduce countdown timers
  decremented by dt instead.
* **Entity bounds**: spawners and cullers must keep every entity
  list bounded under sustained spawning (see
  `tests/test_difficulty.js` and long-run integration tests).

### Tests

* Prefer asserting exact values from seeded runs over ranges.
* Fixed-step helpers (`advance`) quantise to whole frames — do not
  nudge by sub-frame epsilons smaller than one step.
* A bug fix lands together with the regression test that caught it.

## Review Tone

Comments address the code, not the author. Propose alternatives
with rationale; approve when the checklist is satisfied even if a
stylistic preference differs.
