import { Link } from '@inertiajs/react';
import { PagedPreview } from '@openbill/paged-preview';
import { AlertTriangle, Frame } from 'lucide-react';
import { useState } from 'react';
import type { ExpectedField, RenderSources } from '@/api/templates';
import type { RenderErrorItem, RenderResponse } from '@/api/types';
import { Notice, PillButton, Skeleton } from '@/components/ui';
import { isAbort } from '@/editor/latest';
import { path, t, tn } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { errorLabel } from '../errors';
import type { SampleSource } from '../scenario';
import { SamplePicker } from './sample-picker';

type Props = {
    data: RenderResponse | undefined;
    error: unknown;
    highlight: 'header' | 'body' | 'footer' | null;
    sources: RenderSources | undefined;
    source: SampleSource | null;
    missing: ExpectedField[];
    onSource(source: SampleSource): void;
    onJump(error: RenderErrorItem): void;
};

export function PreviewPane({ data, error, highlight, sources, source, missing, onSource, onJump }: Props) {
    const [guides, setGuides] = useStoredFlag('openbill:template-guides', false);
    const [pages, setPages] = useState(1);
    const broken = !!error && !isAbort(error);

    return (
        <section aria-label={t('templates.preview')} className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg bg-surface-2">
            <div className="flex flex-wrap items-center gap-2 p-3">
                <span className="pl-2 text-sm font-strong">{t('templates.preview')}</span>
                <span className="num text-xs text-muted">{tn('editor.pages', pages)}</span>
                <span className="flex-1" />
                {sources && source && <SamplePicker sources={sources} value={source} onChange={onSource} />}
                <PillButton pressed={guides} onClick={() => setGuides(!guides)} title={t('editor.guides_title')}>
                    <Frame aria-hidden className="size-3.5" />
                    {t('editor.guides')}
                </PillButton>
            </div>
            <div className="grid content-start gap-3 overflow-auto px-5 pb-5">
                {missing.length > 0 && (
                    <Notice tone="warn" icon={<AlertTriangle />}>
                        <b>{t('templates.missing_fields')}</b> {missing.map((field) => `${field.scope}.${field.key}`).join(', ')}.{' '}
                        <Link href={path(`/fields?scope=${missing[0].scope}`)}>{t('templates.missing_fields_link')}</Link>
                    </Notice>
                )}
                {data && data.errors.length > 0 && (
                    <Notice tone="bad" icon={<AlertTriangle />}>
                        <b>{t('templates.render_errors')}</b>
                        <ul className="m-0 mt-1 grid list-none gap-0.5 p-0" aria-live="polite">
                            {data.errors.map((item, i) => (
                                <li key={`${item.part}:${item.line}:${i}`}>
                                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onJump(item)}>
                                        <code className="font-mono text-xs">{errorLabel(item)}</code> – {item.message}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Notice>
                )}
                {broken && <Notice tone="bad">{data ? t('editor.preview_stale') : t('editor.preview_failed')}</Notice>}
                {data ? (
                    <PagedPreview
                        parts={data}
                        paper={data.paper}
                        lazy
                        highlight={highlight}
                        showGuides={guides}
                        onPageCount={setPages}
                        labels={{
                            document: t('editor.pp.document'),
                            page: (n) => t('editor.pp.page', { n }),
                            header: t('editor.pp.header'),
                            body: t('editor.pp.body'),
                            footer: t('editor.pp.footer'),
                        }}
                    />
                ) : (
                    !broken && <Skeleton h={520} r={4} />
                )}
            </div>
        </section>
    );
}
