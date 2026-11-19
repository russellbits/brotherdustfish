import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The authored breakpoint is the SCSS declaration; src/lib/breakpoints.ts parses it
// at build time for the markup and the client scripts. That module is Vite-only
// (it imports the file with `?raw`), so this test restates the parse contract
// against the source file itself: a declaration whose shape stops matching fails
// `npm test` as well as the build.
const SCSS = fileURLToPath(new URL('../src/styles/_breakpoint.scss', import.meta.url));
const source = readFileSync(SCSS, 'utf8');

test('_breakpoint.scss declares the breakpoint exactly once', () => {
    const declarations = source.match(/^\s*\$tablet-max\s*:/gm) ?? [];
    assert.equal(declarations.length, 1, 'expected exactly one $tablet-max declaration');
});

test('the declaration is a positive width in px', () => {
    const match = source.match(/^\s*\$tablet-max:\s*(\d+(?:\.\d+)?)px\s*;/m);
    assert.ok(
        match,
        '$tablet-max must be written as `$tablet-max: <n>px;` — breakpoints.ts parses exactly that',
    );

    const px = Number(match[1]);
    assert.ok(Number.isFinite(px) && px > 0, `not a positive width: ${match[1]}`);
});
