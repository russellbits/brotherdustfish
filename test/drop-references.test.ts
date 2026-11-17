import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanDropReferences } from '../src/lib/drop-references.ts';

const chapter = (id: string, body: string) => ({ id, body });

test('a single-line Drop tag is found and namespaced by its chapter', () => {
  const found = scanDropReferences([
    chapter('01-meet-able', 'a <Drop slug="p1s1l1">Skybow</Drop> b'),
  ]);
  assert.deepEqual([...found], ['01-meet-able/p1s1l1']);
});

test('a tag split across lines and a self-closing tag are both found', () => {
  const body = [
    '<Drop',
    '  slug="p1s1l1"',
    '>Skybow</Drop>',
    '',
    '<Drop slug="p2s1l1" />',
  ].join('\n');

  assert.deepEqual([...scanDropReferences([chapter('01-meet-able', body)])], [
    '01-meet-able/p1s1l1',
    '01-meet-able/p2s1l1',
  ]);
});

test('attribute order does not matter', () => {
  const found = scanDropReferences([
    chapter('01-meet-able', '<Drop term="x" slug="p1s1l1">t</Drop>'),
  ]);
  assert.deepEqual([...found], ['01-meet-able/p1s1l1']);
});

test('single-quoted slugs are found too', () => {
  const found = scanDropReferences([
    chapter('01-meet-able', "<Drop slug='p1s1l1'>t</Drop>"),
  ]);
  assert.deepEqual([...found], ['01-meet-able/p1s1l1']);
});

test('the same slug in two chapters yields two namespaced ids', () => {
  const found = scanDropReferences([
    chapter('01-meet-able', '<Drop slug="p1s1l1">a</Drop>'),
    chapter('02-able-is-exiled', '<Drop slug="p1s1l1">a</Drop>'),
  ]);
  assert.deepEqual([...found].sort(), ['01-meet-able/p1s1l1', '02-able-is-exiled/p1s1l1']);
});

// The scanner is a pattern match over MDX, so it has to know what is prose and
// what is a code sample. A documented tag in a fence is not a reference.
test('a slug inside a fenced code block is not a reference', () => {
  const body = 'How to write a drop:\n\n```mdx\n<Drop slug="p9s9l9">x</Drop>\n```\n';
  assert.deepEqual([...scanDropReferences([chapter('01-meet-able', body)])], []);
});

test('a slug inside an HTML comment is not a reference', () => {
  const body = '<!-- <Drop slug="p9s9l9">x</Drop> -->\nreal prose';
  assert.deepEqual([...scanDropReferences([chapter('01-meet-able', body)])], []);
});

test('a chapter with no drops contributes nothing', () => {
  assert.deepEqual([...scanDropReferences([chapter('03-wandering-in-the-desert', 'prose')])], []);
});

test('a chapter with no retained body contributes nothing rather than throwing', () => {
  assert.deepEqual([...scanDropReferences([{ id: '04-meet-ghendra' }])], []);
});

test('the same chapter scanned twice yields one id, not two', () => {
  const source = [chapter('01-meet-able', '<Drop slug="p1s1l1">a</Drop> <Drop slug="p1s1l1">b</Drop>')];
  assert.deepEqual([...scanDropReferences(source)], ['01-meet-able/p1s1l1']);
});
