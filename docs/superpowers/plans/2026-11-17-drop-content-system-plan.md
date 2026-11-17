# Drop Content System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let chapter prose carry expandable content — *drops* — as co-located Markdown files rendered to sanitized HTML fragments and swapped in by HTMX, with the filename as the address and the document as the state.

**Architecture:** A `drops` content collection co-located with each chapter, one prerendered rest-parameter route serving every fragment, an owned `unified` pipeline that sanitizes drops only, a `<Drop>` authoring component whose chapter namespace is bound by the chapter route, and a Sätteri `before` hook that gives chapters paragraph ids and sentence anchors.

**Tech Stack:** Astro 7.3.5, `@astrojs/mdx` 8.0.2, `@astrojs/markdown-satteri` (Sätteri visitor API), unified/remark/rehype, HTMX 2.x, SCSS, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-17-drop-content-system-design.md` — the plan argues from the spec; read both. Section references below (`§n`) are to the spec.

## Errata — where execution departed from this plan

A plan is an argument, not a record: this one was written before the code existed, and building it disproved several things it asserts. Every entry below is also recorded as an erratum in the spec, and every one is here because the plan's version **fails** rather than merely differs. Where a task body has been corrected, the correction is inline; the rest are listed here.

| Plan said | What was actually done | Why |
|---|---|---|
| Task 1: tsconfig `exclude` includes `.astro` | `.astro` is **not** excluded | excluding it removes `.astro/types.d.ts`, which supplies the `ImportMetaEnv` types `import.meta.env?.BASE_URL` needs |
| Task 1: devDeps `typescript`, `@astrojs/check` | plus **`@types/node`** | without it `astro check` reports TS2591 on `node:test` in this plan's own test file, so its acceptance condition could never hold |
| Task 1: `dropHref` ends in `/` | ends in **`.html`** | see the route row below |
| Task 2: figure test uses a placeholder image path | uses a real file under `public/` | Task 3 introduces the rule that an image `src` must exist |
| Task 3: `wrapFragment(…, innerHtml: string, …)` | `wrapFragment(…, body: DropBody, …)` | choosing `<p>` vs `<div>` from serialized HTML means regexing it, which §6 rejects |
| Task 4: `generateId` regex | `replace(/^(.+)\/drops\/([^/]+)\.md$/, '$1/$2')` | the plan's regex eats the separator, producing the id `01-meet-ablep1s1l1`, and the build still stays green |
| Task 7: bind the namespace with a `components` closure | an explicit **`chapter` prop** on each link | the closure fails the build with `NoMatchingRenderer` |
| Task 8: `src/pages/drops/[...id].astro` | **`src/pages/drops/[...id].html.ts`**, an endpoint | a page route gets `<!DOCTYPE html>` prepended, so it can never emit a bare fragment |
| Task 8: fragment written to `…/<name>/index.html` | `…/<name>.html` | an endpoint cannot emit `index.html`, and an extensionless file has its Content-Type guessed |
| Task 10: `hx-on:htmx:after-swap` on each link | one delegated `document` listener | htmx dispatches on the swap target, a sibling of the link for two of the three modes |
| Tasks 9/10: read the reference prototype in-repo | read from the main checkout by absolute path | `the-hyperarticle/` is untracked and absent from the worktree |
| Task 9: port `house.css` colours unchanged | three literal text colours became tokens | the reference is light-only; this site has a dark theme |
| §15: `astro check` clean | **no new** errors | the baseline is 50 pre-existing errors, all in `src/components/LifeBreaks.astro` |

The decisions the plan argues for — D1–D6, the sanitize allow-list, the build-time inventory, refusing `hx-vals`, verifying Sätteri's phase order rather than assuming it — all held as written.

## Global Constraints

- **Node 22.19.0.** Node runs `.ts` tests directly via type stripping. Two consequences, both verified: relative imports in test files **must carry the `.ts` extension** (`import { x } from '../src/lib/drops.ts'`), and the test script must be `node --test "test/**/*.test.ts"` — a bare directory argument fails on this version, an unquoted glob only goes one level deep.
- **`moduleResolution: Bundler`**, `allowImportingTsExtensions: true`, `noEmit: true`, `verbatimModuleSyntax: true` (inherited from `astro/tsconfigs/strict`). Use `import type` for type-only imports.
- **Astro's default Markdown processor is `satteri()`.** Configure it through `markdown.processor`; the legacy `markdown.remarkPlugins`/`rehypePlugins`/`gfm`/`smartypants` options are deprecated.
- **Drops stay `.md`.** No MDX, no component execution, no imports in drop bodies (§2).
- **The DOM id of an expansion drops the chapter namespace**: `p1s1l1-exp`, never `01-meet-able/p1s1l1-exp`. A `/` in an `id` breaks `hx-target` and `getElementById` (§6).
- **No `hx-vals` anywhere** (§8.2).
- **No expansion prose in any route, layout, or component.** Every expansion is a file (§1).
- **Existing inputs, already committed at `0fa40b1` — do not recreate:**
  - `src/content/chapters/01-meet-able/chapter.mdx` line 7 already contains `<Drop slug="p1s1l1">Skybow</Drop>`.
  - `src/content/chapters/01-meet-able/drops/p1s1l1.md` already exists: `mode: sentence`, `term: Skybow`, body `The Skybow is the ring around the planet of the Archelux, Able's home.`
- **The build is red as of `0fa40b1`** with `Expected component 'Drop' to be defined`. Task 7 is the task that makes it green.
- **The working tree carries unrelated uncommitted changes** to `src/components/Layout.astro`, `src/components/CoverZoom.astro`, `src/components/Sidebar.astro`, `src/content.config.ts`, `src/styles/_typography.scss` and `tsconfig.json`. Commit only the hunks this plan creates.
- **Do not commit** `the-hyperarticle/`, `.prompt_history.md`, or `docs/superpowers/{plans,specs}/2026-05-23-*`.

## Review Focus

Five input classes the spec implies but whose tests live only in the tasks below. Each is pinned to a test in the task that owns the code.

1. **A `<Drop slug>` that is not coordinate-shaped** (an author writes `slug="skybow"`). A reasonable person expects a build error naming the file. Task 7.
2. **Two `<Drop>`s with the same slug in one chapter** (duplicate link ids, two links to one fragment). Task 7.
3. **A drop body that is empty or whitespace only** (`wrapFragment` would emit an invisible, unclickable `( )`). Task 3.
4. **A `sentence`- or `paragraph`-mode drop whose target anchor does not exist** (`sent: 3` with no matching `<Sentence n="3" />`). The fragment renders but nothing appears on click, with no error anywhere. Task 8.
5. **An image `src` pointing at a file that is not in `public/`** (a typo yields a broken image and no signal). Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/drops.ts` | One drop: slug↔coordinates, DOM ids, href, wrapper HTML, missing-drop placeholder, reveal decision, and the `unified` sanitize pipeline. |
| `src/lib/drop-references.ts` | The *set* of drops that chapters reference — scans chapter sources. |
| `src/lib/drop-schema.ts` | The `drops` Zod schema, extracted so it is unit-testable without the `astro:content` virtual module. |
| `src/plugins/chapter-anchors.ts` | Sätteri `before` hook: paragraph ids, sentence-1 anchors, `<Sentence n>` rewriting. |
| `src/components/Drop.astro` | The authoring tag: emits the link, indicator and derived attributes. |
| `src/pages/drops/[...id].html.ts` | The fragment route (an endpoint, see Errata): prerenders every existing and referenced drop id. |
| `src/scripts/drops-client.ts` | Toggle, collapse, word reveal, fade reveal. |
| `src/styles/_drops.scss` | Global expansion CSS, ported from `the-hyperarticle/house.css`. |
| `test/*.test.ts` | Unit and build-level tests. |

`src/lib/drops.ts` carries addressing *and* HTML because both describe one drop; the scanner is separate because it describes a set of drops found in chapters. This splits the spec's §14 sketch of a single lib file — names (`parseDropSlug`, `wrapFragment`, `missingFragment`, `renderDropBody`) are unchanged.

---

### Task 1: Toolchain and drop addressing

**Files:**
- Modify: `package.json`, `tsconfig.json`
- Create: `src/lib/drops.ts`, `test/drops.test.ts`

**Interfaces:**
- Produces: `interface DropCoords { para: number; sent: number; link: number }`; `type DropMode = 'inline' | 'sentence' | 'paragraph'`; `dropName(dropId: string): string`; `parseDropSlug(slug: string): DropCoords | null`; `expansionDomId(name: string): string`; `dropHref(chapterId: string, slug: string): string`

- [ ] **Step 1: Add dependencies and the test script**

`dependencies`: `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `rehype-stringify`, `htmx.org`. `devDependencies`: `typescript`, `@astrojs/check`. Scripts: `"test": "node --test \"test/**/*.test.ts\""`, `"check": "astro check"`.

- [ ] **Step 2: Point tsconfig at Astro's strict preset**

Add `"extends": "astro/tsconfigs/strict"` (which supplies `noEmit`, `allowImportingTsExtensions` and `verbatimModuleSyntax`), keep the existing `jsxImportSource`, `baseUrl`, `paths` and `checkJs`, and add `"exclude": ["dist", ".astro", "node_modules", "the-hyperarticle", "stylesheets", "script.js", ".superpowers"]` so `astro check` covers this project rather than the reference prototype.

- [ ] **Step 3: Write the failing tests**

```ts
// test/drops.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropName, parseDropSlug, expansionDomId, dropHref } from '../src/lib/drops.ts';

test('parseDropSlug reads coordinates out of the filename', () => {
  assert.deepEqual(parseDropSlug('p1s2l3'), { para: 1, sent: 2, link: 3 });
});
test('parseDropSlug rejects a mnemonic and a near miss', () => {
  assert.equal(parseDropSlug('skybow'), null);
  assert.equal(parseDropSlug('p1s2'), null);
  assert.equal(parseDropSlug('p1s2l3x'), null);
});
test('dropName strips the chapter namespace', () => {
  assert.equal(dropName('01-meet-able/p1s1l1'), 'p1s1l1');
});
test('expansionDomId never contains a slash', () => {
  assert.equal(expansionDomId('p1s1l1'), 'p1s1l1-exp');
  assert.ok(!expansionDomId(dropName('01-meet-able/p1s1l1')).includes('/'));
});
test('dropHref is the route shape', () => {
  assert.equal(dropHref('01-meet-able', 'p1s1l1'), '/drops/01-meet-able/p1s1l1.html');
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test` — Expected: FAIL, `Cannot find module '../src/lib/drops.ts'`.

- [ ] **Step 5: Implement the addressing exports**

`dropHref` prefixes the site base. Read it **defensively** — `const base = import.meta.env?.BASE_URL ?? '/'` — because `import.meta.env` is Vite-only and this module is imported by plain-Node tests. Keep it the single place the base is read so the component and the route cannot drift (§8.2).

- [ ] **Step 6: Run to verify pass**

Run: `npm test` — Expected: PASS, 5 tests. Then run `npm run check` and record its baseline in the commit message; pre-existing errors outside the drop system's files are out of scope.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/lib/drops.ts test/drops.test.ts
git commit -m "feat: add drop addressing and the node:test toolchain"
```

---

### Task 2: Render pipeline and sanitize schema

**Files:**
- Modify: `src/lib/drops.ts`
- Create: `test/drops-render.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `interface DropEntry { id: string; body?: string }`; `DROP_SCHEMA`; `renderDropBody(entry: DropEntry): Promise<string>`

- [ ] **Step 1: Write the failing tests** — one test per row of §13, each asserting on `renderDropBody({ id: 'x/y', body })`.

Assert on the **property**, not on incidental serialization, wherever the exact output is not what the spec fixes:

| body | assertion |
|---|---|
| `<script>alert(1)</script>` | output contains no `script` and no `alert(1)` |
| `[click](javascript:alert(1))` | output contains `click` and contains no `href` |
| `[c](data:text/html,x)`, `[c](blob:x)` | contains `c`, contains no `href` |
| `<iframe src="x"></iframe>` | no `iframe` in the output |
| `<a href="#" onclick="x()">q</a>` | contains `href="#"`, contains no `onclick` |
| `<span data-tooltip="t">w</span>` | passes through intact (exact match — this is what §13 requires to survive) |
| `<a id="p1" name="p1">z</a>` | no `id=` and no `name=` in the output |
| `<figure><img src="/images/a.png" alt="a"><figcaption>c</figcaption></figure>` | passes through intact |
| `` `[x](javascript:1)` `` in a code span | escaped text, not a link |

Plus: a body containing only whitespace **throws** (Review Focus 3) — assert the thrown message names the entry id.

Plus: a body containing only whitespace **throws** (Review Focus 3) — assert the thrown message names the entry id.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL, `renderDropBody is not exported`.

- [ ] **Step 3: Implement the pipeline**

`remark-parse → remark-gfm → remark-rehype({ allowDangerousHtml: true }) → rehype-raw → rehype-sanitize(DROP_SCHEMA) → rehype-stringify`. `rehype-raw` is not optional: `hast-util-sanitize` returns `undefined` for any node type it does not know, so without it every `raw` node — including the sanctioned tooltip span — is deleted before the allow-list is consulted (§3.1 items 2–4).

`DROP_SCHEMA` extends `defaultSchema` with `tagNames` plus `img`, `figure`, `figcaption`; `attributes` as `'*': ['className', 'title']`, `a: ['href', 'rel']`, `time: ['datetime']`, `span: ['data*']`, `img: ['src', 'alt', 'width', 'height', 'loading']`; **`protocols` omitted entirely** (§3.1 item 1 — the brief's tag-keyed shape disables scheme checking and would render `javascript:` links live); `id` and `name` absent. `renderDropBody` throws a named error when `entry.body` is not a string.

- [ ] **Step 4: Run to verify pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/lib/drops.ts test/drops-render.test.ts && git commit -m "feat: render drops through a sanitize-only unified pipeline"`

---

### Task 3: Wrappers, missing-drop placeholder, reveal decision

**Files:**
- Modify: `src/lib/drops.ts`
- Create: `test/drops-fragments.test.ts`, `test/fixtures/public-check/` (if needed for the image test)

**Interfaces:**
- Consumes: `DropMode`, `dropName`, `expansionDomId` (Task 1); `renderDropBody`, `DROP_SCHEMA` (Task 2).
- Produces: `expansionTarget(mode: DropMode, coords: DropCoords): string`; `revealFor(html: string): 'fade' | 'word'`; `wrapFragment(dropId: string, mode: DropMode, innerHtml: string, opts: { reveal: 'fade' | 'word' }): string`; `missingFragment(dropId: string): string`

- [ ] **Step 1: Write the failing tests**

`expansionTarget` → `'#p1s1l1'` for `inline`, `'#p1s1'` for `sentence`, `'#p1'` for `paragraph` (§8.2).

`wrapFragment` per §6: `inline` yields `<span id="p1s1l1-exp" class="expansion-inline"> (body)</span>` — **assert the leading space survives**; `sentence` wraps in `expansion-sentence`; `paragraph` yields `<p …>` for a single-block body and `<div …>` for a multi-block body, and never a `<p>` inside a `<p>`.

Flat rendering: a two-paragraph body under `inline` joins with `<br>` and produces no nested `<p>`; a body whose only `<p>` sits inside `<pre>` is left alone (the reason §6 rejects regexing our own HTML).

`missingFragment('01-meet-able/p9s9l9')` → contains `no drop at drops/01-meet-able/p9s9l9.md yet.` and the class `expansion-missing`.

`revealFor('<p>x</p>')` → `'word'`; `revealFor('<figure><img src="/a.png" alt="a"></figure>')` → `'fade'`.

**Review Focus 5:** a root-absolute `src` with no matching file under `public/` makes `renderDropBody` throw, and a relative `src` throws a message telling the author to use a `/…` path (§10).

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement**

Build wrapper strings in TypeScript, never in an Astro template, so `compressHTML`'s JSX whitespace rules never see them (§6). Implement flat-vs-block by walking the **hast tree** from the pipeline, not by regexing serialized HTML. Detect a lone image and wrap the paragraph in `<figure>`, promoting `title` to `<figcaption>`; leave an author-written `<figure>` alone (§10).

- [ ] **Step 4: Run to verify pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/lib/drops.ts test/drops-fragments.test.ts && git commit -m "feat: wrap drop fragments per mode and decide reveal at build time"`

---

### Task 4: Drops schema, collection, and authoring template

**Files:**
- Create: `src/lib/drop-schema.ts`, `src/content/chapters/01-meet-able/drops/_template.md`, `test/drop-schema.test.ts`
- Modify: `src/content.config.ts`

**Interfaces:**
- Produces: `dropsSchema` (Zod object)

- [ ] **Step 1: Write the failing tests**

`dropsSchema.parse({ mode: 'inline', term: 'Skybow' })` succeeds; `mode: 'paragrah'` throws; a missing `mode` throws (**D1** — no default); `term: ''` throws; extra keys are stripped. Run against `astro/zod`, which resolves in plain Node (verified) — this is why the schema lives here rather than inline in `content.config.ts`, which imports the `astro:content` virtual module and cannot be imported by a test.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement `dropsSchema` and register the collection**

`mode: z.enum(['inline', 'sentence', 'paragraph'])` and `term: z.string().min(1)`. No `para`/`sent`/`link` fields (D2 — coordinates come from the filename).

In `src/content.config.ts` add to the existing `collections` export:

```ts
const drops = defineCollection({
  loader: glob({
    pattern: '**/drops/[!_]*.md',
    base: './src/content/chapters',
    // Both capture groups are needed: the plan's original pattern discarded the
    // separator slash, yielding `01-meet-ablep1s1l1` and a build that stayed green.
    generateId: ({ entry }) => entry.replace(/^(.+)\/drops\/([^/]+)\.md$/, '$1/$2'),
  }),
  schema: dropsSchema,
});
```

The `[!_]` class is the enforcement, not a convention: `glob()` has no filter callback (§4). Leave `retainBody` at its default, which is `true`.

- [ ] **Step 4: Write `_template.md`**

Documents the front matter, the `p<para>s<sent>l<link>` filename rule, the counting rule for paragraphs, the `mode` bodies (inline: lower-case continuation, no terminal period; sentence: a full sentence), YAML quoting for `term` values containing `: `, `#` or a leading `-`, and that `_`-prefixed files are never served.

- [ ] **Step 5: Run to verify pass** — Run: `npm test` — Expected: PASS. Then `npm run build` — Expected: still fails on the `Drop` reference, and **not** on the collection. Confirm the collection loaded by checking the build does not warn `No files found matching "**/drops/[!_]*.md"`.

- [ ] **Step 6: Commit** — `git add src/lib/drop-schema.ts src/content.config.ts "src/content/chapters/01-meet-able/drops/_template.md" test/drop-schema.test.ts && git commit -m "feat: add the drops collection and its schema"`

---

### Task 5: Chapter reference scanner

**Files:**
- Create: `src/lib/drop-references.ts`, `test/drop-references.test.ts`

**Interfaces:**
- Produces: `interface ChapterSource { id: string; body?: string }`; `scanDropReferences(chapters: ChapterSource[]): Set<string>` — ids namespaced as `<chapterId>/<slug>`

- [ ] **Step 1: Write the failing tests**

A single-line `<Drop slug="p1s1l1">Skybow</Drop>` in chapter `01-meet-able` yields `01-meet-able/p1s1l1`; a tag split across three lines and a self-closing `<Drop slug="p2s1l1" />` both match regardless of attribute order; two different chapters with the same slug yield two namespaced ids; a slug inside a fenced code block or an HTML comment is **not** matched; a chapter with no drops yields an empty set.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement**

Takes `{ id, body }[]` rather than calling `getCollection` itself, so it stays pure and unit-testable (§8.3). Strip fenced code blocks and HTML comments before matching, and tolerate multi-line tags and any attribute order. The pattern is deliberately tolerant; §8.3's two-way check (Task 7) turns a miss into a build error.

- [ ] **Step 4: Run to verify pass** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/lib/drop-references.ts test/drop-references.test.ts && git commit -m "feat: scan chapter sources for referenced drop ids"`

---

### Task 6: `chapterAnchors` Sätteri plugin

**Files:**
- Create: `src/plugins/chapter-anchors.ts`, `test/chapter-anchors.test.ts`
- Modify: `astro.config.mjs`, `package.json` (add `@astrojs/markdown-satteri` if not already resolvable)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `chapterAnchors()` — a `HastPluginDefinition` whose `before(root, ctx)` hook does the work; and `addChapterAnchors(root, ctx)` — the same logic, exported for testing.

- [ ] **Step 1: Read the real node shapes, then write the failing tests**

Before writing the fake tree, read `node_modules/satteri/dist/mdx-types.d.ts` and align the test fixture with the real `MdxJsxTextElementHast` shape. A fake tree that does not match the real one tests nothing.

Tests call `addChapterAnchors(root, ctx)` with a hand-built plain hast root and a fake `ctx` recording `setProperty`/`prependChild`/`replaceNode`, asserting:

- two top-level `<p>`s get `id="p1"` and `id="p2"`;
- each gets a prepended `{ type: 'element', tagName: 'a', properties: { id: 'p1s1', className: ['s'] }, children: [] }`;
- a `<p>` containing `<Sentence n="3" />` gains an anchor with `id: 'p1s3'` **and** its JSX node is gone from the tree;
- a `<p>` containing `<Sentence n="1" />` gains **no** automatic `s1` anchor (explicit wins — no duplicate ids, no error);
- two `<Sentence n="2" />` in one `<p>` throw, and the message names the paragraph.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement the hook and register it**

Do everything in `before(root, ctx)` — Sätteri runs it once per document, before the visitors walk, and `ctx` supplies `setProperty`, `prependChild` and `replaceNode`. Walk `root.children` for `element` with `tagName === 'p'`, counting paragraphs as you go, so no `parent`/`indexOf` bookkeeping is needed. Match `<Sentence>` on `mdxJsxTextElement` nodes whose `name === 'Sentence'`, read the `n` attribute, and `replaceNode` them with a plain hast `a` element.

In `astro.config.mjs`:

```js
import { satteri } from '@astrojs/markdown-satteri';
markdown: { processor: satteri({ hastPlugins: [chapterAnchors()] }) },
prerenderConflictBehavior: 'error',
```

MDX inherits the Markdown config (`extendMarkdownConfig` defaults true), so `chapter.mdx` needs no second registration.

- [ ] **Step 4: Run the unit tests** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Verify the integration** — Run: `npm run build`. The build still fails on `Drop`, but the failure must come from `/chapter/01/meet-able` rendering, and `dist/.prerender/chunks/*.mjs` must show `createVNode("a", { id: "p1s1" …` with **no** `_components.Sentence` reference and no `_missingMdxReference("Sentence", true)`. If it does reference `Sentence`, the `before` hook runs after JSX codegen — stop and report; spec §16 names the fallback.

- [ ] **Step 6: Commit** — `git add src/plugins/chapter-anchors.ts test/chapter-anchors.test.ts astro.config.mjs package.json package-lock.json && git commit -m "feat: give chapters paragraph ids and sentence anchors"`

---

### Task 7: `<Drop>` component and chapter binding — build goes green

**Files:**
- Create: `src/components/Drop.astro`, `test/drop-component.test.ts`
- Modify: `src/pages/chapter/[number]/[slug].astro`

**Interfaces:**
- Consumes: `parseDropSlug`, `dropName`, `expansionDomId`, `dropHref`, `expansionTarget` (Tasks 1, 3); `scanDropReferences` (Task 5); the `drops` collection (Task 4).
- Produces: the `<Drop>` component; props `{ chapterId: string; slug: string }`, children used as the display text.

- [ ] **Step 1: Write the failing tests** — the two Review Focus cases for this task

Against the rendered `dist/chapter/01/meet-able/index.html` after `npm run build`:

- **Review Focus 1:** temporarily add `<Drop slug="skybow">Skybow</Drop>` and expect the build to **fail** with a message naming `chapter.mdx` and the offending slug; revert.
- **Review Focus 2:** temporarily add a second `<Drop slug="p1s1l1">again</Drop>` and expect the build to **fail** on the duplicate; revert.

Both are asserted as real builds, because that is the only place the component sees the whole chapter.

- [ ] **Step 2: Run to verify failure** — Run: `npm run build` — Expected: FAIL (the current `Expected component 'Drop' to be defined`).

- [ ] **Step 3: Implement `Drop.astro`**

Look the drop up with `getEntry('drops', \`${chapterId}/${slug}\`)`. Throw a build error when `parseDropSlug(slug)` returns `null` (Review Focus 1) and when the same `chapterId`+`slug` appears twice (Review Focus 2). Emit §8.2's markup exactly: `id` = the bare slug, `href` from `dropHref`, `hx-get` from the same helper, `hx-target` from `expansionTarget`, `hx-swap="afterend"`, `hx-indicator`, `data-drop-term` from front matter, `data-drop-para`/`-sent`/`-link` from the slug, `data-drop-mode`, `data-astro-prefetch="false"` (§3.1 item 9) and `data-astro-reload` (§3.1 item 10), plus the indicator span.

Assert the children equal the front-matter `term` (D3) and throw otherwise. Emit the link even when the drop file is absent — the route renders the placeholder (§7).

Bind the namespace in `[slug].astro`:

```astro
<Content components={{ Drop }} />
// and in chapter.mdx: <Drop chapter="01-meet-able" slug="p1s1l1">Skybow</Drop>
// A closure here fails with NoMatchingRenderer; the namespace rides on the link.
```

Verified to work: MDX resolves `Drop` from `props.components` (§8.1).

- [ ] **Step 4: Verify the build is green** — Run: `npm run build` — Expected: PASS, 11 pages. Then confirm the emitted link: `grep -o 'hx-get="/drops/01-meet-able/p1s1l1/"[^>]*' dist/chapter/01/meet-able/index.html` shows `hx-target="#p1s1"`, `hx-swap="afterend"`, `data-drop-term="Skybow"`, `data-drop-mode="sentence"`; and `grep -o '<a id="p1s1" class="s"></a>' dist/chapter/01/meet-able/index.html` matches.

- [ ] **Step 5: Commit** — `git add src/components/Drop.astro "src/pages/chapter/[number]/[slug].astro" test/drop-component.test.ts && git commit -m "feat: emit drop links from chapter prose"`

---

### Task 8: Fragment route and referenced-drop inventory

**Files:**
- Create: `src/pages/drops/[...id].html.ts`, `test/build.test.ts`
- Modify: `src/lib/drops.ts` (only if a helper is missing)

**Interfaces:**
- Consumes: everything from Tasks 1–5 and 7.
- Produces: `/drops/<chapterId>/<slug>/` for every existing and referenced drop.

- [ ] **Step 1: Write the failing build-level tests**

Assertions over `dist/` after `npm run build`:

- `dist/drops/01-meet-able/p1s1l1.html` exists and contains `<span id="p1s1l1-exp" class="expansion-sentence">The Skybow is the ring`;
- it is a **bare fragment**: no `<html`, no `<style`, no `<script`;
- no `id=` value anywhere under `dist/` contains a `/`;
- the set of emitted fragments equals the set of `href`s in `dist/chapter/**` — the integrity check of §15;
- **Review Focus 4:** every `sentence`- or `paragraph`-mode drop's target id exists in its chapter's built HTML. This is the assertion that catches `sent: 3` with no matching anchor.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement the route**

`getStaticPaths` returns the union of `getCollection('drops')` ids and `scanDropReferences(await getCollection('chapters'))`; the rest parameter is required because ids contain `/` (§8.4). Assert every drop id's name parses via `parseDropSlug` and throw listing the offenders otherwise — a drop file that cannot yield coordinates is unusable.

Emit `wrapFragment` output, or `missingFragment` when there is no entry (status 200 on purpose, so a gap is visible rather than a dead link). Log the referenced-but-unwritten ids here, in `getStaticPaths`, which Astro calls exactly once per build. Emit **no layout, no styles, no script** (§8.4).

- [ ] **Step 4: Verify** — Run: `npm run build && npm test` — Expected: both PASS. Then:

```bash
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:4321/drops/01-meet-able/p1s1l1.html
```
against `npm run preview` — Expected: `200 text/html; charset=utf-8`.

- [ ] **Step 5: Commit** — `git add "src/pages/drops/[...id].html.ts" test/build.test.ts src/lib/drops.ts && git commit -m "feat: serve drop fragments and prerender every referenced id"`

---

### Task 9: Expansion CSS

**Files:**
- Create: `src/styles/_drops.scss`
- Modify: `src/styles/main.scss`

**Interfaces:**
- Produces: the classes `expansion-inline`, `expansion-sentence`, `expansion-paragraph`, `expansion-missing`, `expansion-fade`, `hx-link`, `htmx-indicator`, `word`, `collapsing`, and the `[data-tooltip]` rules.

- [ ] **Step 1: Write the failing test** — append to `test/build.test.ts`: the stylesheet in `dist/_astro/` contains `.expansion-inline`, `.expansion-sentence`, `.expansion-paragraph`, `.expansion-missing` and `.expansion-fade`, and `dist/chapter/01/meet-able/index.html` links that stylesheet.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Port the rules**

Port verbatim from `the-hyperarticle/house.css`: `a.hx-link` and its `:hover`/`.expanded` states, `.expansion-inline`, `.expansion-sentence`, `.expansion-paragraph` including every `.expansion-paragraph *` child rule, `.expansion-missing`, `.htmx-indicator` with `.htmx-request`, `.word`, `.collapsing`, and the `[data-tooltip]` pseudo-element tooltip. Their colours are **not** adjusted (§12) — tuning them against the parchment pane is a separate visual change. Add only `.expansion-fade` and a `prefers-reduced-motion` block that suppresses it, matching the pattern in `_transitions.scss`.

These must be **global**: scoped component styles attach a `data-astro-*` attribute a fetched fragment will never carry, so scoped rules would silently not apply (§12). Import from `main.scss`.

- [ ] **Step 4: Verify** — Run: `npm test && npm run build` — Expected: both PASS.

- [ ] **Step 5: Commit** — `git add src/styles/_drops.scss src/styles/main.scss test/build.test.ts && git commit -m "feat: add global expansion styles"`

---

### Task 10: Client behaviour and HTMX wiring

**Files:**
- Create: `src/scripts/drops-client.ts`
- Modify: `src/components/Layout.astro`

**Interfaces:**
- Consumes: `revealFor`'s build-time output — the `data-drop-reveal="fade"` attribute on the wrapper.
- Produces: `handleToggle(event: MouseEvent, expId: string): void`; `handleReveal(event: Event): void`; `collapseExpansion(el: HTMLElement, link: HTMLElement, done?: () => void): void`; `revealWordByWord(el: HTMLElement): void`

- [ ] **Step 1: Write the failing test** — a pure decision extracted for testability: `shouldFade(el: { getAttribute(name: string): string | null }): boolean` returns true only for `data-drop-reveal="fade"`. Assert true, false, and `null`.

`shouldFade` is the **reader** of the attribute that Task 3's `revealFor` decides at build time. They are not duplicates and must not be merged: `revealFor` runs in the pipeline over rendered HTML and chooses the value; `shouldFade` runs in the browser over the inserted DOM node and obeys it.

- [ ] **Step 2: Run to verify failure** — Run: `npm test` — Expected: FAIL.

- [ ] **Step 3: Implement the client module**

Port `handleToggle`, `wrapTextNodes`, `collapseExpansion` and `revealWordByWord` from `the-hyperarticle/index.html`. Two deliberate changes:

- **Reveal:** `handleReveal` reads the `data-drop-reveal` attribute from the inserted element; on `fade` it adds `.expansion-fade` and **skips** the word reveal, so an image drop's caption is not tokenised into `<span class="word">` and typed out (§11).
- **No leaked listeners:** the prototype attached `document.body.addEventListener('htmx:afterSwap', …, { once: true })` on every toggle, leaking a listener whenever a swap never landed. Use **one delegated listener registered at module scope**. The `hx-on:htmx:after-swap` on the link that this plan originally prescribed does not work: htmx dispatches on the swap target, which is a sibling of the link for `sentence` and `paragraph` modes.

Collapse stays DOM-only: set `hx-disable`, animate out, remove the node, re-enable (§11).

- [ ] **Step 4: Wire HTMX and the script in `Layout.astro`**

Add `import 'htmx.org';` and `import '../scripts/drops-client.ts';` in a layout `<script>`, so Astro bundles and dedupes HTMX rather than pulling a CDN tag (§11). Expose the handlers on `window` if the inline `onclick`/`hx-on` attributes require it, and verify that by inspecting the built page rather than assuming.

- [ ] **Step 5: Verify in the browser**

Run: `npm run build && npm run preview`. On `/chapter/01/meet-able`: clicking *Skybow* reveals an italic, left-ruled aside at the head of the first paragraph; clicking again collapses it and removes the node; a third click re-fetches; the indicator appears and clears. Then temporarily author a drop whose body is a single image and confirm it fades in rather than typing. Expected: all of the above.

This step is the honest gap in this plan: the DOM behaviour has **no automated test**, because the spec fixes `node --test` with no new dependencies (§14) and there is no DOM implementation available to it.

- [ ] **Step 6: Commit** — `git add src/scripts/drops-client.ts src/components/Layout.astro test/drops-client.test.ts && git commit -m "feat: drive drop expansion with bundled htmx"`

---

### Task 11: Final acceptance

**Files:**
- Modify: `test/build.test.ts` (only if an assertion is missing)

- [ ] **Step 1: Run the full automated suite** — Run: `npm test && npm run build && npm run check` — Expected: PASS, and no **new** `astro check` errors relative to the Task 1 baseline.

- [ ] **Step 2: Run the §15 contract and security checks**

```bash
npm run preview &
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' localhost:4321/drops/01-meet-able/p1s1l1.html   # 200 text/html;charset=utf-8
grep -rn "Skybow is the ring" src/ | grep -v '\.md:'   # no output: expansion prose lives only in its .md
grep -rn "hx-vals" src/ dist/                          # no output
```

- [ ] **Step 3: Verify all three modes render** — change `01-meet-able/drops/p1s1l1.md` to `mode: inline`, rebuild, and confirm the parenthesised span keeps its leading space; then to `mode: paragraph`, rebuild, and confirm a one-block body yields `<p class="expansion-paragraph">`. Restore `mode: sentence` and rebuild.

- [ ] **Step 4: Verify the reference-failure path** — add `<Drop slug="p9s9l9">nowhere</Drop>` to a chapter, rebuild, and confirm the build logs `01-meet-able/p9s9l9` as unwritten, the fragment returns the placeholder naming `drops/01-meet-able/p9s9l9.md`, and the status is 200. Then revert.

- [ ] **Step 5: Verify the no-JavaScript fallback** — with JavaScript disabled in the browser, clicking a drop link navigates to the fragment URL rather than doing nothing.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "test: complete drop system acceptance checks"`

---

## Self-Review

- **Spec coverage:** §4 layout (T4), §5 collection/schema (T4), §6 markup contract (T3), §7 anchors and `<Sentence>` (T6), §8 component and route (T7, T8), §9 pipeline (T2), §10 images (T2, T3, T10), §11 client (T10), §12 CSS (T9), §13 security (T2), §14 testing (T1, T8), §15 acceptance (T11). D1 (T4), D2 (T1, T4), D3 (T7), D4 (T7, T8), D5 (T2, T3, T10), D6 (T6). Gaps: none known.
- **Type consistency:** `DropCoords`, `DropMode`, `DropEntry`, `ChapterSource` are defined once (T1–T5) and used with the same names and shapes afterwards; `wrapFragment`'s fourth parameter is an options object `{ reveal }` throughout.
- **Review Focus:** five lines, each with the task that pins its test — T7 (1, 2), T3 (3, 5), T8 (4).
- **Proportion:** ~11 tasks against a 297-line spec; the plan carries decisions and tests, not implementations.
