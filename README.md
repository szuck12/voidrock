# Voidrock

![version](https://img.shields.io/badge/version-1.2.0-blue)

A minimalist arcade survival game inspired by Asteroids. Pilot a
wedge-fighter inside a walled arena, split incoming rocks, chase
rare gold asteroids for 4x scoring, and grab power-ups before they
fade — all in vanilla JavaScript on HTML5 Canvas with zero
dependencies.

The project uses centralised constants, deterministic seeded logic,
an exhaustive `node:test` suite, and a documentation-first workflow
(see `docs/`).

---

## Project Tree

```
voidrock/
├── .github/
│   ├── dependabot.yml            # Weekly npm + Actions updates
│   └── workflows/
│       └── deploy-pages.yml      # GitHub Pages deployment
├── docs/                         # Development guides
│   ├── adding_powerup.md         # Recipe: new power-up types
│   ├── code_review_guide.md      # Review expectations
│   ├── commenting_guidelines.md  # Comment style rules
│   ├── game_mechanics.md         # Tuning values + design notes
│   ├── maintain_todo.md          # TODO.md conventions
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
├── tests/                        # node:test suite (134 tests)
│   ├── helpers.js                # Deterministic fixtures
│   └── test_*.js                 # Per-module suites
├── index.html                    # Game shell: HUD + overlays
├── styles.css                    # Terminal-flavoured styling
├── run_tests.js                  # Convenience test runner
├── package.json                  # npm scripts (test/start)
├── requirements.txt              # Runtime note (stdlib only)
├── LICENSE                       # MIT
├── SECURITY.md                   # Vulnerability reporting
├── CHANGELOG.md                  # Keep-a-Changelog history
└── TODO.md                       # Living task list
```

## How to Play

| Key | Action |
| --- | --- |
| `W A S D` / arrow keys | Thrust (ship turns toward movement) |
| `SPACE` | Ship fires |
| `P` / `Esc` | Pause |
| `ENTER` | Start / restart |

Survive. Every second alive is worth one point.  Asteroids award
size-based scores on each hit:

| Size | Points |
| --- | --- |
| Large | 10 |
| Medium | 15 |
| Small | 20 |

Rare **special** asteroids multiply each hit:

| Class | Rarity | Multiplier | Unlocks at |
| --- | --- | --- | --- |
| Bronze ring | 58% of specials | x2 | 25 s |
| Gold ring | 42% of specials | x4 | 115 s |

Rocks spawn from all four edges and appear in three sizes
(50% large, 30% medium, 20% small).  Smaller rocks are generally
faster.  Rock speeds increase progressively as the game continues.

Nine power-ups drop and are collected by touch:

| Power-up | Effect | Duration |
| --- | --- | --- |
| Speed Boost | 1.5x thrust and top speed | 15 s |
| Points Boost | All scoring doubled | 10 s |
| Extra Life | +1 life, capped at 3; only drops when eligible | instant |
| Slow Asteroids | Asteroid motion scaled to 45% | 10 s |
| Protective Border | Border redirects asteroids away from the ship | 20 s |
| Rapid Fire | Cooldown cut to 45% | 10 s |
| Multi-Shot | Three-bolt spread | 10 s |
| 3x Score | All scoring tripled | 8 s |
| 5x Score | All scoring quintupled | 6 s |

Score multipliers (Points Boost, 3x, 5x) combine multiplicatively.
The 3x power-up unlocks after 60 s and the 5x after 120 s; both are
rarer than standard power-ups.  Power-up generation frequency
increases gradually as the game progresses.

Difficulty ramps on a keyframed curve: asteroids spawn faster, fly
quicker, and specials appear more often.

## Getting Started

No dependencies to install — only Node.js >= 18 is required for
tests and any static file server (or Python 3) for local play.

```bash
# run the test suite
npm test            # or: node run_tests.js

# play locally (http://localhost:8000)
npm start
```

## Deployment

Pushes to `main` deploy automatically to GitHub Pages via
`.github/workflows/deploy-pages.yml`. The workflow stages
`index.html`, `styles.css`, and `src/` into the artifact — there is
no build step. The site can also be hosted from any static file
server as-is.

## Testing Philosophy

All gameplay logic lives in pure modules driven by injected `dt`
and an injectable seeded RNG (mulberry32); wall-clock time and DOM
access are quarantined in `main.js`. This makes every scenario —
spawn schedules, power-up expiry, collision chains, difficulty
curves — exactly reproducible in tests without mocks or sleeps.
See `docs/game_mechanics.md` for the tuning reference.

## Further Reading

* `docs/commenting_guidelines.md` — how source comments are written
* `docs/code_review_guide.md` — what reviewers check first
* `docs/maintain_todo.md` / `docs/update_changelog.md` — how
  TODO.md and CHANGELOG.md are maintained
* `docs/adding_powerup.md` — step-by-step recipe for new power-ups
