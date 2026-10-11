import type { ReactNode } from 'react';
import { SWRConfig, type SWRConfiguration } from 'swr';
import { api, ApiError } from '@/lib/api';

export const fetcher = (url: string): Promise<unknown> => api<unknown>(url);

export const swrConfig: SWRConfiguration = {
    fetcher,
    // filters and searches keep showing the last rows while the next answer loads
    keepPreviousData: true,
    // client errors (404, 403, 422) don't get better by asking again
    shouldRetryOnError: (error: unknown) => !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    errorRetryCount: 2,
    focusThrottleInterval: 30_000,
};

export function ApiProvider({ children }: { children: ReactNode }) {
    return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
