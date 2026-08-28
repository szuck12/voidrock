# Code Review Guide

Review of VoidRock happens at two cadences:

1. **Fast track** — the per-request gate applied to every committed
   change (Section 0 below).
2. **Deep dive** — a scheduled, cross-cutting architectural audit
   applied before each release, when a design question arises, or
   when structural issues are suspected (Sections 1–9 below).

This document is **not** only a per-commit PR checklist. The deep
dive is meant to be run in full before releases and whenever
significant change lands (a new power-up, a new entity type, a
redesign of the simulation step, a CI or dependency change).

For the full architecture description, see `architecture.md`.

---

## How to Use

Read through each section and examine the actual codebase.  Questions
are organised by increasing depth — start with Section 0 (fast track)
and Section 1, and stop if a blocker is found.  Many sections ask for
a judgment call rather than a binary yes/no.

When this guide references another doc in `docs/`, read that doc first
to establish the spec, then check the codebase against it.

---

## Section 0 — Fast Track: Per-Request Review

A lightweight gate that applies to every change before it is committed
or merged.  This is a sanity check, not a substitute for the deep
dive.

- `npm test` passes with zero failures.
- New behaviour has tests that fail without the change.
- CHANGELOG.md and TODO.md updated when applicable (see the
  dedicated guides).  README-only changes are not changelog-worthy.
- Lines stay within 80 columns; file headers follow
  `docs/commenting_guidelines.md`.
- No `Math.random()`, `Date.now()`, or `performance.now()` in `src/`
  logic modules (see Section 3).
- No new runtime dependencies; no new network calls; no `innerHTML`;
  no `eval` or `Function` construction.
- Config changes land in `config.js` with a comment, and the values
  are mirrored in `docs/game_mechanics.md` and any README tables.

---

## Section 1 — Conventions Compliance Audit

Cross-reference the actual codebase against the specifications in the
documentation files.

### 1a. Headers, Docstrings, and Comments (commenting_guidelines.md)

- [ ] Every source file opens with the 80-column banner: filename,
      single responsibility, and any correctness rules the file
      enforces.
- [ ] Exported functions carry a JSDoc block with `Args:` and
      `Returns:` sections where applicable.
- [ ] Time- and pixel-based values document units (`s`, `px`, `rad`).
- [ ] State-mutating functions document which fields mutate, e.g.
      `state (mutated: score, bestScore)`.
- [ ] Docstrings describe *what* and *why*, not implementation detail.
- [ ] No inline comments that restate the obvious
      (e.g. `// increment score`).
- [ ] Block comments are used for multi-step algorithms, not
      single-liners.
- [ ] No stale `TODO`/`FIXME` markers left in code (cross-checked
      against `TODO.md`).
- [ ] `@throws` annotations appear only when a function throws in a
      way callers must handle; VoidRock prefers sentinel returns
      (`null`) over exceptions.

### 1b. TODO Lifecycle (maintain_todo.md)

- [ ] All entries use correct Markdown checkbox syntax
      (`- [ ]` pending, `- [x]` done).
- [ ] **In Progress** holds at most 1–2 items.
- [ ] Items in **Done** that are already recorded in a CHANGELOG
      release have been pruned.
- [ ] No item appears in two sections simultaneously.
- [ ] Open items have a clear next step (not vague).
- [ ] Ideas that solidify have moved to a priority section; rejected
      ideas have been removed.

### 1c. Changelog and Versioning (update_changelog.md)

- [ ] The README version badge matches the latest CHANGELOG entry and
      `package.json`.
- [ ] The most recent version bump matches the type of change:

      | Change type | Bump | Example |
      |-------------|------|---------|
      | New power-up, new special, new entity | MINOR | 1.3.1 → 1.4.0 |
      | Bug fix, tuning, doc improvements, tests | PATCH | 1.3.1 → 1.3.2 |
      | Breaking gameplay rule / config key / API | MAJOR | 1.x.x → 2.0.0 |

- [ ] Changelog entries include only user-facing and
      test-infrastructure changes — no internal refactoring,
      comment-only changes, dependency bumps, or README-only changes.
- [ ] Each entry is a single concise line from the user's perspective.
- [ ] Changelog date is accurate.
- [ ] Any `### Security` entry states only the count and general
      nature of a finding — never package names, versions, or
      CVE/GHSA identifiers (see Section 9b).

### 1d. Config Discipline (architecture.md)

- [ ] Every gameplay number lives in `config.js`; reject raw magic
      numbers in gameplay code unless locally justified.
- [ ] Every config object is deeply frozen with `Object.freeze`.
- [ ] New constants carry a comment explaining purpose and units.
- [ ] Derived values (`POWERUP.DURATIONS`, `POWERUP.WEIGHTS`) are
      generated from static data, never hand-maintained.

---

## Section 2 — Systems and Entities Structural Audit

All entities and systems are expected to follow the internal patterns
defined in `docs/extension_patterns.md`, `docs/adding_powerup.md`,
and `docs/architecture.md`.  Walk the modules and check.

### 2a. Entity Pattern (extension_patterns.md)

Walk every module in `src/entities/` and check:

- [ ] Each entity has a creation function and an update function.
- [ ] Creation returns a plain state object with position, velocity,
      radius, age, and `alive` fields.
- [ ] The entity carries an `alive` flag; culling respects it.
- [ ] The entity never imports DOM or browser globals.
- [ ] Entity speed and geometry constants come from `config.js`, not
      local literals.
- [ ] Split/child logic (asteroids) preserves the parent's `type`
      and inherits a controlled speed boost (asteroid.js).  Child
      velocities respect `CHILD_SPEED_BOOST` and `CHILD_ANGLE_SPREAD`.

### 2b. System Pattern (architecture.md)

Walk every module in `src/systems/` (collisions, difficulty,
powerups, scoring, spawner) and check:

- [ ] Imports stay within the allowed set: config, utils, entities,
      and sibling systems — never output/browser modules.
- [ ] No module-level mutable variables; all state flows through the
      single state object.
- [ ] Difficulty interpolation (`calculateDifficulty`) walks
      `DIFFICULTY.KEYFRAMES` monotonically and clamps at both ends.
- [ ] Collision ordering preserves the snapshot-iteration invariant
      and the dead-before-scoring invariant (Section 5a).
- [ ] Spawners respect caps: asteroids 24, projectiles 40, power-ups
      2, particles 320.

### 2c. Power-Up Anatomy (adding_powerup.md)

For the full recipe see `adding_powerup.md`.  A complete power-up
registers in every layer:

| Layer | Location | Check |
|-------|----------|-------|
| Config | `POWERUP_TYPES` in `config.js` | label ≤ 8 chars, all-caps; duration in s (`0` = instant); relative weight; optional `unlockTime` |
| Effect | gameplay hook via `effectActive` / `effectRemaining` | effect applied at exactly one mechanic site; magnitude constants live in `POWERUP` |
| HUD | `CHIP_KEYS` in `hud.js` | timed types appear in display order; label renders via `POWERUP_TYPES` |
| Render | `drawPowerUpGlyph` in `render.js` | a `switch` case draws a crisp vector glyph |
| Docs | README, `game_mechanics.md`, `adding_powerup.md` | values match `config.js` exactly |

- [ ] New power-ups are followed-unlock (3x gates 5x) only where
      intended — `unlockTime` must not exceed a later type's
      unlock time.
- [ ] Durability vs `POWERUP.LIFETIME` (12 s) and `MAX_ON_SCREEN`
      (2) hold.

### 2d. Specials and Difficulty Architecture

- [ ] Special classes unlock in order (bronze → gold) with strictly
      increasing `UNLOCK_TIMES`.
- [ ] `rollSpecialType` restricts weights to the unlocked set; gold
      stays rare because of smaller weight *and* later unlock.
- [ ] Rarity checks use `SPECIAL.TYPE_WEIGHTS` normalised only over
      unlocked classes — no hard-coded split.

---

## Section 3 — Determinism and Simulation Integrity

Determinism is the project's core promise: the entire simulation is
reproducible from a seed.  This underpins the 223-test suite and the
planned run-replay feature.  A single `Math.random()` call in logic
code breaks every seeded assertion.

### 3a. RNG Stream Discipline

- [ ] Zero uses of `Math.random()`, `Date.now()`, or
      `performance.now()` outside `main.js`.  Grep check:

      ```bash
      rg -n "Math\.random|Date\.now|performance\.now" src/ --glob '!**/'
      ```

- [ ] All game randomness flows through the injected `state.rng`.
- [ ] No iteration over object key order where roll or spawn order
      matters.  Ordered selection uses arrays or `pickWeighted`
      (`utils/rng.js`).
- [ ] No code caches RNG draws in a way that an early return would
      skip (each path must consume the same stream for a given
      scenario).

### 3b. Fixed-Step Invariants

- [ ] Simulation results are independent of `dt` granularity —
      verify via the frame-rate independence test pattern
      (`advance` at 1/20 vs 1/120 producing identical totals).
- [ ] Whole-step quantisation: tests never nudge by sub-frame
      epsilons smaller than one `stepSize`.
- [ ] `MAX_DT` clamp in `main.js` guards tab-switch jumps; logic
      modules never assume a frame duration.

### 3c. Reproducibility Protocol

- [ ] Two states created with identical seeds produce identical
      sequences: `createRng(seed)` equality over drawn values.
- [ ] `makeState(seed)` in tests must yield byte-identical outcomes
      on every platform (no locale, no `Number` precision drift).
- [ ] The full state object is inspectable and serialisable — no
      hidden global state or singletons.

---

## Section 4 — Test Coverage Audit

Sources of truth: `docs/testing_guide.md` and the actual suite.

### 4a. Coverage Matrix

The suite holds 223 tests across 16 files.  Confirm each module has
at least one dedicated test file:

| Source module | Test file |
| --- | --- |
| `entities/asteroid.js`, `systems/spawner.js` | `test_asteroids.js` |
| `systems/collisions.js` | `test_collisions.js` |
| `config.js` | `test_config.js` |
| `systems/difficulty.js` | `test_difficulty.js`, `test_specials.js` |
| `game.js` | `test_game_flow.js`, `test_game_edges.js` |
| `utils/math.js` | `test_math.js` |
| `entities/player.js` | `test_player.js`, `test_player_edges.js` |
| `systems/powerups.js` | `test_powerups.js`, `test_powerup_edges.js` |
| `entities/projectile.js` | `test_projectiles.js` |
| `utils/rng.js` | `test_rng.js` |
| `systems/scoring.js` | `test_scoring.js` |

- [ ] Every exported gameplay function is referenced by at least one
      test file.
- [ ] Edge-case files exist for modules with boundary-heavy logic
      (player, powerups, game).
- [ ] `helpers.js` utilities (`makeState`, `step`, `advance`,
      `placeAsteroid`, `placePowerUp`, `rng`, `IDLE_INPUT`) are used
      consistently; no test hand-rolls its own seeding.

### 4b. Required Categories

For each test file, check:

- [ ] Tests prefer exact seeded values over ranges.
- [ ] Normal-operation path tested.
- [ ] Edge/transition behaviour tested (expiry, unlock thresholds,
      phase changes).
- [ ] Phase-guard no-op tests present where a module early-returns on
      `phase !== "playing"`.
- [ ] No `Math.random()` or `Date.now()` in any test.
- [ ] Floating-point comparisons use explicit epsilon
      (`< 1e-9`), never `assert.equal` on computed floats.
- [ ] A bug fix ships alongside the regression test that caught it.

### 4c. Reasonableness / Mathematical Invariants

Verify each assertion style in the suite is mathematically sound:

| Area | Invariant | Why it must hold |
|------|-----------|------------------|
| Slow Asteroids | displacement scaled, velocity preserved | expiring effect restores motion exactly |
| Effects | absolute expiry freezes on pause | `elapsed` stops during pause |
| Difficulty | speed/spawn values monotonic across keyframes | no mid-game difficulty regression |
| Scoring | `SIZE_SCORE × special × boost × 3x × 5x` exact | every multiplier table value checked |
| Caps | 24 / 40 / 2 / 320 enforced at the limit | no unbounded memory growth |
| Geometry | `pointSegmentDistance` falls back to point distance on zero-length segments | degenerate input never NaN |
| RNG | `pickWeighted` never exceeds total; padding residue handled | distribution sums to 1 |
| Multipliers | gold (x4) > bronze (x2) > normal (x1) ordering | gameplay intent preserved |

### 4d. What Is Not Automated

`main.js`, `render.js`, `hud.js`, and `input.js` are browser-bound and
covered by code review plus manual browser testing:

- [ ] The four browser modules remain thin wrappers — any logic
      growing in them is a flag for extraction into a testable
      system module.
- [ ] Manual test checklist (run in the browser on the demo site):
      start, move, shoot, pause/resume, game over, restart, best
      score persistence, resize.

---

## Section 5 — Error Handling and Edge Cases

A systematic sweep of every failure mode across the codebase.

### 5a. Collision Correctness

- [ ] Swept segment: projectile collision uses `prevX`/`prevY`, not
      just current position — fast shots cannot tunnel.
- [ ] One projectile resolves against at most one asteroid (the
      nearest along its path) — a single shot never scores twice.
- [ ] Dead-before-scoring: the projectile is marked dead before
      scoring so no path can credit it twice.
- [ ] Player collisions iterate a snapshot; split children spawned
      mid-step never resolve against the player in the same frame.
- [ ] Shield (Protective Border) destroys asteroids with normal
      score and no life loss; `state.asteroids` is filtered to the
      surviving field before callers observe it.

### 5b. Boundary Conditions

- [ ] `clampToBoard` keeps the ship's full circle inside the board
      and zeroes the velocity component pushing into the wall.
- [ ] Spawn placement across all four edges sits within `EDGE_MARGIN`
      and rejects points within `MIN_PLAYER_DISTANCE` of the player,
      falling back to the farthest edge midpoint after 24 attempts.
- [ ] Off-board culling keeps newcomers inside the entry band until
      they enter, and removes never-entering strays after
      `ENTER_GRACE_SECONDS`.
- [ ] Projectile expiry (`LIFETIME`), off-board removal, and the
      `OFFBOARD_MARGIN` band are consistent.

### 5c. Degenerate and Extreme Inputs

- [ ] Zero-length sweep segments return point distance (tested in
      `test_math.js`).
- [ ] Seeds `0` and `0xFFFFFFFF` produce valid runs (no divide-by-zero
      in `createRng`).
- [ ] Empty arrays flow through `resolve*`, `cull*`, and render loops
      without error.
- [ ] `pickWeighted` with no positive weight returns `null` — callers
      guard on it.
- [ ] `performance.now()` gap (tab switch) is clamped by `MAX_DT`.

### 5d. Phase Guards

- [ ] Every early-return on `state.phase !== "playing"` is verified:
      `resolvePlayerCollisions`, `stepGame`'s full-system block, etc.
- [ ] Pause freezes effects / timers via absolute expiry.
- [ ] Particles decay during game over so explosions finish
      gracefully — confirm this divergence is intentional and
      documented.
- [ ] `startNewRun` resets every run-scoped field while preserving
      `bestScore` and the RNG stream.

### 5e. Storage and Browser Failures

- [ ] `localStorage` read/write is wrapped in try/catch (private
      mode) and stores only the best score.
- [ ] Missing DOM elements fail loudly in development, not silently.
- [ ] `beforeunload` detaches input listeners and saves best score.

---

## Section 6 — Cross-Cutting Concerns

Issues that span multiple files or subsystems.

### 6a. Rendering Purity

- [ ] `render.js` reads state only — it never mutates it.
- [ ] The shake transform is wrapped in `save`/`restore`.
- [ ] No nested `beginPath` without a matching `closePath`/`stroke`
      pattern that would corrupt subsequent geometry.
- [ ] `drawBorder` remains the only board-edge drawing (no per-stage
      CSS border double-up).

### 6b. HUD DOM-Diff

- [ ] `hud.js` rebuilds chips only when the active-set signature
      changes; unchanged sets update countdown text in place.
- [ ] Only `textContent` and `className` are used — no `innerHTML`.
- [ ] Chip class names derive from the hardcoded `CHIP_KEYS` list,
      never from user input.

### 6c. Input and Frame Loop

- [ ] `preventDefault()` fires for arrows and Space so the page never
      scrolls during play.
- [ ] Keyboard repeat (holding a key) does not wedge the input state.
- [ ] `MAX_DT` (50 ms) caps the per-frame step; overshoots are
      dropped, not accumulated.

### 6d. Events and Presentation Bookkeeping

- [ ] `state.events` is drained once per step so renderers always see
      fresh events.
- [ ] Best score persists on hide (`visibilitychange`) and unload.

---

## Section 7 — Documentation Consistency

Verify documentation matches the actual code.

### 7a. README Accuracy

- [ ] Version badge matches `package.json` and the latest CHANGELOG
      entry.
- [ ] Power-up table (labels, durations, effects) matches
      `config.js` exactly.
- [ ] Special asteroid table (unlock times, rarity, multipliers)
      matches `config.js`.
- [ ] Scoring tables (size scores, survival rate) match `config.js`.
- [ ] Project-structure tree lists every `src/` file and `docs/` file
      that exists.
- [ ] The live URL (https://szuck12.github.io/voidrock/) is present
      ahead of Installation.
- [ ] Example commands in Installation produce valid output
      (spot-check 2–3).

### 7b. Cross-Reference Integrity

- [ ] All relative links between docs resolve.
- [ ] `game_mechanics.md` values match `config.js` (unlocks, rarity,
      weights, durations, difficulty keyframes).
- [ ] `architecture.md` state-model table covers every top-level
      field returned by `createInitialState()`.
- [ ] New fields added to the state object are mirrored in
      `architecture.md`.
- [ ] `adding_powerup.md` / `extension_patterns.md` patterns are each
      used by at least one real module.
- [ ] `maintain_todo.md` lifecycle is followed by `TODO.md`.
- [ ] `update_changelog.md` rules are followed by `CHANGELOG.md`.

### 7c. Stale or Duplicate Content

- [ ] No section of any doc describes behaviour changed in a later
      version.
- [ ] No doc duplicates content from another doc (cross-reference
      instead).
- [ ] No TODO item describes something already done.
- [ ] No references to sections that do not exist in a referenced
      guide (e.g. section numbers must be verified when a guide is
      restructured).

---

## Section 8 — Open-Ended: Structural, Performance, and UX Analysis

These questions require judgment and are the heart of the deep dive.
There is no right answer — the goal is to surface design drift.

### 8a. Module Boundaries and Cohesion

- `main.js` (≈183 lines) orchestrates the browser shell; does any
  game logic linger there?
- `render.js` (≈427 lines) is the largest module.  Is the canvas
  command surface still navigable, or does it warrant splitting the
  glyph drawing out?
- If a tenth power-up were added, how many files would change?
  (Answer from the 2c table — low is good.)
- If a new entity type were added, would it slot into
  `extension_patterns.md` without touching existing dispatch?

### 8b. Extension Cost Analysis

- Estimate the cost of adding a new power-up vs a new special class
  vs a new entity.  Walk the checklists in Sections 2a/2c and count
  touched files.
- Identify any pattern that requires touching more than ~4 files for
  a single feature — candidate for a new template or a refactor.

### 8c. Performance and Rendering Budget

- Profile a minute of `npm start` gameplay in DevTools: are there any
  per-frame allocations in hot loops (spawners, collisions)?
- The particle pool caps at 320; verify bursts reject cleanly at the
  cap.
- Are there any O(n²) loops, and are they bounded by the entity caps?
  (Collision loops iterate asteroids × projectiles; confirm caps make
  worst case acceptable.)
- Does the HUD diff actually skip DOM writes when the signature is
  unchanged?
- Canvas re-size on window resize: backing store re-allocates only on
  actual CSS box change (guard against redundant re-allocation).

### 8d. Accessibility and User Experience

- The game is keyboard-only; confirm no interaction requires a mouse.
- Reduced-motion preference (`prefers-reduced-motion`) does not yet
  tone down shake/flash — is that a PATCH or a decorum decision?
  (Tracked in TODO.md Low Priority.)
- Gold vs bronze vs normal asteroid colours: distinguishability under
  deuteranopia?  Shape differences (written glyphs) already aid this —
  keep it in mind for new classes.
- HUD legibility at small viewports: the 300 px canvas floor keeps
  the board playable; verify the footer and overlay scale correctly.
- Pause-on-blur is not implemented — deliberate?  A stray tab switch
  costs a life today.

### 8e. Browser Compatibility and API Surface

- The code relies on ES modules, optional chaining, nullish
  coalescing, `Object.freeze`, and `replaceChildren`.  Confirm the
  supported browser floor matches README claims (no transpilation).
- No build step means no polyfills — a new browser API usage must be
  gated by the same floor.

### 8f. Test Economics

- The suite runs in ≈250 ms.  Would adding DOM tests (hud, input,
  render) require a DOM harness, and is that investment warranted?
- Any test file that is flaky, order-dependent, or relies on
  `Date.now()` must be fixed immediately (it would break the
  determinism promise).

### 8g. Next-Action Synthesis

Based on the findings above, produce a list of the top 3–5 actions.
Each entry must be one of two forms:

1. **Take** — a concrete action that is clearly worthwhile with no
   further debate needed (e.g. "Remove stale `silver` reference from
   TODO.md").  These can be added directly to `TODO.md`.
2. **Ask** — a question that needs a decision before work proceeds
   (e.g. "Should pause-on-blur cost a life, or auto-pause?").  These
   should be raised to the project owner.

| # | Type | Action |
|---|------|--------|
| 1 | Take | ... |
| 2 | Ask | ... |
| 3 | Take | ... |

---

## Section 9 — Security Vulnerability Review

Run this section before each release and after any CI, credential, or
dependency change.  VoidRock is hosted on GitHub and deployed to
GitHub Pages.  This review protects two assets: the integrity of the
repository and the machines of everyone who plays or develops the
game.  Where a check depends on repository visibility, both cases are
noted.

### 9a. Scope and Threat Model

VoidRock is a static, client-side game with zero runtime
dependencies and no server.  The trust boundaries are narrow but real:

| Boundary | Enters via | Risk if hostile |
|----------|-----------|-----------------|
| Browser input | keyboard, resize events | none today — mapped to booleans, never parsed |
| Local storage | `localStorage` | only a numeric best score; no sensitive data |
| GitHub Pages content | publicly served `index.html`, `styles.css`, `src/` | tampered game files could run in a visitor's browser |
| Repository surface | issues, PRs, settings, workflows | leaked secrets, tampered history, malicious workflow edits |

Anything crossing a boundary unvalidated is a candidate finding;
anything staying inside one boundary starts at Low severity by
definition.

### 9b. Severity Scale and Reporting Protocol

Findings are graded on four levels.  Grade by *reachability* today,
not by worst-case imagination:

| Severity | Definition | Required response |
|----------|-----------|-------------------|
| **Very High Risk** | Live secret exposed, or an exploitable code path reachable without preconditions | Revoke/rotate the credential FIRST, then remove from repo; PATCH release same day; history rewrite only if revocation is impossible |
| **High Risk** | Realistic exploit path needing modest preconditions | Fix within days; PATCH release; disclose after the fix ships |
| **Medium Risk** | Weakens posture; becomes exploitable only after some future change | Fix or formally accept in the next release |
| **Low Risk** | Hygiene / hardening; no realistic path today | Batch into TODO.md Low Priority |

Reporting protocol:

1. Never open a public issue containing a live secret — reference
   its location, never its value.
2. Prefer a GitHub private security advisory for externally reported
   issues.
3. Rotate/revoke leaked credentials before scrubbing history;
   rotation makes history rewrite unnecessary in most cases.
4. Record every finding — date, severity, and disposition
   (`FIXED vX.Y.Z`, `ACCEPTED RISK`, or open) — in a log kept
   outside the repository; committed docs and changelog entries state
   at most the count and general class of a finding.
5. If no strong fix exists, record that explicitly in the private
   log: state the residual risk, the compensating control, and why
   the risk is accepted.
6. Discuss vulnerabilities only in general terms in any committed or
   public artifact.  Specifics — packages, versions, CVE/GHSA
   identifiers — live exclusively in the private log and in GitHub
   private advisories.

### 9c. Vulnerability Class Checklists

#### 1. Secrets and Credentials

- What: tokens, API keys, passwords, private keys anywhere in
  tracked files, docs, tests, or git history.
- Check:

  ```bash
  git log --all -p | grep -inE '(ghp_|gho_|github_pat_|AKIA[A-Z0-9]{16}|BEGIN [A-Z ]*PRIVATE KEY)'
  git ls-files | grep -iE '\.env|secret|token|credential|\.pem'
  # Optional deeper scan: gitleaks detect / trufflehog
  ```

- Pass: no hits outside placeholders and documentation examples.
- Fail severity: **Very High** if live, Medium if expired/example.
- Fix: revoke at the provider first, then delete the file; use
  `git filter-repo` only when the secret cannot be revoked.

#### 2. Dangerous Execution Primitives

- What: `eval`, `new Function`, `innerHTML`, `document.write`,
  `insertAdjacentHTML`, `setTimeout`/`setInterval` with strings —
  anything that turns data into code or markup.
- Check:

  ```bash
  rg -n "eval\(|new Function|innerHTML|document\.write|insertAdjacentHTML" --glob '*.{js,html}' src/ index.html
  ```

- Pass: zero hits (the codebase currently documents this as a design
  rule in `hud.js`).
- Fail severity: **Very High** if reachable from input, High
  otherwise.
- Fix: keep all DOM writes on `textContent`/`className`;
  use explicit dispatch tables instead of dynamic evaluation.

#### 3. Input Handling and Injection Surfaces

- What: how browser input flows into sinks.  Keys map to boolean
  flags in `input.js`; no string input reaches the DOM or network.
- Check:
  - `preventDefault()` applied only where needed (arrows, Space).
  - No keyboard-derived string is ever placed in innerHTML or a URL.
  - No `fetch` / `XMLHttpRequest` anywhere in `src/` — the game makes
    zero network requests.
- Fail severity: Low while input is strictly local.
  - Fix: keep the input-to-boolean mapping; add input validation at
    the point where any new input source is introduced.

#### 4. Content Security and Resource Loading

- What: what the page is allowed to load and run.
- Check:
  - `index.html` carries the CSP meta tag
    (`default-src 'none'; script-src 'self'; style-src 'self';
     img-src data:`).
  - No external `script`, `style`, `link`, image, or font references.
  - No `http://` resources (the only occurrence is the SVG `xmlns`
    namespace, which is not a load).
- Pass: meta CSP present and no external resources.
- Fail severity: Medium if an external resource sneaks in (it would
  be blocked by CSP but should never exist).
- Fix: remove the external reference; update the CSP only with
  explicit justification.

#### 5. Dependency and Supply Chain

- What: every package needed to build, test, or deploy.
- Check:
  - `package.json` has zero `dependencies` and zero
    `devDependencies` — any new dependency is a review event.
  - No transitive packages in `node_modules` beyond the lockfile.
  - GitHub Actions in `.github/workflows/` are pinned to full commit
    SHAs (not version tags), with a version comment.
  - Dependabot alerts enabled and update PRs reviewed promptly.
- Pass: zero dependencies and pinned actions.
- Fail severity: Medium for an unpinned action tag; **Very High** if
  an audit flags a known-vulnerable pinned dependency.
- Fix: pin actions by SHA; run `npm audit` before adding any
  dependency; re-run the full suite after every bump.

#### 6. Repository Hygiene and Metadata

- What: files that leak local machine info or bloat public history.
- Check:

  ```bash
  git ls-files | grep -iE '\.DS_Store|cache|\.env|\.log$'
  git status --porcelain --untracked-files=all
  cat .gitignore
  ```

- Pass: index contains none of them AND `.gitignore` covers
  `node_modules/`, `.DS_Store`, `*.log`, coverage and IDE dirs.
- Fail severity: Low.
- Fix: extend `.gitignore`; `git rm --cached <file>` if already
  tracked.

#### 7. GitHub Platform Configuration

- What: account/repo settings that bound the blast radius.  These
  are settings, not files.
- Check:
  - Dependabot alerts: ON.
  - Secret scanning + push protection: ON for public repos.
  - Branch protection on `main`: no force pushes; require PRs once
    there is more than one maintainer.
  - GitHub Pages source points at the intended branch/root, and the
    deploy workflow stages only `index.html`, `styles.css`, and
    `src/`.
- Fail severity: Medium — secrets pushed today persist unnoticed
  without secret scanning.
- Fix: Settings → Code security and analysis / Branches / Pages.

#### 8. Data Trust and Local Storage

- What: assumptions about locally stored and remotely served data.
- Check:
  - `localStorage` stores only `voidrock.best`, a number, wrapped in
    try/catch (private-mode safe).
  - No `JSON.parse` of anything other than internal literals — no
    deserialization of remote or user data.
  - The RNG seed (from `Math.random()` in `main.js`) is used for
    gameplay variety only and is not a security control.
- Fail severity: informational unless storage ever grows to hold
  user-controlled or sensitive data.

---

## Common Issues

These are the most frequent review findings:

1. **Magic numbers in logic code** — move to `config.js`.
2. **Missing `alive` flag check** — entities without it cannot be
   safely culled.
3. **Countdown timers instead of absolute expiry** — breaks pause
   freezing.
4. **Mutation in render functions** — must be read-only.
5. **Missing snapshot iteration** — player collision loop must copy
   the asteroid array to prevent cascade kills.
6. **`Math.random()`/`Date.now()` leaking into `src/`** — breaks the
   determinism promise (Section 3a).
7. **Docs and config drifting apart** — mirror every `config.js`
   change in `game_mechanics.md` and README tables (Section 7b).

## Review Tone

Comments address the code, not the author.  Propose alternatives
with rationale; approve when the checklist is satisfied even if a
stylistic preference differs.

When requesting changes, reference the specific invariant or rule
being violated.  For example:

- "This magic number should live in `config.js` per the config
  discipline rule."
- "This needs snapshot iteration to prevent cascade kills — see
  `resolvePlayerCollisions` for the pattern."
- "This effect should use absolute expiry for pause safety."
- "This `Date.now()` call breaks determinism — inject a seeded rng
  instead (Section 3a)."