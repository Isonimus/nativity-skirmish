---
id: '0004'
title: "The Star is the initiative track, the event clock and the moving objective"
type: architecture
status: accepted
date: 2026-08-10
supersedes: []
superseded_by: []
---

# The Star is the initiative track, the event clock and the moving objective

## Context

The concept note (0001) specified factions, terrain, scenarios and campaign progression,
and no activation system — the thing that actually makes a skirmish game a game. Order of
play was simply absent.

A skirmish system needs three separate pieces that are usually three separate
subsystems: something that decides **who acts next**, something that drives **round-level
events** so the board changes without a referee, and something that **moves the point of
contention** so players cannot solve the game by camping an objective on turn one. Each
normally costs components and rules text, and rules text is the scarce resource in a
manual that has to be readable at a family table.

The Star of Bethlehem is already in the set — every belén has one, usually mounted above
the stable and often movable. It is thematically the thing that *tells people where to
go*, which is exactly the semantics of all three subsystems.

## Decision

**The Star is a single component serving all three roles.**

1. **Position.** The Star occupies one terrain feature of the display. It starts on the
   stable.
2. **Movement.** At the start of each round it advances to an adjacent terrain feature by
   a rule the scenario specifies. Its destination is knowable but not freely chosen by any
   one player.
3. **Initiative.** The player whose nearest model is closest to the Star activates first
   this round; play then alternates. Distances measured in `H` (ADR-0003).
4. **Event clock.** The feature the Star occupies is *illuminated*: its terrain effect is
   active or amplified this round. Features it has left go dark.
5. **Objective.** Scenarios may score on proximity to the Star, which makes the scoring
   position move every round by construction.

## Consequences

- One rule paragraph buys initiative, a round timer, a live board and an anti-camping
  pressure. This is the cheapest structural decision available and it is thematically free
  — the Star moving and everyone following it is the source material, not a mechanic
  bolted onto it.
- Initiative becomes a *positional* resource rather than a dice roll: standing near the
  Star means acting first and scoring, and also means being the most exposed model on the
  board. That tension is the core tactical decision of v1, and it needs no faction rules
  to exist.
- "Follow That Star" ceases to be a scenario and becomes the engine; the scenario list
  in 0001 loses one entry and every other scenario gains a spine.
- Risk to test in playtest: if the Star's next feature is fully predictable, the game
  degenerates into a foot-race with no decisions. The scenario-specified movement rule
  must carry at least one bit of uncertainty. This is a playtest question, not a design
  one, and the number goes in a later ADR.
