// test_rng.js
// Determinism and distribution tests for the seeded RNG helpers.

import { describe, it } from "node:test";
import { createRng, intInRange, pickWeighted, range }
  from "../src/utils/rng.js";
import { assert } from "./helpers.js";

describe("rng", () => {
  it("produces identical sequences for identical seeds", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      assert.equal(a(), b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    let differs = false;
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) {
        differs = true;
      }
    }
    assert.ok(differs);
  });

  it("stays within [0, 1) across many draws", () => {
    const r = createRng(7);
    for (let i = 0; i < 10000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
    }
  });

  it("range() honours its bounds", () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = range(r, -5, 5);
      assert.ok(v >= -5 && v < 5);
    }
  });

  it("intInRange() stays inside inclusive bounds", () => {
    const r = createRng(11);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const v = intInRange(r, 2, 5);
      assert.ok(v >= 2 && v <= 5);
      seen.add(v);
    }
    assert.deepEqual([...seen].sort(), [2, 3, 4, 5]);
  });

  it("pickWeighted never selects zero-weight keys", () => {
    const r = createRng(5);
    const weights = { a: 1, b: 0, c: 0 };
    for (let i = 0; i < 500; i++) {
      assert.equal(pickWeighted(r, weights), "a");
    }
  });

  it("pickWeighted returns null when nothing is eligible", () => {
    assert.equal(pickWeighted(createRng(1), { a: 0, b: 0 }), null);
    assert.equal(pickWeighted(createRng(1), {}), null);
  });

  it("pickWeighted respects proportional frequencies", () => {
    // With weights 3:1, over many draws the heavy key should win
    // roughly three quarters of the time.
    const r = createRng(2024);
    let heavy = 0;
    const total = 4000;
    for (let i = 0; i < total; i++) {
      if (pickWeighted(r, { heavy: 3, light: 1 }) === "heavy") {
        heavy++;
      }
    }
    const share = heavy / total;
    assert.ok(share > 0.68 && share < 0.82, `share=${share}`);
  });
});
