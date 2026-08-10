---
id: '0002'
title: "Nativity: Skirmish — premise, and the conversion table as the load-bearing mechanism"
type: architecture
status: accepted
date: 2026-08-10
supersedes: ['0001']
superseded_by: []
---

# Nativity: Skirmish — premise, and the conversion table as the load-bearing mechanism

## Context

The idea: a skirmish miniatures ruleset played with the figures of a Christmas nativity
display (*belén*), written in the dead-serious register of a wargame manual.

**Prior art, checked 2026-08-10.** Three searches (English and Spanish, plus itch.io
physical-games listings) found no ruleset of this kind. What exists is adjacent in two
directions, and both directions are evidence *for* the premise rather than against it:

1. **Nativity as subject, wargame as material.** Spanish hobbyists build belenes out of
   Warhammer 40K miniatures as a recurring Christmas tradition (cargad.com 2015, El Libro
   de los Agravios 2015). That is the inverse joke and does not occupy this space.
2. **Belén parts as wargame terrain.** Wargamers already buy belén scenery — bridges,
   wells, palms, buildings — as cheap terrain (warhammer-el-nuevo-mundo, 2011). The
   physical premise is therefore established: these pieces work on a table at wargame
   scale. Nobody has written rules that read the set *as* the army.
3. **Any-minis skirmish systems** (Song of Blades & Heroes, Open Combat, Frostgrave,
   Skirmisher Publishing's *Skirmish!*) prove the mechanism of "play with the models you
   own" is sound, and are the real competition.

The distinguishing fact is not the joke. It is that **the input set is culturally
standardised**. Any-minis systems must say "use proxies, agree with your opponent",
because they cannot know what is in the reader's box. A belén can be known: shepherd,
sheep, king, angel, Roman, well, palm, and a large population of anonymous villagers
carrying things. That makes a *deterministic* conversion from a household's own
decorations to a legal warband possible, which no general any-minis system can offer.

The concept note (0001) named this as the "Belen Army Builder" and treated it as one
feature among many, alongside factions, campaign rosters and eight scenarios. That
ordering is wrong: the conversion table is the only part that is novel, and every other
part is depth on a loop that does not exist yet.

0001 is also the wrong kind of document. It is filed as a slice — a feature work-unit
frozen at merge — but has no implementable scope, and its Definition of Done ("the pitch
explains the premise clearly") cannot fail. A premise is a decision later work obeys, so
it belongs in an ADR. This ADR supersedes it on both counts.

## Decision

Build **Nativity: Skirmish**: a skirmish ruleset whose army list is the reader's own
belén.

1. **Skirmish scale: 5–15 models per player.** 0001 proposed "20-40 models per side",
   which is a mass-battle game — different rules, different session length, different
   failure modes — and contradicts its own title. The binding constraint is a family
   playing after a Christmas meal, so a game must finish inside an evening.
2. **Models are classified by silhouette and pose, never by identity.** The profile table
   keys on what a figure visibly *is* — kneeling figure, figure with staff, figure
   carrying a load, mounted figure, herd animal, large animal, armed figure, winged figure
   — not on who it depicts. Identity-keyed rules break on the first set that lacks a piece
   or carries seventeen of another; silhouette-keyed rules absorb any set, including the
   inexplicable fisherman, without a special case.
3. **v1 ships three things only:** the conversion table, a core loop (initiative,
   alternating activation, one opposed roll, morale), and one scenario ("The Journey", as
   0001 proposed — the correct first choice, because escort across a board exercises
   movement, terrain and morale in one).
4. **Deferred to v2:** campaign rosters, faction abilities beyond the minimum, the Magi,
   Roman taxation, Herod's decree. All good, none load-bearing.
5. **No statline copied from an existing published game.** v1 defines its own short
   profile. A four-stat bespoke line is both safer and better suited to a game this small
   than an eight-stat borrowed one.

## Consequences

- The conversion table is the first artifact written and the one playtesting targets. If
  it cannot classify an arbitrary household belén, the project has no reason to exist and
  should stop.
- Every rule must survive sets that are missing figures and sets with absurd duplicates.
  "Requires a Roman soldier" is not an acceptable dependency for a core rule.
- Standing invariant: **profiles key on silhouette, never on figure identity.** Added to
  `CLAUDE.md` §4 in this commit, `review-only` — no script can judge whether a proposed
  rule smuggles in an identity dependency.
- Tone in the "Massacre"-adjacent material is undecided and deliberately not settled here;
  it is carried as an open ledger item, because it is a call for the operator, not a
  detail to be drifted into during drafting.
