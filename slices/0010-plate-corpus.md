---
id: '0010'
title: "The plate corpus: art as structured data, and the invariants it now enforces"
type: slice
status: proposed
date: 2026-08-11
supersedes: []
superseded_by: []
---

# The plate corpus: art as structured data, and the invariants it now enforces

## Summary

Twenty-one illustration plates for the published manual, specified as data rather than as
prose typed into a chat window, plus the script that checks them against the rules and
renders them to a prompt sheet.

## Scope

- `art/plates.json` — one record per plate, plus the shared style and negative
  constraints.
- `scripts/art-verify.mjs` — the checks, and the generator for
  `artifacts/plate-prompts.md`.

Out of scope: the images themselves, and the manual's visual identity (ADR-0008 defers the
latter to its own slice).

## Design

**Plates teach the procedure; they do not decorate it.** ADR-0008 fixed the direction:
illustrate the observable attribute or the rules situation, never a named figure as the
exemplar of a class. Every class plate therefore shows *several visibly different figurines
that resolve to the same class* — four unrelated figures carrying four unrelated loads,
captioned "all of these are Bearers". A reader who only looks at the pictures still learns
the right lesson, which is the strongest test an illustration set can pass.

**Three plates carry the ambiguous cases.** The conversion table documents three orderings
that carry judgement — mounted before armed, staff before kneeling, kneeling excluding
burden — and those are exactly where a reader will guess wrong. `p11-class-rider`,
`p13-class-drover` and `p15-class-bearer` are composed so the eye asks the question the
caption answers.

**The subject is a figurine, not a person.** The whole corpus renders painted ceramic with
visible glaze, chips and worn gilding. This is a style choice that does structural work:
it removes portraiture, sidesteps depicting religious figures as people, and matches what
is actually on the table.

**Data, not prose.** One record per plate carrying id, section, kind, what it teaches,
subject, composition and caption; the style and the negative constraints stated once. That
buys stable filenames the manual can reference before the images exist, one place for the
shared constraints instead of twenty-one drifting copies, and a checkable relation between
plates and profiles. The prompt sheet is generated — editing it changes nothing.

## Verification

`scripts/art-verify.mjs`, wired into `npm run verify` and `npm run check`.

Machine-checkable half — non-zero exit if any holds:

- **a forbidden term appears anywhere in the corpus** — a named figure (invariant 5), a
  publisher or published game, an "in the style of" reference (invariant 6), or a term
  depicting violence. Both invariants were recorded review-only by ADR-0008 and are now
  enforced;
- **a class has no plate, or more than one** — one class, one picture: two would teach two
  different pictures of the same rule;
- a plate teaches an attribute or a class that is not in the conversion table;
- a plate id is not of the form `pNN-kebab-name`, or is used twice — ids are the filenames
  the manual references;
- a plate sits outside the manual's sections 0..6 (ADR-0008), or omits any required field;
- the shared style or negative constraints are absent or empty.

The forbidden-term scan deliberately covers the shared `style` block as well as each
plate: a violation there would reach all twenty-one prompts at once. It deliberately
excludes the `negative` list, where those words are the entire point — scanning it would
forbid forbidding.

Every check was negative-tested by perturbing `art/plates.json` and confirming it fires,
per the practice recorded in `CLAUDE.md` §4. Two rounds were needed: the first
perturbation of the class-coverage checks mutated the wrong record and exercised nothing,
which is its own small lesson about trusting a red result without reading it.

Human half — `artifacts/plate-prompts.md`: twenty-one complete, self-contained prompts
grouped by manual section, each carrying the shared style and negative constraints inline.
That is the sheet handed to the image model.

**What this does not verify**: whether the plates are any good, whether the style holds
across twenty-one generations, or whether a generated image actually obeys its
constraints. The last of those is the real risk — the checks bind the *prompt*, not the
image, and a returned picture still needs a human to look at it before it ships.

That risk was immediately borne out. Of the first twenty-one renders, **seven came back
with a title, plate number or caption drawn inside the image**, one carried numerals, one
put The Infant into a plate whose whole point was empty hands, and the cover arrived as a
devotional tableau rather than the scattered mismatched set the brief asked for. Every one
of them passed every check in this repo, because every one of them had a clean prompt.

The root cause was prompt order, not prompt content: the no-lettering rule was a trailing
negative, and a trailing negative is the first instruction an image model drops. It now
*leads* each prompt as a positive statement of what the image is. The second batch of ten
came back with no baked-in text at all.

Two further checks close the loop from the other end — an image file that matches no plate
fails, and a master with no web derivative fails. A plate with no image is *reported*
rather than failed, because outstanding renders are tracked work rather than defects, and
failing on them would redden every unrelated commit until the last picture arrived.

## Definition of Done

Given the plate corpus,
When any record or the shared style names a religious figure, a publisher, a published
game or an external style reference,
Then the build fails.
Proof: `art-verify.mjs`, the FORBIDDEN scan, negative-tested with a record naming a figure,
a publisher and "in the style of" simultaneously.

Given the ten classes of the conversion table,
When any class has no plate, or more than one,
Then the build fails, so the manual cannot ship a profile it never shows.
Proof: `art-verify.mjs`, negative-tested by repointing a class plate to leave one class
orphaned and another doubled.

Given a plate record,
When its id, section, kind or taught subject would not resolve against the rules or the
manual's section index,
Then the build fails rather than emitting an unusable prompt.
Proof: `art-verify.mjs`, negative-tested with a malformed id, section 9, an undeclared
attribute and a missing caption.

Given the plate corpus,
When a record changes,
Then the prompt sheet changes with it and no hand-edited copy of a prompt exists.
Proof: `artifacts/plate-prompts.md` is written by `art-verify.mjs` on every run and states
so in its own header.
