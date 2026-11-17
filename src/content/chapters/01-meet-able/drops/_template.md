---
mode: sentence
term: the exact anchor text this drop expands
---

Authoring reference for drops. The leading `_` means the collection's glob
(`**/drops/[!_]*.md`) never serves this file: the rule is enforced by the
pattern, not by convention, so a note can sit beside the content without
becoming a URL.

## The filename is the address *and* the coordinates

`p<para>s<sent>l<link>.md`, counted in the chapter the drop belongs to:

- **para** — the n-th top-level paragraph of `chapter.mdx`. The chapter's own
  `<h1>` and summary are not in the chapter body, so the first prose paragraph
  is 1, not 2.
- **sent** — which sentence of that paragraph. Only sentence 1 gets an anchor
  automatically, so this must be 1 unless the chapter places a
  `<Sentence n="…" />` marker there.
- **link** — which drop link within that sentence, counting from 1.

So `p1s1l1.md` is the first drop link in the first sentence of the first
paragraph. The chapter folder namespaces it: the drop id is
`01-meet-able/p1s1l1` and it is served at `/drops/01-meet-able/p1s1l1/`.

## Linking to a drop

```mdx
<Drop chapter="01-meet-able" slug="p1s1l1">Skybow</Drop>
```

- **`chapter`** — the chapter folder name, e.g. `01-meet-able`. It is written on
every link rather than inferred. The chapter route cannot bind it into the
component, because MDX resolves `Drop` from the `components` prop and a closure
introduced there is not a renderer-recognised component; deriving it from the URL
would be silently wrong in a preview, a listing or a feed.
- **`slug`** — the drop's filename without `.md`.
- **the children** — the visible anchor text, plain text only, and it must equal
the drop's `term`.

A wrong `chapter` is not silent: the link still renders, and the fragment answers
with the visible `no drop at drops/<what-you-wrote>.md yet` placeholder naming
the path it looked for.

A miscounted **para** is visible rather than silent — `sentence` and `paragraph`
drops swap in at `#p<para>s<sent>` and `#p<para>`, so they land in the wrong
place. A miscounted **sent** or **link** only spoils the coordinates a future
language-model call would read.

## Front matter

- **`mode`** — required, and deliberately has no default. The PHP renderer
  defaulted to `inline`, which is how a typo makes a paragraph render as an
  inline gloss unnoticed; a misspelled mode now fails the build.
  - `inline` — a parenthesised gloss inserted immediately after the term. Write
    the body as a lower-case noun-phrase continuation with no terminal full
    stop, because the wrapper supplies both the parentheses and the spacing:
    `the ring around the planet of the Archelux, Able's home`
  - `sentence` — an italic, left-ruled aside. Write a full sentence, capital and
    full stop included.
  - `paragraph` — a block that may hold several paragraphs, a list, or a
    heading. A one-paragraph body keeps a `<p>` wrapper; anything richer gets a
    `<div>` so paragraphs never nest.
- **`term`** — the machine-readable copy of the anchor text, and it must equal
  the text between `<Drop>` and `</Drop>` in the chapter. A mismatch fails the
  build.

Front matter here is real YAML, unlike the PHP parser's line-oriented
`key: value` scanner. Quote any `term` containing `: `, `#`, or a leading `-`:

```yaml
term: "SEO: colonized it"
```

## Images

`![alt text](/images/thing.png)` alone in a paragraph becomes a `<figure>`; the
image's `title`, if given, becomes the `<figcaption>`.

`src` must be **root-absolute** and the file must exist under `public/`. A
relative path is refused: the fragment is inserted into the *chapter* page, so
`images/thing.png` would resolve against `/chapter/01/meet-able/` and fail with
no error anywhere.
