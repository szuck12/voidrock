// projectile.js
// Player projectile creation, movement, and lifetime bookkeeping.
//
// Projectiles record their previous position each step so the
// collision system can sweep the travelled segment and prevent
// fast shots tunnelling through small asteroids.

import { PROJECTILE } from "../config.js";

/**
 * Create a projectile at a position travelling along an angle.
 *
 * Args:
 *     x: Spawn X position (typically the ship nose).
 *     y: Spawn Y position.
 *     angle: Travel direction in radians.
 *
 * Returns:
 *     Projectile state object with prevX/prevY for swept
 *     collision and an `alive` flag.
 */
export function createProjectile(x, y, angle) {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(angle) * PROJECTILE.SPEED,
    vy: Math.sin(angle) * PROJECTILE.SPEED,
    angle,
    radius: PROJECTILE.RADIUS,
    age: 0,
    alive: true,
  };
}

/**
 * Advance a projectile by one step and expire it past its lifetime.
 *
 * Args:
 *     projectile: Projectile state object (mutated in place).
 *     dt: Elapsed seconds.
 */
export function updateProjectile(projectile, dt) {
  projectile.prevX = projectile.x;
  projectile.prevY = projectile.y;
  projectile.x += projectile.vx * dt;
  projectile.y += projectile.vy * dt;
  projectile.age += dt;
  if (projectile.age >= PROJECTILE.LIFETIME) {
    projectile.alive = false;
  }
}
