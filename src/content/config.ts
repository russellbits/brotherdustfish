import { defineCollection, z } from 'astro:content';

const chapters = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    number: z.number(),
    summary: z.string(),
  }),
});

export const collections = { chapters };
