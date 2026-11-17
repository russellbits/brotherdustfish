import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChapterAnchors, type AnchorContext, type AnchorNode } from '../src/plugins/chapter-anchors.ts';

// Sätteri's real context applies mutations through a command buffer onto an
// arena-backed tree handle. This fake applies the same three operations directly
// to a plain tree, so the logic is testable without the engine. The node shapes
// mirror satteri's MdxJsxTextElementHast: `name` plus `attributes`, each with a
// string `value`.

const text = (value: string): AnchorNode => ({ type: 'text', value });

const sentence = (n: string): AnchorNode => ({
  type: 'mdxJsxTextElement',
  name: 'Sentence',
  attributes: [{ type: 'mdxJsxAttribute', name: 'n', value: n }],
  children: [],
});

const jsx = (name: string, attributes: AnchorNode['attributes'] = []): AnchorNode => ({
  type: 'mdxJsxTextElement',
  name,
  attributes,
  children: [],
});

const paragraph = (...children: AnchorNode[]): AnchorNode => ({
  type: 'element',
  tagName: 'p',
  properties: {},
  children,
});

const element = (tagName: string, ...children: AnchorNode[]): AnchorNode => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

const root = (...children: AnchorNode[]): AnchorNode => ({ type: 'root', children });

function createContext(rootNode: AnchorNode): AnchorContext {
  const replaceIn = (parent: AnchorNode, target: AnchorNode, next: AnchorNode): boolean => {
    const children = parent.children ?? [];
    const at = children.indexOf(target);

    if (at !== -1) {
      children[at] = next;
      return true;
    }

    return children.some((child) => replaceIn(child, target, next));
  };

  return {
    setProperty(node, key, value) {
      node.properties = { ...(node.properties ?? {}), [key]: value };
    },
    prependChild(node, child) {
      node.children = [child, ...(node.children ?? [])];
    },
    replaceNode(node, next) {
      replaceIn(rootNode, node, next);
    },
  };
}

const anchorsIn = (node: AnchorNode): AnchorNode[] =>
  (node.children ?? []).filter((child) => child.tagName === 'a');

const idsOf = (node: AnchorNode): unknown[] => anchorsIn(node).map((a) => a.properties?.id);

test('each top-level paragraph is numbered and gets a sentence-1 anchor', () => {
  const tree = root(paragraph(text('one')), paragraph(text('two')));
  addChapterAnchors(tree, createContext(tree));

  const [first, second] = tree.children ?? [];

  assert.equal(first.properties?.id, 'p1');
  assert.equal(second.properties?.id, 'p2');

  const anchor = anchorsIn(first)[0];
  assert.equal(anchor.tagName, 'a');
  assert.deepEqual(anchor.properties, { id: 'p1s1', className: ['s'] });
  assert.deepEqual(anchor.children, []);
  assert.equal((first.children ?? [])[1].value, 'one', 'the anchor is prepended, not appended');

  assert.deepEqual(idsOf(second), ['p2s1']);
});

test('only top-level paragraphs are numbered', () => {
  const quoted = paragraph(text('quoted'));
  const tree = root(element('blockquote', quoted), paragraph(text('prose')));
  addChapterAnchors(tree, createContext(tree));

  assert.equal(quoted.properties?.id, undefined);
  assert.equal(tree.children?.[1].properties?.id, 'p1', 'the real paragraph is still the first');
});

test('a heading does not consume a paragraph number', () => {
  const tree = root(paragraph(text('one')), element('h2', text('head')), paragraph(text('two')));
  addChapterAnchors(tree, createContext(tree));

  assert.equal(tree.children?.[0].properties?.id, 'p1');
  assert.equal(tree.children?.[2].properties?.id, 'p2');
});

test('an explicit Sentence marker becomes an anchor for that sentence and is consumed', () => {
  const tree = root(paragraph(text('a '), sentence('3'), text(' b')));
  addChapterAnchors(tree, createContext(tree));

  const paragraphNode = tree.children?.[0] ?? { type: 'root' };
  assert.deepEqual(idsOf(paragraphNode).sort(), ['p1s1', 'p1s3']);
  assert.ok(!JSON.stringify(tree).includes('mdxJsxTextElement'), 'the JSX node is gone');
});

test('an explicit Sentence n="1" suppresses the automatic anchor, so no id is duplicated', () => {
  const tree = root(paragraph(sentence('1'), text('one')));
  addChapterAnchors(tree, createContext(tree));

  const paragraphNode = tree.children?.[0] ?? { type: 'root' };
  assert.deepEqual(idsOf(paragraphNode), ['p1s1']);
});

test('other JSX in a paragraph is left alone', () => {
  const drop = jsx('Drop', [{ type: 'mdxJsxAttribute', name: 'slug', value: 'p1s1l1' }]);
  const tree = root(paragraph(text('a '), drop, text(' b')));
  addChapterAnchors(tree, createContext(tree));

  assert.ok(JSON.stringify(tree).includes('"name":"Drop"'));
});

test('two markers for the same sentence in one paragraph is a build error naming the paragraph', () => {
  const tree = root(paragraph(sentence('2'), sentence('2')));
  assert.throws(() => addChapterAnchors(tree, createContext(tree)), /paragraph 1/);
});

test('a Sentence marker without a usable n is a build error', () => {
  const tree = root(paragraph(jsx('Sentence')));
  assert.throws(() => addChapterAnchors(tree, createContext(tree)), /Sentence/);
});
