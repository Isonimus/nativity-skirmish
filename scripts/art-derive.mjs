#!/usr/bin/env node
// Renders the web derivatives the published manual actually serves.
//
// The masters in art/plates/ are ~8 MB PNGs, which is right for print and wrong for a
// page someone opens on a phone. This writes art/web/<id>.webp at DERIVATIVE_WIDTH, which
// is what the site ships; the masters stay in Git LFS and are never served.
//
// Regenerates every derivative unconditionally. It takes seconds, and a conditional
// rebuild would need staleness tracking that is more machinery than the problem deserves
// — masters are re-rendered wholesale, not edited in place.
//
//   node scripts/art-derive.mjs
//
// Exit 1 if a master is unreadable or ImageMagick is absent.

import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTERS = join(ROOT, 'art/plates');
const WEB = join(ROOT, 'art/web');

/** Wide enough for a full-bleed plate on a high-density display, small enough that a
 *  21-plate manual stays under a few megabytes. */
const DERIVATIVE_WIDTH = 1600;
const QUALITY = 82;

if (!existsSync(MASTERS)) throw new Error(`no masters at ${MASTERS}`);

const masters = readdirSync(MASTERS).filter((f) => f.endsWith('.png')).sort();
if (masters.length === 0) throw new Error(`no PNG masters in ${MASTERS} — nothing to derive`);

mkdirSync(WEB, { recursive: true });

for (const file of masters) {
  const id = file.replace(/\.png$/, '');
  execFileSync('convert', [
    join(MASTERS, file),
    '-resize', `${DERIVATIVE_WIDTH}x>`,
    '-quality', String(QUALITY),
    '-strip',
    join(WEB, `${id}.webp`),
  ]);
}

console.log(`art-derive: ok — ${masters.length} derivatives at ${DERIVATIVE_WIDTH}px into art/web/`);
