---
id: '0012'
title: "The published manual: a nine-construct renderer, a fixed index made executable, and a play sheet nobody typed"
type: slice
status: proposed
date: 2026-08-11
supersedes: []
superseded_by: []
---

# The published manual: a nine-construct renderer, a fixed index made executable, and a play sheet nobody typed

## Summary

The GitHub Pages manual, built from `rules/*.md` by a Markdown renderer small enough to be
written and constrained enough to stay that way, with the index of ADR-0008 §2 turned from
a table in a decision record into data the build and the checks both read.

## Scope

- `scripts/lib/markdown.mjs` — the subset renderer, and the document splitter.
- `scripts/lib/manual.mjs` — ADR-0008 §2's index as data.
- `scripts/build-site.mjs` — the generator; writes `build/`, which is git-ignored.
- `scripts/site-verify.mjs` — the checks and the site map.
- `scripts/site-negative.mjs` — the proof that each of those checks can fail.
- `site/style.css`, `site/fonts/` — the visual identity of ADR-0011, and four vendored
  WOFF2 files.
- `rules/introduction.md` — §0, which the index promised and the corpus lacked.
- `.github/workflows/pages.yml` — the first CI this repo has had.

Out of scope: publishing the ADR bodies in Appendix A, which needs constructs the subset
does not have and is carried in `LEDGER.md`.

## Design

**The renderer and its constraint are one decision, not two.** ADR-0011 chose nine
constructs over a Markdown dependency, and that trade only holds because
`site-verify.mjs` runs the renderer over the whole corpus and the renderer *throws* rather
than degrades. A lenient renderer would emit `[the core loop](#4)` as literal text and the
manual would ship wrong while every check reported green. The constraint is what keeps the
renderer at a size where writing it beats auditing someone else's.

**The index stops being prose.** ADR-0008 fixed the section numbers and called them
addresses, but a table inside a decision record cannot stop a rules section from silently
never appearing on the site. `scripts/lib/manual.mjs` holds the same table as data, and the
verify script checks the claims are exhaustive and disjoint against the corpus: a new `##`
that nobody added to the index fails the build.

**The play sheet is extracted, and that is the third caller.** `rules-table.mjs` was
extracted at the second caller against the rule of three, on the argument that two
hand-rolled parsers of the same file would disagree silently. §6 settles it. A retyped play
sheet would be a second copy of every number in the game, on the one page people actually
print and therefore actually trust.

**The banner reads the ledger.** ADR-0008 §5 asked for provisional status generated from a
single source rather than typed into a template. The source chosen is the count of open
playtest items in `LEDGER.md`, which inverts the usual failure: the manual cannot claim its
stats are tested while playtests remain open, and the banner removes itself when the last
one closes instead of waiting to be noticed.

**Nothing generated is committed.** `build/` is git-ignored, so standing invariant 4 —
no rules sentence duplicated into presentation — becomes structurally true rather than a
thing to remember at review, and `site-verify.mjs` fails on any tracked `.html`.

## Verification

`scripts/site-verify.mjs`, wired into `npm run verify` and `npm run check`.

Machine-checkable half — non-zero exit if any holds:

- a rules file uses Markdown outside the nine-construct subset;
- a `##` in the corpus is claimed by no manual section, by more than one, or the index
  claims a heading that has been renamed away;
- any `.html` is tracked by git;
- the built page shows Markdown as literal text — an emphasis marker, a backtick, a link, a
  table row or a heading marker outside a code span;
- an internal link points at an id the page does not carry, or a manual section has no
  anchor;
- the page or the stylesheet references an asset the build did not write;
- the play sheet's profile table is missing a class the rules define.

Every one was negative-tested by perturbing its input and confirming it fires, per
`CLAUDE.md` §4 — and the perturbations are committed as `scripts/site-negative.mjs`, wired
as `npm run negative`, rather than done once in a scratch file. Three vacuous bounds have
now shipped in this repo; a proof that cannot be re-run is how the next one gets in.

That pass found three defects in the checks themselves, which is the whole argument for
doing it:

- the subset failure was collected and then buried, because the build ran afterwards and
  threw the same error as an uncaught stack trace from a child process. The script now
  reports before it builds.
- the play-sheet check read the whole of §6 rather than its profiles table. The decision
  procedure alongside it also names every class, so the check passed with the profile table
  cut to three of ten rows — **a third vacuous bound in this repo's harness**, and the
  first one caught deliberately rather than by accident.
- the index-coverage check does not bite on a file claimed whole (`headings: '*'`), which
  is correct — the manual section *is* the file — but was worth discovering by testing
  rather than by assuming.

Human half — `artifacts/site-map.md`: what the build assembled, section by section, with
anchors, sources, word counts and plate counts. A section that quietly stopped shipping
shows up as a word count that fell off a cliff.

**What this does not verify**: how any of it looks. There is no screenshot artifact and no
browser in the loop — the checks read the HTML, never the rendering, so a stylesheet that
sets the body text to the background colour would pass every one of them. That gap is real
and is carried in `LEDGER.md` rather than implied by silence.

## Definition of Done

Given a rules file,
When it uses a Markdown construct outside the manual's nine,
Then the build fails naming the file and the line, rather than emitting the construct as
literal text.
Proof: `site-verify.mjs`; `site-negative.mjs` case 1 adds a link to `rules/introduction.md`.

Given the manual's index and the rules corpus,
When a `##` section exists that no manual section claims, or the index claims a heading
that no longer exists,
Then the build fails, so a rules section cannot silently stop appearing on the site.
Proof: `site-verify.mjs`; `site-negative.mjs` cases 2 and 3 append an unclaimed section to
`rules/conversion-table.md` and rename a claimed heading.

Given the built page,
When an internal link, an image or a stylesheet asset resolves to nothing,
Then the build fails rather than publishing a dead link or a missing plate.
Proof: `site-verify.mjs`; `site-negative.mjs` cases 5 and 6 typo a contents anchor and
rename a vendored font file.

Given the play sheet,
When extraction returns fewer profiles than the rules define,
Then the build fails, because a printed sheet missing a profile is worse than no sheet.
Proof: `site-verify.mjs`; `site-negative.mjs` case 7 truncates the extracted profile rows
to three.

Given the repository,
When any HTML file is tracked by git,
Then the build fails, so the generated manual cannot become a second copy of the rules.
Proof: `site-verify.mjs`, negative-tested by hand with an intent-to-add `leaked.html`. Not
in `site-negative.mjs`: staging a file mutates the operator's index, and a negative suite
that can leave the working tree changed is not one anybody will run.
