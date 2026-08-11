---
id: '0008'
title: "The published manual: generated from the rules, illustrated by attribute, styled at arm's length"
type: architecture
status: accepted
date: 2026-08-10
supersedes: []
superseded_by: []
---

# The published manual: generated from the rules, illustrated by attribute, styled at arm's length

## Context

The rules exist as `rules/*.md` and are meant to be read by people at a table, not by a
linter. The intended shipping form is a GitHub Pages site in the register of a printed
wargame manual — two columns, boxed examples, plates.

Three things about that intent need deciding before any of it is built, because all three
are expensive to reverse and cheap to fix now.

**The index calcifies first.** Section numbers and URL anchors are referenced by rules
text (`see §3`), by image filenames, by the ledger, and by anyone who links to the site.
Renumbering later breaks all of them at once. The index is therefore a content decision
that must land before the last rules section is written, not a presentation decision that
can follow it.

**The art can contradict the rules.** Standing invariant 1 (ADR-0002) is that profiles key
on silhouette and pose, never on figure identity — this is the whole reason the conversion
table works on a set the authors have never seen. An illustration of a recognisable Joseph
beside the Bearer profile teaches the reader to match figures to *pictures*, which is
identity matching with an extra step. The art direction is not decoration; it is either
load-bearing for the central invariant or actively corrosive to it.

**"Wargame manual style" has a legal edge.** The visual grammar — heavy display headers,
red section rules, two columns, sidebars, plates with captions — is generic and predates
any one publisher. Specific trade dress is not: fonts, logos, the skull-and-laurel border
family, and the publisher's own product names. Games Workshop enforces this on fan work,
and the cost of finding out where the line is falls entirely on us. ADR-0002 already
forbids copying a statline from a published game; the visual equivalent is the same
decision applied to a different surface, and it has not been recorded.

A fourth thing is true and must be visible rather than decided: **every stat in the manual
is a placeholder**, pending the physical playtests carried in `LEDGER.md`. A published
site reads as finished. Nothing in the current corpus would tell a reader otherwise.

## Decision

### 1. The site is generated, never hand-authored

`rules/*.md` is the single source. The site build reads it and emits HTML; no rules
sentence is ever retyped into a template, and no HTML file containing rules text is
committed by hand.

This includes the **play sheet** (§6): the one page anyone prints, holding the profile
table, the decision procedure and the round sequence. It is extracted from
`rules/conversion-table.md` and `rules/core-loop.md` by script. A retyped play sheet is a
second copy of every number in the game, with no sync path — the failure ADR-0005 exists
to prevent, in a place nobody would think to look for it.

It is also the **third consumer** of `scripts/lib/rules-table.mjs`, which was extracted at
the second caller against the rule of three. The third caller settles that.

### 2. The index is fixed here

Sections are numbered and their numbers are stable. Anchors are the slug of the numbered
title (`#4-the-core-loop`), so an anchor cannot drift from its section without the section
title changing.

| § | Title | Source |
|---|---|---|
| 0 | What this is | `rules/introduction.md` |
| 1 | Establishing the scale | `rules/conversion-table.md` §1 |
| 2 | The Conversion Table | `rules/conversion-table.md` §2–4 |
| 3 | Building a Warband | `rules/conversion-table.md` §5 |
| 4 | The Core Loop | `rules/core-loop.md` |
| 5 | Scenario 01 — The Journey | `rules/scenario-01-the-journey.md` |
| 6 | The Play Sheet | generated |
| A | Design notes | generated from `adr/` |

New sections are **appended**, never inserted. A section that becomes wrong is superseded
in place under its existing number, exactly as an ADR is. Renumbering is forbidden for the
same reason renumbering ADRs is forbidden: the number is an address other documents hold.

Appendix A publishes the reasoning — why the Star, why nothing dies to a single roll, why
the table is ordered as it is — with links into the ADR corpus. A rulebook that argues
with itself in public is the most distinctive thing this project has, and it costs nothing
to ship because the arguments are already written.

### 3. Art direction: illustrate the attribute, never the character

Every plate depicts an **observable attribute or a rules situation**, and its caption
names the attribute. Where a plate shows a class, it shows *several visibly different
figures that resolve to the same class* — three unrelated silhouettes that all carry a
load, captioned "all of these are Bearers."

Forbidden in any plate:

- a recognisable, named holy figure presented as the exemplar of a class;
- faces rendered with enough specificity to read as a portrait of a particular person;
- any figure depicted as a target of violence — the game removes models, the art does not
  illustrate it (this is the same instinct that produced ADR-0005 and it applies to the
  pictures as much as to the rules);
- infant figures in any depiction other than static and unattended.

Plates are specified as **structured data**, not as prose prompts typed into a chat
window: one record per plate carrying its id, section, subject, the attributes it must
show, its composition, and its negative constraints. The generator emits the prompt sheet.
This buys stable filenames the manual can reference before the images exist, one place for
the shared constraints instead of twenty drifting copies, and a checkable relation between
plates and profiles.

### 4. Trade dress: the grammar is shared, the dress is not

Permitted: multi-column layout, heavy display headers, coloured section rules, boxed
examples and sidebars, full-bleed plates, small-caps stat blocks, a serif body face. This
is the shared grammar of printed rulebooks and belongs to nobody.

Forbidden: any font, logo, icon, border motif, colourway or page furniture identifiable as
a specific publisher's; the name of any published game or its trademarks anywhere in the
manual, its metadata, its filenames or its image prompts; any request to an image model
naming a publisher, artist or product as a style reference.

Where a comparison is genuinely needed in prose, the manual names the *mechanism*
("alternating activation", "opposed roll"), never the product. Mechanisms are not
protectable and naming them is honest; naming the product is borrowing recognition we have
not earned and cannot defend.

### 5. Provisional status is generated, not written

The site carries a version banner stating that the stats are untested, derived from a
single source alongside the build — not typed into a template header where it will still
claim v0.1 long after v0.4 shipped, and not silently dropped once the numbers are
measured.

## Consequences

- The manual cannot go stale against the rules, because it has no independent copy of
  them. The cost is that presentation changes are code changes.
- Section numbers become part of the corpus's addressing scheme, with the same
  append-only discipline as ADR ids. This is a real constraint on future editing and is
  the point.
- The art direction makes the plates *teach the conversion procedure* rather than
  decorate it. A reader who only looks at the pictures still learns the right lesson,
  which is the strongest test an illustration set can pass.
- The trade-dress boundary rules out the fastest path to a convincing look — "in the style
  of &lt;publisher&gt;" as an image prompt — and requires the visual identity to be
  specified in its own terms. This is slower and produces something we can actually
  publish.
- Two standing invariants follow and are added to `CLAUDE.md` in this commit: no rules
  text is duplicated into presentation, and no plate keys on figure identity.
- Not decided here: the actual palette, typeface choices and page furniture. Those are a
  slice, written against a complete book, deliberately after Scenario 01 rather than
  before it — a template shaped around two thirds of the manual is a template that will be
  rebuilt when the third arrives.
