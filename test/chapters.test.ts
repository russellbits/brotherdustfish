import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterHref, isHomeChapter, type Chapter } from '../src/lib/chapters.ts';

// Only `id` and `data.number` are read by the URL helpers; the rest of the entry
// (body, rendered content, file path) is not, so a partial cast keeps the test
// focused on the rule rather than on the shape of a collection entry.
const chapter = (id: string, number: number): Chapter =>
  ({ id, data: { number, title: id, summary: '' } }) as unknown as Chapter;

test('chapterHref sends the opening chapter to the site root', () => {
  assert.equal(chapterHref(chapter('01-meet-able', 1)), '/');
});

test('chapterHref keeps later chapters under their own route', () => {
  assert.equal(chapterHref(chapter('02-able-is-exiled', 2)), '/chapter/02/able-is-exiled');
});

test('isHomeChapter is true only for the opening chapter', () => {
  assert.equal(isHomeChapter(chapter('01-meet-able', 1)), true);
  assert.equal(isHomeChapter(chapter('02-able-is-exiled', 2)), false);
});
