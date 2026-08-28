// math.js
// Small vector and geometry helpers shared by game systems.

/** Two times pi, for readability in angle math. */
export const TAU = Math.PI * 2;

/**
 * Constrain a value to a range.
 *
 * Args:
 *     value: Input number.
 *     min: Lower bound.
 *     max: Upper bound.
 *
 * Returns:
 *     value clamped to [min, max].
 */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/**
 * Euclidean length of a 2D vector.
 *
 * Args:
 *     x: X component.
 *     y: Y component.
 *
 * Returns:
 *     sqrt(x^2 + y^2).
 */
export function length(x, y) {
  return Math.sqrt(x * x + y * y);
}

/**
 * Distance between two points.
 *
 * Args:
 *     ax: First point X.
 *     ay: First point Y.
 *     bx: Second point X.
 *     by: Second point Y.
 *
 * Returns:
 *     Distance between the two points.
 */
export function distance(ax, ay, bx, by) {
  return length(bx - ax, by - ay);
}

/**
 * Shortest distance from a point to a finite line segment.  Used
 * for swept projectile collision so fast projectiles cannot tunnel
 * through thin asteroid bodies between frames.
 *
 * Args:
 *     px: Point X.
 *     py: Point Y.
 *     ax: Segment start X.
 *     ay: Segment start Y.
 *     bx: Segment end X.
 *     by: Segment end Y.
 *
 * Returns:
 *     Perpendicular distance to the segment (endpoint-aware).
 */
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return distance(px, py, ax, ay);
  }
  // Project P onto AB and clamp t to [0, 1] so endpoints count.
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return distance(px, py, ax + t * dx, ay + t * dy);
}

/**
 * Test whether two circles overlap (or touch).
 *
 * Args:
 *     ax: First circle centre X.
 *     ay: First circle centre Y.
 *     ar: First circle radius.
 *     bx: Second circle centre X.
 *     by: Second circle centre Y.
 *     br: Second circle radius.
 *
 * Returns:
 *     true when the circles intersect.
 */
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const rSum = ar + br;
  const dx = bx - ax;
  const dy = by - ay;
  // Compare squared values to avoid a sqrt per check per frame.
  return dx * dx + dy * dy <= rSum * rSum;
}

/**
 * Normalize an angle into [0, TAU).
 *
 * Args:
 *     angle: Angle in radians, any magnitude.
 *
 * Returns:
 *     Equivalent angle in [0, TAU).
 */
export function normalizeAngle(angle) {
  let a = angle % TAU;
  if (a < 0) {
    a += TAU;
  }
  return a;
}

/**
 * Shortest signed difference between two angles in [-PI, PI].
 *
 * Args:
 *     from: Starting angle in radians.
 *     to: Target angle in radians.
 *
 * Returns:
 *     Signed rotation needed to move `from` onto `to`.
 */
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) {
    d -= TAU;
  } else if (d < -Math.PI) {
    d += TAU;
  }
  return d;
}

/**
 * Linear interpolation between two numbers.
 *
 * Args:
 *     a: Value at t=0.
 *     b: Value at t=1.
 *     t: Interpolation parameter.
 *
 * Returns:
 *     a + (b - a) * t.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
