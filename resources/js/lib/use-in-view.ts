import { useCallback, useEffect, useState } from 'react';

/**
 * true once the element came near the viewport (and stays true): galleries render their previews only then.
 * Without IntersectionObserver the element counts as visible.
 */
export function useInView<T extends Element>(rootMargin = '200px'): [(node: T | null) => void, boolean] {
    const [node, setNode] = useState<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!node || inView) return;
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, inView, rootMargin]);

    return [useCallback((element: T | null) => setNode(element), []), inView];
}
