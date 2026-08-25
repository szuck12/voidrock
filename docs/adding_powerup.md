# Adding a Power-Up

A step-by-step recipe. Each stage lists the exact files to touch
and the tests to add. Work through them in order and the feature
lands complete — logic, visuals, HUD, docs.

As a running example, imagine adding `time_freeze` (asteroids stop
moving for N seconds).

## 1. Config — `src/config.js`

Add the type to the `POWERUP_TYPES` object in `config.js`:

```js
time_freeze: {
  duration: 5,
  weight: 12,
  unlockTime: 0,
  label: "FREEZE",
  color: "#00cccc",
  glyph: "f",
},
```

* `duration`: seconds the effect lasts; use `0` for instant effects.
* `weight`: relative spawn weight; pick something in line with
  neighbours and justify it in a comment.
* `unlockTime`: elapsed seconds before this type can appear in the
  eligible pool; use `0` for always-available.
* `label`: short HUD chip text (max 8 characters).
* `color`: HUD chip and capsule colour.
* `glyph`: single character drawn inside the capsule.

Weights are relative, not percentages. The spawner normalises them
automatically.

## 2. Effect Hook — wherever gameplay reads it

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

For instant effects like Extra Life, handle them directly in
`applyPowerUp()`.

## 3. Rendering — `src/render.js`

Draw the capsule generically via `POWERUP_TYPES` colours/glyphs;
add a case to `drawPowerUpGlyph()` for the new icon. Glyphs are
vector-drawn paths, not fonts, so they stay crisp when scaled.
If the effect needs an on-ship indicator, follow the dashed
shield ring pattern used by Protective Border.

## 4. Tests

Add cases to `tests/test_powerups.js`, mirroring existing ones:

* duration matches `POWERUP_TYPES.time_freeze.duration` exactly;
* effect activates on apply and expires one frame past its
  duration (remember: `advance()` quantises to whole frames);
* gameplay hook behaves while active and after expiry;
* eligibility rules if any (see Extra Life's suppression test);
* unlock gating: the type must not appear in `eligibleWeights()`
  before its `unlockTime`.

Keep every scenario deterministic: seeded state from `helpers.js`,
fixed steps, exact assertions.

## 5. Docs

* `docs/game_mechanics.md`: add the row to the power-up table.
* `README.md`: extend the power-up list.
* `CHANGELOG.md`: entry under `[Unreleased] → Added`.
* `TODO.md`: tick any tracking item.

## Checklist

- [ ] entry in `POWERUP_TYPES` with duration, weight, unlockTime,
      label, color, glyph
- [ ] effect hooked at the mechanic's single read site
- [ ] glyph drawn; ship/fx indicator if needed
- [ ] deterministic tests green (`node run_tests.js`)
- [ ] README / game_mechanics / CHANGELOG updated
