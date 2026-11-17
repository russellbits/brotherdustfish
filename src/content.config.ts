import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

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

export const collections = { chapters };
