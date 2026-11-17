import type { CollectionEntry } from 'astro:content';

export type Chapter = CollectionEntry<'chapters'>;

// Chapter folders are named `<NN>-<slug>` (e.g. `01-meet-able`), and the glob
// loader pins each entry id to that folder name. Both segments become part of
// the URL: /chapter/<NN>/<slug>.
const FOLDER_PATTERN = /^(\d+)-(.+)$/;

export interface ChapterParts {
    /** Zero-padded number segment, exactly as it appears in the folder name. */
    number: string;
    /** Title slug segment, with the number prefix stripped off. */
    slug: string;
}

export function chapterParts(chapter: Chapter): ChapterParts {
    const match = FOLDER_PATTERN.exec(chapter.id);
    if (!match) {
        throw new Error(
            `Chapter entry "${chapter.id}" does not follow the <NN>-<slug> folder ` +
                `convention required by the /chapter/[number]/[slug] route.`,
        );
    }
    return { number: match[1], slug: match[2] };
}

export function chapterHref(chapter: Chapter): string {
    const { number, slug } = chapterParts(chapter);
    return `/chapter/${number}/${slug}`;
}

/** Chapters in reading order, without mutating the caller's array. */
export function orderedChapters(chapters: Chapter[]): Chapter[] {
    return [...chapters].sort((a, b) => a.data.number - b.data.number);
}
