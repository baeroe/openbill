import useSWR from 'swr';
import { renderPreview, type RenderRequest } from '@/api/documents';
import type { RenderResponse } from '@/api/types';
import { useDebounced } from '@/lib/hooks';
import { createLatest } from './latest';
import { toPayload } from './ops';
import type { Draft } from './types';

const render = createLatest((body: RenderRequest, signal: AbortSignal) => renderPreview(body, signal));

/**
 * Live preview: POST /api/render 250 ms after the last change with the whole local draft; a newer request aborts the
 * older one, the last answer stays visible meanwhile. Totals, line and group sums and issues come from this answer.
 * Finalized documents (draft null) render from their snapshot.
 */
export function useRenderPreview(id: string, draft: Draft | null) {
    const body = JSON.stringify(draft ? { document_id: id, draft: toPayload(draft) } : { document_id: id });
    const debounced = useDebounced(body, 250);
    return useSWR<RenderResponse>(['/api/render', debounced], ([, json]: [string, string]) => render(JSON.parse(json) as RenderRequest), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
    });
}
