---
id: '0011'
title: "The manual's visual identity: glazed terracotta, a subset renderer, and nothing generated in git"
type: architecture
status: accepted
date: 2026-08-11
supersedes: []
superseded_by: []
---

# The manual's visual identity: glazed terracotta, a subset renderer, and nothing generated in git

## Context

ADR-0008 fixed the manual's index, its art direction and its trade-dress boundary, and
deliberately deferred "the actual palette, typeface choices and page furniture" to a slice
written **against a complete book**, on the grounds that a template shaped around two
thirds of the manual is a template that will be rebuilt when the third arrives. Sections 1
to 5 now exist. The book is complete enough for the deferral to expire.

Three questions have to be answered before any CSS is written, and only one of them is
about looks.

**How Markdown becomes HTML.** The stack recorded in `CLAUDE.md` is zero-dependency ESM.
A Pages site needs a build step regardless, and the obvious move is to add a Markdown
library — it is a solved problem, and writing another one is exactly the speculative work
the quality bar forbids. But the manual does not need Markdown. It needs *this* Markdown:
the constructs three rules files actually use, which is a closed list of nine.

**What the identity is, stated positively.** ADR-0008 §4 rules out the fastest route to a
convincing look and requires the identity to be specified in its own terms. "Not theirs"
is not a specification; something has to be chosen and written down, or the first
stylesheet becomes the decision by default and nobody will know what it was trying to do.

**Where the generated site lives.** `docs/` already means something in this repo's
taxonomy — live documents, read by the linter — so it cannot double as the Pages output
directory. And the repo has no CI at all: the pre-commit hook's own comment names
`.github/workflows/docs.yml` as its backstop, and that file has never existed. Every
verify script's error-check half has been running in exactly one place, on one machine.

## Decision

### 1. A subset renderer, and the subset is checked

`scripts/lib/markdown.mjs` renders the constructs the rules corpus uses, and no others:

| Block | Inline |
|---|---|
| `# h1`, `## h2` | `**strong**` |
| paragraph | `*em*` |
| `> blockquote` | `` `code` `` |
| `---` horizontal rule | |
| `- ` unordered list, with continuation lines | |
| `1. ` ordered list, with continuation lines | |
| `\| pipe table \|` with a header row | |

Nine constructs. That is small enough to write correctly, and — this is the load-bearing
half — `scripts/site-verify.mjs` **fails the build on any construct outside the list**.
Without that check the renderer is a liability: it would meet a nested list or a link one
day, silently emit it as a paragraph of literal asterisks, and the manual would ship
wrong. With it, the renderer can never encounter input it does not handle, because such
input cannot be committed.

This is the answer to "why not add a dependency". It is not that the dependency is bad; it
is that the constraint is what keeps the renderer at a size where writing it is cheaper
than auditing someone else's. If the subset ever needs to grow past what one screen of
code can hold, that is the signal to take the dependency, and it gets its own ADR.

**The subset check lives in `site-verify.mjs`, not in `lint-docs.mjs`.** The linter is
vendored from the method and is updated in place; a repo-specific rule added there would
be a merge conflict every update. It also would not run: `rules/` is outside the linter's
`READ_SCOPE`, and the pre-commit hook extracts only that scope from the staged tree, so
the rule would pass in a working-tree run and be dead in the hook — the precise defect
`READ_SCOPE` was introduced to stop happening twice.

### 2. Palette: glazed terracotta, gilding, candlelight

The subject supplies the palette, so it is taken from the objects rather than invented.
These are the tokens; they are named for what they are, not for where they are used, and
the stylesheet holds no other colour.

| Token | Light | Dark | What it is |
|---|---|---|---|
| `--ground` | `#f4ece0` | `#191410` | unglazed bisque; cork; the page |
| `--ink` | `#2b2119` | `#ede4d6` | brush-black on terracotta — never `#000` |
| `--dim` | `#6b5d4f` | `#a2937f` | secondary text, captions |
| `--terracotta` | `#a8442a` | `#c9573a` | fired clay; the section rules |
| `--gild` | `#8a6520` | `#c99a3c` | worn gold leaf; statline keys, numerals |
| `--glaze` | `#1e3a5c` | `#7fa8d4` | the deep blue of a glazed robe; links |
| `--edge` | `#ddd0bd` | `#33291f` | hairlines, table rules |

Dark is not an inversion, it is the candlelit version of the same objects: the ground goes
to fired umber rather than to black, and the gild brightens because that is what gold does
in low light. The dark palette is the *default* under `prefers-color-scheme: dark` and is
defined by redefining tokens only — no colour has its sole definition inside a media
query, so a browser that reports nothing still gets a complete page.

### 3. Typefaces: one superfamily, vendored, no external request

Body, headings and stat blocks are all **Alegreya** (SIL OFL 1.1), with **Alegreya SC** for
the small-caps stat blocks ADR-0008 §4 permits. One superfamily rather than a display/text
pairing, for two reasons: it is four files instead of six or eight, and a rulebook whose
headings and body disagree about their century looks like a template rather than a book.
Alegreya is a text face designed for long-form literature, which is what a rules section
is, and it is warm and slightly calligraphic in a way that suits painted figurines and
would suit a science-fiction wargame very badly.

The four latin-subset WOFF2 files are **vendored into `site/fonts/`** — 126 KB in total,
with `OFL.txt` alongside them as the licence requires. Not linked from a font CDN: a
static rulebook that phones a third party on every page load is a tracking beacon we did
not need and cannot switch off for our readers, and the site would break offline and in
print. Committing binaries is a real cost and this is the whole of it.

Code spans use the system monospace stack. There is no vendored mono face because `` `2H` ``
and `` `burden` `` are the only things set in it.

### 4. Page furniture: one column on screen, two only in print

ADR-0008 permits multi-column layout as shared grammar. The manual does not use it on
screen. Two columns exist in printed rulebooks because a page is a fixed rectangle and a
long measure is unreadable; a scrolling browser window is neither, and two columns there
force the reader to scroll up to continue a sentence. The permitted grammar is not an
obligation, and the reason for the convention does not hold on the surface we ship to.

What is used, and what each is for:

- **A single measure of about 34em**, so a line is a line and not a paragraph.
- **The section number as a large gilded numeral**, set beside its heading. Section
  numbers are addresses (ADR-0008 §2) and the design should say so.
- **A terracotta rule beneath every `##`**, which is the one piece of manual furniture
  that is genuinely generic and genuinely useful.
- **Tables with a small-caps gilded header row** and hairline `--edge` rules — no fill, no
  zebra striping. A statline is dense enough without decoration.
- **Epigraphs** (`>` at the top of each section) in italic with a terracotta left rule.
- **Plates full-measure**, caption in small caps `--dim` beneath. The `art/web/*.webp`
  derivative is what is served, never the master (ADR-0008).
- **Print stylesheet**: two columns, and only for the play sheet (§6), which is the one
  page that is a fixed rectangle and therefore the one place the convention applies.

### 5. Nothing generated is committed; the site is built in CI

`scripts/build-site.mjs` writes to `build/`, which is git-ignored. No HTML is committed,
so no committed file can hold a second copy of a rule — standing invariant 4 becomes
structurally true rather than a thing to remember at review.

A single workflow, `.github/workflows/pages.yml`, runs `npm run check` and then builds and
deploys. That closes the gap named above: the verify scripts' error-check half has never
run anywhere but this machine, which `CLAUDE.md` §3 requires and which nothing enforced.

## Consequences

- The renderer and the subset check are a matched pair. Either alone is worse than the
  dependency: the renderer without the check ships wrong HTML silently, and the check
  without the renderer forbids constructs for no reason. A future edit that deletes one
  must delete both, and this sentence is here so that reads as obviously wrong.
- Writing a rules section now means writing within nine constructs. A section that wants a
  link, a nested list or an `###` fails the build, and the fix is a deliberate choice to
  extend both the renderer and the subset, not a quiet workaround.
- The palette and the typeface are now the answer to "what does this look like", and
  a future disagreement with them is a superseding ADR rather than a stylesheet edit.
  This is heavier than styling usually is, on purpose: the trade-dress boundary is only
  defensible if the identity is a recorded decision rather than an accumulation.
- 126 KB of font binary enters git history permanently. Judged worth it against a
  third-party request on every page load.
- The play sheet (ADR-0008 §1) makes `scripts/lib/rules-table.mjs` a three-caller module,
  settling the rule-of-three exception that extraction was made under.
- A standing invariant follows and is added to `CLAUDE.md` in this commit: rules Markdown
  stays inside the renderer's subset.
- Not decided here: whether Appendix A publishes ADR bodies verbatim or summaries. That
  needs the appendix built to answer and is carried in `LEDGER.md`.
