import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { chapterAnchors } from './src/plugins/chapter-anchors.ts';
import { TABLET_MAX_PX } from './src/lib/breakpoints.ts';

export default defineConfig({
  site: 'https://www.brotherdustfish.com',
  server: {
    port: 21815,
  },
  outDir: './build',
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

  vite: {
    css: {
      preprocessorOptions: {
        // One source of truth for the layout breakpoint: this injects `$tablet-max`
        // into every SCSS entry, component style blocks included, so the number
        // lives in src/lib/breakpoints.ts and nowhere else. It emits no CSS, so it
        // cannot disturb the `@import url(…)` that has to stay first.
        scss: { additionalData: `$tablet-max: ${TABLET_MAX_PX}px;\n` },
      },
    },
  },
});
