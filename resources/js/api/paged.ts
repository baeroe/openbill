import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { apiPage, type Page } from '@/lib/api';

export type PagedList<T> = {
    items: T[];
    total: number;
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    error: unknown;
    loadMore(): void;
    retry(): void;
};

/** Mounted paginated lists. SWR's filter-mutate skips useSWRInfinite keys, so invalidate() reaches them here. */
const mountedLists = new Set<{ firstPage: string; revalidate(): void }>();

/**
 * Reloads every cached request whose URL starts with `prefix` (lists, pickers, details) after a write.
 * `except` keeps keys that already hold the fresh answer (the saved detail) or must stay until the page leaves.
 */
export function invalidate(prefix: string, except: string[] = []): Promise<unknown> {
    for (const list of mountedLists) if (list.firstPage.startsWith(prefix)) list.revalidate();
    return mutate((key) => typeof key === 'string' && key.startsWith(prefix) && !except.includes(key));
}

/** A paginated collection with "load more". `key(page)` gives the URL of a page (1-based). */
export function usePagedList<T>(key: (page: number) => string): PagedList<T> {
    const swr = useSWRInfinite<Page<T>>(
        (index, previous: Page<T> | null) => (previous && !previous.hasMore ? null : key(index + 1)),
        (url: string) => apiPage<T>(url),
        // a list shown again after a write elsewhere reloads all its loaded pages, not only the first
        { revalidateAll: true },
    );
    const firstPage = key(1);
    const revalidate = useRef(swr.mutate);
    revalidate.current = swr.mutate;
    useEffect(() => {
        const entry = { firstPage, revalidate: () => void revalidate.current() };
        mountedLists.add(entry);
        return () => void mountedLists.delete(entry);
    }, [firstPage]);
    const pages = swr.data ?? [];

    return {
        items: pages.flatMap((page) => page.items),
        total: pages[0]?.total ?? 0,
        hasMore: pages.at(-1)?.hasMore ?? false,
        isLoading: swr.isLoading,
        isLoadingMore: swr.size > 0 && swr.data !== undefined && swr.data[swr.size - 1] === undefined,
        error: swr.error,
        loadMore: () => void swr.setSize(swr.size + 1),
        retry: () => void swr.mutate(),
    };
}
