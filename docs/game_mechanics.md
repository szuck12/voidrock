# Game Mechanics Reference

The tuning numbers and design rules behind VoidRock. Every value
here lives in `src/config.js` — this document explains *why*, the
code defines *what*.

## Board and Frame

* Logical playfield: **960 x 640** px; the canvas scales fluidly
  around it with a device-pixel-ratio aware transform.
* The simulation advances in fixed logical steps driven by
  requestAnimationFrame, clamped to 50 ms per frame so background
  tab switches cannot cause a "spiral of death".

## Ship

* Acceleration-based movement: thrust **1800 px/s²**, exponential
  damping **6.0/s** → equilibrium cruise ≈ **300 px/s**, hard cap
  **380 px/s** (Speed Boost multiplies both by 1.5).
* Facing turns toward the input direction at a bounded rate;
  firing uses facing, not velocity.
* Edges clamp fully inside the board; the into-wall velocity
  component zeroes to avoid sticky sliding.
* Three lives. A hit costs one life, grants **2 s** invulnerability
  (rendered as a blink), and recentres the ship.

## Asteroids

| Level | Radius | Base speed |
| --- | --- | --- |
| 3 (large) | 38 px | 115 px/s |
| 2 (medium) | 23 px | +50 px/s over parent tier |
| 1 (small) | 12 px | +50 px/s again |

* Speeds carry ±35% variance; children inherit heading ± divergence.
* Spawn edges are all four sides — top, bottom, left, right —
  weighted equally at 25% each.
* Spawn sizes use weighted random selection: 50% large, 30% medium,
  20% small.
* Spawns keep ≥150 px from the player when possible.
* Off-board margin 80 px with an `entered` flag and a 3 s grace:
  newcomers may approach, entered asteroids that leave are culled,
  strays that never enter age out. Field hard-capped at 24.

## Specials

Unlocks at 25 s / 115 s (bronze / gold). Silver has been removed.
Among specials, weights are bronze .58 / gold .42. Per-hit
multipliers x2 / x4 apply on top of the size-based base score.

Scoring per hit:

| Size | Bronze (x2) | Gold (x4) |
| --- | --- | --- |
| Large (10 pts) | 20 | 40 |
| Medium (15 pts) | 30 | 60 |
| Small (20 pts) | 40 | 80 |

## Difficulty Curve

Seven keyframes at 0/30/60/100/150/220/300 s, linearly interpolated
and held after the last:

| t (s) | spawn interval | speed mult | special chance |
| --- | --- | --- | --- |
| 0 | 1.6 s | 1.00 | .03 |
| 30 | 1.5 s | 1.10 | .05 |
| 60 | 1.3 s | 1.22 | .08 |
| 100 | 1.08 s | 1.36 | .11 |
| 150 | 0.88 s | 1.52 | .14 |
| 220 | 0.71 s | 1.72 | .17 |
| 300 | 0.58 s | 1.95 | .20 |

Monotonicity is enforced by tests (`tests/test_difficulty.js`).

## Projectiles

* Speed 620 px/s, lifetime 0.8 s, radius 3 px.
* Cooldown 0.22 s (Rapid Fire multiplies by 0.45); Multi-Shot adds
  two bolts at ±0.16 rad, fanned from points on the hull ring.
* Max 40 active shots; oldest-behaviour is moot because shots die
  fast — the cap gates spam.
* Collision uses the swept segment prev→current against the
  target circle, so no tunnelling at any frame rate.
* One projectile scores at most once per shot: the nearest hit
  resolves, the bolt dies before scoring.

## Power-Ups

* Spawn schedule independent of gameplay events: first roll at run
  start, reload-on-expiry with sub-frame remainder carry, interval
  14 s ±4 s jitter. Max 2 on field; uncollected capsules expire
  after 12 s; spawns keep ≥150 px from the player.
* Spawn frequency scales with elapsed time: `freqScale = 1 + elapsed / 600`,
  so power-ups drop more often as the game progresses.
* Duplicate prevention: no power-up spawns while one is already
  on the board, and an active effect prevents a new one from
  spawning for the same type.
* Effects store absolute expiry times (`elapsed + duration`), so
  pausing freezes them naturally.

| Type | Duration | Weight | Unlocks at | Notes |
| --- | --- | --- | --- | --- |
| Speed Boost | 15 s | 20 | 0 s | 1.5x accel/cap |
| Points Boost | 10 s | 18 | 0 s | all scoring x2 |
| Slow Asteroids | 10 s | 16 | 0 s | displacement x0.45, velocities preserved |
| Protective Border | 10 s | 16 | 0 s | destroys asteroids on contact; awards points |
| Rapid Fire | 10 s | 14 | 0 s | cooldown x0.45 |
| Multi-Shot | 10 s | 10 | 0 s | three-bolt spread |
| Extra Life | instant | 8 | 0 s | capped at 3; only drops when below max |
| 3x Score | 8 s | 4 | 60 s | all scoring x3 |
| 5x Score | 6 s | 2 | 120 s | all scoring x5 |

* Player collisions resolve against a snapshot of the asteroid
  list: split children created during the step wait for the next
  frame, preventing same-frame cascade kills under the shield.

## Scoring

Scoring is size-based, not flat:

| Asteroid size | Points per hit |
| --- | --- |
| Large | 10 |
| Medium | 15 |
| Small | 20 |

* +1 per whole second survived, fractional credit carries across
  arbitrary step sizes (frame-rate independent totals).
* Multipliers (gold x4, Points Boost x2, 3x, 5x) apply
  multiplicatively on top of the size-based score.
* Hits route through `addScore`, which also raises `bestScore`;
  best persists to localStorage between sessions.

## Presentation

* Screen shake on hits/deaths; particle bursts scale with rock
  level (pool capped at 320).
* Starfield of 90 stars with parallax twinkle continues during
  pause/menus via wall-clock animation time — visuals only.
