# VoidRock

![version](https://img.shields.io/badge/version-1.3.2-blue)

A minimalist arcade survival game built with vanilla JavaScript and
HTML5 Canvas. Pilot a wedge-fighter inside a walled arena, split
incoming rocks, chase rare gold asteroids for 4x scoring, and grab
power-ups before they fade — zero dependencies, no build step, just
open `index.html`.

The project uses centralised constants in `src/config.js`,
deterministic seeded logic for exact reproducibility, an exhaustive
`node:test` suite (223 tests), and a documentation-first workflow
(see `docs/`).

---

**Play now:** https://szuck12.github.io/voidrock/

---

## Installation

Requires Node.js >= 18 (for tests) and either Python 3 or any
static file server (for local play). No packages to install — the
game has zero runtime dependencies.

```bash
# run the test suite
npm test            # or: node run_tests.js

# play locally (http://localhost:8000)
npm start
```

`package.json` defines two scripts:

| Script | Purpose |
|--------|---------|
| `test` | Runs `node --test tests/test_*.js` — the full deterministic suite |
| `start` | Starts `python3 -m http.server 8000` — a local static file server |

## How to Play

| Key | Action |
| --- | --- |
| `W A S D` / arrow keys | Thrust (ship turns toward movement) |
| `SPACE` | Shoot |
| `P` / `Esc` | Pause |
| `ENTER` | Start / restart |

Survive. Every second alive is worth one point. Asteroids award
size-based scores on each hit:

| Size | Points |
| --- | --- |
| Large | 10 |
| Medium | 15 |
| Small | 20 |

Nine power-ups drop as gold capsules and are collected by touch:

| Power-up | Effect | Duration |
| --- | --- | --- |
| Speed Boost | 1.5x thrust and top speed | 15 s |
| Points Boost | All scoring doubled | 10 s |
| Extra Life | +1 life, capped at 3; only drops when eligible | instant |
| Slow Asteroids | Asteroid motion scaled to 45% | 10 s |
| Protective Border | Destroys asteroids on contact and awards points | 10 s |
| Rapid Fire | Cooldown cut to 45% | 10 s |
| Multi-Shot | Three-bolt spread | 10 s |
| 3x Score | All scoring tripled | 8 s |
| 5x Score | All scoring quintupled | 6 s |

Score multipliers (Points Boost, 3x, 5x) combine multiplicatively.
The 3x power-up unlocks after 60 s and the 5x after 120 s; both are
rarer than standard power-ups. Power-up generation frequency
increases gradually as the game progresses.

## Game Mechanics

### Player

The ship uses acceleration-based movement with exponential damping,
giving a responsive but weighty arcade feel. Holding a movement key
applies 1800 px/s² of thrust; velocity decays exponentially at
6.0/s and is hard-capped at 380 px/s. Facing turns toward the
movement direction at a bounded rate (14 rad/s); with no input the
last facing holds so you can aim while drifting. Edges clamp the
ship fully inside the 960 × 640 playfield — there is no wrapping.

The player starts with 3 lives. A collision with an asteroid costs
one life, triggers a 2 s invulnerability window (rendered as a
blink), and recentres the ship. When lives reach zero the game ends.

### Asteroids

Rocks spawn from all four edges and appear in three sizes:

| Level | Radius | Base speed |
| --- | --- | --- |
| 3 (large) | 38 px | 115 px/s |
| 2 (medium) | 23 px | +50 px/s over parent |
| 1 (small) | 12 px | +50 px/s again |

Spawn sizes use weighted random selection: 50% large, 30% medium,
20% small. Speeds carry ±25% variance. Each asteroid is rendered as
a procedurally generated irregular polygon with 8–11 vertices and
individual spin.

When hit, large and medium asteroids split into two children of the
next smaller level with diverging trajectories and a slight speed
boost (1.05×). Small asteroids are destroyed outright. Special
asteroid classes (bronze, gold) are inherited by children so an
asteroid's value is consistent through its split stages.

Spawns keep ≥150 px from the player. The field is hard-capped at 24
simultaneous asteroids. Off-board asteroids that drift away are
culled once they exit the 80 px margin band, with a 3 s grace
period for newcomers that have not yet entered the playfield.

### Special Asteroids

Special classes unlock over time and carry per-hit score multipliers:

| Class | Unlock | Multiplier | Rarity among specials |
| --- | --- | --- | --- |
| Bronze | 60 s | x2 | 70% |
| Gold | 120 s | x4 | 30% |

Special status is rolled when an asteroid spawns. The probability
starts at 3% and rises to 20% by 5 minutes via the difficulty
curve. Once rolled, the class is chosen proportionally from
unlocked types — gold stays rare because of its smaller weight and
late unlock.

### Scoring

Points come from two sources:

1. **Asteroid hits** — size-based base score (large 10, medium 15,
   small 20) multiplied by the asteroid's special class and any
   active score power-ups.
2. **Survival** — +1 point per whole second alive, with fractional
   credit carried across frames for frame-rate-independent totals.

All multipliers apply multiplicatively. A gold asteroid hit while
Points Boost, 3x, and 5x are all active yields:

```
20 (small base) × 4 (gold) × 2 (boost) × 3 (3x) × 5 (5x) = 2400
```

The session best score is tracked in-memory and persisted to
`localStorage` across sessions.

### Power-Ups

Power-ups spawn on an independent jittered schedule (14 s ±4 s)
with at most 2 on the field. Uncollected capsules disappear after
12 s and flicker during their final 5 seconds as a visual warning.
Effects store absolute expiry times so pausing freezes them
naturally.

Spawn frequency scales with elapsed time (`freqScale = 1 + elapsed / 600`), making power-ups more common as the game progresses.
Duplicate prevention ensures no power-up spawns while one is
already on the board or while an effect of the same type is active.
Extra Life only drops when lives are below the cap and no Extra
Life is already on the field.

### Difficulty

Difficulty ramps on a keyframed curve over elapsed time (not
score). Values are linearly interpolated between seven keyframes
and held after the last:

| t (s) | Spawn interval | Speed mult | Special chance |
| --- | --- | --- | --- |
| 0 | 1.6 s | 1.00 | 3% |
| 30 | 1.5 s | 1.10 | 5% |
| 60 | 1.3 s | 1.22 | 8% |
| 100 | 1.08 s | 1.36 | 11% |
| 150 | 0.88 s | 1.52 | 14% |
| 220 | 0.71 s | 1.72 | 17% |
| 300 | 0.58 s | 1.95 | 20% |

Monotonicity of all three parameters is enforced by tests.

### Projectiles

Projectiles travel at 620 px/s with a 0.8 s lifetime (≈496 px
range). The fire cooldown is 0.22 s; Rapid Fire multiplies it by
0.45. Multi-Shot adds two extra bolts at ±0.16 rad. A hard cap of
40 active shots prevents unbounded accumulation.

Collision uses a swept segment test (previous position to current)
against each asteroid circle, so fast shots cannot tunnel through
thin bodies between frames. Each projectile resolves against at
most one asteroid (the nearest along its path), guaranteeing one
score per shot.

## Technical Overview

VoidRock is written entirely in vanilla ES-module JavaScript with
no build step, no transpiler, and no runtime dependencies. The game
runs directly in the browser via `<script type="module">`.

### Architecture

All mutable run state lives in a single plain object created by
`createInitialState()`. Systems mutate it through small, ordered
functions driven by `stepGame()`, which takes explicit input flags
and a fixed delta time. Nothing in the game-logic layer touches the
DOM, Canvas, or wall clocks — `main.js` is the only module that
interfaces with the browser environment. This separation makes
every scenario exactly reproducible in tests without mocks or
sleeps.

The game loop uses `requestAnimationFrame` with a 50 ms per-frame
clamp so background tab switches cannot cause a spiral of death.
Discrete key events (`Enter`, `P`, `Escape`) drive phase
transitions; held keys are consumed as continuous input flags by the
simulation step.

### State Machine

The game cycles through four phases:

| Phase | Behaviour |
| --- | --- |
| `menu` | Title overlay shown; particles still decay for visual polish |
| `playing` | Full simulation: movement, spawning, collisions, scoring |
| `paused` | Simulation frozen; effect timers frozen (absolute expiry) |
| `game_over` | Score frozen; particles finish; restart available via Enter |

### Rendering

All drawing happens in board coordinates (960 × 640) via a
device-pixel-ratio-aware transform. The visual language is
minimalist monochrome line art on black with restrained metallic
accents reserved for special asteroids and power-ups:

- **Player** — white chevron hull with cyan cockpit dot and thrust
  flame; blinks during invulnerability.
- **Asteroids** — irregular stroked polygons with per-class stroke
  colour (grey/bronze/gold), individual spin, and dark fill.
- **Projectiles** — bright tracer bolts with short fading trails.
- **Power-ups** — gold capsules with pulsing rings and vector
  glyphs communicating each type's function.
- **Particles** — fading squares spawned in bursts on hits and
  deaths, colour-matched to the destroyed entity.
- **Shield** — animated dashed ring around the ship during
  Protective Border.
- **Starfield** — 90 stars with parallax twinkle, continuing during
  pause and menus via wall-clock time.
- **Screen shake** — brief displacement on hits (0.08 s) and deaths
  (0.35 s).

### Deterministic Design

All game randomness flows through an injected `rng` function backed
by a mulberry32 seeded PRNG. Combined with explicit `dt` stepping,
this means the same seed plus the same input sequence reproduces
the identical run — used extensively by the test suite and
identified as a foundation for future replay sharing.

### Collision Detection

- **Projectile vs asteroid** — swept segment-to-circle test using
  `pointSegmentDistance()`. Prevents tunnelling at any frame rate.
- **Player vs asteroid** — circle-circle overlap using squared
  distances (avoids a `sqrt` per check per frame).
- **Player vs power-up** — circle-circle overlap, same approach.

One projectile scores at most once: the nearest hit asteroid
resolves, the bolt dies before scoring, so a single shot can never
credit twice.

### Centralised Configuration

Every tunable gameplay number lives in `src/config.js`. Systems
read from this module and never hard-code their own copies. This
includes board dimensions, player physics, projectile tuning,
asteroid geometry and speeds, scoring rules, special asteroid
unlock times and weights, difficulty keyframes, power-up
definitions and tuning, particle pool limits, and screen shake
durations.

## Project Structure

```
voidrock/
├── .github/
│   ├── dependabot.yml            # Weekly npm + Actions updates
│   └── workflows/
│       ├── deploy-pages.yml      # GitHub Pages deployment
│       └── test.yml              # Pre-commit test + failure gating
├── docs/                         # Development guides
│   ├── adding_powerup.md         # Recipe: new power-up types
│   ├── architecture.md           # Systems, data flow, invariants
│   ├── code_review_guide.md      # Fast-track + deep-dive review
│   ├── commenting_guidelines.md  # Comment style rules
│   ├── development_workflow.md   # Setup, run, contribute
│   ├── extension_patterns.md     # Entity/system creation templates
│   ├── game_mechanics.md         # Tuning values + design notes
│   ├── maintain_todo.md          # TODO.md conventions
│   ├── testing_guide.md          # Test patterns and conventions
│   └── update_changelog.md       # CHANGELOG.md conventions
├── src/                          # Game source (ES modules)
│   ├── config.js                 # Every tunable constant
│   ├── game.js                   # State machine + stepGame loop
│   ├── hud.js                    # DOM HUD bindings
│   ├── input.js                  # Keyboard state tracking
│   ├── main.js                   # Browser bootstrap + RAF loop
│   ├── render.js                 # Canvas drawing (all visuals)
│   ├── entities/                 # Player, projectile, asteroid
│   │   ├── asteroid.js           # Creation, movement, split
│   │   ├── player.js             # Ship physics, board clamping
│   │   └── projectile.js         # Shot creation + lifetime
│   ├── systems/                  # Scoring, difficulty, spawner,
│   │                             # power-ups, collisions
│   │   ├── collisions.js         # Hit/destroy resolution
│   │   ├── difficulty.js         # Keyframe curve + special rolls
│   │   ├── powerups.js           # Spawn, collect, effects
│   │   ├── scoring.js            # Score + best tracking
│   │   └── spawner.js            # Asteroid spawn scheduling
│   └── utils/                    # Seeded RNG + math helpers
│       ├── math.js               # Geometry helpers
│       └── rng.js                # mulberry32 PRNG + selection
├── tests/                        # node:test suite
│   ├── helpers.js                # Deterministic fixtures
│   ├── test_asteroids.js         # Movement, culling, speeds
│   ├── test_collisions.js        # Direct collision primitives
│   ├── test_config.js            # Config sanity
│   ├── test_difficulty.js        # Curve + integration
│   ├── test_game_edges.js        # Game state edge cases
│   ├── test_game_flow.js         # Phases, lives, restart, pause
│   ├── test_math.js              # Math helpers
│   ├── test_player.js            # Player physics + clamping
│   ├── test_player_edges.js      # Player edge cases
│   ├── test_powerups.js          # Power-up scheduling + effects
│   ├── test_powerup_edges.js     # Power-up edge cases
│   ├── test_projectiles.js       # Projectile lifecycle
│   ├── test_rng.js               # Seeded RNG
│   ├── test_scoring.js           # Scoring exact values
│   └── test_specials.js          # Special asteroids
├── index.html                    # Game shell: HUD + overlays
├── styles.css                    # Terminal-flavoured styling
├── run_tests.js                  # Convenience test runner
├── package.json                  # npm scripts (test/start)
├── requirements.txt              # Runtime note (stdlib only)
├── LICENSE                       # MIT
├── SECURITY.md                   # Vulnerability reporting
├── CHANGELOG.md                  # Keep-a-Changelog history
└── TODO.md                       # Living task list
```

`TODO.md` tracks planned work and ideas — see
[docs/maintain_todo.md](docs/maintain_todo.md) for how to maintain
it.

## Testing

All gameplay logic lives in pure modules driven by injected `dt`
and an injectable seeded RNG (mulberry32); wall-clock time and DOM
access are quarantined in `main.js`. This makes every scenario —
spawn schedules, power-up expiry, collision chains, difficulty
curves — exactly reproducible in tests without mocks or sleeps.

The suite has 223 tests across 15 files:

| File | Coverage |
| --- | --- |
| `test_asteroids.js` | Movement, culling, off-board margins, speeds |
| `test_collisions.js` | Swept segment hit, destroy/burst, shield combos |
| `test_config.js` | Constant sanity, monotonicity, unlock ordering |
| `test_difficulty.js` | Keyframe interpolation, monotonicity, special roll |
| `test_game_edges.js` | Pause guards, determinism, reset, particles, shake |
| `test_game_flow.js` | Phases, lives, restart state, game-over transition |
| `test_math.js` | Clamp, length, distance, pointSegment, circles, lerp |
| `test_player.js` | Acceleration, damping, speed cap, facing, clamping |
| `test_player_edges.js` | Zero threshold, speedMult clamping, idempotency |
| `test_powerups.js` | Scheduling, eligibility, effects, rapid/multi |
| `test_powerup_edges.js` | Position, timer roll, creation, event emission |
| `test_projectiles.js` | Lifecycle, swept collision, one-score guarantee |
| `test_rng.js` | Seeded output, range, intInRange, pickWeighted |
| `test_scoring.js` | Size scores, all multiplier combinations |
| `test_specials.js` | Unlock times, class weights, inheritance on split |

### Running Tests

```bash
# Full suite via npm
npm test

# Full suite via the convenience runner (indented TAP output)
node run_tests.js

# A single test file
node --test tests/test_scoring.js
```

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via
`.github/workflows/deploy-pages.yml`. The workflow stages
`index.html`, `styles.css`, and `src/` into the artifact — there is
no build step. The site can also be hosted from any static file
server as-is.

## Further Reading

* `docs/architecture.md` — core systems, module map, data flow,
  state model, collision system, and invariants
* `docs/testing_guide.md` — test patterns, deterministic testing,
  how to write and run tests
* `docs/development_workflow.md` — setup, project structure,
  commit conventions, PR process
* `docs/extension_patterns.md` — templates for new entities,
  systems, config groups, and rendering elements
* `docs/adding_powerup.md` — step-by-step recipe for new power-ups
* `docs/code_review_guide.md` — per-commit gate and scheduled
  deep-dive review
* `docs/commenting_guidelines.md` — how source comments are written
* `docs/game_mechanics.md` — tuning values and design rationale
* `docs/maintain_todo.md` — how TODO.md is maintained
* `docs/update_changelog.md` — how CHANGELOG.md is maintained

## License

MIT — see `LICENSE`.
