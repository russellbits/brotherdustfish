/**
 * The reading-scale steps the text-size buttons move through, in order.
 *
 * Steps are *names*, not percentages, because the sizes themselves are declared in
 * CSS: the attribute carries a name, and the stylesheet resolves it. That way JS
 * cannot hold a number that disagrees with the CSS.
 */
export const FONT_SCALE_STEPS = ['xs', 's', 'm', 'l', 'xl'] as const;

export type FontScaleStep = (typeof FONT_SCALE_STEPS)[number];

/** The step a reader starts on, and the one an unrecognised stored value falls back to. */
export const DEFAULT_FONT_SCALE_STEP: FontScaleStep = 'm';

/** The attribute carrying the step, so the stylesheet owns the actual sizes. */
export const FONT_SCALE_ATTRIBUTE = 'data-font-scale';

export function isFontScaleStep(value: unknown): value is FontScaleStep {
    return typeof value === 'string' && (FONT_SCALE_STEPS as readonly string[]).includes(value);
}

function indexOf(value: unknown): number {
    return FONT_SCALE_STEPS.indexOf(isFontScaleStep(value) ? value : DEFAULT_FONT_SCALE_STEP);
}

/** The next step in `direction`, clamped at both ends. */
export function nextFontScale(current: unknown, direction: 'up' | 'down'): FontScaleStep {
    const next = indexOf(current) + (direction === 'up' ? 1 : -1);
    const clamped = Math.max(0, Math.min(FONT_SCALE_STEPS.length - 1, next));

    return FONT_SCALE_STEPS[clamped];
}

/** Whether `direction` is already at its end, so its button can be disabled. */
export function isAtLimit(current: unknown, direction: 'up' | 'down'): boolean {
    const index = indexOf(current);

    return direction === 'up' ? index === FONT_SCALE_STEPS.length - 1 : index === 0;
}
