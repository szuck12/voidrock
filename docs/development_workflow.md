# Development Workflow

How to set up, run, test, and contribute to VoidRock.  This
document covers prerequisites, day-to-day commands, project
structure, and the conventions that keep contributions consistent.

---

## Prerequisites

- **Node.js >= 18** — required for the test runner.  No npm
  packages need to be installed; the game has zero runtime
  dependencies.
- **Python 3** (optional) — for the `npm start` convenience
  script.  Any static file server works: `npx serve`, `php -S`,
  or opening `index.html` directly in a browser.

No `npm install` step.  No `node_modules`.  No build step.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/szuck12/voidrock.git
cd voidrock

# Run the test suite
npm test

# Play the game locally
npm start
# Then open http://localhost:8000
```

---

## Day-to-Day Commands

| Command | Purpose |
| --- | --- |
| `npm test` | Run the full test suite (223 tests) |
| `node --test tests/test_scoring.js` | Run a single test file |
| `node --test --test-name-pattern "gold" tests/test_scoring.js` | Run tests matching a name |
| `npm start` | Start a local server on port 8000 |
| `node run_tests.js` | Full suite with indented TAP output |

---

## Project Structure

```
voidrock/
├── .github/
│   ├── dependabot.yml            # Weekly npm + Actions updates
│   └── workflows/
│       └── deploy-pages.yml      # GitHub Pages deployment
├── docs/                         # Development guides
│   ├── adding_powerup.md         # Recipe: new power-up types
│   ├── architecture.md           # Systems, data flow, invariants
│   ├── code_review_guide.md      # Fast-track + deep-dive review
│   ├── commenting_guidelines.md  # Comment style rules
│   ├── development_workflow.md   # This file
│   ├── extension_patterns.md     # Entity/system creation templates
│   ├── game_mechanics.md         # Tuning values + design notes
│   ├── maintain_todo.md          # TODO.md conventions
│   ├── testing_guide.md          # Test patterns and conventions
│   └── update_changelog.md       # CHANGELOG.md conventions
├── src/                          # Game source (ES modules)
│   ├── config.js                 # Every tunable constant
│   ├── game.js                   # State machine + stepGame loop
│   ├── hud.js                    # DOM HUD bindings
│   ├── input.js                  # Keyboard state tracking
│   ├── main.js                   # Browser bootstrap + RAF loop
│   ├── render.js                 # Canvas drawing (all visuals)
│   ├── entities/                 # Player, projectile, asteroid
│   ├── systems/                  # Scoring, difficulty, spawner,
│   │                             # power-ups, collisions
│   └── utils/                    # Seeded RNG + math helpers
├── tests/                        # node:test suite
│   ├── helpers.js                # Deterministic fixtures
│   └── test_*.js                 # Test files (16 suites)
├── index.html                    # Game shell: HUD + overlays
├── styles.css                    # Terminal-flavoured styling
├── run_tests.js                  # Convenience test runner
├── package.json                  # npm scripts (test/start)
└── CHANGELOG.md                  # Version history
```

### Source code organisation

Source code is split into three layers:

| Layer | Directory | Purpose |
| --- | --- | --- |
| **Config** | `src/config.js` | All tunable gameplay constants, deeply frozen |
| **Game logic** | `src/entities/`, `src/systems/`, `src/game.js` | Pure simulation — no DOM, no Canvas, no wall clocks |
| **Browser interface** | `src/main.js`, `src/render.js`, `src/hud.js`, `src/input.js` | DOM access, Canvas rendering, keyboard capture |

Game logic modules depend only on each other and on `config.js`.
Browser interface modules import game logic but never the reverse.
This separation is the foundation of deterministic testing.

### Entity files

| File | Creates | Updates |
| --- | --- | --- |
| `entities/player.js` | Ship at (x, y) with velocity, facing, radius | Acceleration, damping, speed cap, board clamping |
| `entities/asteroid.js` | Asteroid with procedural shape, velocity, spin | Position, rotation, age |
| `entities/projectile.js` | Projectile with position, velocity, prev position | Position, age, lifetime expiry |

### System files

| File | Responsibility |
| --- | --- |
| `systems/collisions.js` | Swept-segment projectile hits, player overlap, shield destruction |
| `systems/difficulty.js` | Keyframe interpolation, special asteroid rolls |
| `systems/powerups.js` | Spawn scheduling, eligibility, collection, effect management |
| `systems/scoring.js` | Score calculation, survival accrual, best tracking |
| `systems/spawner.js` | Asteroid edge selection, position, timing |

### Utility files

| File | Provides |
| --- | --- |
| `utils/math.js` | `clamp`, `length`, `distance`, `pointSegmentDistance`, `circlesOverlap`, `normalizeAngle`, `angleDelta`, `lerp` |
| `utils/rng.js` | `createRng` (mulberry32), `range`, `intInRange`, `pickWeighted` |

---

## Making Changes

### Workflow

1. **Read the relevant docs** — `architecture.md` for system
   understanding, `game_mechanics.md` for tuning context.
2. **Create a branch** — `git checkout -b feature/my-change`.
3. **Make the change** — follow the file's existing conventions.
4. **Add tests** — every logic change needs a deterministic test.
5. **Run the full suite** — `npm test` must pass with zero
   failures.
6. **Update docs** — CHANGELOG.md, TODO.md, and relevant files in
   `docs/`.
7. **Submit a PR** — see the review process below.

### Branch naming

Use descriptive kebab-case prefixes:

| Prefix | Use for |
| --- | --- |
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation-only changes |
| `test/` | Test additions or fixes |
| `refactor/` | Code restructuring without behaviour change |

---

## Commit Conventions

### Message format

```
<type>: <brief imperative description>
```

Examples:

```
feat: add score_5x power-up with 6s duration and 120s unlock
fix: prevent shield from awarding double score on split children
test: add monotonicity scan for difficulty speed multiplier
docs: expand architecture guide with collision system details
refactor: extract makeStars into game.js for clarity
```

### Rules

- **Imperative mood**: "add", "fix", "expand" — not "added" or
  "fixes".
- **One concern per commit**: a feature and its tests in the same
  commit; a doc update in a separate commit.
- **No secrets or keys**: never commit API keys, passwords, or
  tokens.
- **Reference issues**: when work traces to a GitHub issue, include
  the number: `fix: resolve spawn position edge case (#42)`.

---

## Code Style

### Line length

80 columns maximum, including comments.

### File headers

Every source file starts with a two-line banner:

```js
// filename.js
// One-sentence summary of the module's single responsibility.
```

Longer headers may include design rules the file enforces:

```js
// collisions.js
// Collision resolution between projectiles, asteroids, the player,
// and power-ups.
//
// Correctness rules:
//   * Projectile vs asteroid uses a swept segment test so fast
//     shots cannot tunnel through an asteroid between frames.
```

### JSDoc for exported functions

Exported functions carry a docblock with `Args:` and `Returns:`
sections:

```js
/**
 * Compute the points awarded for one hit on an asteroid.
 *
 * Args:
 *     level: Asteroid size level (3=large, 2=medium, 1=small).
 *     specialType: Asteroid class ("normal", "bronze", or "gold").
 *
 * Returns:
 *     Integer points for the hit.
 */
export function calculateAsteroidScore(level, specialType) { ... }
```

### Config centralisation

All tunable numbers live in `config.js`.  If you find yourself
writing a bare number in game logic, it belongs in config instead.

### No comments unless necessary

Code should be self-documenting.  Comments explain *why*, not
*what*.  The commenting guide (`docs/commenting_guidelines.md`)
has full details.

---

## Testing Conventions

See `docs/testing_guide.md` for the complete guide.  Key points:

- Use `makeState(seed)` for deterministic state — never
  `Math.random()` or `Date.now()`.
- Use `step()` or `advance()` for simulation — fixed step sizes
  only.
- Use `placeAsteroid()` / `placePowerUp()` for staging collisions
  — bypass the spawner.
- Assert exact values, not ranges (except with explicit epsilon).
- Every logic change ships with a test that fails without it.

---

## Pull Request Process

### Before requesting review

1. `npm test` passes — zero failures.
2. New behaviour has tests that fail without the change.
3. CHANGELOG.md and TODO.md are updated when applicable.
4. All files follow the commenting and code style conventions.

### What reviewers check

See `docs/code_review_guide.md` for the full fast-track checklist
and the scheduled deep-dive audit.  The most critical items:

- **Determinism**: no `Math.random()`, no `Date.now()` in game
  logic.
- **Architecture boundaries**: entities/systems must not import DOM
  or browser globals.
- **One projectile, one hit**: the dead-before-scoring invariant.
- **Bounded entity counts**: spawners and cullers must keep every
  list bounded.

### Review tone

Comments address the code, not the author.  Propose alternatives
with rationale.  Approve when the checklist is satisfied even if a
stylistic preference differs.

---

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via
`.github/workflows/deploy-pages.yml`.  The workflow stages
`index.html`, `styles.css`, and `src/` into the artifact — there
is no build step.

To deploy manually:

```bash
# Build the Pages artifact (if needed)
# The workflow handles this automatically
git push origin main
```

To host from a different static server, serve the repository root.
The only entry point is `index.html`.

---

## Common Tasks

### Adding a new entity type

1. Create `src/entities/<name>.js` following the patterns in
   `entities/projectile.js`.
2. Add config constants to `src/config.js`.
3. Import and integrate into `src/game.js` (stepGame).
4. Add rendering in `src/render.js`.
5. Write tests in `tests/test_<name>.js`.
6. Update `docs/architecture.md` module map and `README.md`
   project structure.

### Adding a new system

1. Create `src/systems/<name>.js` following the patterns in
   `systems/scoring.js`.
2. Add config constants to `src/config.js`.
3. Import and call from `src/game.js` in the correct step order.
4. Write tests in `tests/test_<name>.js`.
5. Update `docs/architecture.md` module map.

### Adding a new power-up

See `docs/adding_powerup.md` for the complete step-by-step recipe.

### Tuning gameplay values

1. Open `src/config.js`.
2. Find the relevant constant group.
3. Change the value.
4. Run `npm test` — some tests may assert exact values and need
   updating.
5. Play-test in the browser.
6. Document the change in CHANGELOG.md.

### Adding a new test file

1. Create `tests/test_<module>.js`.
2. Import `describe`/`it` from `node:test` and `assert` from
   `./helpers.js`.
3. Import functions under test from `src/`.
4. Verify it appears in `npm test` output.
5. Update the test table in `README.md` and
   `docs/testing_guide.md`.
