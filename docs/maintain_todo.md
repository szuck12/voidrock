# Maintaining TODO.md

TODO.md is the project's single living task list. These rules
mirror quant_lab's conventions; keep both files structurally
identical.

## Sections

In this order:

1. **In Progress** — actively being worked; at most a handful.
2. **Done** — completed items, newest last, each dated `YYYY-MM-DD`.
3. **High / Medium / Low Priority** — queued work in rough order.
4. **Ideas (no commitment)** — sparks worth recording.

## Item Format

* Checkbox list items, one concern per item.
* End each item with hashtag tags: `(#gameplay)`, `(#ui)`,
  `(#testing)`, `(#infra)`, `(#audio)`, `(#idea)`, and so on.
  Reuse existing tags before inventing new ones.
* Done items gain a trailing date:
  `- [x] Ship the thing (#gameplay) — 2026-08-22`

## Lifecycle

* Move an item In Progress → Done the moment it ships, adding the
  date.
* When priorities change, re-file the item; do not annotate in
  place with "(now high!)".
* Finished ideas graduate into a priority section or are deleted.

## Pruning

When the **Done** section exceeds ten entries, fold the oldest
into CHANGELOG.md (if not already recorded there) and delete them
from this file. TODO is a workspace, not an archive.

## Hygiene

* No owner names — anyone should be able to pick anything up.
* No target dates; priority ordering communicates urgency.
* If an item has sat unpicked through several sessions, either
  raise its priority or demote it to an Idea.
