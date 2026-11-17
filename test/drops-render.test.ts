import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDropBody } from '../src/lib/drops.ts';

const render = (body: string) => renderDropBody({ id: '01-meet-able/p1s1l1', body });

test('a script element is removed with its contents', async () => {
  const out = await render('<script>alert(1)</script>');
  assert.ok(!out.includes('script'));
  assert.ok(!out.includes('alert(1)'));
});

test('a javascript: link keeps its label and loses its href', async () => {
  const out = await render('[click](javascript:alert(1))');
  assert.ok(out.includes('click'));
  assert.ok(!out.includes('href'));
});

test('data: and blob: links keep their label and lose their href', async () => {
  for (const href of ['data:text/html,x', 'blob:x']) {
    const out = await render(`[c](${href})`);
    assert.ok(out.includes('c'), href);
    assert.ok(!out.includes('href'), href);
  }
});

test('an iframe is removed', async () => {
  const out = await render('<iframe src="x"></iframe>');
  assert.ok(!out.includes('iframe'));
});

test('an event handler attribute is dropped but the href survives', async () => {
  const out = await render('<a href="#" onclick="x()">q</a>');
  assert.ok(out.includes('href="#"'));
  assert.ok(!out.includes('onclick'));
});

test('the sanctioned data-tooltip span survives intact', async () => {
  const out = await render('<span data-tooltip="t">w</span>');
  assert.ok(out.includes('<span data-tooltip="t">w</span>'));
});

test('a drop cannot mint an id or name that collides with the document', async () => {
  const out = await render('<a id="p1" name="p1">z</a>');
  assert.ok(!out.includes('id='));
  assert.ok(!out.includes('name='));
});

test('a figure with an image survives', async () => {
  const out = await render(
    '<figure><img src="/images/a.png" alt="a"><figcaption>c</figcaption></figure>',
  );
  assert.ok(out.includes('<figure>'));
  assert.ok(out.includes('<img src="/images/a.png" alt="a">'));
  assert.ok(out.includes('<figcaption>c</figcaption>'));
});

test('markdown that looks like a link inside a code span stays text', async () => {
  const out = await render('`[x](javascript:1)`');
  assert.ok(out.includes('<code>'));
  assert.ok(!out.includes('<a'));
});

test('a body with nothing but whitespace is refused, naming the entry', async () => {
  await assert.rejects(() => render('   \n\t\n  '), /01-meet-able\/p1s1l1/);
});
