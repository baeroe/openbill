import { Head } from '@inertiajs/react';
import { FileQuestion } from 'lucide-react';
import { useDocument } from '@/api/documents';
import type { DocumentPageContext } from '@/api/types';
import { ButtonLink, EmptyState, ErrorState, Page } from '@/components/ui';
import { Editor } from '@/editor/components/editor';
import { EditorSkeleton } from '@/editor/components/editor-skeleton';
import { appLayout } from '@/layouts/app-shell';
import { ApiError } from '@/lib/api';
import { path, t } from '@/lib/i18n';

/** Document editor (/{locale}/documents/{id}): the document from GET /api/documents/{id}, the page context from Inertia. */
export default function DocumentPage({ document_id: id, context }: { document_id: string; context: DocumentPageContext }) {
    const { data: document, error, mutate } = useDocument(id);

    if (error && !document) {
        return (
            <Page>
                <Head title={t('nav.documents')} />
                {error instanceof ApiError && error.status === 404 ? (
                    <EmptyState
                        icon={<FileQuestion />}
                        title={t('editor.not_found')}
                        actions={
                            <ButtonLink href={path('/documents')} variant="primary">
                                {t('editor.to_documents')}
                            </ButtonLink>
                        }
                    >
                        {t('editor.not_found_text')}
                    </EmptyState>
                ) : (
                    <ErrorState error={error} onRetry={() => void mutate()} />
                )}
            </Page>
        );
    }
    if (!document) return <EditorSkeleton />;
    return <Editor key={id} document={document} context={context} />;
}

DocumentPage.layout = appLayout;
