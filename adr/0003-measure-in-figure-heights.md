---
id: '0003'
title: "All distances are measured in figure-heights, not inches"
type: architecture
status: accepted
date: 2026-08-10
supersedes: []
superseded_by: []
---

# All distances are measured in figure-heights, not inches

## Context

Wargames state ranges in absolute units — 5", 12" — because the publisher also sells the
miniatures and therefore controls the scale. Warhammer is 28–32 mm; every distance in the
rulebook is calibrated to that and to a flat 6×4 table.

This game controls neither. Household belén figures are sold in many sizes, commonly
7–12 cm, with parish and shop displays running far larger; the "table" is a cork-and-moss
landscape with a river, a slope and buildings, not a flat rectangle. 0001 assumed a
"recommended table 60 × 60 cm", which is an assumption about someone else's living room.

A rule written in inches produces a different game on every set it meets. On small
figures a 5" charge crosses the whole display; on large ones it barely leaves the stable.
Both are broken, and neither is detectable by the reader before play — they simply find
the game does not work and blame the game.

The premise (ADR-0002) is that the reader's own belén *is* the army and the battlefield.
Absolute units silently contradict that premise: they make the rules correct for one
scale and wrong for the rest.

## Decision

**One figure-height (`1 H`) is the unit of distance.** It equals the height of a standard
adult figure in the set being played, measured from base to head, chosen once before the
game and used by both players for the whole session.

Every distance in the rules — movement, charge, weapon reach, aura, morale radius,
deployment — is expressed as a multiple or fraction of `H`, in half-`H` increments. No
rule states a distance in centimetres or inches.

Boards are likewise relative: deployment zones and objective spacing are defined in `H`
and as fractions of the display's own extent, never as a fixed table size.

## Consequences

- The system self-scales. The same rules produce the same game on a 7 cm supermarket set
  and on a 25 cm parish display, which is what "your belén is the battlefield" has to mean
  to be true rather than aspirational.
- Measurement is done with a cut strip of paper or card `1 H` long, marked in halves,
  rather than a tape. This is a component the reader makes in thirty seconds from the set
  they already own — it fits the premise and costs nothing to distribute.
- Sets that mix scales (a large Holy Family with small villagers, common in accumulated
  family belenes) need a stated tie-break. v1 rule: `H` is taken from the *most numerous*
  adult figure type, because that minimises the number of models playing at a distorted
  scale.
- Standing invariant: **no absolute distance units in any rules text.** Added to
  `CLAUDE.md` §4 in this commit. This one is mechanically checkable once rules text exists
  — a grep for `"` / `cm` / `mm` in the rules source — so it is carried as `pending
  (LEDGER)` rather than `review-only`, with a ledger item for the lint rule.
