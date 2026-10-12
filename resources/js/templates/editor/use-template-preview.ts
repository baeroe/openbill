import { useMemo } from 'react';
import useSWR from 'swr';
import { renderTemplate, type TemplateFiles, type TemplateRenderRequest } from '@/api/templates';
import type { RenderResponse } from '@/api/types';
import { createLatest } from '@/editor/latest';
import { useDebounced } from '@/lib/hooks';
import type { SampleSource } from '../scenario';

/**
 * Live preview of the unsaved template: POST /api/render with template_id + all parts, 250 ms after the last change.
 * A newer request aborts the older one (per editor instance), the last answer stays visible meanwhile.
 */
export function useTemplatePreview(templateId: string, files: TemplateFiles, source: SampleSource | null) {
    const render = useMemo(() => createLatest((body: TemplateRenderRequest, signal: AbortSignal) => renderTemplate(body, signal)), []);
    const body = source
        ? JSON.stringify({ template_id: templateId, template: files, ...(source.kind === 'scenario' ? { scenario: source.key } : { document_id: source.id }) })
        : null;
    const debounced = useDebounced(body, 250);

    return useSWR<RenderResponse>(debounced ? ['/api/render', 'template', debounced] : null, ([, , json]: [string, string, string]) => render(JSON.parse(json) as TemplateRenderRequest), {
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        shouldRetryOnError: false,
    });
}
