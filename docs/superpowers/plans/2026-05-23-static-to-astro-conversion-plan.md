# Static to Astro Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a static HTML/JS site into an Astro site with MDX content, a sliding sidebar, and page-turning transitions.

**Architecture:** Dynamic routing using Astro Content Collections, SCSS for responsive layout, and Astro View Transitions for the "page-turn" effect.

**Tech Stack:** Astro, MDX, SCSS, View Transitions API.

**Spec:** `docs/superpowers/specs/2026-05-23-static-to-astro-conversion-design.md`

## Global Constraints
- **SASS/SCSS only**: No Tailwind CSS.
- **Routing**: Use `/chapter/[id]` for individual chapters.
- **UI**: Sidebar must be persisted across transitions (`transition:persist`).
- **Layout**: Desktop = sliding grid; Mobile = vertical stack.
- **Content**: All chapters must be `.mdx` with `{title, number, summary}` frontmatter.

---

### Task 1: Project Initialization & Dependency Setup

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`

- [ ] **Step 1: Initialize package.json with Astro and dependencies**
```json
{
  "name": "brother-dustfish",
  "type": "module",
  "dependencies": {
    "astro": "latest",
    "@astrojs/mdx": "latest",
    "sass": "latest"
  }
}
```

- [ ] **Step 2: Configure astro.config.mjs**
```javascript
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  integrations: [mdx()],
});
```

- [ ] **Step 3: Install dependencies**
Run: `npm install`

- [ ] **Step 4: Commit**
```bash
git add package.json astro.config.mjs tsconfig.json
git commit -m "chore: initialize astro project with mdx and sass"
```

### Task 2: Content Migration (MD $\rightarrow$ MDX)

**Files:**
- Create: `scripts/migrate-content.js`
- Create: `src/content/chapters/*.mdx` (multiple files)
- Delete: `contents/*.md` (after verification)

**Interfaces:**
- Produces: `.mdx` files with frontmatter `{title: string, number: number, summary: string}`.

- [ ] **Step 1: Write migration script to extract frontmatter**
The script should:
1. Read each `.md` file in `/contents`.
2. Regex match `### Chapter (\d+)` $\rightarrow$ `number`.
3. Regex match first `# (.+)` $\rightarrow$ `title`.
4. Regex match first `## (.+)` $\rightarrow$ `summary`.
5. Prepend YAML block and remove those lines from the body.
6. Write to `src/content/chapters/[filename].mdx`.

- [ ] **Step 2: Run migration script and verify a few files**
Run: `node scripts/migrate-content.js`
Check: `src/content/chapters/01.mdx` should have correct frontmatter.

- [ ] **Step 3: Commit**
```bash
git add src/content/chapters/ scripts/migrate-content.js
git commit -m "feat: migrate content to mdx with frontmatter"
```

### Task 3: Content Collection Schema

**Files:**
- Create: `src/content/config.ts`

**Interfaces:**
- Produces: Typed `chapters` collection for use in `getStaticPaths` and components.

- [ ] **Step 1: Define schema in config.ts**
```typescript
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
```

- [ ] **Step 2: Commit**
```bash
git add src/content/config.ts
git commit -m "feat: define content collection schema for chapters"
```

### Task 4: Base Styling & Typography (SCSS)

**Files:**
- Create: `src/styles/main.scss`
- Create: `src/styles/_typography.scss`
- Create: `src/styles/_variables.scss`

**Interfaces:**
- Produces: Global CSS variables and base typography rules.

- [ ] **Step 1: Define variables in _variables.scss**
Include: `$sidebar-width: 350px;`, `$primary-font: 'Georgia', serif;`, `$transition-speed: 0.5s;`.

- [ ] **Step 2: Port type.css to _typography.scss**
Include: `.book-title`, `.chapter-ref`, `article p` (with `text-indent: 2rem`), and `clamp()` typography.

- [ ] **Step 3: Create main.scss entry point**
```scss
@import './variables';
@import './typography';
@import './layout';
```

- [ ] **Step 4: Commit**
```bash
git add src/styles/
git commit -m "feat: implement base typography and scss variables"
```

### Task 5: Layout & Sidebar Implementation

**Files:**
- Create: `src/styles/_layout.scss`
- Create: `src/components/Layout.astro`
- Create: `src/components/Sidebar.astro`

**Interfaces:**
- Produces: Persistent shell with a sliding sidebar.
- Consumes: `_layout.scss`, `_typography.scss`.

- [ ] **Step 1: Implement _layout.scss with CSS Grid**
Desktop: `.layout-wrapper { display: grid; grid-template-columns: $sidebar-width 1fr; }`.
Mobile: `@media (max-width: 1023px) { .layout-wrapper { display: flex; flex-direction: column; } }`.
Collapsed state: `.sidebar-collapsed .sidebar { transform: translateX(-100%); }`.

- [ ] **Step 2: Create Sidebar.astro with transition:persist**
Include:
- Small book cover image.
- Toggle button to add/remove `.sidebar-collapsed` from the wrapper.
- Add `transition:persist` to the sidebar element.

- [ ] **Step 3: Create Layout.astro shell**
Include: `<ClientRouter />` in the head.
Wrap the `<slot />` and `<Sidebar />` in a div with the `.layout-wrapper` class.

- [ ] **Step 4: Verify sliding behavior on desktop and stack on mobile**
Test: Toggle sidebar on desktop $\rightarrow$ content should center.
Test: Resize to mobile $\rightarrow$ sidebar should be at the top.

- [ ] **Step 5: Commit**
```bash
git add src/components/Layout.astro src/components/Sidebar.astro src/styles/_layout.scss
git commit -m "feat: implement layout with persistent sliding sidebar"
```

### Task 6: Cover Zoom & Navigation Components

**Files:**
- Create: `src/components/CoverZoom.astro`
- Create: `src/components/ChapterNav.astro`

**Interfaces:**
- `ChapterNav` Consumes: `chapters` collection to find relative index.

- [ ] **Step 1: Implement CoverZoom.astro**
Port original `fadeTarget` logic: full-screen overlay with `3D-book-cover.png`, triggered by a click on the sidebar cover.

- [ ] **Step 2: Implement ChapterNav.astro**
Logic:
1. Fetch all chapters.
2. Sort by `number`.
3. Find current chapter `id`.
4. Render links to `id - 1` and `id + 1`.

- [ ] **Step 3: Commit**
```bash
git add src/components/CoverZoom.astro src/components/ChapterNav.astro
git commit -m "feat: implement cover zoom and prev/next navigation"
```

### Task 7: Dynamic Chapter Routes

**Files:**
- Create: `src/pages/chapter/[id].astro`

**Interfaces:**
- Consumes: `chapters` collection, `Layout.astro`, `ChapterNav.astro`.

- [ ] **Step 1: Implement getStaticPaths**
Generate paths based on the files in `src/content/chapters/`.

- [ ] **Step 2: Implement page template**
Render the MDX content within the `<Layout>` and place `<ChapterNav />` at the bottom.
Ensure the transition is a slide effect using Astro's View Transitions.

- [ ] **Step 3: Commit**
```bash
git add src/pages/chapter/[id].astro
git commit -m "feat: implement dynamic chapter routes"
```

### Task 8: Landing Page Port

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Port index.html content to index.astro**
Convert HTML to Astro components. Ensure the "Start Reading" link points to `/chapter/01`.
Wrap in `Layout.astro`.

- [ ] **Step 2: Commit**
```bash
git add src/pages/index.astro
git commit -m "feat: port landing page to astro"
```

### Task 9: Final Verification & Polish

- [ ] **Step 1: Verify "Page Turn" transition**
Navigate between chapters $\rightarrow$ Content should slide, sidebar should remain static.

- [ ] **Step 2: Verify Mobile Readability**
Check on small viewport $\rightarrow$ Sidebar at top, content fills screen, typography is fluid.

- [ ] **Step 3: Final Build Test**
Run `npm run build` to ensure no TypeScript errors in Content Collections.

- [ ] **Step 4: Final Commit**
```bash
git commit -m "feat: final polish and verification of astro conversion"
```
