import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertedAfter, shouldFade } from '../src/scripts/drops-client.ts';

// The DOM behaviour itself is verified in the browser — there is no DOM
// implementation available to node:test here, and the spec fixes this test runner
// with no new dependencies. What is unit-tested is the logic that can be wrong
// quietly: which reveal a fragment asks for, and which element the fragment is.

test('shouldFade is true only for the build-time fade marker', () => {
  const withAttribute = (value: string | null) => ({ getAttribute: () => value });

  assert.equal(shouldFade(withAttribute('fade')), true);
  assert.equal(shouldFade(withAttribute('word')), false);
  assert.equal(shouldFade(withAttribute(null)), false);
});

test('insertedAfter finds the fragment HTMX put after the swap target', () => {
  const fragment = { id: 'p1s1l1-exp' };
  assert.equal(insertedAfter({ nextElementSibling: fragment }), fragment);
});

test('insertedAfter ignores a sibling that is not an expansion', () => {
  assert.equal(insertedAfter({ nextElementSibling: { id: 'ind-p1s1l1' } }), null);
  assert.equal(insertedAfter({ nextElementSibling: null }), null);
  assert.equal(insertedAfter({ nextElementSibling: undefined }), null);
});
