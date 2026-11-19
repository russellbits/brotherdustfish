import breakpointSource from '../styles/_breakpoint.scss?raw';

/**
 * The layout breakpoint, in the two forms markup and browser code need.
 *
 * The value is authored once, as `$tablet-max` in src/styles/_breakpoint.scss, and
 * read back here. Two languages need it and cannot share a literal: Sass can only
 * read a declaration on disk — Vite's `additionalData` is invisible to editors and
 * to plain `sass`, which is why that approach was dropped — while these consumers
 * cannot read SCSS at all:
 *
 *   - the `<source media>` on the cover's <picture>, which is markup;
 *   - the client scripts that gate behaviour on `matchMedia`.
 *
 * Deriving instead of duplicating means the SCSS and the markup cannot drift.
 *
 * The reasoning for the number lives in this comment rather than in the SCSS file
 * because comments here are stripped from the bundle, whereas the SCSS file is
 * shipped verbatim as the string the `?raw` import returns.
 *
 * 1366px is the widest iPad in landscape, so every tablet stacks. Below it the
 * sidebar becomes the landing page's cover and, on chapter pages, a compact
 * header, with the reading pane at full width; above it the sidebar is the 350px
 * column it has always been. The cost is that a 1366px laptop stacks too — if that
 * matters more than covering the largest iPad, lower the declaration; it is the
 * only place to change.
 *
 * `?raw` makes this module Vite-only: a bare `node --test` script resolves the
 * literal `?raw` suffix as part of the filename. Nothing does today; if something
 * needs this from Node, read the file with `fs` instead of importing this.
 */
const DECLARATION = /^\s*\$tablet-max:\s*(\d+(?:\.\d+)?)px\s*;/m;

const match = breakpointSource.match(DECLARATION);
if (!match) {
    throw new Error('No `$tablet-max: <n>px;` in src/styles/_breakpoint.scss');
}

export const TABLET_MAX_PX = Number(match[1]);

/** The same breakpoint as a media query, for markup and `matchMedia`. */
export const TABLET_QUERY = `(max-width: ${TABLET_MAX_PX}px)`;
