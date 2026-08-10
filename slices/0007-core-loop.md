---
id: '0007'
title: "The core loop: round, activation, opposed roll, morale"
type: slice
status: proposed
date: 2026-08-10
supersedes: []
superseded_by: []
---

# The core loop: round, activation, opposed roll, morale

## Summary

The ten profiles of slice 0006 are not yet a game. This slice is the loop that turns them
into one: the round sequence, what a model does when activated, how a strike resolves, how
fear degrades a model, and how points are scored.

## Scope

- `rules/core-loop.md` — the round, activation and terrain, the opposed roll, morale,
  scoring.
- `scripts/core-loop-verify.mjs` — exact odds over the profiles, and the bounds they must
  respect.
- `scripts/lib/rules-table.mjs` — one markdown-table reader, now that two scripts parse
  the same rules file and must agree about its format.

Out of scope: scenarios, factions, campaign play.

## Design

**The Star is the round** (ADR-0004). It advances, illuminates a feature, and sets
initiative by proximity. Standing where you score is standing where you are hit; that trade
is the tactical game, so combat does not have to carry it.

**One roll each, no arithmetic.** The attacker beats its Skill, the defender fails to beat
its own. Advantage and disadvantage — two dice, keep the better or the worse — replace
every modifier, because a table of shifting target numbers is where a family game loses its
audience.

**Morale degrades, never deletes** (ADR-0005). A failed Resolve test leaves a model Shaken,
not removed. Nothing in this game ends on a single roll.

**Combat scores nothing.** Points come from the illuminated feature and from The Infant
ending the round unthreatened. Removing models is a means to those, never an end, which is
what makes lopsided melee odds acceptable rather than fatal.

## Verification

`scripts/core-loop-verify.mjs`, wired into `npm run verify` and `npm run check`.

The odds of two D6 targets are exactly computable, so the script computes rather than
simulates — a gate on commits must not be flaky, and sampling noise would make it so.

Machine-checkable half — non-zero exit if any holds:

- a Skill or Resolve falls outside 2+..6+, which would make a roll auto-pass or auto-fail;
- any exchange exceeds 75% (the roll is ceremony) or falls below 2% (the attacker is
  scenery);
- any matchup needs more than 50 exchanges to resolve, so it could never happen in a game;
- a class has Grit below 1, or cannot move yet can strike, or has no Skill yet tests
  Resolve;
- two classes share an identical stat line, making one of them redundant.

Human half — `artifacts/core-loop-odds.md`: the full hit matrix, exchanges-to-remove, and
morale table, which is the data to argue with when the placeholder stats are tuned.

**What this does not verify**, stated so the harness is not read as covering it: whether
six rounds is the right length, whether positional scoring actually beats melee attrition
at a real table, and whether any of it is fun. Those need two people and an afternoon, and
are carried in `LEDGER.md`.

## Definition of Done

Given the ten profiles of the conversion table,
When every ordered pair of legal targets is evaluated,
Then no exchange is a foregone conclusion and none is unwinnable.
Proof: `core-loop-verify.mjs`, the MAX_DECISIVE and MIN_VIABLE bounds.

Given a model that never rolls to defend,
When an opponent attempts to strike it,
Then the rules state it is not a legal target, rather than leaving the case to be inferred.
Proof: `rules/core-loop.md` §3, and the restriction of the matchup set to combatants in
`core-loop-verify.mjs`.

Given a model that fails a morale test,
When its next activation comes,
Then it is degraded and still on the table.
Proof: `rules/core-loop.md` §4; review against `CLAUDE.md` §4 row 3.

Given two scripts that both read the profile table,
When the table's format changes,
Then both change together.
Proof: `scripts/lib/rules-table.mjs` is the single reader; `npm run verify` runs both
consumers.
