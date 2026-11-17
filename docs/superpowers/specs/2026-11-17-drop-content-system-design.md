# Design Spec: Drop Content System

**Date:** 2026-11-17
**Status:** Draft for review
**Source brief:** `the-hyperarticle/astro-drop-system-brief.md`
**Reference implementation:** `the-hyperarticle/` (dispatch contract and policy only; none of its code or content is ported)

## 1. Goal

Let a chapter's prose carry expandable content — *drops* — without that content living in the page template, a JSON API, or client-side state.

A reader clicks a term; the browser requests a named drop; the server returns one HTML fragment; HTMX swaps it into the document. The document holds the state. The filename is the address.

Concretely, this spec delivers: a `drops` content collection co-located with each chapter, one `drops` collection schema, a `<Drop>` authoring component, a `<Sentence>` anchor component, one prerendered fragment route, a Sätteri hast plugin that gives chapters paragraph and sentence anchors, an owned Markdown→sanitized-HTML pipeline, HTMX-driven client behaviour, and global expansion CSS.

## 2. Non-goals

- **Language-model generation.** The brief's on-demand route is a design note, not a work order. Everything here is prerendered and static. Nothing needs an adapter.
- **Porting the prototype's 24 drops or its prose.** The prototype is a reference for the dispatch contract and the sanitization policy. No drop files and no anchors move across.
- **MDX drops.** Drops stay `.md`: no component execution, no imports, so a later model-authored file cannot reach the site's component tree.
- **Changing the chapter Markdown pipeline's rendering of prose.** The one exception, authorised explicitly, is §7's anchor plugin, which adds `id` and anchor attributes and changes nothing else.
- **Image optimization for drop images.** See §10 for the trade-off.
- **A CMS, database, admin UI, or client-side drop rendering.**

## 3. Decisions

Each decision was taken deliberately; the cost of reversing it is noted.

| # | Decision | Rationale | Cost if reversed |
|---|---|---|---|
| **D1** | `mode` is required; no `.default('inline')` | The brief argues a silent inline default is how a typo hides, then specifies exactly that default. Omission or misspelling fails the build instead. | Authors must type `mode` every time. |
| **D2** | Coordinates come from the filename (`p<para>s<sent>l<link>`), not front matter | The filename is already the address; duplicating the coordinates in front matter lets them drift from it. Front matter carries `mode` and `term` only. | A drop cannot claim coordinates that differ from its name; renumber the file. |
| **D3** | `<Drop>` children are the display text; `term` is the machine-readable copy; the build asserts they match | Keeps prose readable and keeps `data-drop-term` available for future prompt scaffolding. | Authors maintain two strings, with the mismatch caught loudly at build time. |
| **D4** | Static output, `hx-get`, no adapter, no SSR route | Faithful port. A drop is a resource being read, so `GET` is correct HTTP, and the site stays deployable as pure static. | Adding generation later means adding the `hx-post` route and flipping link verbs. |
| **D5** | Images are allowed, emitted inside `<figure>`, and image drops fade in instead of running the word-by-word reveal | See §10 for the URL rule and §11 for the reveal rule. | Removing images means dropping three tag names and the fade path. |
| **D6** | An author-placed `<Sentence n="N" />` marker sits on top of the automatic `s1` anchors | Automatic anchors only exist for sentence 1 of each paragraph, so any term later in a paragraph could otherwise never have a sentence-mode aside. | Sentence-mode drops stay limited to paragraph-opening sentences. |

### 3.1 Corrections to the brief

These were each verified against the installed sources (Astro 7.3.5, `@astrojs/mdx` 8.0.2, `hast-util-sanitize`/`rehype-sanitize` current releases). They supersede the brief where they conflict.

1. **`protocols` is keyed by property name, not tag name.** The brief's `{ a: { href: […] }, img: { src: […] } }` *replaces* `defaultSchema.protocols` with keys `a` and `img`. The `href` lookup then misses, and `safeProtocol` returns early on "no protocols defined" — so `[click](javascript:alert(1))` would render a **live `javascript:` link**. This spec omits `protocols` entirely; the defaults (`href: http/https/irc/ircs/mailto/xmpp`, `src: http/https`) are already stricter than required.
2. **`attributes` are matched by hast property name.** `'class'` matches nothing; it must be `className`. `'data-tooltip'` must be `data*` (or `dataTooltip`). As briefed, every class and the sanctioned tooltip would have been silently dropped.
3. **`allowDataAttributes` is not a real option.** `'data*'` in the attribute list is the mechanism.
4. **The brief's pipeline deletes all raw HTML.** `hast-util-sanitize`'s `transform()` switches on `comment | doctype | element | root | text` and returns `undefined` for anything else, so `raw` nodes are dropped before any allow-list is consulted — including the sanctioned tooltip span. `rehype-raw` must sit between `remarkRehype` and `rehypeSanitize`.
5. **Disallowed markup is removed, not escaped.** The PHP renderer escaped `<script>` and `<iframe>` into visible text; this pipeline deletes them. Acceptance criteria are worded accordingly, and only text that was never parsed as HTML (a code span) stays escaped.
6. **The render-time inventory in the brief cannot work.** `astro/dist/core/build/generate.js` collects *every* route's `getStaticPaths` before rendering any page:
   ```js
   const pathsWithRoutes = await prerenderer.getStaticPaths();
   const generationPhases = [filteredPaths, fallbackPaths];
   ```
   A module-level array that `<Drop>` fills during chapter rendering is therefore empty when the drops route asks for it. §8 derives the referenced set from chapter sources instead.
7. **`CollectionEntry.rendered.html` does exist** (`RenderedContent.html: string`), contrary to the brief's guess — but it is unsanitized, so it is not a usable shortcut for drops.
8. **The brief's §12 version notes are accurate** for this install: `markdown.processor` defaults to `satteri()` (`astro/dist/core/config/schemas/base.js`, `.default(() => satteri())`), the legacy `markdown.*` plugin options are deprecated, and `render()` returns a component.
9. **Astro's prefetcher is on by default here.** With `prefetch` unconfigured, the define becomes `undefined`, so ClientRouter's `init({ prefetchAll: true })` wins and **every `<a>` is prefetched on hover**. Drop links must carry `data-astro-prefetch="false"` or every hovered term fetches a fragment that may never be clicked.
10. **ClientRouter and HTMX coexist safely, but not by accident.** ClientRouter's document-level click listener bails when `ev.defaultPrevented` (`astro/components/ClientRouter.astro`), and HTMX cancels the default for an anchor with a real `href`. Drop links additionally carry `data-astro-reload` so the opt-out does not depend on HTMX's internal behaviour.

## 4. Layout on disk and addressing

```
src/content/chapters/
  01-meet-able/
    chapter.mdx
    drops/
      p1s1l1.md            → served at /drops/01-meet-able/p1s1l1/
      _template.md         → authoring reference; never served
    images/
      chapter-image.png
  02-able-is-exiled/
    chapter.mdx
    drops/
```

- A drop's **id** is `<chapter-entry-id>/<name>`, e.g. `01-meet-able/p1s1l1`. The namespace is the chapter entry id — the same string `lib/chapters.ts` already parses — so chapter and drop cannot disagree.
- Its **URL** is `/drops/<chapter-entry-id>/<name>/`.
- A file whose name begins with `_` is a template or note, never served. Enforced by the collection's glob pattern, not by convention: `glob()` has no filter callback, so `**/drops/[!_]*.md` is the only available enforcement.
- No registry, no route list, no content table. Adding a drop file adds a URL.

## 5. Content collections and schema

`src/content.config.ts` gains one collection alongside the existing `chapters`.

- **Loader:** `glob({ pattern: '**/drops/[!_]*.md', base: './src/content/chapters', generateId: ({ entry }) => entry.replace(/\/drops\/([^/]+)\.md$/, '$1') })`. This yields `01-meet-able/p1s1l1`.
- **`retainBody`** is left at its default (`true`). The render pipeline consumes `entry.body`, and the chapter scanner consumes the chapters' bodies.
- **Schema:**
  - `mode: z.enum(['inline', 'sentence', 'paragraph'])` — required (D1).
  - `term: z.string().min(1)`.
  - The slug shape `p<para>s<sent>l<link>` is validated against `/^p(\d+)s(\d+)l(\d+)$/`, and the three coordinates are parsed from the **slug** (D2). No `para`/`sent`/`link` front-matter fields exist.

YAML gotcha carried into the authoring docs: the PHP front-matter parser was a line-oriented `key: value` scanner, but Astro parses real YAML. Any `term` containing `: `, `#`, or a leading `-` must be quoted (`term: "SEO: colonized it"`).

## 6. The drop markup contract

`wrapFragment(dropId, mode, innerHtml, { reveal })` in `src/lib/drops.ts` is the single source of wrapper truth, used by the fragment route and by any future on-demand route so the two cannot disagree. `reveal` is `'fade'` or `'word'`; when it is `'fade'` the wrapper carries `data-drop-reveal="fade"`, which is what tells the client to skip the word-by-word reveal (§11).

The DOM id **drops the namespace**: `p1s1l1-exp`, not `01-meet-able/p1s1l1-exp`. A `/` in an `id` breaks every `#selector` that `hx-target` and `handleToggle` depend on. The namespace belongs in the URL and the drop lookup, never in an `id`.

| `mode` | wrapper | notes |
|---|---|---|
| `inline` | `<span id="<name>-exp" class="expansion-inline"> (body)</span>` | Body is a lower-case noun-phrase continuation; the wrapper supplies the parentheses and the leading space. |
| `sentence` | `<span id="<name>-exp" class="expansion-sentence">flat</span>` | Block-level aside. Body is a full sentence with capital and full stop. |
| `paragraph` | `<p id="<name>-exp" class="expansion-paragraph">inner</p>` when the body is exactly one top-level `<p>`, else `<div id="<name>-exp" class="expansion-paragraph">body</div>` | Never nests `<p>` inside `<p>`. |

**Flat rendering** for `inline` and `sentence`: a single paragraph collapses to bare text, several join with `<br>`. A nested `<p>` inside a `<span>` is invalid markup. This is ported from the PHP renderer's `md_flat_html`/`md_is_single_paragraph` **in spirit but implemented over hast**, not by regexing our own HTML output — `preg_match_all('/<p>…/')` would corrupt a `<p>` inside a `<pre>` in a fenced code block.

**Missing drop:** `missingFragment(dropId)` returns ``<span class="expansion-inline expansion-missing">no drop at drops/<chapter>/<name>.md yet.</span>``, mirroring the PHP wording so the authoring signal is unchanged.

## 7. Chapter anchors

A Sätteri hast plugin (`chapterAnchors`) is registered once in `astro.config.mjs`:

```js
markdown: { processor: satteri({ hastPlugins: [chapterAnchors()] }) }
```

MDX inherits the Markdown config by default (`extendMarkdownConfig: true`), so `chapter.mdx` needs no second registration.

In one document-order traversal it:

1. **Numbers top-level `<p>` elements** — `id="p1"`, `id="p2"`, … — so `paragraph` mode has a target and `p<n>` means "the n-th prose paragraph of the chapter".
2. **Prepends a sentence-1 anchor** `<a id="p<n>s1" class="s"></a>` to each numbered paragraph, so `sentence` mode has a target for the opening sentence.
3. **Rewrites `<Sentence n="N" />`** into `<a id="p<current>s<N>" class="s"></a>`, using the paragraph index it is already tracking. The author writes only the sentence number.
4. **Explicit wins:** if a paragraph contains `<Sentence n="1" />`, the automatic `s1` anchor is suppressed for that paragraph. No duplicate ids, no error.
5. **Duplicate explicit numbers in one paragraph** (two `<Sentence n="2" />`) are a build error naming the file.

`<Sentence>` is written without an import. This relies on the plugin's phase running *before* MDX JSX codegen, so a rewritten node is emitted as a plain `a` element rather than a `_components.Sentence` reference. Evidence in favour: compiled chapter chunks show JSX nodes surviving into `createVNode(...)` calls, so the plugin sees them. That is not proof of ordering — see §14's acceptance test and §16's contingency.

## 8. The `<Drop>` component and the fragment route

### 8.1 Namespace binding

The chapter route already knows `chapter.id`, so it binds the namespace rather than asking the author or inferring from the URL:

```astro
<Content components={{ Drop: (props) => <Drop chapterId={chapter.id} {...props} /> }} />
```

**Verified, not assumed.** A failed build of `01-meet-able` produced this compiled MDX:

```js
const _components = Object.assign({ em: "em", hr: "hr", p: "p" }, props.components);
const { Drop } = _components;
if (!Drop) _missingMdxReference("Drop", true);
…
createVNode(Drop, { slug: "p1s1l1", children: "Skybow" })
```

MDX resolves `Drop` from `props.components`, so the `components` prop works for a custom component and not merely for HTML element names. `render()`'s MDX branch spreads caller props last (`props = { components: propagationMod.components ?? {}, ...baseProps }`), so the caller's `components` wins. If the binding ever fails, MDX throws `Expected component 'Drop' to be defined` at build time — loud, never silent.

### 8.2 What `<Drop>` emits

Everything is derived from the drop's own front matter and slug. No `hx-vals`, which removes the brief's JSON-quoting hazard (the prototype had a drop whose tooltip span made its `hx-vals` unparseable).

```html
<a id="p1s1l1" class="hx-link"
   href="/drops/01-meet-able/p1s1l1/"
   hx-get="/drops/01-meet-able/p1s1l1/"
   hx-target="#p1s1" hx-swap="afterend"
   hx-indicator="#ind-p1s1l1"
   data-drop-term="Skybow"
   data-drop-para="1" data-drop-sent="1" data-drop-link="1" data-drop-mode="sentence"
   data-astro-prefetch="false" data-astro-reload
   hx-on:htmx:after-swap="handleReveal(event)"
   onclick="handleToggle(event,'p1s1l1-exp')">Skybow</a><span class="htmx-indicator" id="ind-p1s1l1">…</span>
```

`hx-target` by mode: `inline` → the link itself; `sentence` → `#p<para>s<sent>`; `paragraph` → `#p<para>`. `hx-swap` is `afterend` throughout.

`href` is produced by one shared helper alongside the route's own path construction, so `import.meta.env.BASE_URL`, `build.format` and `trailingSlash` resolve in exactly one place. Direct navigation to a fragment URL shows a bare fragment — correct, and matching the PHP behaviour.

### 8.3 Referential integrity

`getStaticPaths` returns the **union of every existing drop and every drop a chapter references**. The second half is what keeps the visible-gap invariant true in a static build: a referenced-but-unwritten drop still needs a prerendered URL that answers 200 with the placeholder.

Because a render-time inventory is impossible (§3.1 item 6), the referenced set comes from **scanning chapter bodies**, which are already retained: `referencedDropIds(chapters: {id, body}[])` takes plain data rather than calling `getCollection` itself, so it is pure and unit-testable.

Scanning MDX with a pattern is the weak point, so the loop is closed where it matters: `<Drop>` asserts at render time that its own resolved id is in the scanned set. A scan miss becomes a **build error** rather than a silently absent placeholder.

The scan and the audit log both run inside the drops route's `getStaticPaths`, which Astro calls exactly once per build, so the build emits one `logger.warn` naming every referenced-but-unwritten drop — not one warning per page. That turns the prototype's throwaway audit script into a permanent property of the build.

`prerenderConflictBehavior: 'error'` is set so a URL collision fails the build instead of silently electing a winner.

### 8.4 Route rules

- One route: `src/pages/drops/[...id].astro`. The rest parameter is required because ids contain `/`.
- **Emit the fragment and nothing else** — no layout, no `<html>`, no `<style>`, no `<script>`. Astro hoists component styles and scripts into a `<head>` that a fragment response does not have, and a stylesheet travelling with every drop defeats the design's purpose.
- `Content-Type` is `text/html; charset=utf-8` by default for a page route.

## 9. Render pipeline and sanitization policy

Drops are rendered by a pipeline this project owns, not by Astro's global Markdown processor. Two reasons: an endpoint needs a string, and sanitization must apply to **drops only** — a global `rehype-sanitize` would strip the chapter's own MDX components and raw HTML.

```
remark-parse → remark-gfm → remark-rehype({allowDangerousHtml: true})
             → rehype-raw            ← see §3.1 item 4
             → rehype-sanitize(DROP_SCHEMA)
             → rehype-stringify
```

`renderDropBody(entry)` reads `entry.body` (the raw, uncompiled Markdown) and throws a named error if it is absent, so a `retainBody` regression fails loudly.

**`DROP_SCHEMA`**, extending `defaultSchema` with the server defaults from `lib/markdown.php`'s allow-list rather than wholesale:

- **`tagNames`:** current list plus `img`, `figure`, `figcaption`. (`h1` is deliberately excluded, so a drop cannot compete with the chapter heading.)
- **`attributes`:** `'*': ['className', 'title']`; `a: ['href', 'rel']`; `time: ['datetime']`; `span: ['data*']`; `img: ['src', 'alt', 'width', 'height', 'loading']`. Property names are hast property names — see §3.1 item 2.
- **`protocols`: omitted.** The defaults already block `javascript:`, `data:` and `blob:` on `href`/`src` while permitting root-relative URLs, because `safeProtocol` treats a value with no colon before its first `/`, `?` or `#` as "not a protocol". Relative hrefs passing unchecked is confirmed behaviour, and root-absolute is enforced for images separately (§10).
- **`id` and `name` are absent** from `'*'`, so a drop cannot mint attributes that collide with the host document's anchors. Even if one slipped through, `clobber: […,'id','name']` with `clobberPrefix: 'user-content-'` would prefix it. Two independent guards.
- **`strip: ['script']`** is inherited, so a `<script>` is removed with its contents.

## 10. Images

- `![alt](src)` and raw `<figure>`/`<figcaption>` markup both survive sanitization.
- **A paragraph whose only child is an `<img>` is wrapped in `<figure>`**; the image's `title`, if present, becomes a `<figcaption>`. An author-written raw `<figure>` is left alone — no double-wrapping.
- **`src` must be root-absolute.** The pipeline prefixes root-absolute `src` with `import.meta.env.BASE_URL`; a relative `src` is a **build error** telling the author to place the file under `public/` and reference it as `/…`.

  This rule exists because of a real trap: a drop's HTML is inserted into the *chapter page*, so a relative `src` resolves against `/chapter/01/meet-able/`, not against the drop's own URL. Silently wrong is worse than loudly refused.
- **Trade-off, stated deliberately:** plain Markdown cannot import assets, so drop images are unoptimized files served from `public/`. They get no hashing, no resizing, no modern formats. Revisiting this means a remark plugin that rewrites paths into imports, which is a larger change than the feature warrants today.

## 11. Client behaviour

- **HTMX** is installed as a dependency and imported in a layout `<script>`, so Astro bundles and dedupes it rather than pulling a CDN tag — which also keeps it working if `security.csp` is enabled later.
- **One module script** ports `handleToggle`, `wrapTextNodes`, `collapseExpansion` and `revealWordByWord`.
- **Reveal is decided at build time.** If the rendered tree contains an `<img>`, the wrapper carries `data-drop-reveal="fade"`. On swap, the handler checks the inserted element: `fade` adds `.expansion-fade` and **skips** the word-by-word reveal, so an image does not get its caption tokenised into `<span class="word">` and typed out. The server already knows the content, so the decision travels with the fragment instead of being re-derived in the browser.
- **Listener leak fixed.** The prototype attached `document.body.addEventListener('htmx:afterSwap', …, { once: true })` on *every* toggle, so a click whose swap never landed left a listener queued and they accumulated. This uses `hx-on:htmx:after-swap` on the link, scoped to that element's request.
- **Collapse stays DOM-only**: set `hx-disable` on the link, animate out, remove the node, re-enable. That is what keeps the system free of client state.
- **No prefetch, no `<ClientRouter />` involvement.** Drop links carry `data-astro-prefetch="false"` (§3.1 item 9) and `data-astro-reload` (§3.1 item 10).

## 12. CSS

All expansion CSS is **global** — `.hx-link`, `.expansion-inline`, `.expansion-sentence`, `.expansion-paragraph` (including its multi-block child rules), `.expansion-missing`, `.expansion-fade`, `.word`, `.collapsing`, `.htmx-indicator`, `[data-tooltip]`. It moves out of any component `<style>` into a global partial imported by `main.scss`.

This is not a style preference: scoped styles attach a `data-astro-*` attribute that a fetched fragment will not carry, so scoped rules would silently not apply to expansions.

The rules are ported **verbatim** from `the-hyperarticle/house.css`, including the multi-block `.expansion-paragraph *` child rules, the `[data-tooltip]` pseudo-element tooltip, `.expansion-missing`, `.htmx-indicator`, `.word` and `.collapsing`. **Their colours are not adjusted**: `--expansion-bg: #eee8d8` and `--expansion-border: #b8a98a` already read as a warm beige on the parchment pane, and tuning them against it is a purely visual follow-up, explicitly outside this spec's acceptance criteria. Only `.expansion-fade` is new.

`prefers-reduced-motion` suppresses both the collapse animation and the fade.

## 13. Security properties

The pipeline is the boundary between untrusted Markdown and the document. Required properties, each with a test in §14:

| Threat | Required outcome |
|---|---|
| `<script>alert(1)</script>` | Absent from output. |
| `[click](javascript:alert(1))` | Label rendered, no `href` attribute. |
| `[click](data:text/html,…)` / `blob:` | Same as above. |
| `<iframe>` | Absent from output. |
| `onclick=` on an allowed tag | Attribute dropped. |
| `<span data-tooltip="…">` | Passes through — it is sanctioned markup. |
| `<a id="…">` / `<a name="…">` | Cannot mint an id or name colliding with the host document. |
| Raw `<figure>` | Passes through; `<img src>` allowed only root-absolute or http/https. |

The eventual author may be a model, not a person, which is why this is enforced by an allow-list rather than by review.

## 14. Testing

No test framework exists in the repo. **`node --test`** is used — zero new dependencies — for the pure units, and a handful of assertions run against `dist/` after `astro build`. `@astrojs/check` and `typescript` are added as devDependencies so `astro check` is real rather than aspirational.

This shapes where code lives. `src/lib/drops.ts` exposes pure functions — the slug→coordinates parser, the wrapper builders, `missingFragment`, `referencedDropIds({id, body}[])`, and the sanitize pipeline — none of which import `astro:content` at runtime. The Astro-coupled parts stay in the component and the route.

**Unit tests.** Wrapper output per mode and per shape; `missingFragment` wording; slug parsing including malformed input; the chapter scanner including a multi-line `<Drop>` and attribute order; and one test per row of §13.

**Build-level tests**, because these are what catch the version traps:

1. A fragment exists for every referenced id, and the referenced set equals the set of `<Drop>` links emitted in `dist/chapter/**`.
2. Each fragment is a bare fragment — no `<html>`, no `<style>`, no `<script>`.
3. No `id=` anywhere in `dist/` contains a `/`.
4. The inline wrapper kept its leading space (Astro 7's `compressHTML` applies JSX whitespace rules; the wrapper is built in TypeScript and injected via `set:html`, so template whitespace is not involved — asserted rather than trusted).
5. A chapter page loads the expansion CSS.
6. `<Sentence n="2" />` produces a real `<a id="p<n>s2" class="s">` element in the chapter HTML and **no** `_components.Sentence` reference in the compiled chunk. This is the test that catches §7's phase-ordering assumption.
7. A referenced-but-unwritten drop yields a 200 placeholder naming the missing file, and the build logged it.
8. A drop with `mode: paragrah` fails the build.

## 15. Acceptance criteria

- `curl -o /dev/null -w '%{http_code} %{content_type}' /drops/01-meet-able/p1s1l1/` → `200 text/html; charset=utf-8`, body is a bare fragment with `id="p1s1l1-exp"` and the expected class.
- All three modes render correctly, including `paragraph` choosing `<p>` for one block and `<div>` for several.
- The paragraph/sentence/paragraph-mode targets all resolve to real elements after a swap.
- Click expands; click again collapses and removes the node; a third click re-fetches. No leaked listeners, no duplicate fragments.
- With JavaScript disabled, clicking a drop link navigates to the fragment URL via `href` rather than doing nothing.
- Expansion CSS applies to fetched fragments — an inline drop renders with its background and border, not as unstyled text.
- An image drop renders inside a `<figure>` and fades in rather than typing its caption out.
- No expansion prose exists in any route, layout, or component: grepping a phrase from a known drop across `src/` finds it only in its `.md` file.
- `astro check` clean.
- No duplicate drop ids across chapters, asserted at build time.
- No `hx-vals` anywhere.

## 16. Contingencies

- **If Sätteri's hast plugin runs after MDX JSX codegen**, `<Sentence n>` cannot be rewritten into a plain anchor and §7's point 3 fails. Fallback, in order: (a) provide `Sentence` through the same proven `components` mapping as `Drop`, with the component emitting an anchor from a fully-specified id (`<Sentence id="p1s3" />`), which loses automatic paragraph numbering and nothing else; (b) drop D6 and record that sentence-mode drops are limited to paragraph-opening sentences. Acceptance test 6 is what detects this.
- **If `<Content components={…}>` stops winning over the propagated components** in a future Astro, the fallback is an explicit `chapter` prop on `<Drop>`. Verbose, cannot break.

## 17. Risks

- **Coordinates are counted by hand.** A miscounted `para` silently misplaces `sentence` and `paragraph` expansions, because those modes target `#p<n>`. A miscounted `sent` or `link` corrupts metadata only. Mitigation: the visible failure is immediate, and the authoring template documents the counting rule.
- **`link` indices are positional** within a sentence, so inserting a new drop earlier in the same sentence renumbers the later ones. Metadata-only.
- **Current repo state:** the build is **red**. `chapter.mdx` line 7 already contains `<Drop slug="p1s1l1">Skybow</Drop>` and `drops/p1s1l1.md` already exists with correct front matter and body. The implementation plan must treat these as existing inputs, not recreate them, and its first step is to make the build green.
