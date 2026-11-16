import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chapters = defineCollection({
  // Each chapter is a folder: src/content/chapters/<slug>/chapter.mdx, with its
  // own images/ sibling. The entry id is the folder name, which is what the
  // /chapter/<slug> URLs are built from.
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

export const collections = { chapters };
