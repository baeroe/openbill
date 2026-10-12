/** Page 1 always, every other page once it was seen (lazy) – or all pages (not lazy). */
export function isPageFilled(index: number, filled: ReadonlySet<number>, lazy: boolean): boolean {
    return !lazy || index === 0 || filled.has(index);
}

/**
 * Calls onVisible(index) once per page element (data-page = index + 1) when it comes near the viewport. The
 * viewport check includes clipping by scrolling ancestors (preview panes), see the IntersectionObserver spec.
 * Without IntersectionObserver every page counts as visible.
 */
export function observePages(elements: Element[], onVisible: (index: number) => void, rootMargin = '300px'): () => void {
    if (typeof IntersectionObserver === 'undefined') {
        elements.forEach((_, index) => onVisible(index));
        return () => undefined;
    }
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const page = Number((entry.target as HTMLElement).dataset.page);
                if (Number.isFinite(page)) onVisible(page - 1);
                observer.unobserve(entry.target);
            }
        },
        { rootMargin },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
}
