// Chapter anchors: paragraph ids, sentence-1 anchors, and <Sentence> markers.
//
// Registered once as a Sätteri `before` hook, which runs per document before the
// plugin's visitors walk — so the mutations here land before MDX compiles the
// tree to JSX. That ordering is what lets `<Sentence n="3" />` be rewritten into
// a plain anchor element: by codegen time there is no JSX node left, so nothing
// has to be provided to MDX's `components` and the author writes no import.
//
// Spec §16 records what to do if that ordering ever stops holding.
//
// The node and context types here are structural rather than imported from
// `satteri`, so this module needs no dependency on the engine itself and its
// logic can be unit-tested against a plain tree.

export interface AnchorAttribute {
    type: string;
    name: string;
    value?: unknown;
}

export interface AnchorNode {
    type: string;
    tagName?: string;
    name?: string | null;
    attributes?: AnchorAttribute[];
    properties?: Record<string, unknown>;
    children?: AnchorNode[];
    value?: string;
}

export interface AnchorContext {
    setProperty(node: AnchorNode, key: string, value: unknown): void;
    prependChild(node: AnchorNode, child: AnchorNode): void;
    replaceNode(node: AnchorNode, next: AnchorNode): void;
}

function anchorElement(paragraph: number, sentence: number): AnchorNode {
    return {
        type: 'element',
        tagName: 'a',
        properties: { id: `p${paragraph}s${sentence}`, className: ['s'] },
        children: [],
    };
}

/** The sentence number a `<Sentence n="…" />` asks for, or null if this is not one. */
function sentenceNumber(node: AnchorNode): number | null {
    if (node.type !== 'mdxJsxTextElement' || node.name !== 'Sentence') return null;

    const attribute = (node.attributes ?? []).find(
        (candidate) => candidate.type === 'mdxJsxAttribute' && candidate.name === 'n',
    );
    const raw = typeof attribute?.value === 'string' ? attribute.value : '';
    const sentence = Number(raw);

    if (!Number.isInteger(sentence) || sentence < 1) {
        throw new Error(
            `<Sentence> needs a positive whole number, e.g. <Sentence n="2" /> (got "${raw}")`,
        );
    }

    return sentence;
}

function visit(node: AnchorNode, each: (node: AnchorNode) => void): void {
    each(node);
    for (const child of node.children ?? []) visit(child, each);
}

/**
 * Number the chapter's top-level paragraphs, give each a sentence-1 anchor, and
 * turn every `<Sentence n="N" />` into an anchor for sentence N of its paragraph.
 *
 * Only top-level paragraphs are numbered, and only they decide the numbering:
 * the coordinates an author writes in a drop's filename are counts of the chapter
 * body's prose paragraphs, so a paragraph inside a blockquote must not shift them.
 */
export function addChapterAnchors(root: AnchorNode, ctx: AnchorContext): void {
    let paragraph = 0;

    for (const child of root.children ?? []) {
        if (child.type !== 'element' || child.tagName !== 'p') continue;

        paragraph += 1;

        // Collect before mutating: replacing nodes while walking the same child
        // list would skip a sibling.
        const markers: { node: AnchorNode; sentence: number }[] = [];
        const explicit = new Set<number>();

        visit(child, (node) => {
            const sentence = sentenceNumber(node);
            if (sentence === null) return;

            if (explicit.has(sentence)) {
                throw new Error(
                    `two <Sentence n="${sentence}" /> markers in paragraph ${paragraph}`,
                );
            }

            explicit.add(sentence);
            markers.push({ node, sentence });
        });

        for (const marker of markers) {
            ctx.replaceNode(marker.node, anchorElement(paragraph, marker.sentence));
        }

        ctx.setProperty(child, 'id', `p${paragraph}`);

        // An explicit marker for sentence 1 wins, so the id is never duplicated
        // and the author is not scolded for stating the obvious.
        if (!explicit.has(1)) {
            ctx.prependChild(child, anchorElement(paragraph, 1));
        }
    }
}

/**
 * The Sätteri plugin.
 *
 * `before` is cast because Sätteri's own context type is an arena-backed handle
 * that shares the shape declared above; the cast is confined to this one adapter
 * boundary, and everything behind it is typed.
 */
export function chapterAnchors() {
    return {
        name: 'chapter-anchors',
        before: ((root: AnchorNode, ctx: AnchorContext) =>
            addChapterAnchors(root, ctx)) as (...args: any[]) => void,
    };
}
