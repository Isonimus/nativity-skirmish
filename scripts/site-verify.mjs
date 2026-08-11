#!/usr/bin/env node
// Verifies the manual's Markdown subset, the index's coverage of the corpus, and the built
// site's internal consistency.
//
// The half that gates the build is here; the half that needs eyes is artifacts/site-map.md,
// which lists what the build actually assembled so a section that quietly stopped shipping
// is visible without opening a browser (CLAUDE.md §3).
//
//   node scripts/site-verify.mjs
//
// Exit 1 on any failed check.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, splitSections } from './lib/markdown.mjs';
import { SECTIONS, RULES_DIR, anchorOf } from './lib/manual.mjs';
import { tableUnder } from './lib/rules-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(ROOT, RULES_DIR);
const BUILD = join(ROOT, 'build');
const ARTIFACT = join(ROOT, 'artifacts/site-map.md');

const failures = [];
const fail = (message) => failures.push(message);

function report() {
  if (failures.length === 0) return;
  console.error(`site-verify: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}

const ruleFiles = readdirSync(RULES).filter((name) => name.endsWith('.md')).sort();
if (ruleFiles.length === 0) throw new Error(`${RULES_DIR}/ holds no markdown — the manual has no source`);

// --- 1. the Markdown subset -------------------------------------------------
//
// The renderer refuses what it cannot render (ADR-0011 §1), so running it over the corpus
// *is* the subset check. This is the load-bearing half of choosing a subset renderer over
// a dependency: without it the renderer would meet a link or a nested list one day and
// emit it as literal text while every check reported green.

for (const name of ruleFiles) {
  try {
    render(readFileSync(join(RULES, name), 'utf8'));
  } catch (error) {
    fail(`${RULES_DIR}/${name} is outside the manual's Markdown subset — ${error.message}`);
  }
}

// --- 2. the index covers the corpus -----------------------------------------
//
// ADR-0008 §2 fixed the index and `scripts/lib/manual.mjs` holds it as data. A rules
// section nobody claimed would simply never appear on the site, silently, and a claim on a
// heading that has been renamed would drop the section it used to name.
//
// This bites only on files split across manual sections — `conversion-table.md` today. A
// file claimed whole (`headings: '*'`) absorbs new headings by construction, which is the
// intended behaviour and not a hole: the manual section *is* the file. Said out loud
// because a coverage check that cannot fail on most of its inputs is worth understanding
// before it is trusted.

const claimsByFile = new Map();
for (const section of SECTIONS.filter((candidate) => candidate.file)) {
  if (!claimsByFile.has(section.file)) claimsByFile.set(section.file, []);
  claimsByFile.get(section.file).push(section);
}

for (const name of ruleFiles) {
  const claimants = claimsByFile.get(name);
  if (!claimants) { fail(`${RULES_DIR}/${name} is claimed by no manual section — it would never appear on the site`); continue; }

  const headings = splitSections(readFileSync(join(RULES, name), 'utf8')).sections.map((s) => s.heading);
  const claimed = claimants.flatMap((section) => (section.headings === '*' ? headings : section.headings));

  for (const heading of claimed) {
    if (!headings.includes(heading)) fail(`manual §${claimants.find((s) => s.headings !== '*' && s.headings.includes(heading))?.number} claims "${heading}", which is not a heading in ${name}`);
    if (claimed.filter((other) => other === heading).length > 1) fail(`"${heading}" in ${name} is claimed by more than one manual section — it would ship twice`);
  }
  for (const heading of headings) {
    if (!claimed.includes(heading)) fail(`"${heading}" in ${name} is claimed by no manual section — it would never appear on the site`);
  }
}

for (const file of claimsByFile.keys()) {
  if (!ruleFiles.includes(file)) fail(`the index names ${RULES_DIR}/${file}, which does not exist`);
}

// --- 3. no committed HTML ---------------------------------------------------
//
// ADR-0011 §5 keeps the generated site out of git, which is what makes standing invariant 4
// — no rules sentence duplicated into presentation — structurally true rather than a thing
// to remember at review. A tracked .html file is that guarantee gone.

const tracked = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (tracked !== '') fail(`HTML is committed (${tracked.split('\n').join(', ')}) — the site is generated and must not be in git (ADR-0011 §5)`);

// --- 4. build, then check what was built ------------------------------------

// Report before building. The build renders the same corpus and throws on the same input,
// so a subset failure here would otherwise surface as an uncaught stack trace from a child
// process and the diagnosis collected above would never be printed.
if (failures.length > 0) report();

execFileSync('node', [join(ROOT, 'scripts/build-site.mjs')], { cwd: ROOT, stdio: 'pipe' });

const html = readFileSync(join(BUILD, 'index.html'), 'utf8');

const decode = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/**
 * The page's text, chunked at tag boundaries and flagged for whether it sits inside a
 * `<code>` span.
 *
 * Chunking rather than stripping all tags matters twice. A leaked construct is only a leak
 * at the *start* of an element's text — the decision-procedure table has a legitimate
 * `<th>#</th>`, which a line-anchored scan over stripped text reads as a heading marker.
 * And a bare asterisk is normal inside a code span (the table's `*` wildcard) and a leaked
 * emphasis marker anywhere else.
 */
const chunks = [];
let insideCode = false;
for (const part of html.split(/(<[^>]+>)/)) {
  if (part.startsWith('<') && part.endsWith('>')) {
    if (/^<code[\s>]/.test(part)) insideCode = true;
    else if (part === '</code>') insideCode = false;
    continue;
  }
  if (part.trim() !== '') chunks.push({ text: decode(part), insideCode });
}

/**
 * Markdown that survived into the output — the failure the subset exists to prevent, seen
 * from the far end. Checked on the built page as well as on the source, because the build
 * assembles HTML of its own (the play sheet, the appendix) that the renderer never sees.
 */
const LEAKED = [
  { pattern: /\]\(/, what: 'a link', inCode: true },
  { pattern: /`/, what: 'a backtick', inCode: true },
  { pattern: /\*/, what: 'an emphasis marker', inCode: false },
  { pattern: /^\s*\|/, what: 'a table row', inCode: false },
  { pattern: /^\s*#{1,6}\s/, what: 'a heading marker', inCode: false },
];

for (const { text, insideCode: inCode } of chunks) {
  for (const rule of LEAKED) {
    if (inCode && !rule.inCode) continue;
    if (rule.pattern.test(text)) fail(`the built page shows ${rule.what} as literal text: "${text.trim().slice(0, 80)}"`);
  }
}

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) {
  if (!ids.has(target)) fail(`the page links to #${target}, which is not an id on it`);
}

for (const section of SECTIONS) {
  if (!ids.has(anchorOf(section))) fail(`manual §${section.number} has no anchor #${anchorOf(section)} — the index would link nowhere (ADR-0008 §2)`);
}

for (const [, asset] of html.matchAll(/(?:src|href)="(?!#|https?:)([^"]+)"/g)) {
  if (!existsSync(join(BUILD, asset))) fail(`the page references ${asset}, which the build did not write`);
}

const css = readFileSync(join(BUILD, 'style.css'), 'utf8');
for (const [, asset] of css.matchAll(/url\("([^"]+)"\)/g)) {
  if (!existsSync(join(BUILD, asset))) fail(`style.css references ${asset}, which the build did not write`);
}

/**
 * The play sheet is extracted, not retyped (ADR-0008 §1), and an extraction that silently
 * returns fewer rows than the rules hold is the failure mode that matters: a printed sheet
 * missing a profile is worse than no sheet, because the reader trusts it.
 *
 * Scoped to the profiles table specifically, not to the whole of §6. Written against the
 * section it passed while the profiles table held three of ten rows, because the decision
 * procedure alongside it also names every class — a check that reads the whole section
 * cannot fail, which is worse than not having it.
 */
const conversion = readFileSync(join(RULES, 'conversion-table.md'), 'utf8');
const profilesTable = (() => {
  const start = html.indexOf('<caption>Profiles</caption>');
  if (start === -1) throw new Error('the built play sheet holds no profiles table');
  return html.slice(start, html.indexOf('</table>', start));
})();

for (const cells of tableUnder(conversion, '4. Profiles')) {
  const className = cells[0].replace(/`/g, '').trim();
  if (!profilesTable.includes(`<td>${className}</td>`)) fail(`the play sheet's profile table does not list "${className}" — an extraction that lost a row`);
}

// --- artifact: the site map --------------------------------------------------

const wordsIn = (text) => text.trim().split(/\s+/).filter(Boolean).length;

const rows = SECTIONS.map((section) => {
  const start = html.indexOf(`id="${anchorOf(section)}"`);
  const end = html.indexOf('<section id=', start + 1);
  const body = html.slice(start, end === -1 ? undefined : end);
  return {
    number: section.number,
    title: section.title,
    anchor: anchorOf(section),
    source: section.generated ? `generated (${section.generated})` : `${RULES_DIR}/${section.file}`,
    words: wordsIn(body.replace(/<[^>]+>/g, ' ')),
    plates: [...body.matchAll(/<figure class="plate">/g)].length,
  };
});

const lines = [
  '# Site map',
  '',
  'Generated by `scripts/site-verify.mjs` — do not edit by hand.',
  '',
  'What the build actually assembled. A section that quietly stopped shipping shows up here',
  'as a word count that fell off a cliff, which is the half of this check that needs eyes.',
  '',
  '| § | Title | Anchor | Source | Words | Plates |',
  '|---|---|---|---|---|---|',
  ...rows.map((row) => `| ${row.number} | ${row.title} | \`#${row.anchor}\` | ${row.source} | ${row.words} | ${row.plates} |`),
  '',
  `Total: ${rows.reduce((sum, row) => sum + row.words, 0)} words, ${rows.reduce((sum, row) => sum + row.plates, 0)} plates.`,
  '',
];

mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(ARTIFACT, `${lines.join('\n')}\n`);

// --- result -----------------------------------------------------------------

report();

console.log(`site-verify: ok — ${ruleFiles.length} rules files inside the subset, ${SECTIONS.length} sections all anchored`);
console.log(`  ${rows.reduce((sum, row) => sum + row.words, 0)} words, ${rows.reduce((sum, row) => sum + row.plates, 0)} plates, ${ids.size} anchors`);
console.log(`  wrote ${ARTIFACT}`);
