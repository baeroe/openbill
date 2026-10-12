type Env = { doc: { activeElement: Element | null }; frame(callback: () => void): unknown };

const FIELD = 'input, textarea, select, [contenteditable="true"]';

/**
 * Focuses an element after React rendered it (next frame) – unless the user went into another field meanwhile.
 * A late programmatic focus would otherwise pull the cursor out of the field being typed in and lose the input
 * (cause of the "invalid number" flake: a new row's title took the focus back from its quantity).
 */
export function focusSoon(target: () => HTMLElement | null | undefined, options: { select?: boolean } = {}, env?: Env): void {
    const { doc, frame } = env ?? { doc: document, frame: (callback: () => void) => requestAnimationFrame(callback) };
    const before = doc.activeElement;
    frame(() => {
        const now = doc.activeElement;
        if (now !== before && now?.matches(FIELD)) return;
        const element = target();
        element?.focus();
        if (options.select) (element as HTMLInputElement | null | undefined)?.select?.();
    });
}

/** Focus after a menu closed: Radix hands the focus back to the trigger in a timeout; this runs after it. */
export function focusAfterMenu(target: () => HTMLElement | null | undefined): void {
    setTimeout(() => setTimeout(() => requestAnimationFrame(() => target()?.focus()), 0), 0);
}
