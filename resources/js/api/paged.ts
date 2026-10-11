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

/** A paginated collection with "load more". `key(page)` gives the URL of a page (1-based). */
export function usePagedList<T>(key: (page: number) => string): PagedList<T> {
    const swr = useSWRInfinite<Page<T>>(
        (index, previous: Page<T> | null) => (previous && !previous.hasMore ? null : key(index + 1)),
        (url: string) => apiPage<T>(url),
    );
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
