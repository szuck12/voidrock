# Adding a Power-Up

A step-by-step recipe for adding a new power-up type to VoidRock.
Each stage lists the exact files to touch and the tests to add.
Work through them in order and the feature lands complete — logic,
visuals, HUD, docs.

As a running example, imagine adding `time_freeze` (asteroids stop
moving for N seconds).

---

## 1. Config — `src/config.js`

Add the type to the `POWERUP_TYPES` object in `config.js`:

```js
time_freeze: Object.freeze({
  label: "FREEZE",
  duration: 5,
  weight: 12,
  unlockTime: 0,
}),
```

| Field | Purpose | Rules |
| --- | --- | --- |
| `label` | HUD chip text | Max 8 characters; all caps |
| `duration` | Effect length in seconds | `0` for instant effects (like Extra Life) |
| `weight` | Relative spawn weight | Pick something in line with neighbours |
| `unlockTime` | Elapsed seconds before eligible | `0` for always-available |

Weights are relative, not percentages.  The spawner normalises them
automatically.  The frequency scaling formula
`freqScale = 1 + elapsed / 600` multiplies all weights uniformly,
so relative ordering stays constant.

### If the effect needs a tunable magnitude

Add it to the `POWERUP` object:

```js
export const POWERUP = Object.freeze({
  // ... existing constants ...

  /** Duration of the time freeze effect. */
  TIME_FREEZE_FACTOR: 0, // asteroid displacement multiplier
});
```

---

## 2. Effect Hook — wherever gameplay reads it

Timed effects are read with `effectActive(state, "time_freeze")`
(or `effectRemaining` for countdown UI).  Apply the effect at the
single place the mechanic lives.

### For displacement-modifying effects (like Slow Asteroids)

Follow the precedent: scale *displacement*, never mutate stored
velocities.  This means expiring the effect restores normal
motion with zero bookkeeping.

In `game.js`, inside `stepGame`, where asteroids are updated:

```js
const freezeFactor =
  effectActive(state, "time_freeze")
    ? POWERUP.TIME_FREEZE_FACTOR
    : 1;
for (const a of state.asteroids) {
  updateAsteroid(a, dt, freezeFactor);
}
```

The `updateAsteroid` function already accepts a `slowFactor`
parameter that scales displacement.  If your effect modifies a
different aspect, you may need to add a similar parameter to the
relevant update function.

### For instant effects (like Extra Life)

Handle directly in `applyPowerUp()` in `systems/powerups.js`:

```js
if (type === "time_freeze") {
  // instant: something happens immediately
  return;
}
```

### For effects that modify the player

In `updateShooting()` or `updateMovement()`, check the effect:

```js
const rapid = effectActive(state, "rapid_fire");
```

Follow the same pattern: check at the point of use, apply a
multiplier, do not mutate any persistent state.

---

## 3. Rendering — `src/render.js`

### Power-up capsule

The capsule is drawn generically from `POWERUP_TYPES` metadata.
No per-type rendering code is needed for the capsule itself.

### Glyph inside the capsule

Add a case to `drawPowerUpGlyph()` for the new icon.  Glyphs are
vector-drawn paths, not fonts, so they stay crisp when scaled:

```js
case "time_freeze":
  // Snowflake or clock icon
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.moveTo(-5, -3);
  ctx.lineTo(5, 3);
  ctx.moveTo(-5, 3);
  ctx.lineTo(5, -3);
  ctx.stroke();
  break;
```

### On-ship indicator (if needed)

If the effect should be visible while active (like the Protective
Border's dashed ring), add a draw function following the shield
pattern in `drawShield()`:

```js
function drawFreezeIndicator(ctx, state, t) {
  const expiry = state.effects.time_freeze;
  if (expiry == null || state.elapsed >= expiry) return;
  // Draw visual indicator on the ship or around asteroids
}
```

Call it from `render()` inside the `playing`/`paused` guard.

---

## 4. HUD Integration — `src/hud.js`

Add the effect key to the `CHIP_KEYS` array:

```js
const CHIP_KEYS = [
  "speed_boost",
  "points_boost",
  "rapid_fire",
  "multi_shot",
  "slow_asteroids",
  "protective_border",
  "score_3x",
  "score_5x",
  "time_freeze",  // <-- add here
];
```

The chip will automatically appear when the effect is active and
show a countdown label from `POWERUP_TYPES[type].label`.

Add a CSS class in `styles.css` for the chip colour:

```css
.chip-time_freeze { border-color: #00cccc; }
```

---

## 5. Tests — `tests/test_powerups.js`

Add cases to `tests/test_powerups.js`, mirroring existing ones.
Use the helpers from `tests/helpers.js` for deterministic setup.

### Duration test

```js
it("time_freeze lasts its configured duration", () => {
  const state = makeState();
  applyPowerUp(state, "time_freeze");
  assert.equal(POWERUP_TYPES.time_freeze.duration, 5);
  advance(state, 4.5);
  assert.ok(effectActive(state, "time_freeze"));
  advance(state, 0.5 + 1 / 60);
  assert.equal(effectActive(state, "time_freeze"), false);
});
```

### Gameplay hook test

```js
it("time_freeze halts asteroid movement while active", () => {
  const state = makeState();
  const a = placeAsteroid(state, { x: 200, y: 200, vx: 100, vy: 0 });
  applyPowerUp(state, "time_freeze");
  const x0 = a.x;
  step(state, 1);
  assert.equal(a.x, x0, "asteroid must not move while frozen");
  assert.equal(a.vx, 100, "velocity must be preserved");
});

it("asteroids resume normal speed after time_freeze expires", () => {
  const state = makeState();
  applyPowerUp(state, "time_freeze");
  advance(state, POWERUP_TYPES.time_freeze.duration + 0.01);
  const a = placeAsteroid(state, { x: 200, y: 200, vx: 100, vy: 0 });
  const x0 = a.x;
  step(state, 1);
  assert.ok(Math.abs(a.x - (x0 + 100)) < 1e-6);
});
```

### Eligibility test (if unlockTime > 0)

```js
it("time_freeze is locked before its unlock time", () => {
  const state = makeState();
  state.elapsed = 30;
  const weights = eligibleWeights(state);
  assert.equal(weights.time_freeze, undefined);
});
```

### Keep every scenario deterministic

- Seeded state from `helpers.js`.
- Fixed steps via `step()` or `advance()`.
- Exact assertions, not ranges (except with explicit epsilon).

---

## 6. Documentation

Update the following files:

### `docs/game_mechanics.md`

Add a row to the power-up table:

```markdown
| Time Freeze | Asteroids stop moving | 5 s |
```

### `README.md`

Add to the power-up table in the "How to Play" section.

### `CHANGELOG.md`

Add under `[Unreleased] > Added`:

```markdown
- Time Freeze power-up: freezes all asteroid movement for 5 s.
```

### `TODO.md`

Tick any tracking item for this feature.

---

## Checklist

- [ ] Entry in `POWERUP_TYPES` with label, duration, weight,
      unlockTime
- [ ] Config constants for any tunable magnitudes
- [ ] Effect hooked at the mechanic's single read site
- [ ] Glyph drawn in `drawPowerUpGlyph()`
- [ ] Ship/fx indicator if the effect should be visible while
      active
- [ ] HUD chip key added to `CHIP_KEYS`
- [ ] CSS class for chip colour
- [ ] Deterministic tests green (`npm test`)
- [ ] `docs/game_mechanics.md` updated with new row
- [ ] `README.md` power-up table updated
- [ ] `CHANGELOG.md` entry under `[Unreleased] > Added`
- [ ] `TODO.md` tracking item checked off
