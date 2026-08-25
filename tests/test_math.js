// test_math.js
// Geometry and vector helper tests, including the swept-segment
// distance used for projectile collision.

import { describe, it } from "node:test";
import {
  angleDelta,
  circlesOverlap,
  clamp,
  distance,
  lerp,
  length,
  normalizeAngle,
  pointSegmentDistance,
} from "../src/utils/math.js";
import { assert } from "./helpers.js";

describe("math helpers", () => {
  it("clamp() clamps to both bounds", () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
  });

  it("length() computes vector magnitude", () => {
    assert.equal(length(3, 4), 5);
    assert.equal(length(0, 0), 0);
  });

  it("distance() measures point separation", () => {
    assert.equal(distance(0, 0, 3, 4), 5);
  });

  it("pointSegmentDistance() handles perpendicular projection", () => {
    // Point directly above the middle of a horizontal segment.
    const d = pointSegmentDistance(5, 3, 0, 0, 10, 0);
    assert.equal(d, 3);
  });

  it("pointSegmentDistance() clamps past segment endpoints", () => {
    // Beyond the right endpoint the nearest point is (10, 0).
    const d = pointSegmentDistance(15, 4, 0, 0, 10, 0);
    assert.ok(Math.abs(d - Math.sqrt(41)) < 1e-9);
  });

  it("pointSegmentDistance() handles degenerate segments", () => {
    const d = pointSegmentDistance(3, 4, 0, 0, 0, 0);
    assert.equal(d, 5);
  });

  it("circlesOverlap() detects hit, miss, and exact touch", () => {
    assert.equal(circlesOverlap(0, 0, 5, 8, 0, 5), true);   // overlap
    assert.equal(circlesOverlap(0, 0, 5, 20, 0, 5), false); // apart
    assert.equal(circlesOverlap(0, 0, 5, 10, 0, 5), true);  // touch
  });

  it("normalizeAngle() wraps negatives into [0, TAU)", () => {
    assert.equal(normalizeAngle(-Math.PI / 2),
                 Math.PI * 1.5);
    const wrapped = normalizeAngle(Math.PI * 2.25);
    assert.ok(wrapped >= 0 && wrapped < Math.PI * 2);
  });

  it("angleDelta() takes the shortest path both ways", () => {
    assert.ok(Math.abs(angleDelta(0.1, 0.3) - 0.2) < 1e-9);
    assert.ok(Math.abs(angleDelta(0.3, 0.1) + 0.2) < 1e-9);
    // Across the wrap boundary: from PI to -PI is zero net turn.
    assert.ok(Math.abs(angleDelta(Math.PI, -Math.PI)) < 1e-9 ||
              Math.abs(angleDelta(Math.PI, -Math.PI) -
                       Math.PI * 2) < 1e-9);
  });

  it("lerp() interpolates linearly", () => {
    assert.equal(lerp(10, 20, 0), 10);
    assert.equal(lerp(10, 20, 1), 20);
    assert.equal(lerp(10, 20, 0.5), 15);
  });
});
