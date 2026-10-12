import { Link } from '@inertiajs/react';
import { FileQuestion, Lock } from 'lucide-react';
import type { DocumentDetail } from '@/api/types';
import { Notice } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { path, t } from '@/lib/i18n';
import type { SaveState } from '../types';

export function ReadOnlyNotice({ document, saveState }: { document: DocumentDetail; saveState: SaveState }) {
    if (saveState === 'locked') {
        // an alert: screen readers learn at once that the document was finalized elsewhere
        return (
            <div role="alert">
                <Notice tone="warn" icon={<Lock />}>
                    {t('editor.locked_elsewhere')}
                </Notice>
            </div>
        );
    }
    if (saveState === 'gone') {
        return (
            <div role="alert">
                <Notice tone="bad" icon={<FileQuestion />}>
                    {t('editor.gone')}{' '}
                    <Link href={path('/documents')} className="font-medium text-accent">
                        {t('editor.to_documents')}
                    </Link>
                </Notice>
            </div>
        );
    }
    if (!document.is_locked) return null;
    return (
        <Notice tone="accent" icon={<Lock />}>
            {t('editor.read_only', { date: formatDate(document.finalized_at) })}{' '}
            {document.type === 'invoice' ? t('editor.read_only_invoice') : document.type === 'cancellation' ? '' : t('editor.read_only_other')}
            {document.cancelled_by_id && (
                <>
                    {' '}
                    {t('editor.cancelled_by')}{' '}
                    <Link href={path(`/documents/${document.cancelled_by_id}`)} className="font-medium text-accent">
                        {t('editor.cancelled_by_link')}
                    </Link>
                    .
                </>
            )}
        </Notice>
    );
}
