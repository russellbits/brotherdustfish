# Design Spec: Static HTML to Astro Conversion

**Date:** 2026-05-23
**Status:** Final / Approved

## 1. Goals
Convert a static HTML/JS site into a modern Astro site. The primary focus is on maintaining the aesthetic of the original book-like experience while introducing a more robust content pipeline and a responsive, interactive layout.

### Key Requirements:
- **Content**: Convert `.md` chapters to `.mdx` with specific frontmatter.
- **Routing**: Dynamic routing for chapters (`/chapter/[id]`).
- **UI (Desktop)**: Visible-by-default sliding sidebar (book cover) that expands the main content and centers it.
- **UI (Mobile)**: Vertical stack with the sidebar as the first static element; no sliding.
- **Transitions**: "Page-turn" transitions between chapters; sidebar must remain static (`transition:persist`).
- **Styling**: SCSS implementation, no Tailwind, porting existing CSS.

## 2. Architecture

### Tech Stack
- **Framework**: Astro
- **Content**: MDX (`@astrojs/mdx`)
- **Styling**: SCSS (`sass`)
- **Routing**: Astro Dynamic Routes
- **Transitions**: Astro View Transitions (`ClientRouter`)

### Directory Structure
```text
src/
├── components/
│   ├── Layout.astro       # Main shell (Sidebar + Content Slot)
│   ├── Sidebar.astro      # Sliding navigation with cover preview
│   ├── ChapterNav.astro   # Prev/Next navigation links
│   └── CoverZoom.astro    # Full-screen cover modal
├── content/
│   └── chapters/          # MDX content files
├── pages/
│   ├── index.astro        # Landing page
│   └── chapter/
│       └── [id].astro     # Chapter dynamic route
└── styles/
    ├── main.scss          # Entry point
    ├── _layout.scss       # Grid and sliding logic
    └── _typography.scss   # Ported type styles
```

## 3. Content Pipeline

### MD to MDX Migration
Existing `.md` files in `/contents` will be migrated to `src/content/chapters/` with the following transformations:

**Frontmatter Extraction:**
- **Title**: Extracted from the first H1 (`#`).
- **Number**: Extracted from the chapter header (`### Chapter N`).
- **Summary**: Extracted from the first H2 (`##`).

**Example Result:**
```mdx
---
title: "The Desert of Idex Mortez"
number: 1
summary: "In which we meet Able..."
---
[Body content starts here, with original headers removed]
```

### Content Collection Schema
A `config.ts` will define the `chapters` collection to ensure:
- `title`: string (required)
- `number`: number (required)
- `summary`: string (required)

## 4. Layout & UI Design

### Desktop (1024px+)
- **Layout**: CSS Grid with `grid-template-columns: 350px 1fr;`.
- **Sidebar**: 
    - Width: 350px.
    - Fixed position or first grid column.
    - Sliding behavior: Toggled via `.sidebar-collapsed` class on a wrapper.
    - `transform: translateX(-100%)` when collapsed.
- **Content Area**:
    - `1fr` width.
    - Internal `<article>` with `max-width: 70ch` and `margin: 0 auto`.
    - As the sidebar slides out, the center of the `1fr` column shifts, creating a natural expansion/centering effect.

### Mobile (< 1024px)
- **Layout**: `flex-direction: column`.
- **Sidebar**: 
    - Standard block element at the top.
    - `transform` and `position: fixed` removed.
- **Content Area**: Full width with standard padding.

### Transitions
- **Persistence**: `Sidebar.astro` will use the `transition:persist` directive to remain static during page changes.
- **Page Turn**: Custom View Transition utilizing a slide effect (current page slides out, new page slides in) to mimic book pages.

## 5. Navigation & Routing

### Dynamic Routes
The file `src/pages/chapter/[id].astro` will use `getStaticPaths()` to iterate through the `chapters` collection and generate static paths based on the filename.

### Prev/Next Logic
The `ChapterNav.astro` component will:
1. Fetch all entries in the `chapters` collection.
2. Sort them by the `number` property.
3. Find the index of the current chapter.
4. Generate links to `index - 1` and `index + 1`.

## 6. Landing Page
`index.html` will be ported to `src/pages/index.astro`, maintaining its structure as the "front cover" of the site, linking directly to the first chapter.
