import { router } from '@inertiajs/react';
import { useState } from 'react';
import { mutate } from 'swr';
import { cancelInvoice, convertDocument, deleteDocument, duplicateDocument, finalizeDocument, setDocumentStatus } from '@/api/documents';
import { keys } from '@/api/keys';
import type { DocumentDetail, DocumentStatus, DocumentType, Issue } from '@/api/types';
import { ApiError, errorMessage } from '@/lib/api';
import { path, t, tn } from '@/lib/i18n';
import { scheduleDelete } from '@/lib/pending-delete';
import { toast } from '@/lib/toast';
import { jumpToIssue } from './jump';
import { violationPath } from './paths';
import { useEditor } from './store';

type Running = 'finalize' | 'status' | 'convert' | 'cancel' | 'duplicate';

export type DocumentActions = {
    pending: Running | null;
    finalizeOpen: boolean;
    cancelOpen: boolean;
    startFinalize(): Promise<void>;
    confirmFinalize(): Promise<void>;
    closeFinalize(): void;
    setStatus(status: DocumentStatus): Promise<void>;
    convert(type: DocumentType): Promise<void>;
    openCancel(): void;
    confirmCancel(): Promise<void>;
    closeCancel(): void;
    duplicate(): Promise<void>;
    remove(): void;
    openPdf(): Promise<void>;
};

type Args = { document: DocumentDetail; issues: Issue[]; flush(): Promise<void>; stop(): void; expand(): void };

/**
 * The document actions of the editor. Every rule (may this be finalized, converted, cancelled?) is the server's:
 * the buttons follow the page context, the API answers with the new document or a problem.
 */
export function useDocumentActions({ document, issues, flush, stop, expand }: Args): DocumentActions {
    const [pending, setPending] = useState<Running | null>(null);
    const [finalizeOpen, setFinalizeOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const label = (type: DocumentType) => t(`document_type.${type}`);

    const report = (error: unknown) => {
        toast.error(errorMessage(error));
        // a refused finalize lists the compliance issues as violations: jump to the first one
        const first = error instanceof ApiError ? error.violations[0] : undefined;
        if (first) jumpToIssue(violationPath(useEditor.getState().draft ?? { groups: [] }, first.path), expand);
    };

    const run = async (name: Running, job: () => Promise<void>) => {
        setPending(name);
        try {
            await job();
        } catch (error) {
            report(error);
        } finally {
            setPending(null);
        }
    };

    /** The answer is the changed document: into the cache, then the page context (allowed actions, chain) anew. */
    const settle = async (saved: DocumentDetail) => {
        await mutate(keys.document(saved.id), saved, { revalidate: false });
        router.reload({ only: ['context'] });
    };

    /** Another document came out of the action: cache it (no skeleton) and open it. */
    const open = async (created: DocumentDetail) => {
        await mutate(keys.document(created.id), created, { revalidate: false });
        router.visit(path(`/documents/${created.id}`));
    };

    return {
        pending,
        finalizeOpen,
        cancelOpen,
        startFinalize: async () => {
            if (issues.length > 0) {
                toast.error(tn('editor.finalize_blocked', issues.length));
                jumpToIssue(issues[0].path, expand);
                return;
            }
            await flush();
            // invalid input or a conflict: the save status and the notice say why
            if (useEditor.getState().saveState !== 'saved') return;
            router.reload({ only: ['context'] }); // number preview for the current date
            setFinalizeOpen(true);
        },
        confirmFinalize: () =>
            run('finalize', async () => {
                try {
                    const saved = await finalizeDocument(document.id);
                    await settle(saved);
                    toast.success(t('editor.finalized', { type: label(saved.type), number: saved.number ?? '' }));
                } finally {
                    setFinalizeOpen(false);
                }
            }),
        closeFinalize: () => setFinalizeOpen(false),
        setStatus: (status) =>
            run('status', async () => {
                await settle(await setDocumentStatus(document.id, status));
                toast.success(t('editor.status_set', { status: t(`status.${status}`) }));
            }),
        convert: (type) =>
            run('convert', async () => {
                const created = await convertDocument(document.id, type);
                await open(created);
                toast.success(t('editor.converted', { type: label(type) }));
                if (created.dropped_fields.length > 0) toast.info(t('editor.dropped_fields', { type: label(type), fields: created.dropped_fields.join(', ') }));
            }),
        openCancel: () => setCancelOpen(true),
        confirmCancel: () =>
            run('cancel', async () => {
                try {
                    await open(await cancelInvoice(document.id));
                    toast.success(t('editor.converted', { type: label('cancellation') }));
                } finally {
                    setCancelOpen(false);
                }
            }),
        closeCancel: () => setCancelOpen(false),
        duplicate: () =>
            run('duplicate', async () => {
                await flush();
                await open(await duplicateDocument(document.id));
                toast.success(t('editor.duplicated'));
            }),
        remove: () => {
            // nothing may be saved anymore; an undo loads the draft fresh from the server
            stop();
            useEditor.getState().reset();
            const id = document.id;
            const pendingDelete = scheduleDelete(id, (options) => deleteDocument(id, options));
            router.visit(path('/documents'));
            toast.success(t('editor.deleted'), {
                label: t('editor.undo'),
                run: () => {
                    if (!pendingDelete.undo()) return;
                    router.visit(path(`/documents/${id}`));
                    toast.info(t('editor.restored'));
                },
                onExpire: () => void pendingDelete.commit().catch((error: unknown) => toast.error(errorMessage(error))),
            });
        },
        openPdf: async () => {
            // a draft renders live (with watermark): save first, so the PDF shows what is on screen
            if (!document.is_locked) await flush();
            window.open(keys.documentPdf(document.id), '_blank', 'noopener');
        },
    };
}
