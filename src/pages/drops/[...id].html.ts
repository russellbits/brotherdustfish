import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import {
    dropName,
    missingFragment,
    parseDropSlug,
    renderDrop,
    revealFor,
    wrapFragment,
} from '../../lib/drops';
import { scanDropReferences } from '../../lib/drop-references';

/**
 * Every drop that exists, plus every drop a chapter references.
 *
 * The second half is what keeps a missing drop *visible* rather than silent. In a
 * static build a referenced-but-unwritten drop still needs a prerendered URL, or
 * the link is a dead click instead of a gap naming the file to write.
 *
 * The referenced set cannot be collected while chapters render: Astro gathers
 * every route's getStaticPaths before rendering any page, so it comes from the
 * chapter sources instead.
 */
export const getStaticPaths: GetStaticPaths = async () => {
    const [drops, chapters] = await Promise.all([
        getCollection('drops'),
        getCollection('chapters'),
    ]);

    const referenced = scanDropReferences(chapters);
    const existing = new Set(drops.map((drop) => drop.id));

    // A drop file whose name is not coordinates can never be found by a link, so
    // it is unusable rather than merely unused. Refusing it here names every
    // offender in one message.
    const unusable = [...existing].filter((id) => parseDropSlug(dropName(id)) === null);

    if (unusable.length > 0) {
        throw new Error(
            `drops whose filenames are not p<para>s<sent>l<link>: ${unusable.join(', ')}`,
        );
    }

    // This runs exactly once per build, so the whole site is audited in one line
    // rather than warned about per page.
    const unwritten = [...referenced].filter((id) => !existing.has(id));

    if (unwritten.length > 0) {
        console.warn(`[drops] referenced but not written: ${unwritten.join(', ')}`);
    }

    return [...new Set([...existing, ...referenced])].map((id) => ({ params: { id } }));
};

/**
 * An endpoint rather than an .astro page on purpose: Astro prepends a doctype to
 * page routes, so a page can never emit "the fragment and nothing else". A
 * doctype inside a swap target is dropped by the HTML parser, so it is harmless in
 * practice — but it is not a fragment, and returning a Response also makes the
 * Content-Type explicit rather than inherited.
 */
export const GET: APIRoute = async ({ params }) => {
    const id = params.id ?? '';
    const entry = await getEntry('drops', id);
    const body = entry ? await renderDrop(entry, entry.data.mode) : null;

    // An unwritten drop answers 200 with the placeholder on purpose: HTMX swaps
    // 2xx responses and discards the rest, so a 404 here would read as a dead link
    // rather than as a drop waiting to be written.
    const fragment =
        entry && body
            ? wrapFragment(id, entry.data.mode, body, { reveal: revealFor(body.html) })
            : missingFragment(id);

    return new Response(fragment, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
};
