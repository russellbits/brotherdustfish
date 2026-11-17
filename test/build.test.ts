import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// These assert on the built site, so they need `npm run build` to have run; the
// full acceptance runs `npm run build && npm test`. They skip rather than fail
// when dist/ is absent so a fresh clone's `npm test` is still meaningful.

const PAGE = resolve(process.cwd(), 'dist/chapter/01/meet-able/index.html');
const built = existsSync(PAGE);
const skip = built ? false : 'run `npm run build` first';

const html = () => readFileSync(PAGE, 'utf8');

test('the chapter page carries the drop link with everything derived', { skip }, () => {
  const page = html();

  for (const fragment of [
    'id="p1s1l1"',
    'class="hx-link"',
    'href="/drops/01-meet-able/p1s1l1/"',
    'hx-get="/drops/01-meet-able/p1s1l1/"',
    'hx-target="#p1s1"',
    'hx-swap="afterend"',
    'hx-indicator="#ind-p1s1l1"',
    'data-drop-term="Skybow"',
    'data-drop-para="1"',
    'data-drop-sent="1"',
    'data-drop-link="1"',
    'data-drop-mode="sentence"',
    'data-astro-prefetch="false"',
    'data-astro-reload',
    "handleToggle(event,'p1s1l1-exp')",
  ]) {
    assert.ok(page.includes(fragment), `missing from the built page: ${fragment}`);
  }
});

test('the link keeps the hx-on reveal hook rather than a body listener', { skip }, () => {
  assert.ok(html().includes('hx-on:htmx:after-swap="handleReveal(event)"'));
});

test('no link carries hx-vals', { skip }, () => {
  assert.ok(!html().includes('hx-vals'));
});

test('the sentence anchor the target depends on exists in the document', { skip }, () => {
  assert.ok(html().includes('<a id="p1s1" class="s"></a>'));
});

// The word is wrapped in the link and followed by the indicator span, so what must
// survive is the reader-visible TEXT, not any particular arrangement of tags.
// Asserting the bare phrase or the tag order would both fail on a correct system.
test('the visible text is unchanged by the mechanism around it', { skip }, () => {
  const text = html()
    .replace(/<span class="htmx-indicator"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');

  assert.ok(text.includes('glowing Skybow of the Goliaths'));
  assert.ok(text.includes('beneath the great, glowing Skybow'));
});
