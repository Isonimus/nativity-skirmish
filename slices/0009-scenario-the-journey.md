---
id: '0009'
title: "Scenario 01 — The Journey, and the checks the rules corpus must now pass"
type: slice
status: proposed
date: 2026-08-10
supersedes: []
superseded_by: []
---

# Scenario 01 — The Journey, and the checks the rules corpus must now pass

## Summary

The last content unit of v1 (ADR-0002): one playable scenario, and the harness that holds
the whole rules corpus to the promises the ADRs made about it.

## Scope

- `rules/scenario-01-the-journey.md` — board, setup, the Star's road, Gifts, scoring,
  ending.
- `rules/core-loop.md` §6 — the civilian behaviour table, which the Townsfolk trait had
  been citing since slice 0006 with nothing behind it.
- `scripts/scenario-verify.mjs` — corpus checks plus the scenario's scoring arithmetic.

Out of scope: the published manual's styling and plates (ADR-0008 defers both to their own
slices, deliberately after this one).

## Design

**The trailing player chooses the Star's road.** ADR-0004 named the risk that a fully
predictable Star turns the game into a foot-race, and left it as a playtest question. This
scenario answers it structurally instead: the Star advances one feature per round, and the
player *behind on points* picks which. A lead cannot be defended, because the leader does
not decide where the fight is. It costs one paragraph and no components.

**Two kinds of points, deliberately level.** Contested points (the illuminated feature,
The Infant) return to the table every round. Held points (delivered Gifts) are permanent.
They are worth the same per round, so banking permanent income and disengaging trades
evenly against staying on the board — and neither is the answer. This parity is not a
preference; it is a bound the verify script enforces, and it is what capped Gifts at two.

**Nothing about the scenario can end it early.** No model's removal, no objective, no
score. Six rounds, then count. Standing invariant 3, now machine-checked rather than
trusted.

## Verification

`scripts/scenario-verify.mjs`, wired into `npm run verify` and `npm run check`.

Machine-checkable half — non-zero exit if any holds:

- **any absolute distance unit** appears anywhere in `rules/` — this promotes standing
  invariant 2 from `pending (LEDGER)` to enforced, which is what ADR-0003 deferred until
  rules text existed;
- **any sudden-loss phrasing** appears anywhere in `rules/` — invariant 3, previously
  review-only;
- **a section cross-reference** (`Core Loop §6`) points at a section that does not exist;
- **a named table** is cited and is not a section in any rules file;
- **one scoring source** is worth more than half a round, or **held sources out-earn
  contested ones**;
- a scoring source declares a kind outside `[contested, held]`, or a non-positive value.

Every bound above was negative-tested by perturbing the rules text and confirming it
fires. This is now a standing practice rather than a courtesy: the first draft of this
script carried a comeback bound that reduced to `floor(rounds/3) >= rounds/2` and could
never fire at any game length — the second vacuous bound in this repo's harness after
`MAX_DECISIVE`. It was replaced by the held-against-contested bound, which fires.

Human half — `artifacts/scenario-01-scoring.md`: the per-round ceilings, each source's
share, and the contested/held balance. That is the table to argue with after a playtest.

**What this does not verify**: whether the trailing player choosing the Star's road
actually prevents a runaway lead, whether six rounds is right, and whether delivering
Gifts is a trap or a real decision. All three need two people and an afternoon and are
carried in `LEDGER.md`.

## Definition of Done

Given the whole rules corpus,
When any distance is stated in a unit a player cannot measure with their card strip,
Then the build fails.
Proof: `scenario-verify.mjs`, the ABSOLUTE_UNIT check, negative-tested with `30 cm`.

Given the whole rules corpus,
When any rule would end a scenario on a single event rather than on points,
Then the build fails.
Proof: `scenario-verify.mjs`, the SUDDEN_LOSS check, negative-tested with
`immediately loses`.

Given a rules file that cites another section or a named table,
When that section or table does not exist,
Then the build fails rather than shipping a reference the reader cannot follow.
Proof: `scenario-verify.mjs`, negative-tested with `Core Loop §99` and
`the sudden death table`; this check was written because
`the civilian behaviour table` was exactly that defect, and it is fixed in this slice.

Given the scenario's scoring table,
When a permanent objective would out-earn the contestable ones,
Then the build fails, because the board would stop mattering.
Proof: `scenario-verify.mjs`, MAX_HELD_SHARE, negative-tested at 3 points a round.
