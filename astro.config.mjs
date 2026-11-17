import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { chapterAnchors } from './src/plugins/chapter-anchors.ts';

export default defineConfig({
  integrations: [mdx()],

  markdown: {
    // Astro 7's default processor is satteri(); naming it explicitly is how a
    // hast plugin is added. MDX inherits this (extendMarkdownConfig defaults to
    // true), so chapter.mdx needs no second registration.
    processor: satteri({ hastPlugins: [chapterAnchors()] }),
  },

  // Two routes could otherwise write the same prerendered URL and the build
  // would silently keep the higher-priority one.
  prerenderConflictBehavior: 'error',
});
