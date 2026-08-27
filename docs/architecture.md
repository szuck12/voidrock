# Architecture

This document describes how VoidRock's source code is organised,
how data flows through the game loop, and which invariants must
hold for the simulation to remain deterministic and testable.

---

## Module Map

Every file lives under `src/` and has a single, stated
responsibility.  The table lists each module, its purpose, and the
boundary it must not cross.

| File | Lines | Purpose | Must not |
| --- | --- | --- | --- |
| `config.js` | 213 | All tunable gameplay constants | import anything; mutate |
| `game.js` | 338 | State model, `stepGame` simulation driver | touch DOM, Canvas, wall clocks |
| `main.js` | 183 | Browser bootstrap, RAF loop, DOM/Canvas setup | contain game logic |
| `render.js` | 427 | Canvas drawing of every visual element | mutate game state |
| `input.js` | 61 | Keyboard capture into a boolean-flag object | read game state |
| `hud.js` | 113 | DOM synchronisation for score, lives, chips | mutate game state |
| `entities/player.js` | 145 | Ship creation, movement physics, board clamping | import DOM or browser globals |
| `entities/asteroid.js` | 136 | Asteroid creation, movement, split progression | import DOM or browser globals |
| `entities/projectile.js` | 53 | Projectile creation, movement, lifetime | import DOM or browser globals |
| `systems/collisions.js` | 217 | Collision resolution: projectile/asteroid, player/asteroid, shield | import DOM or browser globals |
| `systems/difficulty.js` | 138 | Keyframe-interpolated difficulty, special asteroid rolls | import DOM or browser globals |
| `systems/powerups.js` | 303 | Power-up spawning, eligibility, collection, effects | import DOM or browser globals |
| `systems/scoring.js` | 74 | Score calculation, survival accrual, best tracking | import DOM or browser globals |
| `systems/spawner.js` | 178 | Asteroid spawn placement, scheduling, edge selection | import DOM or browser globals |
| `utils/math.js` | 153 | Vector, geometry, and interpolation helpers | import game state or config |
| `utils/rng.js` | 62 | Seeded PRNG (mulberry32) and weighted selection | import game state |

The dependency graph flows one way:

```
config.js          (leaf — no imports)
utils/math.js      (leaf — no imports)
utils/rng.js       (leaf — no imports)
entities/*         ← config, utils
systems/*          ← config, utils, entities, sibling systems
game.js            ← config, entities, systems, utils/rng
render.js          ← config (read-only)
input.js           (leaf — no imports)
hud.js             ← config, systems/powerups (read-only)
main.js            ← config, game, input, render, hud
```

No module in `entities/` or `systems/` may import `main.js`,
`render.js`, `hud.js`, or `input.js`.  The separation is enforced
by the module system: those four modules touch the browser
environment, while everything else operates on plain data.

---

## The Single State Object

All mutable run state lives on one plain object created by
`createInitialState()`.  There is no hidden global state, no
module-level caches, and no singleton patterns.  The object's top
level contains:

| Field | Type | Description |
| --- | --- | --- |
| `phase` | `string` | `"menu"` \| `"playing"` \| `"paused"` \| `"game_over"` |
| `rng` | `function` | Seeded PRNG returning floats in [0, 1) |
| `player` | `object` | Ship position, velocity, facing, radius, timers |
| `respawnX` | `number` | Centre X for respawn |
| `respawnY` | `number` | Centre Y for respawn |
| `asteroids` | `array` | All active asteroid entities |
| `projectiles` | `array` | All active projectile entities |
| `powerups` | `array` | All capsules on the field |
| `particles` | `array` | Explosion debris particles |
| `events` | `array` | Presentation events consumed once per step |
| `effects` | `object` | Active timed power-up effects (key → absolute expiry) |
| `score` | `number` | Current run score |
| `bestScore` | `number` | Session-best score (persisted to localStorage) |
| `lives` | `number` | Remaining lives (0 → game_over) |
| `elapsed` | `number` | Seconds elapsed in the current run |
| `timeScoreCarry` | `number` | Fractional survival-score carry |
| `fireCooldown` | `number` | Seconds until the next shot is allowed |
| `spawnTimer` | `number` | Seconds until the next asteroid spawn |
| `powerUpTimer` | `number` | Seconds until the next power-up spawn attempt |
| `shakeTimer` | `number` | Seconds of remaining screen shake |
| `stars` | `array` | Static starfield descriptors (generated once) |

### Player sub-object

| Field | Type | Description |
| --- | --- | --- |
| `x`, `y` | `number` | Position in board coordinates |
| `vx`, `vy` | `number` | Velocity (px/s) |
| `facing` | `number` | Current heading in radians |
| `radius` | `number` | Collision radius (13 px) |
| `thrusting` | `boolean` | Whether the thrust flame renders |
| `invulnerableFor` | `number` | Seconds of remaining post-hit safety |

### Asteroid fields

Each asteroid carries: `type`, `level`, `x`, `y`, `vx`, `vy`,
`radius`, `angle`, `shape` (vertex factors), `spin`, `rotation`,
`age`, `entered`, `alive`.

### Projectile fields

Each projectile carries: `x`, `y`, `prevX`, `prevY`, `vx`, `vy`,
`angle`, `radius`, `age`, `alive`.  The `prevX`/`prevY` pair
supports swept-segment collision.

### Effects object

Timed effects are stored as `{ [effectName]: expiryTime }` where
`expiryTime = state.elapsed + duration`.  This makes pausing
freeze all effects naturally: `state.elapsed` stops advancing, so
every expiry time remains in the future.

---

## Game Loop

The game loop lives in `main.js` and follows this sequence on
every animation frame:

```
requestAnimationFrame(loop)
  └─ frame(now)
       ├─ rawDt = (now - lastTime) / 1000
       ├─ dt = min(rawDt, 0.05)          ← 50 ms clamp
       ├─ stepGame(state, input, dt)      ← simulation
       ├─ render(ctx, state, now)         ← canvas drawing
       ├─ hud.update(state)               ← DOM sync
       ├─ syncOverlay(state)              ← overlay visibility
       └─ drainEvents(state)              ← clear event queue
```

The 50 ms clamp prevents a spiral of death when the browser tab
regains focus after being backgrounded.  Without it, a single
frame could simulate seconds of game time in one step, spawning
dozens of entities and collapsing the frame rate further.

### Deterministic step

`stepGame(state, input, dt)` is the simulation entry point.  It
receives three explicit arguments and never reads wall clocks,
`Date.now()`, `performance.now()`, `Math.random()`, or the DOM.
Given the same state, input, and dt, it produces the same result
every time.

The step order matters:

```
1.  Clear events from the previous step
2.  Update particles (move, age, cull)
3.  Decrement shakeTimer
4.  If not playing, return early
5.  Increment elapsed by dt
6.  Update player movement (acceleration, damping, clamping)
7.  Update shooting (cooldown, fire, create projectiles)
8.  Update all projectiles (move, expire by age)
9.  Spawn asteroids (spawner timer, difficulty curve)
10. Update all asteroids (move, rotate; apply slowFactor if active)
11. Cull off-board projectiles
12. Cull off-board asteroids (entered flag, grace period)
13. Resolve projectile vs asteroid collisions (swept segment)
14. Collect power-ups (ship overlap)
15. Update power-up spawning (independent timer)
16. Expire uncollected power-ups from the field
17. Accrue survival time score (fractional carry)
18. Expire timed effects
19. Resolve player vs asteroid collisions (snapshot iteration)
```

Order is significant.  For example, projectile collisions (step 13)
must resolve before player collisions (step 19) so that a shot
that destroys an asteroid in the same frame cannot also damage the
player.  Asteroid culling (step 12) must precede spawning (step 9)
is incorrect — spawning runs before culling so that the field
cap check reflects the true count.  The exact order in the code is:

```
updateMovement → updateShooting → updateProjectile (all) →
updateSpawning → updateAsteroid (all) → cullProjectiles →
cullAsteroids → resolveProjectileHits → collectPowerUps →
updatePowerUpSpawning → expirePowerUps → updateTimeScore →
expireEffects → resolvePlayerCollisions
```

---

## State Machine

The game has four phases.  Transitions are triggered by keyboard
events in `main.js`:

```
              Enter
  menu ──────────────► playing
                       ▲    │
              Enter    │    │ P / Esc
  game_over ──────────┘    │
                       ◄────┘
                     paused
```

| Phase | `stepGame` behaviour | Overlay visible |
| --- | --- | --- |
| `menu` | Particles decay only; no simulation | Menu overlay |
| `playing` | Full simulation loop | None |
| `paused` | Returns immediately after particle/shake updates | Paused overlay |
| `game_over` | Returns immediately after particle/shake updates | Game Over overlay |

Phase transitions never happen inside `stepGame`.  They are
triggered by `keydown` handlers in `main.js` which call
`startNewRun()` or `togglePause()`.  This keeps the simulation
pure: it observes `state.phase` but never changes it (except
`game_over` set by `loseLife` when lives reach zero).

---

## Collision System

### Swept-segment projectile collision

Fast projectiles can travel far enough in one frame to skip past a
small asteroid entirely (tunneling).  VoidRock prevents this with a
swept-segment test:

```
For each alive projectile:
  1. Compute the line segment from (prevX, prevY) to (x, y)
  2. For each alive asteroid:
     a. Compute pointSegmentDistance from asteroid centre to segment
     b. If distance ≤ projectile.radius + asteroid.radius → hit
  3. Among all hits, choose the nearest asteroid
  4. Mark the projectile dead before scoring
  5. Destroy the asteroid (split or remove, emit particles)
```

The `pointSegmentDistance` function projects the point onto the
segment and clamps the parameter `t` to [0, 1], handling both
perpendicular projections and endpoints.  Degenerate zero-length
segments (stationary projectile) fall back to plain point distance.

### One-projectile-one-hit rule

A single projectile resolves against at most one asteroid — the
nearest along its path.  The projectile is marked `alive = false`
immediately after scoring.  This guarantees:

- One score per shot, ever.
- No double-kills from overlapping asteroids.
- No orphaned projectiles left alive after a hit.

### Player vs asteroid

Player collisions iterate a snapshot of the asteroid list (spread
copy).  This prevents split children created during the same step
from resolving against the player in the same frame, which would
cause cascade kills.

When the Protective Border is active, the colliding asteroid is
destroyed with normal score and no life loss.  Otherwise, one life
is lost, the ship recentres, and a 2-second invulnerability window
begins.  At most one life is lost per step — the function returns
after the first collision.

### Circle-circle overlap

Player vs asteroid and player vs power-up both use
`circlesOverlap()`, which compares squared distances against the
sum of radii squared.  This avoids a `sqrt` per check per frame.

---

## Spawning System

### Asteroid spawning

`updateSpawning` decrements `state.spawnTimer` each step.  When it
reaches zero:

1. Look up the current difficulty (spawn interval, speed multiplier,
   special chance) by linearly interpolating the keyframe curve.
2. Roll the special class: `rollSpecialType` first rolls against the
   special chance, then selects among unlocked classes weighted by
   `SPECIAL.TYPE_WEIGHTS`.
3. Pick the size: `pickSpawnSize` uses weighted random from
   `ASTEROID.SIZE_WEIGHTS` (50% large, 30% medium, 20% small).
4. Pick the edge: uniform 25% per side via `pickSpawnEdge`.
5. Find a position on the edge: rejection sampling up to 24 attempts,
   rejecting positions within `MIN_PLAYER_DISTANCE` of the ship.
   Fallback: edge midpoint farthest from the player.
6. Aim inward: `spawnAngle` produces a heading within ±60° of the
   edge's inward normal.
7. Reload the timer from the difficulty's spawn interval.

The field is hard-capped at `ASTEROID.MAX_COUNT` (24).  If the cap
is reached, spawning is suppressed until asteroids are culled or
destroyed.

### Power-up spawning

`updatePowerUpSpawning` runs on its own independent timer, separate
from asteroid spawning.  The timer reloads *before* attempting a
spawn, so a successful or failed spawn never affects the next
schedule.

Eligibility is computed by `eligibleWeights()`, which applies these
rules in a single pass:

- **Unlock gating**: `score_3x` requires `elapsed ≥ 60`,
  `score_5x` requires `elapsed ≥ 120`.
- **Extra Life**: ineligible at max lives; ineligible if one is
  already on the field.
- **Duplicate exclusion**: if a type is already active as an effect
  or present on the board, its weight is zeroed.
- **Frequency scaling**: base weights grow by `1 + elapsed / 600`,
  giving ~50% more spawns at 5 min and ~100% at 10 min.

At most `POWERUP.MAX_ON_SCREEN` (2) capsules exist at once.
Uncollected capsules expire after `POWERUP.LIFETIME` (12 s) and
flicker during their final 5 seconds.

---

## Entity Lifecycle

### Spawn → Update → Collision → Remove

Every entity follows the same lifecycle:

1. **Spawn**: Created by a spawner or system, pushed into the
   relevant state array.
2. **Update**: Moved and aged by `stepGame`.  Projectiles record
   `prevX`/`prevY` for swept collision.  Asteroids rotate visually.
3. **Collision**: Tested against other entities.  A hit marks the
   entity `alive = false`.
4. **Remove**: Culling filters replace the array, dropping dead
   entities.  This happens once per step, after all collisions.

### Asteroid splitting

When a level > 1 asteroid is destroyed:

1. Mark the parent `alive = false`.
2. Emit a particle burst (count depends on level).
3. Call `splitAsteroid(parent, rng)`, which creates 2 children at
   `level - 1` with:
   - Positions offset slightly from the parent.
   - Angles diverging ±`CHILD_ANGLE_SPREAD` from the parent heading.
   - Speeds inheriting a fraction of the parent's momentum, plus
     `CHILD_SPEED_BOOST` (1.12×).
   - The same `type` (normal, bronze, gold) as the parent.
4. Push children into `state.asteroids`.
5. Set `shakeTimer` to `SHAKE.HIT_DURATION` (0.08 s).

Level 1 asteroids produce no children — they are simply destroyed.

### Projectile lifetime

Projectiles have a fixed lifetime of 0.8 s.  Each step, `age`
increases by `dt`.  When `age ≥ LIFETIME`, the projectile is
marked `alive = false`.  Additionally, projectiles that drift
beyond `ASTEROID.OFFBOARD_MARGIN` (80 px past the board edge) are
culled.

### Power-up lifetime

Power-ups have a field lifetime of 12 s.  `expirePowerUps` filters
out capsules where `elapsed - bornAt > POWERUP.LIFETIME`.  During
their final 5 seconds, the renderer flickers their alpha as a
visual warning.

---

## Rendering Pipeline

`render(ctx, state, timeMs)` draws one complete frame.  It reads
state but never mutates it.  The pipeline:

1. Clear the canvas to black.
2. Apply screen shake offset if `shakeTimer > 0`.
3. Draw the starfield (twinkling via wall-clock time).
4. Draw power-ups (gold capsules with pulsing rings and glyphs).
5. Draw asteroids (irregular stroked polygons, per-class colour).
6. Draw projectiles (tracer bolts with fading trails).
7. Draw particles (fading squares, colour-matched to source).
8. Draw the player ship (chevron hull, cockpit dot, thrust flame,
   blinks during invulnerability).
9. Draw the protective border ring if active.
10. Draw the playfield border.
11. Restore the canvas state.

The visual language is minimalist monochrome line art on black,
with restrained metallic accents reserved for special asteroids
(gold, bronze) and power-ups (gold rings).  The accent colour is
cyan (`#7ef9ff`).

Wall-clock time (`timeMs`) drives animations that should continue
during pause: starfield twinkle, power-up pulse, shield ring
rotation.  Game-time effects (particle movement, asteroid motion)
use `state.elapsed` and are frozen during pause.

---

## Configuration System

All gameplay numbers live in `src/config.js`.  Every constant
group is deeply frozen with `Object.freeze` to prevent accidental
mutation.

| Constant group | Contents |
| --- | --- |
| `BOARD` | Logical playfield dimensions (960 × 640) |
| `PLAYER` | Radius, acceleration, max speed, damping, turn speed, invulnerability duration |
| `LIVES` | Starting and maximum lives |
| `PROJECTILE` | Speed, lifetime, cooldown, radius, max active, power-up multipliers |
| `ASTEROID` | Radii per level, speeds, variance, split params, field cap, off-board margin, size weights |
| `SCORING` | Base scores per size, time score rate, power-up multipliers, special multipliers |
| `SPECIAL` | Unlock times and type weights for special asteroids |
| `DIFFICULTY` | Keyframe array for spawn interval, speed multiplier, special chance |
| `POWERUP_TYPES` | Per-type definitions: label, duration, weight, unlock time |
| `POWERUP` | Spawn tuning, field limits, effect magnitudes, derived durations/weights |
| `PARTICLES` | Pool cap, burst counts per level, lifetime, speed |
| `SHAKE` | Hit and death shake durations, magnitude |

Adding a new tunable: add the value to the appropriate group in
`config.js`, import it where needed, and never hard-code a
duplicate in the consuming module.

---

## Deterministic Design

The core design principle: **the same seed plus the same input
sequence produces the identical run, every time**.

### Seeded RNG

All randomness flows through `createRng(seed)`, which returns a
function backed by the mulberry32 algorithm.  The seed is set once
at run start (`Date.now()` in `main.js`, a fixed constant in
tests) and threaded through every system that needs randomness:
spawning, asteroid shape generation, power-up position selection,
special class rolls.

### Explicit dt

The simulation receives `dt` as an explicit parameter.  `main.js`
computes it from `performance.now()` differences and clamps it to
50 ms.  `stepGame` never reads a clock itself.

### Why it matters

- **Tests**: Every test creates a state with a fixed seed and steps
  it with a fixed dt.  Results are exactly reproducible across
  machines, OS versions, and Node.js releases.
- **Future replay**: A seed plus an input log (one boolean array per
  frame) fully describes a run.  This is the foundation for the
  replay-sharing feature listed in TODO.md.

### What breaks determinism

- `Math.random()` anywhere in `src/` (except `main.js`).
- `Date.now()` or `performance.now()` in game logic.
- Reading DOM state inside `stepGame` or any system.
- Unordered iteration over objects where spawn or roll order
  matters.

---

## Invariants

These rules are enforced by the code review guide and tests.
Violations should be caught in review or CI.

1. **Pure simulation**: `stepGame(state, input, dt)` depends only
   on its arguments.  No global reads, no DOM, no wall clocks.
2. **Single state object**: All mutable run state lives on the
   object returned by `createInitialState`.  No module-level
   mutable variables in game logic.
3. **Seeded RNG only**: All randomness uses the injected `rng`
   function.  `Math.random()` is forbidden outside `main.js`.
4. **Config centralisation**: Every tunable number lives in
   `config.js`.  Hard-coded magic numbers in logic code are
   rejected in review.
5. **One projectile, one hit**: A projectile resolves against at
   most one asteroid per step, then dies.
6. **Snapshot iteration for player collisions**: The asteroid list
   is copied before iterating so split children cannot cause
   same-frame cascade kills.
7. **Absolute effect expiry**: Timed effects store
   `elapsed + duration`, not countdown timers, so pausing freezes
   them automatically.
8. **Bounded entity counts**: Asteroids capped at 24, projectiles
   at 40, power-ups on screen at 2, particles at 320.  Spawners
   respect these limits.
9. **Velocity stored unscaled**: Slow Asteroids scales
   displacement, not velocity.  Effect expiry restores normal
   motion with zero bookkeeping.
10. **No mutation in rendering**: `render.js` reads state and draws
    geometry.  It never modifies any game state field.
