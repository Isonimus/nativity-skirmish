#!/usr/bin/env node
// Builds the published manual from rules/*.md into build/.
//
// ADR-0008 §1: the site is generated, never hand-authored — no rules sentence is retyped
// into a template and no HTML holding rules text is committed. ADR-0011 §5 keeps the
// output out of git entirely, which turns standing invariant 4 from a thing to remember at
// review into something the repo cannot violate.
//
//   node scripts/build-site.mjs
//
// Writes build/index.html, build/style.css, build/fonts/, build/art/. Throws on anything
// it cannot render; correctness of the *look* is the verify script's artifact half.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, splitSections, inline, escapeHtml } from './lib/markdown.mjs';
import { SECTIONS, RULES_DIR, anchorOf } from './lib/manual.mjs';
import { tableUnder } from './lib/rules-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const PLATES = join(ROOT, 'art/plates.json');
const WEB_ART = join(ROOT, 'art/web');

const corpus = JSON.parse(readFileSync(PLATES, 'utf8'));
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const ledger = readFileSync(join(ROOT, 'LEDGER.md'), 'utf8');

const sourceOf = (file) => readFileSync(join(ROOT, RULES_DIR, file), 'utf8');

// --- the provisional banner, derived rather than written ---------------------

/**
 * ADR-0008 §5: the site states that its numbers are untested, from a single source
 * alongside the build rather than typed into a template where it would still claim v0.1
 * long after v0.4 shipped.
 *
 * The source is the ledger's own outstanding playtests. That inverts the usual failure:
 * the banner cannot claim the stats are tested while open playtests remain, and it removes
 * itself when the last one is closed rather than waiting for somebody to notice.
 */
const outstandingPlaytests = ledger
  .split('\n')
  .filter((line) => /^- \[feature\] Playtest/.test(line))
  .length;

const banner = outstandingPlaytests === 0
  ? ''
  : `<p class="banner"><strong>Version ${escapeHtml(packageJson.version)} — provisional.</strong> `
    + `Every stat in this manual is a placeholder. ${outstandingPlaytests} playtests are outstanding, `
    + `and the numbers are expected to move when they are run.</p>`;

// --- plates -------------------------------------------------------------------

/**
 * Plates are placed by section, not by position in the prose. Placing them inline would
 * mean the rules text carrying a marker for its own illustration, which is presentation
 * leaking into the source ADR-0008 §1 keeps clean.
 *
 * A plate whose derivative is absent is skipped and counted. `art-verify.mjs` owns the
 * question of whether that is a defect (a master with no derivative) or open work (no
 * master yet); the build's job is to produce a page, not to re-litigate it.
 */
const derivativeExists = (id) => existsSync(join(WEB_ART, `${id}.webp`));
const platesInSection = (number) => corpus.plates.filter((plate) => String(plate.section) === number);

let platesPlaced = 0;
let platesSkipped = 0;

function plateFigure(plate) {
  if (!derivativeExists(plate.id)) { platesSkipped += 1; return ''; }
  platesPlaced += 1;
  return `<figure class="plate">
<img src="art/${plate.id}.webp" alt="${escapeHtml(plate.title)}" loading="lazy">
<figcaption>${escapeHtml(plate.caption)}</figcaption>
</figure>`;
}

// --- prose sections -----------------------------------------------------------

/** The markdown a manual section claims from its source file, reassembled in file order. */
function markdownFor(section) {
  const { preamble, sections } = splitSections(sourceOf(section.file));
  const claimed = section.headings === '*'
    ? sections
    : section.headings.map((heading) => {
      const found = sections.find((candidate) => candidate.heading === heading);
      if (!found) throw new Error(`manual §${section.number} claims "${heading}", which is not a heading in ${section.file}`);
      return found;
    });

  const parts = [];
  if (section.headings === '*' || section.withPreamble) parts.push(preamble);
  for (const { heading, body } of claimed) parts.push(`## ${heading}`, body);
  return parts.filter((part) => part !== '').join('\n\n');
}

// --- §6, the play sheet --------------------------------------------------------

/**
 * The one page anyone prints (ADR-0008 §1), extracted rather than retyped. A hand-written
 * play sheet is a second copy of every number in the game with no sync path, in the one
 * place nobody would think to look for it.
 *
 * This is the third caller of `rules-table.mjs`, settling the rule-of-three exception that
 * module was extracted under (ADR-0008 §1). It reads the rows rather than re-rendering the
 * sections, because a play sheet wants the tables without the prose around them.
 */
function playSheet() {
  const conversion = sourceOf('conversion-table.md');
  const coreLoop = sourceOf('core-loop.md');

  const asTable = (caption, headers, rows) => `<table class="sheet">
<caption>${escapeHtml(caption)}</caption>
<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
<tbody>
${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>`;

  const procedure = tableUnder(conversion, '3. Decision procedure');
  const profiles = tableUnder(conversion, '4. Profiles')
    .map((cells) => cells.slice(0, 5));

  // The round sequence is a numbered list, not a table: take each step's bolded lead and
  // drop the explanation, which is what makes it a sheet rather than a reprint.
  const round = splitSections(coreLoop).sections
    .find((candidate) => candidate.heading === '1. The round');
  if (!round) throw new Error('core-loop.md has no "1. The round" section — the play sheet cannot be built');
  const steps = [...round.body.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((match) => match[1]);
  if (steps.length === 0) throw new Error('"1. The round" holds no numbered steps — the play sheet would be empty');

  return `<p>Print this page. Everything else is read once.</p>
<ol class="steps">${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
${asTable('Decision procedure — first match decides the class', ['#', 'Test', 'Class'], procedure)}
${asTable('Profiles', ['Class', 'Move', 'Skill', 'Grit', 'Resolve'], profiles)}`;
}

// --- Appendix A, the design notes ----------------------------------------------

/**
 * ADR-0008 §2: the appendix publishes the reasoning, with links into the corpus. A
 * rulebook that argues with itself in public is the most distinctive thing this project
 * has, and it costs nothing to ship because the arguments are already written.
 *
 * It links rather than reprints. Whether it should eventually carry the bodies is left
 * open in ADR-0011 and carried in LEDGER.md — that needs the appendix in front of you to
 * answer.
 */
function designNotes() {
  const dir = join(ROOT, 'adr');
  const entries = readdirSync(dir)
    .filter((name) => /^\d{4}-.*\.md$/.test(name))
    .sort()
    .map((name) => {
      const text = readFileSync(join(dir, name), 'utf8');
      const field = (key) => text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.replace(/^['"]|['"]$/g, '').trim() ?? '';
      return { name, id: field('id'), title: field('title'), date: field('date'), status: field('status') };
    });
  if (entries.length === 0) throw new Error('adr/ holds no decision records — the appendix would be empty');

  return `<p>Every rule in this manual was decided on a date, for a reason that was written
down before the rule was. Nothing here is required to play. It is here because the
arguments are the most interesting part.</p>
<ul class="decisions">
${entries.map((entry) => `<li><a href="https://github.com/${escapeHtml(repoSlug())}/blob/main/adr/${escapeHtml(entry.name)}">${escapeHtml(entry.id)}</a> — ${escapeHtml(entry.title)} <span class="dim">${escapeHtml(entry.date)}, ${escapeHtml(entry.status)}</span></li>`).join('\n')}
</ul>`;
}

/** The repository the appendix links into, from package.json rather than hardcoded. */
function repoSlug() {
  const url = packageJson.repository?.url ?? '';
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  if (!match) throw new Error('package.json has no github repository url — Appendix A cannot link into the corpus');
  return match[1];
}

// --- assembly -------------------------------------------------------------------

const GENERATORS = { 'play-sheet': playSheet, 'design-notes': designNotes };

const bodyOf = (section) => (section.generated
  ? GENERATORS[section.generated]()
  : render(markdownFor(section), { headingOffset: 1, idPrefix: `${section.number}-` }));

const sectionHtml = SECTIONS.map((section) => {
  const plates = platesInSection(section.number).map(plateFigure).join('\n');
  return `<section id="${anchorOf(section)}">
<h2><span class="numeral">${escapeHtml(section.number)}</span> ${escapeHtml(section.title)}</h2>
${bodyOf(section)}
${plates}
</section>`;
}).join('\n\n');

const nav = `<nav aria-label="Contents"><ol class="contents">
${SECTIONS.map((section) => `<li><a href="#${anchorOf(section)}"><span class="numeral">${escapeHtml(section.number)}</span> ${escapeHtml(section.title)}</a></li>`).join('\n')}
</ol></nav>`;

const cover = corpus.plates.find((plate) => plate.id === 'p01-cover');
const masthead = cover && derivativeExists(cover.id)
  ? `<img class="cover" src="art/${cover.id}.webp" alt="${escapeHtml(cover.title)}">`
  : '';

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nativity: Skirmish — ${escapeHtml(packageJson.description)}</title>
<meta name="description" content="${escapeHtml(packageJson.description)}">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="masthead">
${masthead}
<h1>Nativity: Skirmish</h1>
<p class="standfirst">${escapeHtml(packageJson.description)}</p>
${banner}
</header>
${nav}
<main>
${sectionHtml}
</main>
<footer>
<p>Generated from the rules corpus. No sentence on this page was typed twice.</p>
</footer>
</body>
</html>
`;

// --- write ----------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'fonts'), { recursive: true });
mkdirSync(join(OUT, 'art'), { recursive: true });

writeFileSync(join(OUT, 'index.html'), page);
copyFileSync(join(ROOT, 'site/style.css'), join(OUT, 'style.css'));

for (const name of readdirSync(join(ROOT, 'site/fonts'))) {
  copyFileSync(join(ROOT, 'site/fonts', name), join(OUT, 'fonts', name));
}

if (existsSync(WEB_ART)) {
  for (const name of readdirSync(WEB_ART).filter((file) => file.endsWith('.webp'))) {
    copyFileSync(join(WEB_ART, name), join(OUT, 'art', name));
  }
}

console.log(`build-site: ok — ${SECTIONS.length} sections, ${Math.round(page.length / 1024)} KB of HTML`);
console.log(`  ${platesPlaced} plates placed${platesSkipped > 0 ? `, ${platesSkipped} skipped for want of a web derivative` : ''}`);
console.log(`  banner: ${banner === '' ? 'none — no playtests outstanding' : `${outstandingPlaytests} playtests outstanding`}`);
console.log(`  wrote ${OUT}`);
