import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// These assert on the built site, so they need `npm run build` to have run; the
// full acceptance runs `npm run build && npm test`. They skip rather than fail
// when dist/ is absent so a fresh clone's `npm test` is still meaningful.

const DIST = resolve(process.cwd(), 'dist');
const PAGE = join(DIST, 'chapter/01/meet-able/index.html');
const FRAGMENT = join(DIST, 'drops/01-meet-able/p1s1l1.html');
// Keyed on the chapter page, NOT on the fragment: if the guard also required the
// fragment to exist, a missing fragment route would skip these tests instead of
// failing them — which is precisely the regression they exist to catch.
const skip = existsSync(PAGE) ? false : 'run `npm run build` first';

const html = () => readFileSync(PAGE, 'utf8');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// ── the link ─────────────────────────────────────────────────────────────────

test('the chapter page carries the drop link with everything derived', { skip }, () => {
  const page = html();

  for (const fragment of [
    'id="p1s1l1"',
    'class="hx-link"',
    'href="/drops/01-meet-able/p1s1l1.html"',
    'hx-get="/drops/01-meet-able/p1s1l1.html"',
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

// htmx fires htmx:afterSwap on the SWAP TARGET, which for sentence and paragraph
// modes is a sibling of the link — so an hx-on attribute on the link would never
// fire and the reveal would silently not run. The hook is a delegated document
// listener instead, and this pins that the per-link form is absent.
test('the link carries no per-link reveal hook', { skip }, () => {
  assert.ok(!html().includes('hx-on:'), 'hx-on cannot reach the swap target');
});

test('htmx is bundled rather than pulled from a CDN', { skip }, () => {
  assert.ok(!html().includes('unpkg.com'), 'htmx must not come from a CDN');
  assert.ok(!/<script[^>]+src="https?:\/\//.test(html()), 'no external script tags');

  const bundled = walk(join(DIST, '_astro'))
    .filter((file) => file.endsWith('.js'))
    .some((file) => readFileSync(file, 'utf8').includes('htmx:afterSwap'));

  assert.ok(bundled, 'htmx does not appear in any built script');
});

test('the chapter page loads its own module script', { skip }, () => {
  assert.match(html(), /<script[^>]+type="module"[^>]+src="\/_astro\//);
});

test('no link carries hx-vals', { skip }, () => {
  assert.ok(!html().includes('hx-vals'));
});

// The word is wrapped in the link and followed by the indicator span, so what must
// survive is the reader-visible TEXT, not any particular arrangement of tags.
test('the visible text is unchanged by the mechanism around it', { skip }, () => {
  const text = html()
    .replace(/<span class="htmx-indicator"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');

  assert.ok(text.includes('glowing Skybow of the Goliaths'));
  assert.ok(text.includes('beneath the great, glowing Skybow'));
});

// ── the fragment ─────────────────────────────────────────────────────────────

test('the fragment is served with the wrapper the mode calls for', { skip }, () => {
  const fragment = readFileSync(FRAGMENT, 'utf8');

  assert.ok(fragment.includes('<span id="p1s1l1-exp" class="expansion-sentence">'));
  assert.ok(fragment.includes('The Skybow is the ring around the planet of the Archelux'));
});

test('the fragment carries no document furniture', { skip }, () => {
  for (const file of walk(join(DIST, 'drops'))) {
    const fragment = readFileSync(file, 'utf8').toLowerCase();

    for (const forbidden of ['<!doctype', '<html', '<head', '<style', '<script', '<body']) {
      assert.ok(!fragment.includes(forbidden), `${relative(DIST, file)} contains ${forbidden}`);
    }
  }
});

// ── integrity ────────────────────────────────────────────────────────────────

test('a DOM id never contains the chapter namespace', { skip }, () => {
  for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
    for (const [, value] of readFileSync(file, 'utf8').matchAll(/\sid="([^"]*)"/g)) {
      assert.ok(!value.includes('/'), `${relative(DIST, file)} has id="${value}"`);
    }
  }
});

test('every emitted fragment has a link, and every link has a fragment', { skip }, () => {
  const emitted = new Set(
    walk(join(DIST, 'drops'))
      .filter((file) => file.endsWith('.html'))
      .map((file) => `/${relative(DIST, file)}`),
  );

  const linked = new Set(
    walk(join(DIST, 'chapter'))
      .filter((file) => file.endsWith('.html'))
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/href="(\/drops\/[^"]*)"/g)])
      .map(([, href]) => href),
  );

  assert.deepEqual([...emitted].sort(), [...linked].sort());
});

// Review Focus 4: a sentence- or paragraph-mode drop whose anchor does not exist
// renders a fragment that nothing swaps in, and no error anywhere. This is the
// assertion that catches it.
test('every swap target in a chapter page exists in that page', { skip }, () => {
  for (const file of walk(join(DIST, 'chapter')).filter((f) => f.endsWith('.html'))) {
    const page = readFileSync(file, 'utf8');

    for (const [, target] of page.matchAll(/hx-target="#([^"]+)"/g)) {
      assert.ok(
        page.includes(`id="${target}"`),
        `${relative(DIST, file)} swaps into #${target}, which does not exist there`,
      );
    }
  }
});

// ── styles ───────────────────────────────────────────────────────────────────

const stylesheet = () => {
  const dir = join(DIST, '_astro');
  const file = existsSync(dir)
    ? readdirSync(dir).find((name) => name.startsWith('Layout.') && name.endsWith('.css'))
    : undefined;

  assert.ok(file, 'the built stylesheet is missing');
  return readFileSync(join(dir, file), 'utf8');
};

test('every expansion class is present in the stylesheet', { skip }, () => {
  const css = stylesheet();

  for (const selector of [
    '.hx-link',
    '.expansion-inline',
    '.expansion-sentence',
    '.expansion-paragraph',
    '.expansion-missing',
    '.expansion-fade',
    '.htmx-indicator',
    '.word',
    '.collapsing',
    '[data-tooltip]',
  ]) {
    assert.ok(css.includes(selector), `stylesheet is missing ${selector}`);
  }
});

// Scoped component styles compile to `.expansion-inline[data-astro-cid-…]`, and a
// fetched fragment never carries that attribute, so the rules would silently not
// apply to any expansion. They must be global.
test('the expansion rules are global, not scoped to a component', { skip }, () => {
  const scoped = [
    ...stylesheet().matchAll(
      /\.(expansion-[a-z]+|hx-link|htmx-indicator|word|collapsing)\[data-astro-cid-/g,
    ),
  ].map((match) => match[1]);

  assert.deepEqual(scoped, []);
});

test('the chapter page loads that stylesheet', { skip }, () => {
  assert.match(html(), /href="\/_astro\/Layout\.[^"]+\.css"/);
});
