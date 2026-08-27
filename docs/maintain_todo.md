# Maintaining TODO.md

This document describes how to keep `TODO.md` up to date and
explains how it relates to the other project documentation.

---

## Purpose

`TODO.md` tracks **planned** and **in-progress** work — features
that haven't shipped yet, bugs not yet fixed, ideas still being
evaluated.  It looks forward.

For **historical** records of what has already shipped, see
`CHANGELOG.md`.

---

## Sections and Their Lifecycles

| Section | Purpose | Lifecycle |
| --- | --- | --- |
| **In Progress** | What's actively being worked on. | At most 1–2 items.  When an item ships, move it to **Done** and record the release in `CHANGELOG.md`. |
| **Done** | Recently completed items. | Prune periodically — once an item is recorded in a release, it can be removed. |
| **High Priority** | Important changes that should be done soon. | Items arrive here when a clear need is identified (bug, requested feature, etc.). |
| **Medium Priority** | Should get done, not urgent. | Items may be promoted or demoted as priorities shift. |
| **Low Priority** | Nice-to-haves. | Items that are worth doing but have no urgency. |
| **Ideas** | Interesting ideas not yet committed to implementation. | When an idea solidifies into a concrete plan, move it to one of the priority sections.  If it is rejected or becomes irrelevant, remove it. |

### Item Flow

```
Ideas → Priority (High/Medium/Low) → In Progress → Done → pruned
```

Items can skip the Ideas stage (e.g. a bug report goes straight
to a priority section).  Items can be demoted or removed at any
point.

---

## When to Update

- **A change is requested or a bug is found.**  Add an unchecked
  item (`[ ]`) to the appropriate priority section based on
  importance.
- **An idea comes up.**  Add it to **Ideas** with an unchecked
  box.
- **Work begins.**  Move the item to **In Progress**.
- **Work ships.**  Move the item to **Done**, check the box
  (`[x]`), and record the change in `CHANGELOG.md` following the
  [changelog process](update_changelog.md).
- **An item is no longer relevant.**  Remove it (no need to leave
  zombie entries).

---

## Relationship to Other Documentation

| File | Role | How It Differs from TODO.md |
| --- | --- | --- |
| `CHANGELOG.md` | Records what shipped in each release. | Backward-looking.  A TODO item moves here once completed. |
| `adding_powerup.md` | Step-by-step guide for implementing a new power-up. | How-to for the *implementation*.  TODO.md tracks *what* is planned; `adding_powerup.md` explains *how* to build it. |
| `architecture.md` | Core systems, data flow, invariants. | Reference for *why* things work the way they do.  TODO items may reference architectural constraints. |
| `extension_patterns.md` | Templates for new entities, systems, and config. | Reference for *how* to structure new code.  TODO items may reference these patterns. |
| `update_changelog.md` | Process for version bumps and changelog entries. | Works in tandem: when an item ships, move it in TODO.md *and* record it in CHANGELOG.md. |

---

## Entry Conventions

Every entry is a Markdown checkbox list item:

```
- [ ] Brief action-oriented description (#tag)
```

Tags are lowercase, single word, prefixed with `#`.  Use any tag
that fits; common ones:

| Tag | When to Use |
| --- | --- |
| `#gameplay` | Gameplay mechanics, rules, balance |
| `#ui` | HUD, overlays, user-facing display |
| `#testing` | Test additions, fixes, coverage |
| `#infra` | Build, CI, deployment, project config |
| `#audio` | Sound effects, music |
| `#feature` | New non-gameplay features |
| `#idea` | Uncommitted ideas not yet planned |
| `#docs` | Documentation changes |
| `#architecture` | Structural or architectural changes |
| `#accessibility` | Accessibility improvements |

### Done Section Format

For completed items, check the box and prefix with the completion
date (`YYYY-MM-DD`):

```
- [x] Ship the thing (#gameplay) — 2026-08-22
```

---

## Done Section Pruning

When the **Done** section has **10 or more** items, prune it to at
most **9** items by removing the oldest entries.  This keeps the
section focused on recently completed work without accumulating
historical noise.

Before removing an entry, verify it is recorded in `CHANGELOG.md`
under the appropriate version.  If not, add it there first.

Never remove items from **In Progress**, **High Priority**,
**Medium Priority**, **Low Priority**, or **Ideas** sections — only
the Done section is pruned.

---

## Entry Ordering

New entries are appended at the **bottom** of their section (after
any existing entries), not inserted at the top.  This preserves a
rough chronological order within each priority group and avoids
merge conflicts when multiple people add entries in the same
session.

---

## Hygiene Rules

- **No owner names** — anyone should be able to pick anything up.
- **No target dates** — priority ordering communicates urgency.
- **No vague entries** — each item should be specific enough that
  someone can start working on it without further clarification.
- **Stale items** — if an item has sat unpicked through several
  sessions, either raise its priority or demote it to an Idea.
