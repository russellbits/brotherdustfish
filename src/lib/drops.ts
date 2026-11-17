// Addressing for a drop. The filename is the address and the coordinates: a drop
// living at `drops/p1s1l1.md` inside chapter `01-meet-able` has the id
// `01-meet-able/p1s1l1` and is served at `/drops/01-meet-able/p1s1l1/`.
//
// Rendering for a drop. Drops are converted by a pipeline this project owns
// rather than by Astro's global Markdown processor, for two reasons: a fragment
// route needs a string rather than a component tree, and sanitization must apply
// to drops ONLY — a global rehype-sanitize would strip the chapter's own MDX
// components and raw HTML out of chapter.mdx.
//
// This module is imported by plain-Node tests as well as by the Astro build, so
// it must not import `astro:content` or any other virtual module.

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

/** The bit of a content entry this module needs. Structural, so tests need no Astro types. */
export interface DropEntry {
    id: string;
    body?: string;
}

const DROP_SLUG = /^p(\d+)s(\d+)l(\d+)$/;

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
 *
 * `import.meta.env` is a Vite global; it is absent in plain Node, where this
 * module is imported by tests, so it is read defensively rather than assumed.
 */
export function dropHref(chapterId: string, slug: string): string {
    const base = import.meta.env?.BASE_URL ?? '/';
    const prefix = base.endsWith('/') ? base.slice(0, -1) : base;

    return `${prefix}/drops/${chapterId}/${slug}/`;
}

/**
 * What a drop may contain.
 *
 * Ported from `lib/markdown.php`'s allow-list policy rather than opened up.
 * Three details are load-bearing and were each verified against the installed
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
 *    anchors that collide with the host document. The inherited `clobber` list
 *    is a second, independent guard.
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

/**
 * `rehype-raw` is not optional here. hast-util-sanitize returns `undefined` for
 * any node type it does not recognise, and `raw` is one of them — so without a
 * pass that turns raw HTML into real elements, every raw node is dropped before
 * the allow-list is ever consulted, including the sanctioned tooltip span.
 */
const dropPipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, DROP_SCHEMA)
    .use(rehypeStringify);

/**
 * Render a drop's raw Markdown to sanitized HTML.
 *
 * Reads `entry.body`, which is the uncompiled Markdown the glob loader retains
 * by default. An absent body is a named failure rather than an empty fragment,
 * because a `retainBody` regression should be loud.
 */
export async function renderDropBody(entry: DropEntry): Promise<string> {
    if (typeof entry.body !== 'string') {
        throw new Error(`drop "${entry.id}" has no raw body — is retainBody disabled?`);
    }

    if (entry.body.trim() === '') {
        throw new Error(`drop "${entry.id}" has an empty body`);
    }

    return String(await dropPipeline.process(entry.body)).trim();
}
