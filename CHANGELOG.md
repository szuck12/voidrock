# Changelog

All notable changes to this project will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-08-24

### Added

- Score-based asteroid scoring: Large = 10 pts, Medium = 15 pts,
  Small = 20 pts per hit (replaces flat 10-point scoring).
- 3x Score power-up: all scoring tripled for 8 s, unlocks at 60 s,
  weight 4.
- 5x Score power-up: all scoring quintupled for 6 s, unlocks at
  120 s, weight 2.
- Score multipliers (Points Boost, 3x, 5x) now combine
  multiplicatively for up to 20x on a single hit.
- Progressive power-up spawn frequency: `freqScale = 1 + elapsed / 600`,
  making power-ups more common as the game progresses.
- Randomised spawn sizes: 50% large, 30% medium, 20% small
  (replaces always-large spawns).
- Four-sided spawn edges (top, bottom, left, right) — asteroids
  now enter from all sides of the arena.
- Arrow keys display with A D on the left, W S on the right for
  clarity.

### Changed

- Gold multiplier reduced from x5 to x4; special scoring now uses
  size-based points instead of flat 10.
- Silver asteroids removed; special pool is now bronze/gold only.
- Base asteroid speed increased from 70 to 115 px/s; per-tier speed
  increased from +30 to +50 px/s.
- Protective Border is now a protective effect: it redirects
  asteroids without destroying them and awards no points (replaces
  destructive wall that scored on contact).
- Speed Boost duration extended from 6 s to 15 s.
- Slow Asteroids duration extended from 6 s to 10 s.
- Rapid Fire duration extended from 8 s to 10 s.
- Protective Border duration extended from 10 s to 20 s.
- HUD label changed from "EFFECTS" to "POWER-UPS".
- Space bar instruction text updated from "Fire" to "SHIP FIRES".
- Power-up weight pool updated with 3x and 5x entries;
  `POWERUP_TYPES` now a single data-driven config object.
- Footer and styling refinements (arrow key spacing, badge update).

### Removed

- Silver asteroid class and its x3 per-hit multiplier.
- `POWERUP_META` and `DURATIONS`/`WEIGHTS` config objects
  (replaced by `POWERUP_TYPES`).
- QuantLab references removed from documentation.

## [1.0.0] - 2026-08-22

Initial release.

### Added

- Core arcade loop: thrust-based ship movement clamped inside a
  walled arena, inertial damping, and facing that tracks movement.
- Projectile system with fire cooldown, active-shot cap, swept-path
  collision (no tunnelling), and one-score-per-shot guarantees.
- Asteroid lifecycle: three sizes that split twice, polygonal
  procedurally-shaped rendering, off-board spawn edges, enter-grace
  culling, and a hard field cap.
- Special asteroid classes — Bronze x2, Silver x3, Gold x5 per-hit
  scoring — unlocked over time at 25 s / 65 s / 115 s with weighted
  rarity and rising frequency.
- Seven power-ups: Speed Boost, Points Boost, Extra Life,
  Slow Asteroids, Protective Border, Rapid Fire, Multi-Shot; with
  independent jittered spawn schedule, field lifetime, eligibility
  rules, and timed effects stored as absolute expiries so pausing
  freezes them.
- Time-based difficulty curve (five keyframes across five minutes)
  driving spawn interval, asteroid speed multiplier, and special
  spawn chance.
- Scoring engine: +1/s survival accrual with fractional carry,
  flat 10-point hits, class multipliers, Points Boost doubling,
  and session-best tracking persisted to localStorage.
- Three-life model with post-hit invulnerability, respawn at
  centre, and game-over gating that freezes the simulation.
- HUD: score/best/lives plus effect chips with live countdowns.
- Presentation: starfield, screen shake, particle bursts, blinking
  invulnerability, shield ring, vector-drawn power-up glyphs.
- Deterministic test suite: 134 tests across 12 suites using
  `node:test`, seeded RNG, and fixed-step simulation helpers.
- GitHub Pages deployment workflow and Dependabot config.

[Unreleased]: https://github.com/szuck12/voidrock/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/szuck12/voidrock/compare/v1.0.0...v1.2.0
[1.0.0]: https://github.com/szuck12/voidrock/releases/tag/v1.0.0
