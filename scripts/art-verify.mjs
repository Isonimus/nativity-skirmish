#!/usr/bin/env node
// Verifies the plate corpus against the rules, and renders it to a prompt sheet.
//
// ADR-0008 makes the art load-bearing rather than decorative: standing invariant 1 is that
// classification keys on silhouette and pose, never on figure identity, and a plate that
// shows a recognisable named figure as the exemplar of a class teaches identity matching
// with an extra step. Invariants 5 and 6 were recorded as review-only. This script is what
// makes them enforced, which is the difference between a rule and a hope.
//
// It is also the generator: the same pass that checks the corpus writes
// artifacts/plate-prompts.md, the sheet handed to an image model. One source, so a prompt
// cannot drift from the plate record it came from.
//
//   node scripts/art-verify.mjs
//
// Exit 1 on any failed check.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tableUnder, unbacktick } from './lib/rules-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLATES = join(ROOT, 'art/plates.json');
const TABLE = join(ROOT, 'rules/conversion-table.md');
const ARTIFACT = join(ROOT, 'artifacts/plate-prompts.md');
const RENDERED = join(ROOT, 'art/plates');
const DERIVED = join(ROOT, 'art/web');

const KINDS = ['class', 'attribute', 'situation'];
const ID_SHAPE = /^p\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The manual's sections, fixed by ADR-0008. Appendix A carries no plates. */
const MAX_SECTION = 6;

/**
 * Terms that may not appear anywhere in the corpus, and why.
 *
 * The named figures are the point of the whole exercise: the conversion table works on a
 * set nobody has seen because it never asks who a figure depicts, and an illustration that
 * names one undoes that in a single caption (invariant 5).
 *
 * The publisher and style terms enforce invariant 6 at the place the violation would
 * actually be committed — not in the manual's prose, where it would be obvious, but inside
 * an image prompt, where "in the style of ..." is the fastest way to a convincing look and
 * nobody would ever read it again.
 *
 * The violence terms are the ADR-0005 instinct applied to the pictures: this game removes
 * models and the art does not illustrate it.
 */
const FORBIDDEN = [
  { pattern: /\b(?:mary|joseph|jesus|christ|balthasar|melchior|c[ag]spar|herod|virgin|madonna|magi|wise men)\b/i, why: 'names a figure — plates key on attributes, never identity (invariant 5)' },
  { pattern: /\b(?:warhammer|games workshop|citadel|kill ?team|mordheim|frostgrave|d&d|dungeons)\b/i, why: 'names a published game or publisher (invariant 6)' },
  { pattern: /\bin the style of\b|\bstyle of [A-Z]/, why: 'borrows an external style reference (invariant 6)' },
  { pattern: /\b(?:attacking|stabbing|slashing|wounded|wounding|bleeding|blood|corpse|dying|dead body|slain|menacing|threatening)\b/i, why: 'depicts violence — the game removes models, the art does not show it' },
];

const failures = [];
const fail = (message) => failures.push(message);

// --- inputs -----------------------------------------------------------------

const corpus = JSON.parse(readFileSync(PLATES, 'utf8'));

for (const field of ['style', 'negative', 'plates']) {
  if (!corpus[field]) throw new Error(`art/plates.json has no "${field}" — the corpus is not usable`);
}
if (!Array.isArray(corpus.negative) || corpus.negative.length === 0) {
  throw new Error('the shared negative constraints are empty — every plate would ship unconstrained');
}

const rules = readFileSync(TABLE, 'utf8');
const classes = tableUnder(rules, '4. Profiles').map((cells) => unbacktick(cells[0]));
const attributes = tableUnder(rules, '2. Observable attributes').map((cells) => unbacktick(cells[0]));

// --- checks -----------------------------------------------------------------

const seen = new Set();

for (const plate of corpus.plates) {
  for (const field of ['id', 'section', 'kind', 'teaches', 'title', 'subject', 'composition', 'caption']) {
    if (plate[field] === undefined || plate[field] === '') fail(`plate "${plate.id ?? '?'}" has no ${field}`);
  }

  if (!ID_SHAPE.test(plate.id)) fail(`plate id "${plate.id}" is not of the form pNN-kebab-name`);
  if (seen.has(plate.id)) fail(`plate id "${plate.id}" is used twice — ids are filenames the manual references`);
  seen.add(plate.id);

  if (!KINDS.includes(plate.kind)) fail(`plate "${plate.id}" has kind "${plate.kind}", not one of [${KINDS.join(', ')}]`);
  if (!Number.isInteger(plate.section) || plate.section < 0 || plate.section > MAX_SECTION) {
    fail(`plate "${plate.id}" sits in section ${plate.section}, outside the manual's 0..${MAX_SECTION} (ADR-0008)`);
  }

  if (plate.kind === 'class' && !classes.includes(plate.teaches)) {
    fail(`plate "${plate.id}" teaches class "${plate.teaches}", which is not a class in the conversion table`);
  }
  if (plate.kind === 'attribute' && !attributes.includes(plate.teaches)) {
    fail(`plate "${plate.id}" teaches attribute "${plate.teaches}", which is not an attribute in the conversion table`);
  }
}

// Every class must be illustrated exactly once. Once, not at least once: two plates for a
// class means two different pictures of what it looks like, and a reader who has seen only
// one of them has learned a narrower rule than the table states.
for (const className of classes) {
  const found = corpus.plates.filter((p) => p.kind === 'class' && p.teaches === className);
  if (found.length === 0) fail(`class "${className}" has no plate — a profile the manual never shows`);
  if (found.length > 1) fail(`class "${className}" has ${found.length} plates (${found.map((p) => p.id).join(', ')}) — one class, one picture`);
}

// The whole corpus is scanned, including the shared style and negatives: a forbidden term
// in the style block would reach every plate at once.
const scannable = [
  ...Object.entries(corpus.style).map(([key, value]) => [`style.${key}`, String(value)]),
  ...corpus.negative.map((line, index) => [`negative[${index}]`, line]),
  ...corpus.plates.flatMap((p) => ['title', 'subject', 'composition', 'caption', 'teaches']
    .map((field) => [`${p.id}.${field}`, String(p[field] ?? '')])),
];

for (const [where, text] of scannable) {
  for (const { pattern, why } of FORBIDDEN) {
    // The negative constraints are where these words are *supposed* to appear — that is
    // what a negative constraint is. Scanning them would forbid forbidding.
    if (where.startsWith('negative[')) continue;
    const match = text.match(pattern);
    if (match) fail(`${where}: "${match[0]}" ${why}`);
  }
}

// --- rendered images --------------------------------------------------------

/**
 * A rendered plate lives at art/plates/<id>.png, so the manual can reference it by the id
 * the corpus already fixed.
 *
 * An orphan file *fails*: it is either a plate nobody declared or a typo in a filename the
 * manual will try to load, and both are defects now. A plate with no image is *reported*,
 * not failed — the images are commissioned in batches and the outstanding ones are open
 * work tracked in LEDGER.md, so failing on them would redden every unrelated commit until
 * the last picture arrives. The distinction is between a wrong thing and an unfinished
 * one.
 *
 * Neither check looks inside the file. Whether an image actually obeys its constraints is
 * not decidable here, and pretending otherwise would be the worst kind of green.
 */
const declared = new Set(corpus.plates.map((p) => p.id));
const rendered = existsSync(RENDERED)
  ? readdirSync(RENDERED).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''))
  : [];

for (const id of rendered) {
  if (!declared.has(id)) fail(`art/plates/${id}.png matches no plate in the corpus — an orphan the manual cannot place`);
}

const missing = corpus.plates.filter((p) => !rendered.includes(p.id)).map((p) => p.id);

/**
 * The site serves art/web/<id>.webp, never the master. A master with no derivative would
 * 404 on the published page, so unlike a missing master this *is* a defect now — the fix
 * is `npm run art:web`, not a render pass.
 *
 * Deliberately not checked: whether a derivative is stale against its master. Doing it
 * properly needs content hashing that survives an LFS checkout, which is more machinery
 * than a wholesale re-render workflow justifies. Said out loud rather than left implied,
 * and carried in LEDGER.md.
 */
const derived = existsSync(DERIVED)
  ? readdirSync(DERIVED).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
  : [];

for (const id of rendered) {
  if (!derived.includes(id)) fail(`art/plates/${id}.png has no derivative in art/web/ — the site would serve nothing (run \`npm run art:web\`)`);
}
for (const id of derived) {
  if (!rendered.includes(id)) fail(`art/web/${id}.webp derives from no master — a leftover the manual may still link`);
}

// --- artifact: the prompt sheet ---------------------------------------------

const styleBlock = Object.entries(corpus.style).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`).join('. ');
const negativeBlock = corpus.negative.join('; ');

const bySection = new Map();
for (const plate of corpus.plates) {
  if (!bySection.has(plate.section)) bySection.set(plate.section, []);
  bySection.get(plate.section).push(plate);
}

const lines = [
  '# Plate prompts',
  '',
  'Generated by `scripts/art-verify.mjs` from `art/plates.json` — do not edit by hand.',
  'Editing a prompt here changes nothing; edit the plate record and regenerate.',
  '',
  `${corpus.plates.length} plates, of which **${rendered.length} are rendered** and **${missing.length} outstanding**.`,
  '',
  'Paste **only the fenced block** — the heading and the caption line above it are for the',
  'manual, not for the image model, and pasting them is how a caption ends up drawn inside',
  'the picture. Save the result as `art/plates/<id>.png`; the manual finds it by that name',
  '(ADR-0008).',
  '',
  ...(missing.length > 0
    ? ['## Outstanding', '', ...missing.map((id) => `- \`${id}\``), '']
    : []),
  '## Shared style',
  '',
  '> ' + styleBlock,
  '',
  '## Shared negative constraints',
  '',
  ...corpus.negative.map((line) => `- ${line}`),
  '',
  '---',
  '',
];

for (const section of [...bySection.keys()].sort((a, b) => a - b)) {
  lines.push(`## Section ${section}`, '');
  for (const plate of bySection.get(section)) {
    lines.push(
      `### \`${plate.id}\` — ${plate.title}`,
      '',
      `*Teaches ${plate.kind === 'situation' ? '' : `the ${plate.kind} `}**${plate.teaches}**. Caption: "${plate.caption}"*`,
      '',
      '```text',
      // The no-lettering rule leads, as a positive statement of what the image *is*.
      // It was originally only a trailing negative, and seven of the first twenty-one
      // renders came back with a baked-in title, plate number or caption — a trailing
      // "do not include text" is the first instruction an image model drops.
      'An untitled illustration. No lettering, numerals, title, caption or border appears anywhere inside the image; the picture fills the whole frame.',
      '',
      `${plate.subject}. ${plate.composition}.`,
      '',
      styleBlock + '.',
      '',
      `Do not include: ${negativeBlock}.`,
      '```',
      '',
    );
  }
}

mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(ARTIFACT, `${lines.join('\n')}\n`);

// --- result -----------------------------------------------------------------

if (failures.length > 0) {
  console.error(`art-verify: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}

console.log(`art-verify: ok — ${corpus.plates.length} plates over ${bySection.size} sections, ${classes.length} classes each illustrated once`);
console.log(`  ${rendered.length} rendered, ${missing.length} outstanding${missing.length > 0 ? `: ${missing.join(', ')}` : ''}, ${derived.length} web derivatives`);
console.log(`  wrote ${ARTIFACT}`);
