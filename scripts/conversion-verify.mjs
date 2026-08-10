#!/usr/bin/env node
// Verifies the conversion table (slice 0006) — the claim that any household nativity set
// converts to playable models.
//
// The claim has two halves and only one of them is assertable, which is exactly the split
// CLAUDE.md §3 describes. Machine-checkable: the procedure is total, unambiguous, and
// agrees with a corpus of real sets. Not machine-checkable: whether the warbands that come
// out are any fun. The first half decides the exit code; the second is written to
// artifacts/ for a human to read.
//
//   node scripts/conversion-verify.mjs
//
// Exit 1 on any failed check.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = join(ROOT, 'rules/conversion-table.md');
const FIXTURES = join(ROOT, 'fixtures/belen-inventories.json');
const ARTIFACT = join(ROOT, 'artifacts/conversion-coverage.md');

// Warband legality, from rules/conversion-table.md §5. Named here rather than inlined
// because each one is a rule a reader can look up, not a tuning constant.
const WARBAND_MIN = 5;
const WARBAND_MAX = 15;
const MIN_CLASSES = 3;
const MAX_HERALDS = 1;
const HERALD = 'Herald';
const INFANT = 'The Infant';
const CATCH_ALL = '*';

// --- markdown table reading -------------------------------------------------

/** The rows of the first markdown table under a `## <heading>` — each row as trimmed
 *  cells. Alignment separators are dropped; the header row is not. */
function tableUnder(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith(`## ${heading}`));
  if (start === -1) throw new Error(`conversion table has no "## ${heading}" section`);

  const rows = [];
  for (const line of lines.slice(start + 1)) {
    const text = line.trim();
    if (text.startsWith('## ')) break;
    if (!text.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    const cells = text.slice(1, -1).split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
    rows.push(cells);
  }
  if (rows.length < 2) throw new Error(`"## ${heading}" holds no table`);
  return rows.slice(1);
}

const unbacktick = (cell) => cell.replace(/`/g, '').trim();

// --- the procedure ----------------------------------------------------------

/**
 * Whether `predicate` holds for a figure with `attributes`.
 *
 * The predicate language is deliberately the smallest one that expresses the table:
 * space-separated attribute names meaning *and*, a `!` prefix meaning *not*, and `*`
 * matching anything. Disjunction is spelled as two rows, which the ordered
 * first-match-wins reading already gives for free.
 */
function holds(predicate, attributes) {
  if (predicate === CATCH_ALL) return true;
  return predicate.split(/\s+/).every((token) =>
    token.startsWith('!') ? !attributes.includes(token.slice(1)) : attributes.includes(token),
  );
}

/** The class the procedure assigns, or null if the figure falls through — which the
 *  totality check exists to make impossible. */
function classify(procedure, attributes) {
  const row = procedure.find((step) => holds(step.predicate, attributes));
  return row ? row.className : null;
}

// --- warband drawing --------------------------------------------------------

/**
 * The largest legal warband drawable from a pool, or null if none is.
 *
 * Tries sizes downward from the cap: the per-class ceiling is a fraction of the warband
 * size, so a *smaller* warband can be legal where a larger one is not — a pool of eleven
 * shepherds and two sheep fields no 15-model warband but does field a 5-model one. Trying
 * only the largest size would report such a set as unplayable, which is precisely the
 * household set the table exists to accommodate.
 */
function drawWarband(counts) {
  const pool = [...counts.values()].reduce((a, b) => a + b, 0);
  for (let size = Math.min(WARBAND_MAX, pool); size >= WARBAND_MIN; size--) {
    const perClass = Math.floor(size / 2);
    const draw = new Map();
    let taken = 0;
    // Rarest class first: it spends the size budget on breadth, which is what the
    // three-class minimum needs. Taking the most numerous first fills the warband with
    // sheep and then fails the breadth check on a pool that could have satisfied it.
    const byScarcity = [...counts.entries()].sort((a, b) => a[1] - b[1]);
    for (const [className, available] of byScarcity) {
      const ceiling = className === HERALD ? MAX_HERALDS : perClass;
      const take = Math.min(available, ceiling, size - taken);
      if (take > 0) {
        draw.set(className, take);
        taken += take;
      }
    }
    if (taken === size && draw.size >= MIN_CLASSES) return { size, draw };
  }
  return null;
}

// --- checks -----------------------------------------------------------------

const failures = [];
const fail = (message) => failures.push(message);

const markdown = readFileSync(TABLE, 'utf8');

const attributes = tableUnder(markdown, '2. Observable attributes').map((r) => unbacktick(r[0]));
const procedure = tableUnder(markdown, '3. Decision procedure').map((r) => ({
  predicate: unbacktick(r[1]),
  className: r[2],
}));
const profiles = tableUnder(markdown, '4. Profiles').map((r) => ({
  className: r[0],
  cells: r.slice(1),
}));

// Every predicate names a declared attribute. A typo here would silently create a step
// that never matches, and the figures it was meant to catch would fall to a later row —
// a wrong class on a green build.
for (const { predicate, className } of procedure) {
  if (predicate === CATCH_ALL) continue;
  for (const token of predicate.split(/\s+/)) {
    const name = token.startsWith('!') ? token.slice(1) : token;
    if (!attributes.includes(name)) {
      fail(`step "${className}" tests \`${name}\`, which §2 does not declare`);
    }
  }
}

// Totality: the last step matches everything, so no figure in any set can fall through.
const last = procedure[procedure.length - 1];
if (last.predicate !== CATCH_ALL) {
  fail(`the last step tests \`${last.predicate}\` rather than \`${CATCH_ALL}\` — some figure could go unclassified`);
}
// ...and nothing sits after the catch-all, where it would be dead.
for (const step of procedure.slice(0, -1)) {
  if (step.predicate === CATCH_ALL) fail(`\`${CATCH_ALL}\` appears before the last step — every step after it is unreachable`);
}

// Unambiguity: two identical predicates mean the second row can never decide anything.
const seen = new Map();
for (const { predicate, className } of procedure) {
  if (seen.has(predicate)) {
    fail(`\`${predicate}\` decides both "${seen.get(predicate)}" and "${className}" — the second is unreachable`);
  }
  seen.set(predicate, className);
}

// Procedure and profiles are the same set of classes, in both directions.
const declaredClasses = new Set(procedure.map((s) => s.className));
const profiledClasses = new Set(profiles.map((p) => p.className));
for (const className of declaredClasses) {
  if (!profiledClasses.has(className)) fail(`"${className}" is produced by §3 but has no profile in §4`);
}
for (const className of profiledClasses) {
  if (!declaredClasses.has(className)) fail(`"${className}" has a profile in §4 but no step in §3 produces it`);
}
for (const { className, cells } of profiles) {
  if (cells.some((cell) => cell === '')) fail(`"${className}" has an empty profile cell`);
}

// The corpus: real sets, classified.
const fixtures = JSON.parse(readFileSync(FIXTURES, 'utf8'));
const report = [];

for (const set of fixtures.sets) {
  const counts = new Map();
  for (const figure of set.figures) {
    for (const attribute of figure.attributes) {
      if (!attributes.includes(attribute)) {
        fail(`${set.name}: "${figure.label}" carries \`${attribute}\`, which §2 does not declare`);
      }
    }
    const assigned = classify(procedure, figure.attributes);
    if (assigned === null) {
      fail(`${set.name}: "${figure.label}" falls through the procedure unclassified`);
      continue;
    }
    if (assigned !== figure.expect) {
      fail(`${set.name}: "${figure.label}" classifies as "${assigned}", expected "${figure.expect}"`);
    }
    if (assigned !== INFANT) counts.set(assigned, (counts.get(assigned) ?? 0) + 1);
  }
  report.push({ name: set.name, counts, warband: drawWarband(counts) });
}

// --- artifact ---------------------------------------------------------------

const lines = [
  '# Conversion coverage',
  '',
  'Generated by `scripts/conversion-verify.mjs` — do not edit by hand.',
  '',
  'The machine-checked half of slice 0006 is the exit code of that script. This file is the',
  'other half: what the table actually produces from real sets, for a human to judge.',
  '',
];

for (const { name, counts, warband } of report) {
  const pool = [...counts.values()].reduce((a, b) => a + b, 0);
  lines.push(`## ${name}`, '', `Pool: ${pool} model(s), excluding The Infant.`, '');
  lines.push('| Class | Models |', '| --- | --- |');
  for (const [className, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${className} | ${n} |`);
  }
  lines.push('');
  if (warband) {
    const composition = [...warband.draw.entries()].map(([c, n]) => `${n}× ${c}`).join(', ');
    lines.push(`**Legal warband:** yes — ${warband.size} models (${composition}).`, '');
  } else {
    lines.push(
      `**Legal warband:** no — this set cannot field ${WARBAND_MIN}–${WARBAND_MAX} models across`,
      `${MIN_CLASSES} classes. It plays a one-sided scenario (§5).`,
      '',
    );
  }
}

mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(ARTIFACT, `${lines.join('\n')}\n`);

// --- result -----------------------------------------------------------------

const figureCount = fixtures.sets.reduce((n, s) => n + s.figures.length, 0);

if (failures.length > 0) {
  console.error(`conversion-verify: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}

console.log(
  `conversion-verify: ok — ${procedure.length} steps, ${profiles.length} profiles, ` +
    `${figureCount} figures across ${fixtures.sets.length} sets`,
);
console.log(`  wrote ${ARTIFACT}`);
