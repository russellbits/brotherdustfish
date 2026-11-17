import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropsSchema } from '../src/lib/drop-schema.ts';

// The schema lives in its own module rather than inline in content.config.ts
// because that file imports the `astro:content` virtual module, which a plain
// Node test cannot import.

test('a well-formed drop data object parses', () => {
  assert.deepEqual(dropsSchema.parse({ mode: 'sentence', term: 'Skybow' }), {
    mode: 'sentence',
    term: 'Skybow',
  });
});

test('every mode in the design is accepted', () => {
  for (const mode of ['inline', 'sentence', 'paragraph'] as const) {
    assert.equal(dropsSchema.parse({ mode, term: 'x' }).mode, mode);
  }
});

// D1: the PHP renderer silently defaulted `mode` to inline, which is how a typo
// produces a paragraph rendering as an inline gloss and nobody notices until
// reading. A strict schema is the whole point of the upgrade.
test('a misspelled mode fails rather than defaulting', () => {
  assert.throws(() => dropsSchema.parse({ mode: 'paragrah', term: 'Skybow' }));
});

test('an omitted mode fails — there is no silent default', () => {
  assert.throws(() => dropsSchema.parse({ term: 'Skybow' }));
});

test('an empty term fails', () => {
  assert.throws(() => dropsSchema.parse({ mode: 'inline', term: '' }));
});

// D2: coordinates come from the filename, so front matter carrying them is at
// best noise and at worst a second source of truth that drifts from the name.
test('coordinates are not front matter', () => {
  const parsed = dropsSchema.parse({ mode: 'inline', term: 'x', para: 1, sent: 2, link: 3 });
  assert.deepEqual(parsed, { mode: 'inline', term: 'x' });
});
