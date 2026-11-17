import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropName, parseDropSlug, expansionDomId, dropHref, normaliseTerm } from '../src/lib/drops.ts';

test('parseDropSlug reads coordinates out of the filename', () => {
  assert.deepEqual(parseDropSlug('p1s2l3'), { para: 1, sent: 2, link: 3 });
});

test('parseDropSlug rejects a mnemonic and a near miss', () => {
  assert.equal(parseDropSlug('skybow'), null);
  assert.equal(parseDropSlug('p1s2'), null);
  assert.equal(parseDropSlug('p1s2l3x'), null);
});

test('dropName strips the chapter namespace', () => {
  assert.equal(dropName('01-meet-able/p1s1l1'), 'p1s1l1');
});

test('expansionDomId never contains a slash', () => {
  assert.equal(expansionDomId('p1s1l1'), 'p1s1l1-exp');
  assert.ok(!expansionDomId(dropName('01-meet-able/p1s1l1')).includes('/'));
});

test('dropHref is the route shape', () => {
  assert.equal(dropHref('01-meet-able', 'p1s1l1'), '/drops/01-meet-able/p1s1l1.html');
});

// A <Drop>'s children are compared against the drop's `term`, but the children
// have been through the Markdown pipeline while `term` is raw YAML text. Sätteri's
// smartPunctuation is on by default in Astro, so a straight apostrophe in `term`
// comes back as a curly one from the rendered children, and an ampersand comes
// back as an entity — either of which would fail the build over an invisible
// difference. Found by review: the build refused `Delphine's scar`.
test('normaliseTerm makes smart punctuation and entities comparable', () => {
  assert.equal(normaliseTerm('Delphine\u2019s scar'), normaliseTerm("Delphine's scar"));
  assert.equal(normaliseTerm('\u201Cquoted\u201D'), normaliseTerm('"quoted"'));
  assert.equal(normaliseTerm('Salt &amp; pepper'), normaliseTerm('Salt & pepper'));
  assert.equal(normaliseTerm('a&nbsp;b'), normaliseTerm('a b'));
  assert.equal(normaliseTerm('  Skybow  '), 'Skybow');
});

// Normalising must not blunt the guard it exists to serve.
test('normaliseTerm still distinguishes genuinely different terms', () => {
  assert.notEqual(normaliseTerm('Skybow'), normaliseTerm('Skybows'));
  assert.notEqual(normaliseTerm('the ring'), normaliseTerm('the rung'));
});
