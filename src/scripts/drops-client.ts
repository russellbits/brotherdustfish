// Client behaviour for drops: toggle, collapse, and the two reveals.
//
// Ported from the reference prototype's inline script, with one structural change:
// the reveal runs from a single delegated listener rather than from `hx-on` on each
// link. htmx dispatches `htmx:afterSwap` on the SWAP TARGET — `makeSettleInfo`
// returns `elts: [target]` and the sole trigger site iterates those — so for
// sentence and paragraph modes the event fires on an anchor or a paragraph that is
// a SIBLING of the link, and an `hx-on` listener on the link never sees it. The
// reveal would silently not run for two of the three modes.
//
// One listener registered at module scope also avoids the prototype's bug, where a
// `{ once: true }` listener was added to `document.body` on every toggle and they
// accumulated whenever a swap never landed.
//
// The DOM work is verified in the browser; there is no DOM implementation available
// to node:test here. What is unit-tested is the logic that fails quietly — which
// reveal a fragment asks for, and which element the fragment is.

const WORD_DELAY_MS = 60;

/** Slightly longer than the collapse animation, so the fallback only ever fires if
 * no animation did — see the note in collapseExpansion. */
const COLLAPSE_FALLBACK_MS = 400;

/** The least an element must offer for this module's decisions. Structural, so it is testable without a DOM. */
export interface RevealElement {
    id: string;
    getAttribute(name: string): string | null;
    classList: { add(token: string): void };
}

/**
 * Whether a fragment asked to fade rather than be revealed word by word. The
 * decision was made at build time by `revealFor`, and travels here as
 * `data-drop-reveal` on the wrapper.
 */
export function shouldFade(element: { getAttribute(name: string): string | null }): boolean {
    return element.getAttribute('data-drop-reveal') === 'fade';
}

/**
 * The fragment htmx inserted after `target`.
 *
 * Every mode swaps `afterend`, so the new fragment is always the target's next
 * element sibling — including inline mode, where the fragment lands between the
 * link and the indicator span. Identified by the `-exp` id suffix, which is the
 * only marker that distinguishes it from the indicator.
 */
export function insertedAfter(target: { nextElementSibling: unknown }): RevealElement | null {
    const next = target.nextElementSibling as RevealElement | null | undefined;

    return next && typeof next.id === 'string' && next.id.endsWith('-exp') ? next : null;
}

function wrapTextNodes(node: Node, counter: { index: number }): void {
    if (node.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();

        for (const token of (node.textContent ?? '').split(/(\s+)/)) {
            if (token === '' || /^\s+$/.test(token)) {
                fragment.appendChild(document.createTextNode(token));
                continue;
            }

            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = token;
            span.style.animationDelay = `${counter.index * WORD_DELAY_MS}ms`;
            counter.index += 1;
            fragment.appendChild(span);
        }

        node.parentNode?.replaceChild(fragment, node);
        return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) wrapTextNodes(child, counter);
    }
}

/** Tokenise a fragment's text into staggered `.word` spans. */
export function revealWordByWord(element: Element): void {
    wrapTextNodes(element, { index: 0 });
}

/**
 * Collapse is a DOM-only operation: mark the fragment as collapsing, remove it when
 * the animation ends, and re-enable the link. Nothing is cached and no state is
 * kept, which is what leaves nothing for the server to re-derive.
 */
export function collapseExpansion(element: Element, link: Element, done?: () => void): void {
    element.classList.add('collapsing');

    let finished = false;

    const finish = () => {
        if (finished) return;
        finished = true;
        element.remove();
        link.classList.remove('expanded');
        done?.();
    };

    element.addEventListener('animationend', finish, { once: true });

    // A fallback, not a nicety: removal must not depend on an animation firing.
    // An element whose reveal animation has already run keeps that animation-name,
    // so adding the collapse class can start nothing at all — which is exactly what
    // happened to image drops and left the figure on screen with no way to dismiss
    // it. A timeout means the node always goes.
    window.setTimeout(finish, COLLAPSE_FALLBACK_MS);
}

/**
 * Click handler for a drop link. Exposed on `window` because the markup's `onclick`
 * attribute refers to it by name.
 */
export function handleToggle(event: Event, expansionId: string): void {
    const link = event.currentTarget;

    if (!(link instanceof Element)) return;

    const existing = document.getElementById(expansionId);

    if (existing) {
        // Stop htmx refetching while the fragment is animating out.
        link.setAttribute('hx-disable', '');
        event.preventDefault();
        event.stopPropagation();

        collapseExpansion(existing, link, () => link.removeAttribute('hx-disable'));
        return;
    }

    link.classList.add('expanded');
}

/**
 * The in-content collapse control.
 *
 * A figure can be tall enough to push its own term off the screen — the sample image
 * is 670px on a phone — so the affordance that dismisses it sits with the figure
 * rather than only on the link far above. It goes through the same
 * `collapseExpansion` the link uses, so the two cannot drift apart.
 */
export function handleCollapseControl(event: Event): void {
    const origin = event.target;
    if (!(origin instanceof Element)) return;

    const control = origin.closest('[data-collapse]');
    if (!control) return;

    const expansion = control.closest('[id$="-exp"]');
    if (!expansion) return;

    // The wrapper's id is the link's id plus a suffix, so the link is derivable
    // rather than having to be passed through the fragment.
    const link = document.getElementById(expansion.id.replace(/-exp$/, ''));
    if (!link) return;

    event.preventDefault();
    // The same handshake the link performs: htmx must not refetch while it animates
    // out, and a later click on the link re-expands.
    link.setAttribute('hx-disable', '');
    collapseExpansion(expansion, link, () => link.removeAttribute('hx-disable'));
}

/** Delegated reveal for every swap, whichever element the mode targeted. */
export function handleReveal(event: Event): void {
    const target = (event as CustomEvent<{ elt?: unknown }>).detail?.elt;

    if (!target || typeof target !== 'object') return;

    const inserted = insertedAfter(target as { nextElementSibling: unknown });

    if (!inserted) return;

    if (shouldFade(inserted)) inserted.classList.add('expansion-fade');
    else revealWordByWord(inserted as unknown as Element);
}

if (typeof document !== 'undefined') {
    document.addEventListener('htmx:afterSwap', handleReveal);
    document.addEventListener('click', handleCollapseControl);
    Object.assign(window, { handleToggle });
}
