---
id: '0006'
title: "The conversion table: any belén to a legal warband"
type: slice
status: proposed
date: 2026-08-10
supersedes: []
superseded_by: []
---

# The conversion table: any belén to a legal warband

## Summary

The first artifact of v1 (ADR-0002): the procedure that turns a household nativity display
into playable models. A reader looks at a figure, answers a short ordered sequence of
observable questions, and gets a profile.

Everything hangs on this. If the table cannot classify an arbitrary belén, the premise
that "your belén is the army" is false and the project stops.

## Scope

- `rules/conversion-table.md` — observable attributes, the decision procedure, the ten
  class profiles, and warband legality.
- `scripts/conversion-verify.mjs` — the machine-checkable half.
- `fixtures/belen-inventories.json` — real household sets, described by attribute, with
  the class each figure must resolve to.

Out of scope: factions, scenarios, the core loop. Class is not faction — a kneeling Mary
and a kneeling king share a profile and will differ by faction rules that do not exist
yet. That separation is what makes the table survive sets it has never seen.

## Design

**Classify by what a figure visibly is, never by who it depicts** (ADR-0002). Attributes
are binary and decidable by looking: winged, mounted, armed, staff, burden, kneeling,
quadruped, large, swaddled.

**First match wins, and the last row matches everything.** Ordering resolves figures with
several attributes (an armed rider, a kneeling shepherd with a crook) without a single
special case, and the catch-all makes the procedure total — the fisherman gets a profile
because *every* figure gets a profile.

**Distances in `H`** (ADR-0003). **No profile carries a loss condition** (ADR-0005).

## Verification

`scripts/conversion-verify.mjs`, wired as `npm run verify` and run in `npm run check`.

Machine-checkable half — the script exits non-zero if any holds:

- a predicate names an attribute the table does not declare;
- the final row is not the catch-all, so some figure could fall through unclassified;
- two rows carry the same predicate, so one is unreachable;
- a class appears in the procedure with no profile, or a profile is unreachable from the
  procedure, or any profile cell is empty;
- any fixture figure resolves to a class other than its expected one.

Human half — the script writes `artifacts/conversion-coverage.md`: per-set class
distribution and warband legality for every fixture inventory, for eyes to judge whether
the resulting warbands are *interesting*, which no assertion can decide.

Playtest on a physical set is what settles the stat values; those are measured numbers and
land in a later ADR, not here.

## Definition of Done

Given a household belén described only by observable attributes,
When the decision procedure is applied to every figure in it,
Then each figure resolves to exactly one class with a complete profile.
Proof: `conversion-verify.mjs`, fixture and totality checks.

Given a figure with several attributes at once — an armed rider, a kneeling figure holding
a staff,
When it is classified,
Then the ordering alone decides, with no exception clause in the table.
Proof: `conversion-verify.mjs`, duplicate-predicate check plus the mixed-attribute fixture
entries.

Given a belén missing common pieces, and another with absurd duplicates,
When a warband is built from either,
Then both produce a legal warband within the 5–15 model band of ADR-0002.
Proof: the legality section of `artifacts/conversion-coverage.md`.

Given the repository's standing invariants,
When the rules text is checked,
Then no distance appears in absolute units and no profile ends a scenario on one model's
loss.
Proof: review against `CLAUDE.md` §4 rows 2 and 3.
