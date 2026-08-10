// Reading markdown tables out of the rules text.
//
// Extracted at the second caller rather than the third, against the usual rule-of-three
// default, for a specific reason: the two callers must agree on the *format* of the same
// file. Two hand-rolled parsers that drift apart do not fail loudly — they disagree about
// what a profile says, and the check that runs second reports numbers nobody wrote. That
// is a present need, not speculative generality.

/**
 * The rows of the first markdown table under a `## <heading>`, each as trimmed cells.
 * Alignment separators are dropped and the header row is not returned.
 *
 * Throws rather than returning empty on a missing section: a verify script that silently
 * checks zero rows is the false green the whole harness exists to prevent.
 */
export function tableUnder(markdown, heading) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith(`## ${heading}`));
  if (start === -1) throw new Error(`no "## ${heading}" section`);

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

/** A cell with its backticks stripped. */
export const unbacktick = (cell) => cell.replace(/`/g, '').trim();
