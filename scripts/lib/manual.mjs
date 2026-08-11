// The manual's index, as data.
//
// ADR-0008 §2 fixed this table and made its numbers addresses: sections are appended,
// never inserted, and a section that becomes wrong is superseded in place under its
// existing number. This file is that table in the form the build and the checks can both
// read, so the site and `site-verify.mjs` cannot disagree about what the manual contains.
//
// `headings` names the `##` sections of the source file this manual section claims.
// `conversion-table.md` supplies three manual sections and is therefore split by heading
// rather than taken whole; `'*'` claims the file entire. site-verify checks the claims are
// exhaustive and disjoint, so a new rules section that nobody added here fails the build
// instead of quietly never appearing on the site.

import { slug } from './markdown.mjs';

export const RULES_DIR = 'rules';

export const SECTIONS = [
  {
    number: '0',
    title: 'What this is',
    file: 'introduction.md',
    headings: '*',
  },
  {
    number: '1',
    title: 'Establishing the scale',
    file: 'conversion-table.md',
    headings: ['1. Establish the figure-height'],
    // The file's preamble introduces the whole conversion procedure and has to land
    // somewhere. It goes with the first manual section drawn from the file, which is where
    // a reader working through the procedure actually starts.
    withPreamble: true,
  },
  {
    number: '2',
    title: 'The Conversion Table',
    file: 'conversion-table.md',
    headings: ['2. Observable attributes', '3. Decision procedure', '4. Profiles'],
  },
  {
    number: '3',
    title: 'Building a Warband',
    file: 'conversion-table.md',
    headings: ['5. Building a warband'],
  },
  {
    number: '4',
    title: 'The Core Loop',
    file: 'core-loop.md',
    headings: '*',
  },
  {
    number: '5',
    title: 'Scenario 01 — The Journey',
    file: 'scenario-01-the-journey.md',
    headings: '*',
  },
  {
    number: '6',
    title: 'The Play Sheet',
    generated: 'play-sheet',
  },
  {
    number: 'A',
    title: 'Design notes',
    generated: 'design-notes',
  },
];

/**
 * A manual section's anchor: `#4-the-core-loop` (ADR-0008 §2).
 *
 * Shares `slug` with the renderer rather than repeating it. There is one anchor scheme in
 * this manual, and two implementations of it would drift into two.
 */
export const anchorOf = (section) => `${section.number.toLowerCase()}-${slug(section.title)}`;
