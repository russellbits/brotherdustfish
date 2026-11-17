// Addressing and rendering for a drop.
//
// The filename is the address and the coordinates: a drop living at
// `drops/p1s1l1.md` inside chapter `01-meet-able` has the id
// `01-meet-able/p1s1l1` and is served at `/drops/01-meet-able/p1s1l1/`.
//
// Drops are converted by a pipeline this project owns rather than by Astro's
// global Markdown processor, for two reasons: a fragment route needs a string
// rather than a component tree, and sanitization must apply to drops ONLY — a
// global rehype-sanitize would strip the chapter's own MDX components and raw
// HTML out of chapter.mdx.
//
// This module is imported by plain-Node tests as well as by the Astro build, so
// it must not import `astro:content` or any other virtual module.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

/** The coordinates a drop's filename carries: paragraph, sentence, link index. */
export interface DropCoords {
    para: number;
    sent: number;
    link: number;
}

export type DropMode = 'inline' | 'sentence' | 'paragraph';

export type DropReveal = 'fade' | 'word';

/** The bit of a content entry this module needs. Structural, so tests need no Astro types. */
export interface DropEntry {
    id: string;
    body?: string;
}

/**
 * A body shaped for its mode, plus the one structural fact the wrapper cannot
 * work out for itself.
 *
 * `paragraphInner` is why this is an object rather than a bare string: paragraph
 * mode chooses between `<p>` and `<div>`, and recovering that fact from
 * serialized HTML would mean matching `<p>` with a regular expression — which is
 * exactly what mangles a `<p>` that legitimately sits inside a `<pre>`.
 */
export interface DropBody {
    /** The body HTML, flattened when the mode calls for flat output. */
    html: string;
    /** Inner HTML of the single top-level paragraph, or null when there is not exactly one. */
    paragraphInner: string | null;
}

/** Just enough of hast to work on the tree without depending on @types/hast. */
interface HastNode {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    value?: string;
}

const DROP_SLUG = /^p(\d+)s(\d+)l(\d+)$/;
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const SITE_BASE = import.meta.env?.BASE_URL ?? '/';
const BASE_PREFIX = SITE_BASE.endsWith('/') ? SITE_BASE.slice(0, -1) : SITE_BASE;

/**
 * Where drop images live. Resolved from the working directory, which is the
 * project root for `astro build`, `astro dev` and `npm test` alike — the module
 * cannot know Astro's configured root, and `import.meta.url` would resolve into
 * the build's chunk directory instead.
 */
const PUBLIC_DIR = resolve(process.cwd(), 'public');

// ── addressing ───────────────────────────────────────────────────────────────

/**
 * The bare name of a drop, with the chapter namespace stripped:
 * `01-meet-able/p1s1l1` -> `p1s1l1`.
 *
 * The namespace belongs in the drop id and the URL. It must never reach a DOM
 * id, because a `/` in an `id` breaks every `#selector` that `hx-target` and
 * `getElementById` depend on.
 */
export function dropName(dropId: string): string {
    return dropId.split('/').pop() ?? dropId;
}

/** Read a drop's coordinates out of its filename, or null when the name is unusable. */
export function parseDropSlug(slug: string): DropCoords | null {
    const match = DROP_SLUG.exec(slug);
    if (!match) return null;

    return {
        para: Number(match[1]),
        sent: Number(match[2]),
        link: Number(match[3]),
    };
}

/** The id of the inserted expansion: `p1s1l1` -> `p1s1l1-exp`. */
export function expansionDomId(name: string): string {
    return `${name}-exp`;
}

/**
 * Where a drop's fragment lives. This is the single place the site base is read,
 * so the link component and the route cannot drift apart when the site is
 * deployed under a subpath.
 */
export function dropHref(chapterId: string, slug: string): string {
    // Ends in `.html` because the fragment route is an endpoint, and an endpoint
    // emitting `index.html` needs a page route — which Astro prepends a doctype
    // to, so it cannot emit a bare fragment. A real .html file is also the only
    // form every static host will serve as text/html; an extensionless file gets
    // guessed at, and a bare path with a trailing slash is not produced at all.
    return `${BASE_PREFIX}/drops/${chapterId}/${slug}.html`;
}

/**
 * What `hx-target` points at, per mode.
 *
 * `inline` swaps after the link itself, `sentence` after the sentence anchor, and
 * `paragraph` after the whole paragraph. `hx-swap` is `afterend` in all three.
 */
export function expansionTarget(mode: DropMode, coords: DropCoords): string {
    switch (mode) {
        case 'sentence':
            return `#p${coords.para}s${coords.sent}`;
        case 'paragraph':
            return `#p${coords.para}`;
        default:
            return `#p${coords.para}s${coords.sent}l${coords.link}`;
    }
}

/**
 * Whether a rendered body should fade in rather than run the word-by-word
 * reveal. The decision is made here, at build time, and travels to the client as
 * `data-drop-reveal`: the server already knows the content, so the browser
 * should not have to re-derive it.
 */
export function revealFor(html: string): DropReveal {
    return /<img[\s/>]/i.test(html) ? 'fade' : 'word';
}

/**
 * What a drop may contain.
 *
 * Ported from `lib/markdown.php`'s allow-list policy rather than opened up. Three
 * details are load-bearing and were each verified against the installed
 * hast-util-sanitize, because getting any of them wrong fails silently:
 *
 * 1. `attributes` are matched by HAST PROPERTY NAME, not by HTML attribute name.
 *    `className`, not `class`; and `data*` is the wildcard that lets
 *    `data-tooltip` through. A `class`/`data-tooltip` list matches nothing, so
 *    every class and the sanctioned tooltip would vanish.
 * 2. `protocols` is deliberately OMITTED. It is keyed by property name, not tag
 *    name, so a tag-keyed table replaces the defaults with unusable keys — and
 *    `safeProtocol` then short-circuits on "no protocols defined" and permits
 *    everything, including `javascript:`. The defaults already block
 *    `javascript:`, `data:` and `blob:` while allowing relative URLs.
 * 3. `id` and `name` are absent from the allow-list, so a drop cannot mint
 *    anchors that collide with the host document. The inherited `clobber` list is
 *    a second, independent guard.
 */
export const DROP_SCHEMA: Options = {
    ...defaultSchema,
    tagNames: [
        'a',
        'abbr',
        'b',
        'br',
        'cite',
        'code',
        'dfn',
        'em',
        'i',
        'kbd',
        'mark',
        'q',
        's',
        'samp',
        'small',
        'span',
        'strong',
        'sub',
        'sup',
        'time',
        'u',
        'var',
        'wbr',
        'p',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'h2',
        'h3',
        'h4',
        'hr',
        'img',
        'figure',
        'figcaption',
    ],
    attributes: {
        '*': ['className', 'title'],
        a: ['href', 'rel'],
        time: ['datetime'],
        span: ['data*'],
        img: ['src', 'alt', 'width', 'height', 'loading'],
    },
};

// ── tree helpers ─────────────────────────────────────────────────────────────

function walk(node: HastNode, visit: (node: HastNode) => void): void {
    visit(node);
    for (const child of node.children ?? []) walk(child, visit);
}

function isElement(node: HastNode, tagName: string): boolean {
    return node.type === 'element' && node.tagName === tagName;
}

function isWhitespaceText(node: HastNode): boolean {
    return node.type === 'text' && (node.value ?? '').trim() === '';
}

/**
 * Images must be root-absolute, and the file must exist.
 *
 * A relative `src` is refused rather than resolved: a drop's HTML is inserted
 * into the CHAPTER page, so `images/x.png` would resolve against
 * `/chapter/01/meet-able/` rather than against the drop's own URL — silently
 * wrong, with no error anywhere. Refusing it loudly is the whole point.
 *
 * Root-absolute sources are then prefixed with the site base, so a subpath
 * deployment still finds them.
 */
export function checkImages(root: HastNode): void {
    walk(root, (node) => {
        if (!isElement(node, 'img')) return;

        const properties = (node.properties ??= {});
        const src = properties.src;

        if (typeof src !== 'string' || src === '') {
            throw new Error('an image has no src');
        }

        // Remote and protocol-relative sources are the sanitizer's business.
        if (HAS_SCHEME.test(src) || src.startsWith('//')) return;

        if (!src.startsWith('/')) {
            throw new Error(
                `image src "${src}" must be root-absolute, e.g. "/images/${src.replace(/^\.?\//, '')}"`,
            );
        }

        if (!existsSync(join(PUBLIC_DIR, src))) {
            throw new Error(`no file at public${src}`);
        }

        properties.src = `${BASE_PREFIX}${src}`;
    });
}

/** A paragraph holding nothing but an image becomes a figure, its title becoming the caption. */
export function wrapLoneImages(root: HastNode): void {
    if (!root.children) return;

    root.children = root.children.map((child) => {
        if (!isElement(child, 'p')) return child;

        const meaningful = (child.children ?? []).filter((node) => !isWhitespaceText(node));
        if (meaningful.length !== 1 || !isElement(meaningful[0], 'img')) return child;

        const image = meaningful[0];
        const title = image.properties?.title;
        const caption: HastNode[] =
            typeof title === 'string' && title !== ''
                ? [
                      {
                          type: 'element',
                          tagName: 'figcaption',
                          properties: {},
                          children: [{ type: 'text', value: title }],
                      },
                  ]
                : [];

        return {
            type: 'element',
            tagName: 'figure',
            properties: {},
            children: [image, ...caption],
        };
    });
}

/**
 * `rehype-raw` is not optional here. hast-util-sanitize returns `undefined` for
 * any node type it does not recognise, and `raw` is one of them — so without a
 * pass that turns raw HTML into real elements, every raw node is dropped before
 * the allow-list is ever consulted, including the sanctioned tooltip span.
 *
 * The transformers are registered through factories deliberately: `unified`
 * calls a bare function with its options before treating the result as a
 * transformer, so passing `checkImages` directly would hand it the options
 * object where the tree belongs.
 */
const dropProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, DROP_SCHEMA)
    .use(() => checkImages as (root: HastNode) => void)
    .use(() => wrapLoneImages as (root: HastNode) => void);

/** Compiled without a parser, purely so a subtree can be serialized. */
const stringifier = unified().use(rehypeStringify);

function toHtmlChildren(node: HastNode): string {
    return String(stringifier.stringify({ type: 'root', children: node.children ?? [] } as never));
}

/**
 * Flatten a body for the flat modes. A nested `<p>` inside a `<span>` is invalid
 * markup, so a single paragraph collapses to its bare contents and several join
 * with `<br>`. A body that is anything other than paragraphs is returned
 * untouched, which is why this reads the tree: doing it to serialized HTML would
 * also flatten a `<p>` that belongs to a `<pre>`.
 */
function flatHtml(root: HastNode): string {
    // Markdown puts a newline text node between adjacent blocks, so the
    // paragraph-only test has to ignore whitespace — otherwise a two-paragraph
    // body looks like "not paragraphs only" and is handed back unflattened,
    // which would nest a <p> inside the wrapping <span>.
    const children = (root.children ?? []).filter((child) => !isWhitespaceText(child));
    const onlyParagraphs = children.length > 0 && children.every((child) => isElement(child, 'p'));

    if (!onlyParagraphs) return toHtmlChildren(root);

    return children.map((child) => toHtmlChildren(child)).join('<br>');
}

async function renderTree(entry: DropEntry): Promise<HastNode> {
    if (typeof entry.body !== 'string') {
        throw new Error(`drop "${entry.id}" has no raw body — is retainBody disabled?`);
    }

    if (entry.body.trim() === '') {
        throw new Error(`drop "${entry.id}" has an empty body`);
    }

    try {
        const parsed = dropProcessor.parse(entry.body);

        return (await dropProcessor.run(parsed)) as unknown as HastNode;
    } catch (error) {
        // Image problems are authoring problems, so name the drop they are in.
        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`drop "${entry.id}": ${message}`);
    }
}

// ── rendering ────────────────────────────────────────────────────────────────

/**
 * Render a drop's raw Markdown to sanitized HTML, unshaped.
 *
 * Reads `entry.body`, which is the uncompiled Markdown the glob loader retains
 * by default. An absent body is a named failure rather than an empty fragment,
 * because a `retainBody` regression should be loud.
 */
export async function renderDropBody(entry: DropEntry): Promise<string> {
    return (await renderDrop(entry, 'paragraph')).html.trim();
}

/** Render a drop shaped for the mode that asked for it. */
export async function renderDrop(entry: DropEntry, mode: DropMode): Promise<DropBody> {
    const root = await renderTree(entry);
    const children = root.children ?? [];
    const single = children.length === 1 && isElement(children[0], 'p');
    const flat = mode === 'inline' || mode === 'sentence';

    return {
        html: flat ? flatHtml(root) : toHtmlChildren(root),
        paragraphInner: single ? toHtmlChildren(children[0]) : null,
    };
}

/**
 * The single source of wrapper truth, shared by the fragment route and any
 * future on-demand route so the two cannot disagree.
 */
export function wrapFragment(
    dropId: string,
    mode: DropMode,
    body: DropBody,
    opts: { reveal: DropReveal },
): string {
    const id = expansionDomId(dropName(dropId));
    const reveal = opts.reveal === 'fade' ? ' data-drop-reveal="fade"' : '';

    switch (mode) {
        case 'sentence':
            return `<span id="${id}" class="expansion-sentence"${reveal}>${body.html}</span>`;

        case 'paragraph':
            return body.paragraphInner !== null
                ? `<p id="${id}" class="expansion-paragraph"${reveal}>${body.paragraphInner}</p>`
                : `<div id="${id}" class="expansion-paragraph"${reveal}>${body.html}</div>`;

        default:
            // The leading space is deliberate and is why this string is built
            // here rather than in a template, where compressHTML's whitespace
            // rules would eat it.
            return `<span id="${id}" class="expansion-inline"${reveal}> (${body.html})</span>`;
    }
}

/**
 * The visible gap left by a drop that has not been written yet, in the PHP
 * renderer's wording so the authoring signal is unchanged. It carries no id, so
 * it cannot collide with the anchor of the link that asked for it.
 */
export function missingFragment(dropId: string): string {
    return `<span class="expansion-inline expansion-missing">no drop at drops/${dropId}.md yet.</span>`;
}
