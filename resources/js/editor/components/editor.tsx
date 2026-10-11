import { Head } from '@inertiajs/react';
import { PanelRightOpen } from 'lucide-react';
import { useMemo } from 'react';
import type { DocumentDetail, DocumentPageContext } from '@/api/types';
import { Button, cx, Tag } from '@/components/ui';
import { t } from '@/lib/i18n';
import { useStoredFlag } from '@/lib/prefs';
import { jumpToIssue } from '../jump';
import { fromDocument } from '../ops';
import { useEditor } from '../store';
import { useDocumentActions } from '../use-actions';
import { useAutosave } from '../use-autosave';
import { useRenderPreview } from '../use-preview';
import { ChainBar } from './chain-bar';
import { CompliancePanel } from './compliance-panel';
import { EditorActions } from './editor-actions';
import { EditorHeader } from './editor-header';
import { GroupsEditor } from './groups-editor';
import { HeaderFields } from './header-fields';
import { PreviewPane } from './preview-pane';
import { ReadOnlyNotice } from './read-only-notice';
import { TextsSection } from './texts-section';
import { TotalsPanel } from './totals-panel';

/** The document editor. Keyed by document id in the page: one instance (and one autosave) per document. */
export function Editor({ document, context }: { document: DocumentDetail; context: DocumentPageContext }) {
    const autosave = useAutosave(document.id, document);
    const stored = useEditor((state) => state.draft);
    const saveState = useEditor((state) => state.saveState);
    const errors = useEditor((state) => state.errors);
    const update = useEditor((state) => state.update);
    // first render (before the store has loaded this document): show the server state
    const fallback = useMemo(() => fromDocument(document), [document]);
    const draft = stored?.id === document.id ? stored : fallback;
    const readOnly = draft.status !== 'draft' || saveState === 'locked' || saveState === 'gone';
    const [previewOpen, setPreviewOpen] = useStoredFlag('openbill:editor-preview', true);
    const preview = useRenderPreview(document.id, readOnly ? null : draft);
    // totals and issues come from the server: the last render answer, until then the saved document's
    const totals = preview.data?.totals ?? document.totals;
    const issues = readOnly ? [] : (preview.data?.issues ?? document.issues);
    const expandAll = useEditor((state) => state.expandAll);
    const jump = (target: string) => jumpToIssue(target, expandAll);
    const templateName = context.templates.find((template) => template.id === draft.template_id)?.name ?? '–';
    const actions = useDocumentActions({ document, issues, flush: autosave.flush, expand: expandAll });
    const messages = useMemo(() => ({ ...Object.fromEntries(issues.map((issue) => [issue.path, issue.message])), ...errors }), [issues, errors]);
    const title = `${t(`document_type.${document.type}`)} ${document.number ?? t('overview.draft_label')}`;

    return (
        <div className={cx('ed', previewOpen && 'ed--with-preview')}>
            <Head title={title} />
            <div className="ed-main">
                <EditorHeader document={document} title={title} saveState={saveState} onRetry={autosave.retry}>
                    {!previewOpen && (
                        <Button variant="ghost" iconOnly icon={<PanelRightOpen />} onClick={() => setPreviewOpen(true)}>
                            {t('editor.preview_show')}
                        </Button>
                    )}
                    <EditorActions document={document} context={context} actions={actions} />
                </EditorHeader>
                <ChainBar chain={context.chain} currentId={document.id} />
                <ReadOnlyNotice document={document} saveState={saveState} />
                <section className="grid min-w-0 gap-4">
                    <HeaderFields draft={draft} context={context} readOnly={readOnly} messages={messages} customerName={document.customer_name} update={update} />
                </section>
                <TextsSection which="intro" value={draft.intro} readOnly={readOnly} error={messages['document.intro']} onChange={(intro) => update((d) => ({ ...d, intro }))} />
                <section className="grid min-w-0 gap-4" aria-labelledby="positions-heading">
                    <div className="flex flex-wrap items-center gap-3">
                        <h2 id="positions-heading" className="text-lg font-heading">
                            {t('editor.positions')}
                        </h2>
                        {context.small_business && <Tag neutral>{t('editor.small_business')}</Tag>}
                    </div>
                    <GroupsEditor draft={draft} totals={totals} smallBusiness={context.small_business} readOnly={readOnly} messages={messages} update={update} />
                    <TotalsPanel totals={totals} />
                </section>
                <TextsSection which="closing" value={draft.closing} readOnly={readOnly} error={messages['document.closing']} onChange={(closing) => update((d) => ({ ...d, closing }))} />
                {!readOnly && <CompliancePanel issues={issues} profile={context.profile} customerId={draft.customer_id} onJump={jump} />}
            </div>
            {previewOpen && (
                <div className="ed-preview">
                    <PreviewPane
                        documentId={document.id}
                        profile={context.profile}
                        finalized={document.is_locked}
                        data={preview.data}
                        error={preview.error}
                        templateName={templateName}
                        onClose={() => setPreviewOpen(false)}
                        onPdf={() => void actions.openPdf()}
                    />
                </div>
            )}
        </div>
    );
}
