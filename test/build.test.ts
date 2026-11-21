import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// These assert on the built site, so they need `npm run build` to have run; the
// full acceptance runs `npm run build && npm test`. They skip rather than fail when
// nothing has been built, so a fresh clone's `npm test` is still meaningful.
//
// The directory is read from the config rather than hardcoded. It *was* hardcoded
// to `dist/`, and when the site moved its output to `./build` every test in this
// file silently skipped: a moved output directory is indistinguishable from
// "nothing has been built yet", so the suite reported success while asserting
// nothing at all. `DIST` is Astro's conventional name for the output directory,
// not a claim about what astro.config.mjs sets.
const config = (await import('../astro.config.mjs')).default;
const DIST = resolve(process.cwd(), config.outDir ?? 'dist');
// Chapter 1 is the site's home page, so this is where its content is asserted.
const PAGE = join(DIST, 'index.html');
const FRAGMENT = join(DIST, 'drops/01-meet-able/p1s1l1.html');
// Keyed on the home page, NOT on the fragment: if the guard also required the
// fragment to exist, a missing fragment route would skip these tests instead of
// failing them — which is precisely the regression they exist to catch.
// Names the directory it looked in, so a mismatch between this and outDir is
// diagnosable rather than a silent pass.
const skip = existsSync(PAGE) ? false : `nothing built in ${DIST} — run \`npm run build\` first`;

const html = () => readFileSync(PAGE, 'utf8');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Astro's prerendered redirect is an HTML document whose entire content is a
// refresh to the destination, so there is nothing else in it to assert against.
const redirectTarget = (file: string): string | null =>
  readFileSync(file, 'utf8').match(/<meta http-equiv="refresh" content="0;url=([^"]*)">/)?.[1] ??
  null;

/**
 * The documents a reader lands on and reads: every built page except the `drops/`
 * fragments, which are partials swapped into a page, and the redirect pages,
 * which carry no chrome of their own. Walking the whole site rather than one
 * directory is what keeps the home page inside these assertions — chapter 1 lives
 * at `/`, so a walk of `chapter/` alone would quietly assert nothing about it.
 */
const renderedPages = (): string[] =>
  walk(DIST)
    .filter((file) => file.endsWith('.html'))
    .filter((file) => !file.startsWith(join(DIST, 'drops')))
    .filter((file) => redirectTarget(file) === null);

// ── the link ─────────────────────────────────────────────────────────────────

test("the home page carries chapter 1's drop link with everything derived", { skip }, () => {
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

test('the home page loads its own module script', { skip }, () => {
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

// ── the home page ────────────────────────────────────────────────────────────

test('the home page is chapter 1 rather than a landing page', { skip }, () => {
  const page = html();

  assert.match(page, /<title>The Desert of Idex Mortez — Brother Dustfish<\/title>/);
  assert.match(page, /class="chapter-ref"[^>]*>Chapter 1</);
  assert.ok(!page.includes('Start Reading'), 'the landing page CTA is still on the home page');
});

// Chapter 1 has one canonical URL, so the routes it used to live at send the
// reader on. `/chapter/01/` reaching it in one hop is the assertion that the
// number route builds its destination with chapterHref rather than by hand.
test('chapter 1 is served only from the home page', { skip }, () => {
  assert.equal(redirectTarget(join(DIST, 'chapter/01/meet-able/index.html')), '/');
  assert.equal(redirectTarget(join(DIST, 'chapter/01/index.html')), '/');
});

// The sidebar owns the sign-up now that there is no landing block to hold a
// second copy, and the sidebar is in the layout — so every page has exactly one.
test('every page a reader lands on offers the sign-up exactly once', { skip }, () => {
  for (const file of renderedPages()) {
    const count = readFileSync(file, 'utf8').split('class="signup-form"').length - 1;
    assert.equal(count, 1, `${relative(DIST, file)} renders the sign-up form ${count} times`);
  }
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
    renderedPages()
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/href="(\/drops\/[^"]*)"/g)])
      .map(([, href]) => href),
  );

  assert.deepEqual([...emitted].sort(), [...linked].sort());
});

// Review Focus 4: a sentence- or paragraph-mode drop whose anchor does not exist
// renders a fragment that nothing swaps in, and no error anywhere. This is the
// assertion that catches it.
test('every swap target in a page exists in that page', { skip }, () => {
  for (const file of renderedPages()) {
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

/**
 * The stylesheet the home page loads, read from the page rather than guessed from
 * a filename. Vite names the asset after the module that owns the shared CSS, and
 * that name moved from `Layout.` to `ChapterView.` when the chapter renderer was
 * extracted out of the route: a name-based lookup read the wrong file and failed
 * every assertion in this section. Following the page's own href also means these
 * assertions run against the CSS a reader actually receives, and that a page which
 * links no stylesheet — or links a missing one — fails here.
 */
const stylesheet = () => {
  const match = html().match(/href="(\/_astro\/[^"]+\.css)"/);

  assert.ok(match, 'the home page links no stylesheet');
  return readFileSync(join(DIST, match[1].replace(/^\//, '')), 'utf8');
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

// ── page chrome ──────────────────────────────────────────────────────────────

test('the text-size controls are on every page', { skip }, () => {
  for (const attribute of ['data-font-scale-step="up"', 'data-font-scale-step="down"']) {
    assert.ok(html().includes(attribute), `missing ${attribute}`);
  }
});

// The steps are declared in CSS so the attribute a browser carries and the size it
// renders cannot disagree — JS only names the step.
test('the reading-scale steps live in CSS', { skip }, () => {
  const css = stylesheet();

  for (const step of ['xs', 's', 'l', 'xl']) {
    assert.ok(css.includes(`data-font-scale=${step}`), `no rule for the ${step} step`);
  }

  // Carried by the reading text and the paragraph expansions only: the inline and
  // sentence wrappers sit inside a scaled paragraph, so they inherit it. Neither
  // selector carries a scope attribute — both live in global partials — so these
  // patterns must not demand one.
  assert.match(css, /article p\{[^}]*var\(--reading-scale\)/);
  assert.match(css, /\.expansion-paragraph\{[^}]*var\(--reading-scale\)/);
});

test('the mobile contents strip is black, fixed, and sized by the one token', { skip }, () => {
  const css = stylesheet();

  assert.match(css, /--toc-bar:3rem/);
  // Only the stacked rule carries these, so each matches the strip rather than the
  // desktop `display: none` above it.
  assert.match(css, /\.toc-disclosure[^{]*\{[^}]*background:#000/);
  assert.match(css, /\.toc-disclosure[^{]*\{[^}]*position:fixed/);

  // One value with three users: the strip's height, the controls' offset below it,
  // and the cover's box.
  const users = (css.match(/var\(--toc-bar\)/g) ?? []).length;
  assert.ok(users >= 3, `--toc-bar is used by ${users} rules, expected at least 3`);
});

// The overlay was styled in two places — here and in CoverZoom.astro — where the
// component won on specificity and the global rule quietly filled any property it did
// not set. One owner, so there is nothing to reconcile.
test('the cover overlay is styled in one place, with the values that work', { skip }, () => {
  const css = stylesheet();
  const component = readFileSync(resolve(process.cwd(), 'src/components/CoverZoom.astro'), 'utf8');

  // Global now, so these selectors carry no scope attribute.
  assert.match(css, /\.cover-zoom\{[^}]*position:fixed/);
  assert.match(css, /\.cover-zoom\.is-visible\{/);

  // The three values deliberately kept from the component rather than the legacy
  // block: 1000 would sit under the toggles, and a hardcoded white would make a white
  // sheet in dark mode. `#fadeTarget` exists nowhere, so it could never show at all.
  assert.match(css, /\.cover-zoom\{[^}]*z-index:1200/);
  assert.match(css, /\.cover-zoom\{[^}]*background-color:var\(--cover-overlay\)/);

  assert.ok(!component.includes('lang="scss"'), 'CoverZoom.astro still carries a style block');
});

test('the toggle is two thirds scale on a stacked layout, and the font buttons match the nav button', { skip }, () => {
  const css = stylesheet();

  assert.match(css, /transform:scale\(\.667\)/);
  assert.match(css, /\.font-size-button\[[^\]]*\]\{[^}]*width:34px;height:34px/);
});

// A drop image is narrower than the reading column, so with no rules the frame
// stretches to the column and strands the picture at its left edge, and below the
// picture's own width the picture overflows the column entirely.
test('drop images are capped, and their frame hugs them', { skip }, () => {
  const css = stylesheet();

  assert.ok(/figure img\{/.test(css), 'no rule constrains an image inside a figure');
  assert.match(css, /figure img\{[^}]*max-width/, 'drop images are not capped to their container');
  assert.match(css, /:has\(> ?figure\)/, 'the frame is not sized to its contents');
});
