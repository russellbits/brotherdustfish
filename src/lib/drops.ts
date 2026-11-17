// Addressing for a drop. The filename is the address and the coordinates: a drop
// living at `drops/p1s1l1.md` inside chapter `01-meet-able` has the id
// `01-meet-able/p1s1l1` and is served at `/drops/01-meet-able/p1s1l1/`.
//
// This module is imported by plain-Node tests as well as by the Astro build, so
// it must not import `astro:content` or any other virtual module.

/** The coordinates a drop's filename carries: paragraph, sentence, link index. */
export interface DropCoords {
    para: number;
    sent: number;
    link: number;
}

export type DropMode = 'inline' | 'sentence' | 'paragraph';

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
