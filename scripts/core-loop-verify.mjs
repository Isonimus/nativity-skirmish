#!/usr/bin/env node
// Verifies the core loop (slice 0007) against the profiles in the conversion table.
//
// The odds of the opposed roll are exactly computable from two D6 targets, so this script
// computes them rather than simulating them. Monte Carlo would answer the same question
// with sampling noise, and a check that gates commits must not be flaky.
//
// What this measures: the resolution mechanic and morale, in isolation. What it does not
// and cannot measure: whether a game is *fun*, whether six rounds is the right length, or
// whether positional scoring beats melee attrition in practice. Those need a table, two
// people and an afternoon, and they are carried in LEDGER.md as playtest items. Stating
// that limit is the point — a harness that quietly implies it covered more than it did is
// worse than no harness.
//
//   node scripts/core-loop-verify.mjs
//
// Exit 1 on any failed check.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tableUnder } from './lib/rules-table.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = join(ROOT, 'rules/conversion-table.md');
const ARTIFACT = join(ROOT, 'artifacts/core-loop-odds.md');

const DIE_FACES = 6;
const NON_COMBATANT = '—';

/**
 * Bounds on a single exchange. Each one names a way the mechanic could be broken, not a
 * number someone liked:
 *
 * - above MAX_DECISIVE the roll is ceremony — the outcome was known before the dice moved;
 * - below MIN_VIABLE a model can never meaningfully strike back, which turns a class into
 *   scenery;
 * - past MAX_EXCHANGES an attrition matchup cannot resolve inside a six-round game, so
 *   striking must not be that model's only way to affect the board.
 *
 * MAX_DECISIVE is measured against the *advantage* roll, not the plain one, because the
 * plain one cannot reach it: with Skill bounded to 2+..6+ the best exchange in the game is
 * 5/6 × 5/6 = 69%, so any threshold above that is a check that can never fire. It was
 * written at 0.75 against the plain roll and was dead on arrival — caught by perturbing a
 * Soldier to Skill 2+ and watching a different bound catch it instead. Advantage is the
 * realistic worst case anyway: it is one charge away at any table.
 */
const MAX_DECISIVE = 0.9;
const MIN_VIABLE = 0.02;
const MAX_EXCHANGES = 50;

// --- profiles ---------------------------------------------------------------

/** The chance of equalling or beating a `N+` target on a D6. A natural 1 always fails and
 *  a natural 6 always succeeds, which the closed range 2..6 already expresses. */
function chance(target) {
  if (!Number.isInteger(target) || target < 2 || target > DIE_FACES) {
    throw new Error(`target "${target}+" is outside 2+..6+ — a stat outside that range is auto-pass or auto-fail`);
  }
  return (DIE_FACES + 1 - target) / DIE_FACES;
}

/** `4+` as 4; the non-combatant dash as null. */
function parseTarget(cell) {
  if (cell === NON_COMBATANT) return null;
  const match = cell.match(/^(\d)\+$/);
  if (!match) throw new Error(`"${cell}" is not a D6 target of the form N+`);
  return Number(match[1]);
}

/** `1½H` as 1.5, `0` as 0. */
function parseMove(cell) {
  const match = cell.match(/^(\d)(½)?H?$/);
  if (!match) throw new Error(`"${cell}" is not a Move value`);
  return Number(match[1]) + (match[2] ? 0.5 : 0);
}

const profiles = tableUnder(readFileSync(TABLE, 'utf8'), '4. Profiles').map((cells) => ({
  className: cells[0],
  move: parseMove(cells[1]),
  skill: parseTarget(cells[2]),
  grit: Number(cells[3]),
  resolve: parseTarget(cells[4]),
}));

const combatants = profiles.filter((p) => p.skill !== null);

// --- checks -----------------------------------------------------------------

const failures = [];
const fail = (message) => failures.push(message);

for (const { className, grit, move, skill, resolve } of profiles) {
  if (!Number.isInteger(grit) || grit < 1) fail(`"${className}" has Grit ${grit} — a model must take at least one hit`);
  // A model that can neither move nor strike is scenery. The Infant is the deliberate
  // exception and says so in its trait; anything else reaching this state is a mistake.
  if (move === 0 && skill !== null) fail(`"${className}" cannot move but can strike — an immobile attacker has no counterplay`);
  if (skill === null && resolve !== null) fail(`"${className}" has no Skill but tests Resolve — it can be shaken with nothing to degrade`);
}

/**
 * P(one hit): the attacker beats its own Skill and the defender fails to beat its own.
 *
 * Both sides are drawn from `combatants`, because a model with no Skill is not a legal
 * target (core loop §3). The first run of this script exposed exactly that gap — it
 * reported "Soldier → The Infant, 67%" as the most decisive exchange in the game, against
 * a model whose trait says it is never removed. The rules text was missing the sentence,
 * not the harness.
 */
const hitChance = (attacker, defender) =>
  chance(attacker.skill) * (1 - chance(defender.skill));

/** Rolling two dice and keeping the better one. */
const withAdvantage = (p) => 1 - (1 - p) ** 2;

const matchups = [];
for (const attacker of combatants) {
  for (const defender of combatants) {
    const p = hitChance(attacker, defender);
    const advantage = withAdvantage(p);
    const exchanges = defender.grit / p;
    matchups.push({ attacker, defender, p, advantage, exchanges });

    const pair = `${attacker.className} → ${defender.className}`;
    if (advantage > MAX_DECISIVE) fail(`${pair} hits ${(advantage * 100).toFixed(0)}% of the time with advantage — above ${MAX_DECISIVE * 100}%, the roll decides nothing`);
    if (p < MIN_VIABLE) fail(`${pair} hits ${(p * 100).toFixed(1)}% of the time — below ${MIN_VIABLE * 100}%, the attacker is scenery`);
    if (exchanges > MAX_EXCHANGES) fail(`${pair} needs ${exchanges.toFixed(0)} exchanges to resolve — beyond ${MAX_EXCHANGES}, it cannot happen in a game`);
  }
}

for (const { className, resolve } of profiles) {
  if (resolve === null) continue;
  const hold = chance(resolve);
  if (hold <= 0 || hold >= 1) fail(`"${className}" holds ${(hold * 100).toFixed(0)}% of the time — a morale test that cannot go both ways is not a test`);
}

// No two classes may share a stat line. Identical numbers mean one of them is a class the
// rules do not need: it exists only as a name, and its trait is doing all the work alone.
//
// This deliberately replaced a stricter check — "no class dominates another on every stat"
// — which fired 22 times on the first run and was wrong on its premise. Pareto-dominance
// is a defect in games where you *buy* an army, because a dominated unit is one nobody
// takes. Here you field the figures you own and the conversion table assigns the class, so
// a Townsfolk being worse than a Soldier at everything is not a choice anyone regrets: it
// is a villager standing next to a legionary. Warband composition is constrained by the
// caps in §5, and what distinguishes classes is traits and scoring position, not stats.
// The check imported an assumption ADR-0002 explicitly rejects.
const statLines = new Map();
for (const { className, move, skill, grit, resolve } of profiles) {
  const line = `${move}/${skill}/${grit}/${resolve}`;
  if (statLines.has(line)) {
    fail(`"${className}" and "${statLines.get(line)}" have the same stat line (${line}) — one of them is a redundant class`);
  }
  statLines.set(line, className);
}

// --- artifact ---------------------------------------------------------------

const percent = (p) => `${(p * 100).toFixed(0)}%`;
const names = combatants.map((p) => p.className);

const lines = [
  '# Core loop — measured odds',
  '',
  'Generated by `scripts/core-loop-verify.mjs` — do not edit by hand.',
  '',
  'Exact arithmetic over the D6 targets in the conversion table, not simulation.',
  'These are the numbers to argue with when the profiles are tuned after playtest.',
  '',
  '## Chance of one hit, per exchange',
  '',
  'Rows strike, columns defend. The attacker beats its own Skill and the defender fails to.',
  '',
  `| Attacker \\ Defender | ${names.join(' | ')} |`,
  `| --- | ${names.map(() => '---').join(' | ')} |`,
];

for (const attacker of combatants) {
  const row = names.map((name) => percent(matchups.find((m) => m.attacker === attacker && m.defender.className === name).p));
  lines.push(`| **${attacker.className}** | ${row.join(' | ')} |`);
}

lines.push(
  '',
  '## Exchanges to remove a model',
  '',
  'Grit divided by the chance above — how long a fight actually takes.',
  '',
  `| Attacker \\ Defender | ${names.join(' | ')} |`,
  `| --- | ${names.map(() => '---').join(' | ')} |`,
);

for (const attacker of combatants) {
  const row = names.map((name) => matchups.find((m) => m.attacker === attacker && m.defender.className === name).exchanges.toFixed(1));
  lines.push(`| **${attacker.className}** | ${row.join(' | ')} |`);
}

const best = matchups.reduce((a, b) => (a.p > b.p ? a : b));
const worst = matchups.reduce((a, b) => (a.p < b.p ? a : b));

lines.push(
  '',
  '## Morale',
  '',
  '| Class | Holds |',
  '| --- | --- |',
  ...profiles.filter((p) => p.resolve !== null).map((p) => `| ${p.className} | ${percent(chance(p.resolve))} |`),
  '',
  '## For the eye',
  '',
  `- Most decisive exchange: **${best.attacker.className} → ${best.defender.className}**, ${percent(best.p)}` +
    ` (${percent(withAdvantage(best.p))} with advantage).`,
  `- Least decisive: **${worst.attacker.className} → ${worst.defender.className}**, ${percent(worst.p)}.`,
  '- Combat scores nothing. Judge these odds by whether they make holding the illuminated',
  '  feature hard, not by whether they kill efficiently.',
  '',
);

mkdirSync(dirname(ARTIFACT), { recursive: true });
writeFileSync(ARTIFACT, `${lines.join('\n')}\n`);

// --- result -----------------------------------------------------------------

if (failures.length > 0) {
  console.error(`core-loop-verify: ${failures.length} failure(s)`);
  for (const message of failures) console.error(`  ${message}`);
  process.exit(1);
}

console.log(`core-loop-verify: ok — ${profiles.length} profiles, ${matchups.length} matchups, no degenerate exchange`);
console.log(`  wrote ${ARTIFACT}`);
