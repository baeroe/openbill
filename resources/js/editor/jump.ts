/** Scrolls to the field with this data-path, focuses its first input and lets it light up briefly (.flash in editor.css). */
export function jumpTo(path: string): boolean {
    const element = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    if (!element) return false;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = element.matches('input, select, textarea') ? element : element.querySelector<HTMLElement>('input, select, textarea, button');
    window.setTimeout(() => input?.focus({ preventScroll: true }), 250);
    element.classList.remove('flash');
    void element.offsetWidth; // restart the animation
    element.classList.add('flash');
    return true;
}

/**
 * Jump for an issue or a field error: a row inside a collapsed group is not in the DOM, so `expand` opens all groups
 * first; a field that does not exist (anymore) falls back to its area.
 */
export function jumpToIssue(path: string, expand: () => void): void {
    if (jumpTo(path)) return;
    expand();
    requestAnimationFrame(() => {
        if (jumpTo(path)) return;
        jumpTo(path.startsWith('positions.') || path.startsWith('groups.') ? 'positions' : path.split('.').slice(0, 2).join('.'));
    });
}
