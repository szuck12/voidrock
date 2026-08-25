// asteroid.js
// Asteroid entity: creation, movement, and split progression.
//
// Asteroids come in three size levels (3 = large, 2 = medium,
// 1 = small).  A hit splits a level > 1 asteroid into two children
// of the next level; level 1 asteroids are destroyed.  Special
// classes (bronze/silver/gold) carry score multipliers and are
// inherited by children so an asteroid's value is consistent
// through its split stages.

import { ASTEROID } from "../config.js";
import { range, intInRange } from "../utils/rng.js";
import { TAU, length } from "../utils/math.js";

/**
 * Create an asteroid.
 *
 * Args:
 *     options: Overrides; at minimum provide `level` (3|2|1),
 *         `x`, `y`, `angle`, `rng`.  Optional `type` defaults to
 *         "normal"; `speedMult` scales the roll speed
 *         (difficulty-scaled spawns pass it through).
 *
 * Returns:
 *     Asteroid state object with an irregular polygon `shape`
 *     (vertex radius factors) generated from the rng.
 *
 * Note:
 *     Velocity is stored unscaled by temporary effects.  Slowdowns
 *     (Slow Asteroids power-up) are applied as a displacement
 *     factor in updateAsteroid() so expiring effects restore normal
 *     motion without bookkeeping and newly spawned asteroids are
 *     slowed consistently.
 */
export function createAsteroid(options) {
  const {
    level,
    x,
    y,
    angle,
    rng,
    type = "normal",
    speedMult = 1,
  } = options;

  const base = ASTEROID.BASE_SPEED + (3 - level) * ASTEROID.SPEED_PER_LEVEL;
  const variance = 1 + range(rng, -ASTEROID.SPEED_VARIANCE,
                             ASTEROID.SPEED_VARIANCE);
  const speed = base * speedMult * variance;

  const vertexCount = intInRange(rng, 8, 11);
  const shape = [];
  for (let i = 0; i < vertexCount; i++) {
    shape.push(range(rng, 0.78, 1.18));
  }

  return {
    type,
    level,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: ASTEROID.RADII[level],
    angle,
    shape,
    spin: range(rng, -1.4, 1.4),
    rotation: range(rng, 0, TAU),
    age: 0,
    entered: false,
    alive: true,
  };
}

/**
 * Advance an asteroid one step, including its visual rotation.
 *
 * Args:
 *     asteroid: Asteroid state object (mutated in place).
 *     dt: Elapsed seconds.
 *     slowFactor: Global multiplier applied while Slow Asteroids
 *         or Time Freeze effects are active; pass 1 otherwise.
 */
export function updateAsteroid(asteroid, dt, slowFactor = 1) {
  // The stored velocity stays unscaled so expiring effects restore
  // normal motion without bookkeeping; only displacement scales.
  asteroid.age += dt;
  asteroid.x += asteroid.vx * dt * slowFactor;
  asteroid.y += asteroid.vy * dt * slowFactor;
  asteroid.rotation += asteroid.spin * dt * slowFactor;
}

/**
 * Split a hit asteroid into its children.
 *
 * Large and medium asteroids produce two children of the next
 * smaller level with diverging trajectories around the parent's
 * heading.  Small asteroids produce no children — they are simply
 * destroyed.
 *
 * Args:
 *     asteroid: The asteroid that was hit.
 *     rng: Random source for child trajectories.
 *
 * Returns:
 *     Array of new child asteroids (empty when the parent was
 *     small).
 */
export function splitAsteroid(asteroid, rng) {
  if (asteroid.level <= 1) {
    return [];
  }
  const childLevel = asteroid.level - 1;
  const heading = Math.atan2(asteroid.vy, asteroid.vx);
  const spread = ASTEROID.CHILD_ANGLE_SPREAD;
  const children = [];
  for (let i = 0; i < ASTEROID.SPLIT_COUNT; i++) {
    // Children fan out symmetrically around the parent heading.
    const side = i === 0 ? -1 : 1;
    const angle = heading + side * spread * (0.5 + rng());
    children.push(createAsteroid({
      level: childLevel,
      x: asteroid.x + Math.cos(angle) * ASTEROID.RADII[childLevel] * 0.5,
      y: asteroid.y + Math.sin(angle) * ASTEROID.RADII[childLevel] * 0.5,
      angle,
      rng,
      type: asteroid.type,
      // Children inherit a slice of the parent's momentum plus
      // their own level-appropriate base speed.
      speedMult: length(asteroid.vx, asteroid.vy) /
        (ASTEROID.BASE_SPEED + (3 - childLevel) * ASTEROID.SPEED_PER_LEVEL)
        * ASTEROID.CHILD_SPEED_BOOST,
    }));
  }
  return children;
}
