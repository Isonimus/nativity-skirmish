#!/usr/bin/env node
// Proves site-verify's bounds can fail.
//
// "A bound that gates the build is negative-tested before it is believed" (CLAUDE.md §4).
// Three vacuous bounds have now shipped in this repo's harness — `MAX_DECISIVE`, a comeback
// bound that reduced to `floor(rounds/3) >= rounds/2`, and a play-sheet check that read a
// whole section where every class name appeared anyway. The first two were found by
// accident. This file exists so the next one is found on purpose, and so the proof named in
// slice 0012's Definition of Done is something you can re-run rather than something somebody
// once did.
//
//   node scripts/site-negative.mjs
//
// Each case perturbs one file, asserts site-verify exits non-zero for the expected reason,
// and restores the file. Exit 1 if any bound failed to fire — including a patch that matched
// nothing, because a perturbation that changed no bytes proves nothing at all.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const CASES = [
  {
    what: 'a link in rules prose, outside the nine-construct subset',
    file: 'rules/introduction.md',
    patch: (text) => text.replace('Two D6.', 'Two D6, see [the core loop](#4).'),
    expect: /outside the manual's Markdown subset/,
  },
  {
    what: 'a rules section the index claims nowhere',
    file: 'rules/conversion-table.md',
    patch: (text) => `${text}\n## 6. An unclaimed section\n\nProse nobody asked for.\n`,
    expect: /claimed by no manual section/,
  },
  {
    what: 'the index claiming a heading that was renamed away',
    file: 'rules/conversion-table.md',
    patch: (text) => text.replace('## 4. Profiles', '## 4. The profiles'),
    expect: /which is not a heading in/,
  },
  {
    what: 'Markdown leaking into the built page as literal text',
    // Perturbs the standfirst, not a plate caption. The captions only reach the page when
    // the web derivatives are present, and those are LFS-adjacent: this case passed
    // vacuously on a fresh clone, where no plate renders and no caption can leak. A
    // negative case that depends on optional inputs proves nothing on the machine that
    // most needs it.
    file: 'package.json',
    patch: (text) => text.replace('"description": "A skirmish', '"description": "A **skirmish**'),
    expect: /shows an emphasis marker as literal text/,
  },
  {
    what: 'a contents link pointing at no anchor',
    file: 'scripts/build-site.mjs',
    patch: (text) => text.replace('<li><a href="#${anchorOf(section)}">', '<li><a href="#${anchorOf(section)}-typo">'),
    expect: /links to #.*which is not an id/,
  },
  {
    what: 'a stylesheet asset the build never writes',
    file: 'site/style.css',
    patch: (text) => text.replace('fonts/alegreya-latin.woff2', 'fonts/alegreya-missing.woff2'),
    expect: /style\.css references .* which the build did not write/,
  },
  {
    what: 'the play sheet losing profile rows in extraction',
    file: 'scripts/build-site.mjs',
    patch: (text) => text.replace('.map((cells) => cells.slice(0, 5));', '.map((cells) => cells.slice(0, 5)).slice(0, 3);'),
    expect: /play sheet's profile table does not list/,
  },
];

let fired = 0;

for (const { what, file, patch, expect } of CASES) {
  const path = join(ROOT, file);
  const original = readFileSync(path, 'utf8');
  const patched = patch(original);

  if (patched === original) {
    console.error(`  no-op patch: ${what} — ${file} no longer contains what this case perturbs`);
    continue;
  }

  writeFileSync(path, patched);
  let output = '';
  let status = 0;
  try {
    execFileSync('node', [join(ROOT, 'scripts/site-verify.mjs')], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    status = error.status;
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  } finally {
    // Restored in `finally` so a crash mid-case cannot leave the corpus perturbed.
    writeFileSync(path, original);
  }

  if (status !== 0 && expect.test(output)) {
    fired += 1;
    console.log(`  fires: ${what}`);
  } else {
    console.error(`  DID NOT FIRE: ${what} (exit ${status})`);
    console.error(`    ${output.trim().split('\n').slice(0, 3).join('\n    ')}`);
  }
}

// The build left behind by the last perturbed run is wrong. Rebuild from the restored
// corpus, so this script cannot leave a poisoned build/ for the next command to trust.
execFileSync('node', [join(ROOT, 'scripts/site-verify.mjs')], { cwd: ROOT, stdio: 'pipe' });

if (fired !== CASES.length) {
  console.error(`site-negative: ${fired}/${CASES.length} bounds fired — a check that cannot fail reports green`);
  process.exit(1);
}

console.log(`site-negative: ok — ${fired}/${CASES.length} bounds fired`);
