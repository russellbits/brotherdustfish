import { z } from 'astro/zod';

/**
 * A drop's front matter.
 *
 * The coordinates are deliberately absent. They live in the filename, which is
 * already the address, so repeating them here would create a second source of
 * truth that can only drift from it (D2).
 *
 * `mode` has no default (D1). The PHP renderer silently defaulted it to
 * `inline`, which is how a typo makes a paragraph render as an inline gloss and
 * nobody notices until reading. A strict schema fails the build instead.
 *
 * This lives in its own module rather than inline in `content.config.ts` because
 * that file imports the `astro:content` virtual module, which a plain Node test
 * cannot import — and `astro/zod` alone resolves fine outside the build.
 */
export const dropsSchema = z.object({
    mode: z.enum(['inline', 'sentence', 'paragraph']),
    term: z.string().min(1),
});
