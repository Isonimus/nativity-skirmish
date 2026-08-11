// The manual's Markdown, and nothing else.
//
// ADR-0011 chose a subset renderer over a Markdown dependency. The argument only holds
// because of how this file fails: it does not skip, degrade or pass through a construct it
// does not know — it throws, naming the line. `scripts/site-verify.mjs` runs it over every
// rules file for exactly that reason, so unsupported Markdown cannot be committed and this
// renderer can never meet input it does not handle.
//
// A lenient renderer here would be the worst of both worlds. A link would emit as the
// literal text `[the core loop](#4)`, a nested list as a paragraph of hyphens, and the
// manual would ship wrong while every check reported green.
//
// The supported subset, in full: h1, h2, paragraph, blockquote, horizontal rule, unordered
// list, ordered list, pipe table; and inline strong, emphasis and code. Nine constructs.
// Growing it means growing this file *and* the ADR — see ADR-0011 §1 before adding one.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (text) => text.replace(/[&<>"]/g, (character) => ESCAPES[character]);

/**
 * Inline constructs that are *valid Markdown elsewhere* and would otherwise pass through
 * this renderer as literal text. Every one of these is a silent-wrong-output bug, which is
 * why they are named and refused rather than left to the escaper.
 */
const UNSUPPORTED_INLINE = [
  { pattern: /!\[/, what: 'an inline image — plates are placed by the build, not by rules prose' },
  { pattern: /\]\(/, what: 'a link' },
  { pattern: /<[a-zA-Z/]/, what: 'inline HTML' },
  { pattern: /~~/, what: 'strikethrough' },
  { pattern: /__/, what: 'underscore emphasis — the corpus uses asterisks' },
];

const fail = (lineNumber, message) => {
  throw new Error(`line ${lineNumber}: ${message}`);
};

/** Stands in for a code span while emphasis is resolved. NUL cannot occur in the corpus. */
const HOLE = '\u0000';

/**
 * Inline markup within one block of text: `code`, **strong**, *emphasis*.
 *
 * Code spans are lifted out and replaced by a placeholder rather than split on, because
 * the corpus emphasises *across* them — `**one figure-height — \`1 H\`**` is one strong
 * span containing a code span, and splitting first leaves both asterisk pairs orphaned in
 * different segments. Lifting also keeps an asterisk inside a code span from being read as
 * emphasis, which was the reason to split in the first place.
 *
 * After the emphasis passes, a surviving asterisk or backtick means the author wrote
 * something unbalanced; that is refused rather than rendered as a stray character.
 *
 * Exported because the play sheet renders table cells lifted straight out of the rules,
 * and cells are Markdown: stripping their backticks instead would put a bare `*` wildcard
 * on the one page people print.
 */
export function inline(text, lineNumber = 0) {
  for (const { pattern, what } of UNSUPPORTED_INLINE) {
    if (pattern.test(text)) fail(lineNumber, `${what} is not in the manual's Markdown subset (ADR-0011)`);
  }
  if (text.includes(HOLE)) fail(lineNumber, 'a NUL byte in the source would collide with the renderer placeholder');

  const codes = [];
  const lifted = text.replace(/`([^`]+)`/g, (_, code) => `${HOLE}${codes.push(code) - 1}${HOLE}`);
  if (lifted.includes('`')) fail(lineNumber, 'unbalanced backtick');

  const marked = escapeHtml(lifted)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  if (marked.includes('*')) fail(lineNumber, 'unbalanced emphasis marker');

  return marked.replace(new RegExp(`${HOLE}(\\d+)${HOLE}`, 'g'), (_, at) => `<code>${escapeHtml(codes[Number(at)])}</code>`);
}

/** A heading's anchor: lowercase, punctuation dropped, spaces hyphenated (ADR-0008 §2). */
export const slug = (text) => text
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-');

const UNORDERED_ITEM = /^- (.*)$/;
const ORDERED_ITEM = /^\d+\. (.*)$/;

const ALIGNMENT_ROW = /^\|(?:\s*:?-{3,}:?\s*\|)+$/;
const cellsOf = (line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim());

function renderTable(block, startLine) {
  if (block.length < 3) fail(startLine, 'a table needs a header row, an alignment row and at least one body row');
  if (!ALIGNMENT_ROW.test(block[1].trim())) fail(startLine + 1, 'the row under a table header must be the alignment row');

  const head = cellsOf(block[0]).map((cell) => `<th>${inline(cell, startLine)}</th>`).join('');
  const body = block.slice(2)
    .map((line, offset) => `<tr>${cellsOf(line).map((cell) => `<td>${inline(cell, startLine + 2 + offset)}</td>`).join('')}</tr>`)
    .join('\n');

  return `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/**
 * List items, with continuation lines folded in.
 *
 * A line inside a list block is either a new item or an indented continuation of the
 * previous one. Anything else — an unindented line that is not a marker — is refused: it
 * is almost always a wrapped line the author forgot to indent, and rendering it as a new
 * paragraph inside a list is the kind of quiet wrongness this renderer exists to avoid.
 */
function renderList(block, startLine, marker) {
  const items = [];
  block.forEach((line, offset) => {
    const match = line.match(marker);
    if (match) {
      items.push({ text: match[1], line: startLine + offset });
      return;
    }
    if (!/^\s{2,}\S/.test(line)) fail(startLine + offset, 'a continuation line inside a list must be indented by at least two spaces');
    if (items.length === 0) fail(startLine + offset, 'a list block starts with an indented line');
    items[items.length - 1].text += ` ${line.trim()}`;
  });

  const tag = marker === ORDERED_ITEM ? 'ol' : 'ul';
  return `<${tag}>\n${items.map((item) => `<li>${inline(item.text, item.line)}</li>`).join('\n')}\n</${tag}>`;
}

/**
 * Markdown to HTML, for the subset in this file's header.
 *
 * `headingOffset` demotes headings so a rules file can be embedded under the manual's own
 * section heading: at 1, the file's `#` becomes `<h2>` and its `##` becomes `<h3>`. The
 * ids are slugs of the heading text, prefixed so that the two files that both hold a
 * "5. Scoring" do not collide on one page.
 *
 * Throws on any construct outside the subset, naming the line.
 */
export function render(markdown, { headingOffset = 0, idPrefix = '' } = {}) {
  const lines = markdown.split('\n');
  const html = [];

  let index = 0;
  while (index < lines.length) {
    if (lines[index].trim() === '') { index += 1; continue; }

    const startLine = index + 1;
    const block = [];
    while (index < lines.length && lines[index].trim() !== '') {
      block.push(lines[index]);
      index += 1;
    }

    const first = block[0];

    if (/^#{3,}\s/.test(first)) {
      fail(startLine, 'headings deeper than `##` are not in the subset — a rules section that needs one wants splitting (ADR-0011)');
    }

    if (/^#{1,2}\s/.test(first)) {
      if (block.length > 1) fail(startLine, 'a heading must be its own block');
      const depth = first.startsWith('## ') ? 2 : 1;
      const text = first.replace(/^#{1,2}\s+/, '');
      const tag = `h${depth + headingOffset}`;
      html.push(`<${tag} id="${idPrefix}${slug(text)}">${inline(text, startLine)}</${tag}>`);
      continue;
    }

    if (first.trim() === '---') {
      if (block.length > 1) fail(startLine, 'a horizontal rule must be its own block');
      html.push('<hr>');
      continue;
    }

    if (first.startsWith('> ')) {
      const quoted = block.map((line, offset) => {
        if (!line.startsWith('> ')) fail(startLine + offset, 'every line of a blockquote must begin with "> "');
        return line.slice(2).trim();
      }).join(' ');
      html.push(`<blockquote><p>${inline(quoted, startLine)}</p></blockquote>`);
      continue;
    }

    if (first.trim().startsWith('|')) {
      html.push(renderTable(block, startLine));
      continue;
    }

    if (UNORDERED_ITEM.test(first)) { html.push(renderList(block, startLine, UNORDERED_ITEM)); continue; }
    if (ORDERED_ITEM.test(first)) { html.push(renderList(block, startLine, ORDERED_ITEM)); continue; }

    if (/^(```|~~~)/.test(first)) fail(startLine, 'fenced code is not in the subset (ADR-0011)');
    if (/^\s+\S/.test(first)) fail(startLine, 'an indented block is not in the subset — it would be a code block elsewhere (ADR-0011)');

    html.push(`<p>${inline(block.join(' ').replace(/\s+/g, ' ').trim(), startLine)}</p>`);
  }

  return html.join('\n');
}

/**
 * A rules file split into its title, its preamble and its `##` sections.
 *
 * The manual's index (ADR-0008 §2) maps *parts* of a file to sections — `conversion-table.md`
 * supplies three of them — so the build needs the pieces addressable by heading, and
 * `site-verify.mjs` needs the same split to check that every heading in the corpus is
 * claimed by exactly one manual section. Two callers, one splitter: two that drifted apart
 * would disagree silently about which prose ships.
 *
 * The title is returned rather than dropped. The manual supplies its own section headings
 * and does not use it, but a splitter that quietly discards content is a splitter nobody
 * can audit.
 */
export function splitSections(markdown) {
  const title = markdown.split('\n').find((line) => line.startsWith('# '))?.slice(2).trim() ?? '';

  const preamble = [];
  const sections = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('# ')) continue;
    if (line.startsWith('## ')) { sections.push({ heading: line.slice(3).trim(), lines: [] }); continue; }
    (sections.length > 0 ? sections[sections.length - 1].lines : preamble).push(line);
  }

  return {
    title,
    preamble: preamble.join('\n').trim(),
    sections: sections.map(({ heading, lines }) => ({ heading, body: lines.join('\n').trim() })),
  };
}
