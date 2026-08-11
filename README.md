# Nativity: Skirmish

A skirmish miniatures ruleset played with the figures of a Christmas nativity display — a
*belén* — written in the register of a serious wargame manual. There is nothing to buy and
nothing to paint: the set your family keeps in a box is the terrain, the models and the
objectives.

The rules never ask who a figure depicts, only what it visibly is — silhouette, pose, what
it is holding — so two households with completely different sets get the same game
(ADR-0002). Every stat in the manual is currently a placeholder; the playtests that will
replace them are open in [`LEDGER.md`](LEDGER.md).

## Layout

| Path | What it is |
|---|---|
| `rules/*.md` | The single source for every rule. Nothing is retyped anywhere else (ADR-0008). |
| `adr/`, `slices/` | Decision records and work units. Immutable once written (ADR-0001). |
| `art/plates.json` | The illustration corpus as data; `art/plates/` masters, `art/web/` derivatives (ADR-0008). |
| `site/` | The stylesheet and the four vendored WOFF2 faces (ADR-0011). |
| `scripts/` | The linter, the build, and the verification harness. |
| `build/` | The generated manual. Git-ignored — no HTML is ever committed (ADR-0011). |

## Commands

Zero dependencies; Node 22 and nothing else.

| Command | What it does |
|---|---|
| `npm run check` | Everything below that gates a commit: index, linter, immutability, all verify scripts. |
| `npm run site` | Builds the manual into `build/`. |
| `npm run negative` | Perturbs each of the site's bounds and proves it can fail (ADR-0011). |
| `npm run art:web` | Regenerates `art/web/*.webp` from the plate masters. |

The pre-commit hook runs the linter against the **commit**, not the working tree, so a fix
you forgot to stage cannot green a red commit. `.github/workflows/pages.yml` runs the same
checks in CI and publishes `build/` to GitHub Pages from `main`.

## Working on it

Conventions specific to this repo — the document taxonomy, the standing invariants and how
each is enforced — are in [`CLAUDE.md`](CLAUDE.md). General practice is in
[`docs/quality-bar.md`](docs/quality-bar.md).

Two constraints surprise people:

- **Rules Markdown is a nine-construct subset.** Headings, paragraphs, blockquotes, rules,
  lists, tables, and inline strong/emphasis/code. A link or an `###` fails the build; the
  fix is to extend the renderer and ADR-0011, not the output.
- **Section numbers are addresses.** They are appended, never inserted or renumbered,
  because rules text, image filenames and external links all hold them (ADR-0008).

## Requirements

`git lfs install` before the first commit touching `art/plates/*.png`, which are ~8 MB each
and versioned through LFS. ImageMagick for `npm run art:web`.
