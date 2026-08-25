# Updating CHANGELOG.md

CHANGELOG.md is written for players and future maintainers, in
that order. Conventions match quant_lab.

## Format

* [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) layout
  with Semantic Versioning.
* An `[Unreleased]` section always exists at the top; entries
  accumulate there until release.

## Sections

Within a version, use only these subsections, in this order:

* **Added** — new features.
* **Changed** — changes to existing behaviour.
* **Deprecated** — soon-to-be-removed features.
* **Removed** — removed features.
* **Fixed** — bug fixes.
* **Security** — vulnerability-related changes.

## Writing Entries

* One bullet per user-visible change; omit internal refactors that
  do not alter behaviour (mention them under Changed only if they
  affect extension points).
* Lead with the feature, follow with the effect:
  > - Protective Border: wall contact now destroys asteroids,
  >   awarding normal hit score instead of costing a life.
* Include tuning changes with their numbers:
  > - Reduced Rapid Fire cooldown multiplier from 0.5x to 0.45x.
* Reference issue numbers when work traces to one:
  > - Fixed swept-path test flake (#42).

## Versioning Rules

* **MAJOR** — breaking changes to gameplay rules, config keys, or
  module APIs other code may import.
* **MINOR** — new features (a new power-up, new specials).
* **PATCH** — fixes, tuning, docs.

## Release Checklist

1. Rename `Unreleased` to `## [X.Y.Z] - YYYY-MM-DD`.
2. Add compare links at the bottom.
3. Bump `version` in package.json to match.
4. Update the version badge in README.md.
