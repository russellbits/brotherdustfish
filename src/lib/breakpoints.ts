/**
 * The one place the layout breakpoint is written down.
 *
 * Below it the page stacks: on the landing page the sidebar becomes the site's
 * cover, on chapter pages a compact header, and the reading pane takes the full
 * width. Above it, the sidebar is the 350px column it has always been.
 *
 * Three consumers cannot share one mechanism, which is why this file exists:
 *   - the SCSS media queries, which read `$tablet-max`, injected into every SCSS
 *     entry by `astro.config.mjs` importing this module;
 *   - the `<source media>` on the cover's <picture>, which is markup;
 *   - the two client scripts that gate behaviour on the same width.
 *
 * 1366px is the widest iPad in landscape, so every tablet stacks. The cost is that
 * a 1366px laptop stacks too; if that matters more than covering the largest iPad,
 * lower this value — it is the only place to change.
 */
export const TABLET_MAX_PX = 1366;

/** The same breakpoint as a media query, for markup and `matchMedia`. */
export const TABLET_QUERY = `(max-width: ${TABLET_MAX_PX}px)`;
