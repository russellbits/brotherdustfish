import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { dropsSchema } from './lib/drop-schema';

const chapters = defineCollection({
  // Each chapter is a folder: src/content/chapters/<NN>-<slug>/chapter.mdx, with
  // its own images/ sibling. The entry id is that folder name, which the
  // /chapter/<NN>/<slug> URLs are derived from.
  loader: glob({
    pattern: '*/chapter.mdx',
    base: './src/content/chapters',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    title: z.string(),
    number: z.number(),
    summary: z.string(),
  }),
});

const drops = defineCollection({
  // Drops live beside the chapter they belong to, so the filename is the whole
  // interface and adding a file adds a URL. The entry id is
  // `<chapter-folder>/<drop-name>` — the same namespace the chapters collection
  // uses for its ids, so a drop and its chapter cannot disagree about which is
  // which.
  //
  // `[!_]` is the enforcement of the leading-underscore rule, not a convention:
  // glob() takes no filter callback, so the pattern is the only place to say
  // that `_template.md` is a note rather than a drop.
  //
  // retainBody is left at its default (true) because the render pipeline
  // consumes the raw Markdown.
  loader: glob({
    pattern: '**/drops/[!_]*.md',
    base: './src/content/chapters',
  // Both capture groups are needed. The source brief's version of this pattern,
  // `replace(/\/drops\/([^/]+)\.md$/, '$1')`, matches the separator slash before
  // `drops` and discards it, so `01-meet-able/drops/p1s1l1.md` becomes
  // `01-meet-ablep1s1l1` — an id no lookup can find, which silently degrades a
  // drop to inline mode instead of failing.
  generateId: ({ entry }) => entry.replace(/^(.+)\/drops\/([^/]+)\.md$/, '$1/$2'),
  }),
  schema: dropsSchema,
});

export const collections = { chapters, drops };
