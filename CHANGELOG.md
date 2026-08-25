# Changelog

All notable changes to this project will be documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-22

Initial release.

### Added

- Core arcade loop: thrust-based ship movement clamped inside a
  walled arena, inertial damping, and facing that tracks movement.
- Projectile system with fire cooldown, active-shot cap, swept-path
  collision (no tunnelling), and one-score-per-shot guarantees.
- Asteroid lifecycle: three sizes that split twice, polygonal
  procedurally-shaped rendering, off-board spawn edges (never from
  the bottom), enter-grace culling, and a hard field cap.
- Special asteroid classes — Bronze x2, Silver x3, Gold x5 per-hit
  scoring — unlocked over time at 25 s / 65 s / 115 s with weighted
  rarity and rising frequency.
- Seven power-ups: Speed Boost, Points Boost, Extra Life,
  Slow Asteroids, Protective Border, Rapid Fire, Multi-Shot; with
  independent jittered spawn schedule, field lifetime, eligibility
  rules (Extra Life only when lives < max and none on field), and
  timed effects stored as absolute expiries so pausing freezes them.
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

[Unreleased]: https://github.com/szuck12/voidrock/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/szuck12/voidrock/releases/tag/v1.0.0
