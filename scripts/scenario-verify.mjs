#!/usr/bin/env node
// Verifies the rules corpus, and Scenario 01's scoring in particular.
//
// A scenario is prose, so most of what makes it good is unverifiable — whether the Star's
// road produces real decisions, whether six rounds is right, whether anyone enjoys it.
// Those are playtest questions and are carried in LEDGER.md.
//
// What *is* machine-checkable is that the corpus keeps the promises the ADRs made about
// it, and that the scoring arithmetic says what the prose claims. Three of these checks
// enforce standing invariants that were previously review-only or deferred:
//
//   - no absolute distance unit appears anywhere in rules text (ADR-0003, invariant 2);
//   - no rule ends a scenario on a single event (ADR-0005, invariant 3);
//   - no rules text refers to a table or a section that does not exist.
//
//   node scripts/scenario-verify.mjs
//
// Exit 1 on any failed check.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tableUnder, unbacktick } from './lib/rules-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES_DIR = join(ROOT, 'rules');
const SCENARIO = join(RULES_DIR, 'scenario-01-the-journey.md');
const ARTIFACT = join(ROOT, 'artifacts/scenario-01-scoring.md');

/**
 * No single objective may be worth more than this share of a round's maximum. Above it,
 * one objective *is* the game and the rest is decoration — which is the failure ADR-0004
 * describes as a foot-race. This bound is what capped delivered Gifts at two: three would
 * have made the delivery race worth more per round than the illuminated feature and The
 * Infant combined, and the positional game ADR-0007 is built on would have been a
 * sideshow.
 */
const MAX_SOURCE_SHARE = 0.5;

/**
 * Held points — earned once and never contestable again — may not out-earn the contested
 * ones per round. Past parity the optimal line is to bank the permanent income and stop
 * playing the board, which is the same foot-race failure by another route.
 *
 * This replaced a comeback bound ("a player may score nothing for the first third of the
 * game and still win") that was dead on arrival: with a symmetric per-round maximum it
 * reduces to floor(rounds/3) >= rounds/2, which is false for every game length. That is
 * the second vacuous bound written into this repo's harness — the first was MAX_DECISIVE
 * in core-loop-verify.mjs — so the rule now is that a bound is negative-tested before it
 * is believed, not after someone wonders.
 */
const MAX_HELD_SHARE = 0.5;

const failures = [];
const fail = (message) => failures.push(message);

const rulesFiles = readdirSync(RULES_DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({ name, text: readFileSync(join(RULES_DIR, name), 'utf8') }));

if (rulesFiles.length === 0) throw new Error(`no rules files under ${RULES_DIR}`);

// --- corpus checks ----------------------------------------------------------

/**
 * Absolute distance units. ADR-0003 makes `H` the only unit of distance in the game, so
 * any of these in rules text is a measurement a reader cannot take.
 *
 * Only the abbreviations are matched next to a number, because bare `m`, `in` and `ft`
 * are ordinary English. The spelled-out units are matched anywhere, minus `foot`/`feet`:
 * this check first fired on the phrase "foot-race", and a rule that cries wolf on the
 * prose gets deleted rather than obeyed.
 *
 * `in` has since gone the same way. Next to a number it is not enough of a signal either:
 * the phrase that caught it was "it will still mean §3 in ten years". The residual hole is
 * a rule written as "2 in" — accepted knowingly, because the manual's register spells
 * units out and `inch`/`inches` are still matched anywhere, as is the `2"` mark.
 */
const ABSOLUTE_UNIT = /\b\d+(?:½)?\s*(?:cm|mm|m|ft)\b|\b\d+(?:½)?\s*"|\b(?:centimetres?|centimeters?|millimetres?|millimeters?|inch|inches)\b/gi;

/** Sudden loss. Standing invariant 3: importance is per-round scoring pressure, never a
 *  scenario-ending event. These are the phrasings that would express one. */
const SUDDEN_LOSS = /\b(?:immediately (?:loses|wins|ends)|loses? the game|wins? the game immediately|game ends immediately|is eliminated|are eliminated|instant (?:loss|win|defeat|victory))\b/gi;

for (const { name, text } of rulesFiles) {
  for (const match of text.matchAll(ABSOLUTE_UNIT)) {
    fail(`${name}: "${match[0].trim()}" is an absolute distance — every distance is a multiple of H (ADR-0003)`);
  }
  for (const match of text.matchAll(SUDDEN_LOSS)) {
    fail(`${name}: "${match[0].trim()}" ends the game on an event — importance is scored, never sudden (ADR-0005)`);
  }
}

/** Every `## N. Title` heading in the corpus, as "<file> §N" and as its lowercased title,
 *  so both kinds of reference below can be resolved against one index. */
const headings = new Map();
const headingTitles = new Set();
for (const { name, text } of rulesFiles) {
  for (const match of text.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)) {
    headings.set(`${name} §${match[1]}`, match[2].trim());
    headingTitles.add(match[2].trim().toLowerCase());
  }
}

/** Cross-references of the form "The Conversion Table §5" or "Core Loop §2". The title is
 *  slugged to a filename the same way the published manual will slug it (ADR-0008), so a
 *  reference that resolves here resolves on the site. */
const FILE_FOR_TITLE = new Map(
  rulesFiles.map(({ name }) => [basename(name, '.md').replace(/^scenario-\d+-/, ''), name]),
);

const slug = (title) => title.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '-');

/** Words that cannot appear inside the name of a table, and whose presence means the
 *  match spanned a sentence rather than naming one. */
const FUNCTION_WORDS = new Set(['the', 'a', 'an', 'of', 'off', 'on', 'in', 'by', 'to', 'from', 'and', 'or', 'is', 'was', 'be', 'been', 'that', 'this', 'it', 'its']);

for (const { name, text } of rulesFiles) {
  for (const match of text.matchAll(/\b((?:The )?[A-Z][A-Za-z]*(?: [A-Z][A-Za-z]*)*) §(\d+)/g)) {
    const target = FILE_FOR_TITLE.get(slug(match[1]));
    if (!target) {
      fail(`${name}: reference "${match[0]}" names no rules file`);
    } else if (!headings.has(`${target} §${match[2]}`)) {
      fail(`${name}: reference "${match[0]}" points at a section ${target} does not have`);
    }
  }

  // "the civilian behaviour table" must be a table that exists. This check was written
  // because that exact reference shipped in the conversion table's Townsfolk trait with
  // nothing behind it — a rule the reader is told to consult and cannot.
  //
  // A name is at most three words and may contain no function word: without that, "the
  // game by being taken off the table" reads as a reference to a table called "taken off
  // the". A reference to a whole rules file ("the Conversion Table") is a document, not a
  // section, and resolves against the file index instead.
  for (const match of text.matchAll(/\bthe ((?:[a-z]+ ){0,2}[a-z]+) table\b/gi)) {
    const name_ = match[1].trim().toLowerCase();
    if (name_.split(' ').some((word) => FUNCTION_WORDS.has(word))) continue;
    if (FILE_FOR_TITLE.has(slug(`${name_} table`))) continue;
    if (!headingTitles.has(`${name_} table`) && !headingTitles.has(`the ${name_} table`)) {
      fail(`${name}: refers to "the ${name_} table", which is not a section in any rules file`);
    }
  }
}

// --- scenario scoring -------------------------------------------------------

const scenarioText = readFileSync(SCENARIO, 'utf8');

const roundsMatch = scenarioText.match(/\*\*(\w+) rounds\*\*/);
if (!roundsMatch) throw new Error('the scenario does not state its length in rounds');

const WORD_NUMBERS = { four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const rounds = WORD_NUMBERS[roundsMatch[1].toLowerCase()];
if (!rounds) throw new Error(`"${roundsMatch[1]} rounds" is not a length this script can read`);

const KINDS = ['contested', 'held'];

const sources = tableUnder(scenarioText, '5. Scoring').map((cells) => {
  const perRound = Number(unbacktick(cells[2]));
  if (!Number.isInteger(perRound) || perRound < 1) {
    throw new Error(`"${cells[0]}" scores at most "${cells[2]}" per round, which is not a positive whole number`);
  }
  const kind = unbacktick(cells[1]);
  if (!KINDS.includes(kind)) {
    throw new Error(`"${cells[0]}" is of kind "${kind}", not one of [${KINDS.join(', ')}]`);
  }
  return { source: unbacktick(cells[0]), kind, perRound };
});

const maxPerRound = sources.reduce((total, s) => total + s.perRound, 0);

for (const { source, perRound } of sources) {
  const share = perRound / maxPerRound;
  if (share > MAX_SOURCE_SHARE) {
    fail(`"${source}" is worth ${(share * 100).toFixed(0)}% of a round — above ${MAX_SOURCE_SHARE * 100}%, one objective is the whole game`);
  }
}

const perKind = (kind) => sources.filter((s) => s.kind === kind).reduce((total, s) => total + s.perRound, 0);
const held = perKind('held');
const contested = perKind('contested');

if (contested === 0) fail('no scoring source is contested — the board would not matter');
if (held / maxPerRound > MAX_HELD_SHARE) {
  fail(`held sources are worth ${held} a round against ${contested} contested — banking permanent income would beat playing the board`);
}

// --- artifact ---------------------------------------------------------------

const lines = [
  '# Scenario 01 — scoring, measured',
  '',
  'Generated by `scripts/scenario-verify.mjs` — do not edit by hand.',
  '',
  `A ${rounds}-round game. These are ceilings: the maximum a player could score if every`,
  'objective went their way every round, which never happens and is not meant to.',
  '',
  '## Per round',
  '',
  '| Source | Kind | Most per round | Share of the round | Most over the game |',
  '| --- | --- | --- | --- | --- |',
  ...sources.map(({ source, kind, perRound }) =>
    `| ${source} | ${kind} | ${perRound} | ${((perRound / maxPerRound) * 100).toFixed(0)}% | ${perRound * rounds} |`),
  `| **Total** | | **${maxPerRound}** | **100%** | **${maxPerRound * rounds}** |`,
  '',
  '## Contested against held',
  '',
  `**${contested}** points a round are contested — put back on the table every round, and`,
  `lost the moment you stop standing there. **${held}** are held: earned once, permanent.`,
  '',
  held === contested
    ? 'They are exactly level, which is the intended balance: banking the permanent income costs you the board, and the two trade evenly.'
    : `Held income is ${((held / maxPerRound) * 100).toFixed(0)}% of a round. Below parity, delivery is a supporting move rather than a strategy.`,
  '',
  '## What this does not measure',
  '',
  '- Whether the trailing player choosing the Star\'s road actually prevents a runaway lead.',
  `- Whether ${rounds} rounds is the right length.`,
  '- Whether delivering Gifts is a trap, a race, or a real decision.',
  '',
  'All three need two people and an afternoon. They are carried in `LEDGER.md`.',
  '',
];

mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(ARTIFACT, `${lines.join('\n')}\n`);

// --- result -----------------------------------------------------------------

if (failures.length > 0) {
  console.error(`scenario-verify: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}

console.log(`scenario-verify: ok — ${rulesFiles.length} rules files, ${headings.size} sections, ${sources.length} scoring sources over ${rounds} rounds`);
console.log(`  wrote ${ARTIFACT}`);
