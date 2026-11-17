// Which drops a chapter asks for.
//
// This exists because of a verified Astro build-order fact: every route's
// `getStaticPaths` is collected before any page renders
// (`astro/dist/core/build/generate.js`), so a set filled in by the <Drop>
// component while chapters render is still empty when the fragment route asks
// for it. The referenced set therefore has to come from the chapter *sources*,
// which are available without rendering anything.
//
// It reads chapter bodies rather than calling getCollection itself, so it stays
// pure and unit-testable; the loader retains `body` by default.

export interface ChapterSource {
    id: string;
    body?: string;
}

/**
 * A `<Drop>` tag with a `slug`, in any attribute order, on one line or several,
 * single- or double-quoted. Attribute values are assumed not to contain `>`,
 * which holds for slugs.
 */
const DROP_TAG = /<Drop\b[^>]*?\bslug\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*?\/?>/g;

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const FENCED_BLOCK = /^([ \t]*)(`{3,}|~{3,})[\s\S]*?^[ \t]*\2[ \t]*$/gm;

/**
 * Remove the parts of a chapter that document rather than use a drop.
 *
 * Without this, the authoring notes in `_template.md` — and any chapter that
 * explains the syntax in a code sample — would be read as a request for a drop
 * that does not exist, and the build would report a phantom gap.
 */
function stripDocumentation(markdown: string): string {
    return markdown.replace(HTML_COMMENT, '').replace(FENCED_BLOCK, '');
}

/**
 * The ids of every drop the chapters reference, namespaced as
 * `<chapterId>/<slug>`.
 *
 * A pattern match over MDX is the weak point of this approach, so it is closed
 * in the direction that matters by the `<Drop>` component, which asserts at
 * render time that its own id is in this set. A miss therefore becomes a build
 * error rather than a silently absent placeholder.
 */
export function scanDropReferences(chapters: ChapterSource[]): Set<string> {
    const found = new Set<string>();

    for (const chapter of chapters) {
        if (typeof chapter.body !== 'string') continue;

        for (const match of stripDocumentation(chapter.body).matchAll(DROP_TAG)) {
            const slug = match[1] ?? match[2];
            if (slug) found.add(`${chapter.id}/${slug}`);
        }
    }

    return found;
}
