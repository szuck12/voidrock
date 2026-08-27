# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2026-08-26

### Changed
- Bronze asteroids now unlock at 60 s (was 25 s) and represent 70%
  of specials (was 58%).
- Gold asteroids now unlock at 120 s (was 115 s) and represent 30%
  of specials (was 42%).
- Consolidated duplicate special asteroid description in README.

## [1.3.0] - 2026-08-25

### Added
- Comprehensive test suite expansion: 223 tests across 17 suites
  (up from 159 tests across 14 suites).
- `test_collisions.js`: Direct unit tests for `projectileHitsAsteroid`,
  `destroyAsteroid`, `spawnBurst`, particle spawning, shield+multiplier
  combos, event emission, and phase guards.
- `test_powerup_edges.js`: Edge cases for `powerUpPosition`,
  `powerUpTimerRoll`, `createPowerUp`, `collectPowerUps` event
  emission, and `effectRemaining`.
- `test_game_edges.js`: Toggle pause phase guards, `createInitialState`
  determinism, `startNewRun` state reset, particle lifecycle, and
  shakeTimer countdown.
- `test_player_edges.js`: `decayVelocity` zero threshold,
  `updatePlayer` speedMult clamping, and `clampToBoard` idempotency.
- Augmented `test_scoring.js` with exact value assertions for all
  multiplier combinations (boost, 3x, 5x, bronze, gold).
- Augmented `test_game_flow.js` with restart state checks (elapsed,
  spawnTimer, projectiles, events, particles).
- Augmented `test_powerups.js` with rapid fire, multi shot, unknown
  type, and effectRemaining edge case tests.
- `docs/architecture.md` — core systems, module map, data flow,
  state model, collision system, spawning, entity lifecycle,
  rendering pipeline, configuration, deterministic design, and
  invariants.
- `docs/testing_guide.md` — test runner usage, file structure,
  deterministic helpers, patterns by module, adding new tests,
  common pitfalls, and coverage summary.

### Changed
- Expanded `docs/adding_powerup.md` from 5 short steps to a
  comprehensive recipe with config templates, effect hook patterns,
  rendering guidance, HUD integration, test examples, and
  documentation checklist.
- Expanded `docs/code_review_guide.md` from a bullet checklist to
  a detailed guide with architecture overview, invariant
  explanations, and common issues.
- Updated README.md documentation section to list all 10 docs
  files and expanded Further Reading links.
- Removed CSS borders around `.stage`; canvas `drawBorder()` edges
  remain.

## [1.2.1] - 2026-08-25

### Changed
- Expanded `docs/commenting_guidelines.md` with block/section
  comments, TODO/FIXEMarkers, vertical spacing, and line length
  rules.
- Expanded `docs/maintain_todo.md` with lifecycle table, tag
  reference, relationship to other docs, and hygiene rules.
- Expanded `docs/update_changelog.md` with version bump table,
  what-to-include/exclude checklists, and commit format guidance.

## [1.2.0] - 2026-08-24

### Added
- `docs/development_workflow.md` — prerequisites, day-to-day
  commands, project structure, making changes, commit conventions,
  code style, testing conventions, PR process, deployment, and
  common tasks.
- `docs/extension_patterns.md` — templates for new entities,
  systems, config groups, rendering elements, HUD chips, and test
  patterns.

### Changed
- Protective Border now destroys asteroids on contact and awards
  points (replaces redirect-only behavior).
- Shield label changed from "PROTECTIVE BORDER" to "SHOOT" in
  controls reference.
- Canvas CSS scales vertically to fit both width and height;
  removed expanding box on small viewports.
- Favicon simplified to inline SVG cyan triangle (transparent
  background).
- HUD label changed from "EFFECTS" to "POWER-UPS".
- Space bar instruction text updated from "Fire" to "SHIP FIRES".
- Power-up weight pool updated with 3x and 5x entries;
  `POWERUP_TYPES` now a single data-driven config object.
- Footer and styling refinements (arrow key spacing, badge update).
- Arrow keys display with A D on the left, W S on the right for
  clarity.

## [1.1.2] - 2026-08-23

### Changed
- Base asteroid speed increased from 70 to 115 px/s; per-tier speed
  increased from +30 to +50 px/s.
- Protective Border is now a protective effect: it redirects
  asteroids without destroying them and awards no points (replaces
  destructive wall that scored on contact).
- Speed Boost duration extended from 6 s to 15 s.
- Slow Asteroids duration extended from 6 s to 10 s.
- Rapid Fire duration extended from 8 s to 10 s.
- Protective Border duration extended from 10 s to 20 s.

## [1.1.1] - 2026-08-23

### Added
- Randomised spawn sizes: 50% large, 30% medium, 20% small
  (replaces always-large spawns).
- Four-sided spawn edges (top, bottom, left, right) — asteroids
  now enter from all sides of the arena.

### Changed
- Gold multiplier reduced from x5 to x4; special scoring now uses
  size-based points instead of flat 10.

### Removed
- Silver asteroid class and its x3 per-hit multiplier.
- `POWERUP_META` and `DURATIONS`/`WEIGHTS` config objects
  (replaced by `POWERUP_TYPES`).
- QuantLab references removed from documentation.

## [1.1.0] - 2026-08-22

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
