---
id: '0005'
title: "The Infant generates scoring pressure; no model is a sudden-loss condition"
type: architecture
status: accepted
date: 2026-08-10
supersedes: []
superseded_by: []
---

# The Infant generates scoring pressure; no model is a sudden-loss condition

## Context

The concept note (0001) makes the Infant an immobile model that buffs nearby friendlies
and whose capture **immediately loses the scenario**, and calls this good design on the
grounds that it makes the game revolve around protecting a one-point model.

It does the opposite. The rule is a binary sudden-loss condition attached to a model that
cannot move, which makes the dominant strategy trivially computable: form a ring around
the manger and never leave it. Every other system in the game is then dead weight —
movement is a liability, terrain is irrelevant, the Star (ADR-0004) can be ignored, and
the opponent's only line of play is to throw models at a wall until one gets through.
Neither side is making decisions.

This is the standard failure of king-capture conditions in skirmish games, and it is
worse here than usual, because the protected model is immobile *by rule*, so the defender
cannot even relocate the problem. It also destroys the escort scenario ADR-0002 names as
v1's only scenario: "The Journey" requires the Holy Family to cross the board, which no
rational player would do if crossing risks instant defeat.

The dramatic goal behind the rule is right — the Infant should be the most important thing
on the table. Sudden loss is simply the wrong instrument for it.

## Decision

**No single model's loss ends a scenario.** Importance is expressed as scoring pressure,
continuously, never as a binary.

1. The Infant scores victory points for the controlling player **each round he ends
   unthreatened** — no enemy model within a stated radius in `H`.
2. An enemy model that ends its activation within that radius converts the round's points
   to the threatening player instead.
3. Capture is a large point swing and a strong ongoing effect, not a game end. Play
   continues; the scenario can be recovered.

The generalisation is binding: any future rule proposing "if X happens you immediately
lose" must instead be expressed as points, and if it cannot be, it does not ship.

## Consequences

- The defender must *contest ground away from the manger* to stop the conversion, which is
  the behaviour the rule was trying to produce and the turtling version prevents.
- Points accrue per round, so a player who is behind still has a reason to play the last
  round — the failure mode of sudden-loss games, where the outcome is decided long before
  the game ends, is removed.
- Escort scenarios become possible, so ADR-0002's v1 scenario survives.
- Standing invariant: **no rule ends a scenario on a single model's loss or capture.**
  Added to `CLAUDE.md` §4 in this commit, `review-only`.
- The radius and the per-round value are unset here on purpose: they are playtest numbers,
  and this repo's standard is that measured values go in an ADR after measurement rather
  than estimates going in before it.
