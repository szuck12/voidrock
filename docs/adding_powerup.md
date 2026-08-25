# Adding a Power-Up

A step-by-step recipe. Each stage lists the exact files to touch
and the tests to add. Work through them in order and the feature
lands complete — logic, visuals, HUD, docs.

As a running example, imagine adding `time_freeze` (asteroids stop
moving for N seconds).

## 1. Config — `src/config.js`

Add the type's tunables inside `POWERUP`:

* `DURATIONS.time_freeze: 5` (omit for instant effects).
* `WEIGHTS.time_freeze: <weight>` relative to the existing pool.

Weights are relative, not percentages; pick something in line with
neighbours and justify it in a comment.

## 2. Metadata — `src/systems/powerups.js`

* Add a label to `POWERUP_META` (HUD chip text, e.g.
  `"FREEZE"`).
* If the effect is timed, add the key to `TIMED_TYPES` so
  `expireEffects()` clears it. Instant effects (like Extra Life)
  are handled directly in `applyPowerUp()` instead.

No other system changes should be needed here: scheduling,
eligibility, collection, and expiry are generic.

## 3. Effect Hook — wherever gameplay reads it

Timed effects are read with `effectActive(state, "time_freeze")`
(or `effectRemaining` for countdown UI). Apply the effect at the
single place the mechanic lives:

```js
const freeze = effectActive(state, "time_freeze") ? 0 : 1;
updateAsteroid(a, dt * freeze);
```

Follow the Slow Asteroids precedent: scale *displacement*, never
mutate stored velocities, so expiring the effect restores motion
with zero bookkeeping.

## 4. Rendering — `src/render.js`

Draw the capsule generically via `POWERUP_META` colours/glyphs;
add a case to `drawPowerUpGlyph()` for the new icon. Glyphs are
vector-drawn paths, not fonts, so they stay crisp when scaled.
If the effect needs an on-ship indicator, follow the dashed
shield ring pattern used by Protective Border.

## 5. Tests

Add cases to `tests/test_powerups.js`, mirroring existing ones:

* duration matches config exactly;
* effect activates on apply and expires one frame past its
  duration (remember: `advance()` quantises to whole frames);
* gameplay hook behaves while active and after expiry;
* eligibility rules if any (see Extra Life's suppression test).

Keep every scenario deterministic: seeded state from `helpers.js`,
fixed steps, exact assertions.

## 6. Docs

* `docs/game_mechanics.md`: add the row to the power-up table.
* `README.md`: extend the power-up list.
* `CHANGELOG.md`: entry under `[Unreleased] → Added`.
* `TODO.md`: tick any tracking item.

## Checklist

- [ ] config values + weights
- [ ] POWERUP_META label (+ TIMED_TYPES if timed)
- [ ] effect hooked at the mechanic's single read site
- [ ] glyph drawn; ship/fx indicator if needed
- [ ] deterministic tests green (`npm test`)
- [ ] README / game_mechanics / CHANGELOG updated
