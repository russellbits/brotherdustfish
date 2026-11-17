import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expansionTarget,
  missingFragment,
  renderDrop,
  renderDropBody,
  revealFor,
  wrapFragment,
  type DropMode,
} from '../src/lib/drops.ts';

const ID = '01-meet-able/p1s1l1';
const entry = (body: string) => ({ id: ID, body });

const wrap = async (body: string, mode: DropMode, reveal: 'fade' | 'word' = 'word') =>
  wrapFragment(ID, mode, await renderDrop(entry(body), mode), { reveal });

// ── targets ──────────────────────────────────────────────────────────────────

test('expansionTarget points at the anchor each mode swaps after', () => {
  const coords = { para: 1, sent: 2, link: 3 };
  assert.equal(expansionTarget('inline', coords), '#p1s2l3');
  assert.equal(expansionTarget('sentence', coords), '#p1s2');
  assert.equal(expansionTarget('paragraph', coords), '#p1');
});

// ── reveal decision ──────────────────────────────────────────────────────────

test('revealFor picks fade only when the body carries an image', () => {
  assert.equal(revealFor('<p>x</p>'), 'word');
  assert.equal(revealFor('<figure><img src="/images/arrow.svg" alt="a"></figure>'), 'fade');
});

// ── the missing-drop placeholder ─────────────────────────────────────────────

test('a missing drop names the file to write, in the PHP wording', () => {
  const out = missingFragment('01-meet-able/p9s9l9');
  assert.ok(out.includes('no drop at drops/01-meet-able/p9s9l9.md yet.'));
  assert.ok(out.includes('expansion-inline'));
  assert.ok(out.includes('expansion-missing'));
});

test('a missing drop uses the bare name, never the namespaced id, in any DOM id', () => {
  assert.ok(!missingFragment('01-meet-able/p9s9l9').includes('id="01-meet-able'));
});

// ── wrappers per mode ────────────────────────────────────────────────────────

test('an inline drop is parenthesised with its leading space intact', async () => {
  assert.equal(
    await wrap('a gloss', 'inline'),
    '<span id="p1s1l1-exp" class="expansion-inline"> (a gloss)</span>',
  );
});

test('a sentence drop is a block-level aside span', async () => {
  assert.equal(
    await wrap('The Skybow is the ring.', 'sentence'),
    '<span id="p1s1l1-exp" class="expansion-sentence">The Skybow is the ring.</span>',
  );
});

test('a one-paragraph body keeps a <p> wrapper, with no nested <p>', async () => {
  assert.equal(
    await wrap('A single block.', 'paragraph'),
    '<p id="p1s1l1-exp" class="expansion-paragraph">A single block.</p>',
  );
});

test('a richer body uses a <div> so paragraphs never nest', async () => {
  const out = await wrap('One.\n\nTwo.', 'paragraph');
  assert.ok(out.startsWith('<div id="p1s1l1-exp" class="expansion-paragraph">'), out);
  assert.ok(out.includes('<p>One.</p>'), out);
  assert.ok(out.includes('<p>Two.</p>'), out);
  assert.ok(out.endsWith('</div>'), out);
});

test('a list body uses a <div> too', async () => {
  const out = await wrap('- one\n- two', 'paragraph');
  assert.ok(out.startsWith('<div id="p1s1l1-exp" class="expansion-paragraph">'), out);
  assert.ok(out.includes('<ul>'), out);
});

// ── flat rendering, which must not be done by regexing our own HTML ──────────

test('several paragraphs under a flat mode join with <br> and carry no <p>', async () => {
  const out = await wrap('One.\n\nTwo.', 'inline');
  assert.ok(out.includes('One.<br>Two.'), out);
  assert.ok(!out.includes('<p>'), out);
});

test('a block body under a flat mode is left as blocks rather than mangled', async () => {
  const out = await wrap('```\n<p>x</p>\n```', 'inline');
  assert.ok(out.includes('<pre>'), out);
  assert.ok(!out.includes('<br>'), out);
});

// ── images ───────────────────────────────────────────────────────────────────

test('a lone image becomes a figure, keeping the alt on the image', async () => {
  const out = await renderDropBody(entry('![the Skybow](/images/arrow.svg)'));
  assert.ok(out.includes('<figure>'), out);
  assert.ok(out.includes('<img src="/images/arrow.svg" alt="the Skybow">'), out);
  assert.ok(out.includes('</figure>'), out);
});

test('an image title becomes a figcaption', async () => {
  const out = await renderDropBody(entry('![alt text](/images/arrow.svg "the caption")'));
  assert.match(out, /<figcaption>the caption/, out);
});

// An image drop's only collapse affordance used to be the term itself, which on a
// 670px-tall figure means scrolling back up to find it. The control lives at the
// end of the caption instead, injected by the pipeline because that is where the
// tree still exists — wrapFragment only receives serialised HTML.
test('an image drop carries a collapse control at the end of its caption', async () => {
  const out = await renderDropBody(entry('![the Skybow](/images/arrow.svg "A caption")'));

  assert.match(out, /<figcaption>A caption<button[^>]*data-collapse/, out);
});

// A figure only gets a figcaption today when the image supplies a title, and the
// control needs somewhere to live regardless.
test('an image drop with no title still gets a caption to hold the control', async () => {
  const out = await renderDropBody(entry('![the Skybow](/images/arrow.svg)'));

  assert.match(out, /<figcaption><button[^>]*data-collapse/, out);
});

// Text drops keep the decorative marker they already had; only figures get a
// control, because only figures are tall enough to hide their own term.
test('a text drop gets no collapse control', async () => {
  const out = await renderDropBody(entry('A single paragraph body.'));

  assert.ok(!out.includes('data-collapse'), out);
});

test('a remote image src needs no local file', async () => {
  const out = await renderDropBody(entry('![a](https://example.com/x.png)'));
  assert.ok(out.includes('src="https://example.com/x.png"'), out);
});

// Review Focus 5 — a typo'd image path must be loud, not a broken image.
test('a root-absolute image src with no file under public/ is refused', async () => {
  await assert.rejects(
    () => renderDropBody(entry('![a](/images/definitely-not-here.png)')),
    /definitely-not-here\.png/,
  );
});

test('a relative image src is refused, because it would resolve against the chapter page', async () => {
  await assert.rejects(() => renderDropBody(entry('![a](images/arrow.svg)')), /root-absolute/);
});
