import { PagedPreview } from '@openbill/paged-preview';
import { Download, Frame, PanelRightClose } from 'lucide-react';
import { useState } from 'react';
import type { ComplianceProfile, RenderResponse } from '@/api/types';
import { Button, Notice, PillButton, Skeleton, Tabs } from '@/components/ui';
import { t, tn } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { isAbort } from '../latest';
import { XmlView } from './xml-view';

type Tab = 'preview' | 'xml';

type Props = {
    documentId: string;
    profile: ComplianceProfile;
    finalized: boolean;
    data: RenderResponse | undefined;
    error: unknown;
    templateName: string;
    onClose(): void;
    onPdf(): void;
};

/** Pages exactly as the PDF: server-rendered header, body and footer, split into pages by packages/paged-preview. */
export function PreviewPane({ documentId, profile, finalized, data, error, templateName, onClose, onPdf }: Props) {
    const [tab, setTab] = useState<Tab>('preview');
    const [guides, setGuides] = useStoredFlag('openbill:editor-guides', false);
    const [pages, setPages] = useState(1);
    const strict = profile === 'en16931';
    const active: Tab = strict ? tab : 'preview';
    const failed = !!error && !isAbort(error) && !data;

    return (
        <aside aria-label={t('editor.preview')} className="ed-pane grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl bg-bg">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
                {strict ? (
                    <Tabs<Tab> label={t('editor.view')} value={active} onChange={setTab} items={[{ value: 'preview', label: t('editor.preview') }, { value: 'xml', label: t('editor.e_invoice') }]} />
                ) : (
                    <span className="font-heading">{t('editor.preview')}</span>
                )}
                <span className="flex-1" />
                {active === 'preview' && (
                    <PillButton pressed={guides} onClick={() => setGuides(!guides)} title={t('editor.guides_title')} aria-label={t('editor.guides')}>
                        <Frame aria-hidden className="size-3.5" />
                        <span className="ed-pane__label">{t('editor.guides')}</span>
                    </PillButton>
                )}
                <Button size="sm" variant="ghost" iconOnly icon={<Download />} onClick={onPdf}>
                    {t('editor.pdf')}
                </Button>
                <Button size="sm" variant="ghost" iconOnly icon={<PanelRightClose />} onClick={onClose}>
                    {t('editor.preview_hide')}
                </Button>
            </div>

            <div className="ed-pane__body grid content-start gap-3 overflow-auto px-5 pt-2 pb-5">
                {active === 'xml' ? (
                    <XmlView documentId={documentId} finalized={finalized} />
                ) : (
                    <>
                        {data?.errors.map((item, i) => (
                            <Notice key={i} tone="bad">
                                {t('editor.template_error', { file: item.file ?? item.part, line: item.line ?? '–', message: item.message })}
                            </Notice>
                        ))}
                        {failed && <Notice tone="bad">{t('editor.preview_failed')}</Notice>}
                        {data ? (
                            <PagedPreview
                                parts={data}
                                paper={data.paper}
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
                            !failed && <Skeleton h={520} r={4} />
                        )}
                        <p className="text-center text-xs text-muted">
                            {tn('editor.pages', pages)} · {t('editor.preview_template', { name: templateName })}
                        </p>
                    </>
                )}
            </div>
        </aside>
    );
}
