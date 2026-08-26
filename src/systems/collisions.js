// collisions.js
// Collision resolution between projectiles, asteroids, the player,
// and power-ups.
//
// Correctness rules:
//   * Projectile vs asteroid uses a swept segment test so fast
//     shots cannot tunnel through an asteroid between frames.
//   * One projectile resolves against at most one asteroid (the
//     nearest along its path), so a single shot can never score
//     twice.
//   * Player vs asteroid respects invulnerability and the
//     Protective Border effect; the border destroys the colliding
//     asteroid with normal score and no life loss.

import { PARTICLES, PLAYER, SHAKE } from "../config.js";
import { splitAsteroid } from "../entities/asteroid.js";
import { circlesOverlap, pointSegmentDistance } from "../utils/math.js";
import { addScore, calculateAsteroidScore } from "./scoring.js";
import { effectActive } from "./powerups.js";

/**
 * Whether a projectile's swept path intersects an asteroid.
 *
 * Tests the distance from the asteroid centre to the segment
 * travelled this frame; degenerate zero-length segments fall back
 * to plain point distance inside pointSegmentDistance().
 *
 * Args:
 *     projectile: Projectile state (uses prevX/prevY and x/y).
 *     asteroid: Asteroid state.
 *
 * Returns:
 *     true when the projectile hits the asteroid this step.
 */
export function projectileHitsAsteroid(projectile, asteroid) {
  const rSum = projectile.radius + asteroid.radius;
  const d = pointSegmentDistance(asteroid.x, asteroid.y,
                                 projectile.prevX, projectile.prevY,
                                 projectile.x, projectile.y);
  return d <= rSum;
}

/**
 * Resolve every projectile against asteroids for one step.
 *
 * For each alive projectile the nearest hit asteroid is chosen;
 * the projectile dies after resolving one hit regardless of how
 * many asteroids overlap its path, guaranteeing exactly one score
 * per shot.  Hits award points via the central scoring rules and
 * split or destroy the target.
 *
 * Args:
 *     state: Game state (mutated: projectiles, asteroids, score,
 *         particles, shakeTimer).
 */
export function resolveProjectileHits(state) {
  const boostActive = effectActive(state, "points_boost");
  const scoreMult3x = effectActive(state, "score_3x");
  const scoreMult5x = effectActive(state, "score_5x");

  for (const p of state.projectiles) {
    if (!p.alive) {
      continue;
    }
    let target = null;
    let targetDist = Infinity;
    for (const a of state.asteroids) {
      if (!projectileHitsAsteroid(p, a)) {
        continue;
      }
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const dist = dx * dx + dy * dy;
      if (dist < targetDist) {
        target = a;
        targetDist = dist;
      }
    }
    if (!target) {
      continue;
    }

    // One projectile, one hit: mark it dead before scoring so no
    // code path can credit it again.
    p.alive = false;
    addScore(state, calculateAsteroidScore(
      target.level, target.type, boostActive, scoreMult3x, scoreMult5x));
    destroyAsteroid(state, target);
  }

  state.projectiles = state.projectiles.filter((p) => p.alive);
  state.asteroids = state.asteroids.filter((a) => a.alive);
}

/**
 * Destroy an asteroid: emit particles and, if it is not small,
 * spawn two children of the next level inheriting its type.
 *
 * Args:
 *     state: Game state (mutated: asteroids, particles,
 *         shakeTimer).
 *     asteroid: The asteroid being destroyed.
 */
export function destroyAsteroid(state, asteroid) {
  asteroid.alive = false;
  spawnBurst(state, asteroid.x, asteroid.y,
             PARTICLES.BURST_BY_LEVEL[asteroid.level], asteroid.type);

  const children = splitAsteroid(asteroid, state.rng);
  state.asteroids.push(...children);
  if (state.shakeTimer < SHAKE.HIT_DURATION) {
    state.shakeTimer = SHAKE.HIT_DURATION;
  }
}

/**
 * Resolve player vs asteroid contact for one step.
 *
 * While the Protective Border effect is active the collision
 * destroys the offending asteroid with normal score and no life
 * loss.  Otherwise a hit costs one life, grants a short
 * invulnerability window (preventing multi-life frames), recentres
 * the ship, and triggers death feedback.
 *
 * Args:
 *     state: Game state (mutated).
 */
export function resolvePlayerCollisions(state) {
  if (state.phase !== "playing" || state.player.invulnerableFor > 0) {
    return;
  }

  const borderActive = effectActive(state, "protective_border");
  const boostActive = effectActive(state, "points_boost");
  const scoreMult3x = effectActive(state, "score_3x");
  const scoreMult5x = effectActive(state, "score_5x");

  // Iterate a snapshot: destroyAsteroid() appends split children,
  // and freshly spawned children must never resolve against the
  // player in the same frame they were created.
  const rocks = [...state.asteroids];
  for (const a of rocks) {
    if (!circlesOverlap(state.player.x, state.player.y,
                        state.player.radius, a.x, a.y, a.radius)) {
      continue;
    }
    if (borderActive) {
      addScore(state, calculateAsteroidScore(
        a.level, a.type, boostActive, scoreMult3x, scoreMult5x));
      destroyAsteroid(state, a);
      continue;
    }
    loseLife(state);
    return; // one life event per step maximum
  }

  // Drop asteroids the border destroyed this step so callers see
  // exactly the surviving field.
  state.asteroids = state.asteroids.filter((a) => a.alive);
}

/**
 * Process losing one life: feedback, repositioning, safety window,
 * and the game-over transition at zero lives.  Score and board
 * contents are preserved across the death.
 *
 * Args:
 *     state: Game state (mutated).
 */
export function loseLife(state) {
  state.lives -= 1;
  spawnBurst(state, state.player.x, state.player.y,
             PARTICLES.BURST_BY_LEVEL[3], "normal");
  state.shakeTimer = SHAKE.DEATH_DURATION;
  state.events.push({ kind: "death", x: state.player.x, y: state.player.y });

  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = "game_over";
    return;
  }

  // Brief reset to centre plus invulnerability prevents instant
  // repeated collisions while debris settles.
  state.player.x = state.respawnX;
  state.player.y = state.respawnY;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.invulnerableFor = PLAYER.INVULNERABLE_DURATION;
}

/**
 * Push a particle burst into the state's particle pool.
 *
 * Args:
 *     state: Game state (mutated: `particles`).
 *     x: Burst X position.
 *     y: Burst Y position.
 *     count: Number of particles to emit (capped by pool space).
 *     colorKey: Particle colour family ("normal" or special class).
 */
function spawnBurst(state, x, y, count, colorKey) {
  for (let i = 0; i < count && state.particles.length < PARTICLES.MAX;
       i++) {
    const angle = state.rng() * Math.PI * 2;
    const speed = (0.35 + state.rng() * 0.65) * PARTICLES.SPEED;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      lifetime: PARTICLES.LIFETIME * (0.6 + state.rng() * 0.8),
      colorKey,
    });
  }
}
