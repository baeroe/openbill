import { describe, expect, it } from 'vitest';
import { isPageFilled, observePages } from './lazy';

describe('isPageFilled', () => {
    it('fills every page when not lazy', () => {
        expect(isPageFilled(5, new Set(), false)).toBe(true);
    });

    it('fills the first page at once and others once seen', () => {
        expect(isPageFilled(0, new Set(), true)).toBe(true);
        expect(isPageFilled(1, new Set(), true)).toBe(false);
        expect(isPageFilled(1, new Set([1]), true)).toBe(true);
    });
});

describe('observePages', () => {
    it('reports every page as visible without IntersectionObserver (server rendering, old browsers)', () => {
        const seen: number[] = [];
        const stop = observePages([{} as Element, {} as Element], (index) => seen.push(index));

        expect(seen).toEqual([0, 1]);
        stop();
    });

    it('reports a page when it intersects and stops watching it', () => {
        const unobserved: Element[] = [];
        let callback: IntersectionObserverCallback = () => undefined;
        class FakeObserver {
            constructor(cb: IntersectionObserverCallback) {
                callback = cb;
            }
            observe() {}
            unobserve(element: Element) {
                unobserved.push(element);
            }
            disconnect() {}
        }
        const original = globalThis.IntersectionObserver;
        globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
        const first = { dataset: { page: '1' } } as unknown as Element;
        const second = { dataset: { page: '2' } } as unknown as Element;
        const seen: number[] = [];

        const stop = observePages([first, second], (index) => seen.push(index));
        callback(
            [
                { target: second, isIntersecting: true },
                { target: first, isIntersecting: false },
            ] as unknown as IntersectionObserverEntry[],
            {} as IntersectionObserver,
        );

        expect(seen).toEqual([1]);
        expect(unobserved).toEqual([second]);
        stop();
        globalThis.IntersectionObserver = original;
    });
});
