# Game Mechanics Reference

The tuning numbers and design rules behind Voidrock. Every value
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
| 3 (large) | 38 px | 70 px/s |
| 2 (medium) | 23 px | +30 px/s over parent tier |
| 1 (small) | 12 px | +30 px/s again |

* Speeds carry ±35% variance; children inherit heading ± divergence.
* Spawn edges are top / left / right only (weighted 50/25/25) —
  never the bottom, where the HUD focus sits.
* Spawns keep ≥150 px from the player when possible.
* Off-board margin 80 px with an `entered` flag and a 3 s grace:
  newcomers may approach, entered asteroids that leave are culled,
  strays that never enter age out. Field hard-capped at 24.

## Specials

Unlocks at 25 s / 65 s / 115 s (bronze / silver / gold). Among
specials, weights are bronze .58 / silver .30 / gold .12. Per-hit
multipliers x2 / x3 / x5 apply on top of the flat 10-point base —
size never matters, class does.

## Difficulty Curve

Five keyframes at 0/60/120/180/300 s, linearly interpolated and
held after the last:

| t (s) | spawn interval | speed mult | special chance |
| --- | --- | --- | --- |
| 0 | 2.4 s | 1.00 | .03 |
| 60 | 1.9 s | 1.15 | .06 |
| 120 | 1.5 s | 1.30 | .10 |
| 180 | 1.15 s | 1.45 | .14 |
| 300 | 0.8 s | 1.60 | .20 |

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
  after 12 s; spawns keep ≥90 px from the player.
* Effects store absolute expiry times (`elapsed + duration`), so
  pausing freezes them naturally. Durations:

| Type | Duration | Notes |
| --- | --- | --- |
| Speed Boost | 6 s | 1.5x accel/cap |
| Points Boost | 15 s | all scoring x2 |
| Slow Asteroids | 6 s | displacement x0.45, velocities preserved |
| Protective Border | 10 s | wall contact destroys rocks (scores!) |
| Rapid Fire | 8 s | cooldown x0.45 |
| Multi-Shot | 8 s | three-bolt spread |
| Extra Life | instant | capped at 3; suppressed while full or one is on field |

* Player collisions resolve against a snapshot of the asteroid
  list: split children created during the step wait for the next
  frame, preventing same-frame cascade kills under the border.

## Scoring

* +1 per whole second survived, fractional credit carries across
  arbitrary step sizes (frame-rate independent totals).
* Hits route through `addScore`, which also raises `bestScore`;
  best persists to localStorage between sessions.

## Presentation

* Screen shake on hits/deaths; particle bursts scale with rock
  level (pool capped at 320).
* Starfield of 90 stars with parallax twinkle continues during
  pause/menus via wall-clock animation time — visuals only.
