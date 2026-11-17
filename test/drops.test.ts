import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropName, parseDropSlug, expansionDomId, dropHref } from '../src/lib/drops.ts';

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
  assert.equal(dropHref('01-meet-able', 'p1s1l1'), '/drops/01-meet-able/p1s1l1/');
});
