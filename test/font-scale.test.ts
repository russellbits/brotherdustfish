import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FONT_SCALE_STEP,
  FONT_SCALE_STEPS,
  isAtLimit,
  isFontScaleStep,
  nextFontScale,
} from '../src/lib/font-scale.ts';

test('steps up and down from the default', () => {
  assert.equal(nextFontScale(null, 'up'), 'l');
  assert.equal(nextFontScale(null, 'down'), 's');
});

test('clamps at both ends rather than running off them', () => {
  assert.equal(nextFontScale('xl', 'up'), 'xl');
  assert.equal(nextFontScale('xs', 'down'), 'xs');
});

// localStorage survives across deploys and a reader's own edits, so a value that is
// no longer a step must not break the control — it falls back to the default.
test('an unknown stored value falls back to the default', () => {
  assert.equal(nextFontScale('enormous', 'up'), 'l');
  assert.equal(nextFontScale(undefined, 'down'), 's');
  assert.equal(nextFontScale('', 'up'), 'l');
});

test('the limits are reported so the buttons can disable themselves', () => {
  assert.equal(isAtLimit('xl', 'up'), true);
  assert.equal(isAtLimit('xs', 'down'), true);
  assert.equal(isAtLimit('m', 'up'), false);
  assert.equal(isAtLimit('m', 'down'), false);
  assert.equal(isAtLimit('xl', 'down'), false);
});

test('only the declared steps are accepted', () => {
  assert.deepEqual([...FONT_SCALE_STEPS], ['xs', 's', 'm', 'l', 'xl']);
  assert.equal(DEFAULT_FONT_SCALE_STEP, 'm');

  assert.equal(isFontScaleStep('m'), true);
  assert.equal(isFontScaleStep('xl'), true);
  assert.equal(isFontScaleStep('90%'), false);
  assert.equal(isFontScaleStep(null), false);
});
