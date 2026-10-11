import { Head } from '@inertiajs/react';
import { useMemo } from 'react';
import type { DocumentDetail, DocumentPageContext } from '@/api/types';
import { t } from '@/lib/i18n';
import { fromDocument } from '../ops';
import { useEditor } from '../store';
import { useAutosave } from '../use-autosave';
import { ChainBar } from './chain-bar';
import { EditorHeader } from './editor-header';
import { HeaderFields } from './header-fields';
import { ReadOnlyNotice } from './read-only-notice';
import { TextsSection } from './texts-section';

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
    const issues = readOnly ? [] : document.issues;
    const messages = useMemo(() => ({ ...Object.fromEntries(issues.map((issue) => [issue.path, issue.message])), ...errors }), [issues, errors]);
    const title = `${t(`document_type.${document.type}`)} ${document.number ?? t('overview.draft_label')}`;

    return (
        <div className="ed">
            <Head title={title} />
            <div className="ed-main">
                <EditorHeader document={document} title={title} saveState={saveState} onRetry={autosave.retry} />
                <ChainBar chain={context.chain} currentId={document.id} />
                <ReadOnlyNotice document={document} saveState={saveState} />
                <section className="grid min-w-0 gap-4">
                    <HeaderFields draft={draft} context={context} readOnly={readOnly} messages={messages} customerName={document.customer_name} update={update} />
                </section>
                <TextsSection which="intro" value={draft.intro} readOnly={readOnly} error={messages['document.intro']} onChange={(intro) => update((d) => ({ ...d, intro }))} />
                <TextsSection which="closing" value={draft.closing} readOnly={readOnly} error={messages['document.closing']} onChange={(closing) => update((d) => ({ ...d, closing }))} />
            </div>
        </div>
    );
}
