// spawner.js
// Asteroid spawn placement and scheduling.
//
// Asteroids enter from the top, left, or right edges only — never
// the bottom — and never on top of the player.  Spawn cadence is
// governed by the difficulty curve's spawn interval.

import { ASTEROID, BOARD } from "../config.js";
import { createAsteroid } from "../entities/asteroid.js";
import { calculateDifficulty, rollSpecialType } from "./difficulty.js";
import { range } from "../utils/rng.js";
import { distance } from "../utils/math.js";

/**
 * Pick a spawn edge (excluding the bottom).
 *
 * Args:
 *     rng: Random source returning floats in [0, 1).
 *
 * Returns:
 *     One of "top", "left", "right".
 */
export function pickSpawnEdge(rng) {
  const roll = rng();
  if (roll < 0.5) {
    return "top";
  }
  return roll < 0.75 ? "left" : "right";
}

/**
 * Choose a spawn point on an edge.
 *
 * The point is placed at most EDGE_MARGIN px inside the board so
 * asteroids visibly enter from outside the play area, and is
 * rejected if it lies within MIN_PLAYER_DISTANCE of the ship.
 *
 * Args:
 *     edge: Edge name from pickSpawnEdge().
 *     rng: Random source returning floats in [0, 1).
 *     player: Player state (for distance rejection only).
 *
 * Returns:
 *     Spawn position {x, y}.
 */
export function spawnPosition(edge, rng, player) {
  const margin = ASTEROID.EDGE_MARGIN;
  for (let attempt = 0; attempt < 24; attempt++) {
    let x;
    let y;
    if (edge === "top") {
      x = range(rng, margin, BOARD.WIDTH - margin);
      y = -ASTEROID.RADII[3] * 0.5 + range(rng, 0, margin);
    } else if (edge === "left") {
      x = -ASTEROID.RADII[3] * 0.5 + range(rng, 0, margin);
      y = range(rng, 0, BOARD.HEIGHT - margin);
    } else {
      x = BOARD.WIDTH + ASTEROID.RADII[3] * 0.5 - range(rng, 0, margin);
      y = range(rng, 0, BOARD.HEIGHT - margin);
    }
    if (!player ||
        distance(x, y, player.x, player.y) >= ASTEROID.MIN_PLAYER_DISTANCE) {
      return { x, y };
    }
  }
  // Exhaustive retries failed (the player is hugging this edge);
  // fall back to whichever edge midpoint lies farthest from the
  // ship, which maximises the minimum guaranteed distance.
  const candidates = [
    { x: BOARD.WIDTH / 2, y: -10 },
    { x: -10, y: BOARD.HEIGHT / 2 },
    { x: BOARD.WIDTH + 10, y: BOARD.HEIGHT / 2 },
  ];
  let best = candidates[0];
  let bestDist = -1;
  for (const c of candidates) {
    const d = distance(c.x, c.y, player ? player.x : 0,
                       player ? player.y : 0);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/**
 * Aim a spawn trajectory into the play area.
 *
 * Args:
 *     edge: Edge name from pickSpawnEdge().
 *     rng: Random source returning floats in [0, 1).
 *
 * Returns:
 *     Heading angle in radians pointing generally toward the
 *     board interior with random spread.
 */
export function spawnAngle(edge, rng) {
  const spread = Math.PI / 3; // +/-60 degrees around inward normal
  if (edge === "top") {
    return range(rng, Math.PI / 2 - spread, Math.PI / 2 + spread);
  }
  if (edge === "left") {
    return range(rng, -spread, spread);
  }
  return range(rng, Math.PI - spread, Math.PI + spread);
}

/**
 * Run one step of asteroid spawning for a game state.
 *
 * Decrements the spawn timer; when it expires, spawns a large
 * asteroid (special class rolled per difficulty) unless the
 * MAX_COUNT cap is reached, then reloads the timer from the
 * current difficulty interval.
 *
 * Args:
 *     state: Game state (mutated: `asteroids`, `spawnTimer`).
 *     dt: Elapsed seconds.
 */
export function updateSpawning(state, dt) {
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0 || state.asteroids.length >= ASTEROID.MAX_COUNT) {
    return;
  }
  const elapsed = state.elapsed;
  const difficulty = calculateDifficulty(elapsed);
  const type = rollSpecialType(elapsed, state.rng);

  const edge = pickSpawnEdge(state.rng);
  const pos = spawnPosition(edge, state.rng, state.player);
  state.asteroids.push(createAsteroid({
    level: 3,
    x: pos.x,
    y: pos.y,
    angle: spawnAngle(edge, state.rng),
    type,
    speedMult: difficulty.speedMult,
    rng: state.rng,
  }));
  state.spawnTimer += difficulty.spawnInterval;
}
