# TODO

A living list of tasks and ideas for Voidrock. See
`docs/maintain_todo.md` for the conventions this file follows.

## In Progress

- [ ] Nothing currently in flight.

## Done

- [x] Core game loop with deterministic, seeded simulation
      (#architecture) — 2026-08-22
- [x] Asteroid splitting, specials (bronze/silver/gold), and
      time-based difficulty curve (#gameplay) — 2026-08-22
- [x] Seven power-ups with eligibility rules and timed effects
      (#gameplay) — 2026-08-22
- [x] HUD with effect countdown chips; overlays for menu, pause,
      and game over (#ui) — 2026-08-22
- [x] 134-test deterministic suite via node:test (#testing) —
      2026-08-22
- [x] GitHub Pages deployment workflow (#infra) — 2026-08-22

## High Priority

- [ ] Add sound effects and a mute toggle (#audio)
- [ ] Mobile/touch controls: virtual stick + fire button (#ui)

## Medium Priority

- [ ] Local high-score table persisted per browser (#feature)
- [ ] Screen-wrap variant as a rules toggle (#gameplay #idea)
- [ ] Asteroid health: large rocks require two hits at higher
      difficulty tiers (#gameplay)

## Low Priority

- [ ] Optional gamepad support (#feature)
- [ ] Reduced-motion preference honours shake/flash effects
      (#accessibility)

## Ideas (no commitment)

- Boss asteroid every 100 points with weak-point rings (#idea)
- Two-player hot-seat score duel (#idea)
- Replay sharing via seeded run codes — the whole sim is already
  deterministic, so a seed plus input log reproduces a run
  (#idea #architecture)
