import type { CollectionEntry } from 'astro:content';

export type Chapter = CollectionEntry<'chapters'>;

// Chapter folders are named `<NN>-<slug>` (e.g. `01-meet-able`), and the glob
// loader pins each entry id to that folder name. Both segments become part of
// the URL: /chapter/<NN>/<slug>, except for the opening chapter, which is the
// site's front door and is served from `/` instead.
const FOLDER_PATTERN = /^(\d+)-(.+)$/;

// The opening chapter is the one whose folder number matches the lowest number
// in the collection, and that number is the one the routes are built from.
const HOME_CHAPTER = '01';

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

/**
 * True for the chapter served from `/`. The routes and the redirect that points
 * them there both ask this rather than comparing numbers themselves.
 */
export function isHomeChapter(chapter: Chapter): boolean {
    return chapterParts(chapter).number === HOME_CHAPTER;
}

/** The chapter's canonical URL, which for the opening chapter is the site root. */
export function chapterHref(chapter: Chapter): string {
    if (isHomeChapter(chapter)) return '/';
    const { number, slug } = chapterParts(chapter);
    return `/chapter/${number}/${slug}`;
}

/** Chapters in reading order, without mutating the caller's array. */
export function orderedChapters(chapters: Chapter[]): Chapter[] {
    return [...chapters].sort((a, b) => a.data.number - b.data.number);
}
