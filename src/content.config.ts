import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    number: z.number(),
    summary: z.string(),
  }),
});

export const collections = { chapters };
