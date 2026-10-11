import { Check, CloudOff, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DocumentDetail } from '@/api/types';
import { Button, cx, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { SaveState } from '../types';

const LABEL: Partial<Record<SaveState, string>> = {
    saved: 'editor.save.saved',
    dirty: 'editor.save.dirty',
    saving: 'editor.save.saving',
    error: 'editor.save.error',
    invalid: 'editor.save.invalid',
};

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry(): void }) {
    const label = LABEL[state];
    if (!label) return null;
    const bad = state === 'error' || state === 'invalid';
    return (
        <span className="inline-flex items-center gap-1">
            <span data-testid="save-status" role="status" className={cx('inline-flex items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5', bad ? 'text-bad' : 'text-muted')}>
                {state === 'saved' ? <Check aria-hidden /> : bad ? <CloudOff aria-hidden /> : <span aria-hidden className={cx('size-[7px] rounded-full', state === 'saving' ? 'animate-pulse bg-accent' : 'bg-faint')} />}
                {t(label)}
            </span>
            {state === 'error' && (
                <Button size="sm" variant="ghost" iconOnly icon={<RotateCw />} onClick={onRetry}>
                    {t('common.retry')}
                </Button>
            )}
        </span>
    );
}

export function EditorHeader({ document, title, saveState, onRetry, children }: { document: DocumentDetail; title: string; saveState: SaveState; onRetry(): void; children?: ReactNode }) {
    const typeLabel = t(`document_type.${document.type}`);
    return (
        <header className="ed-head flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="grid min-w-0 flex-[1_1_18rem] gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-title" aria-label={title}>
                        {typeLabel} <span className="num font-semibold text-muted">{document.number ?? t('overview.draft_label')}</span>
                    </h1>
                    <StatusBadge status={document.status} overdue={document.is_overdue} />
                </div>
                <p className="truncate text-sm text-muted">
                    {document.customer_name ?? t('documents.no_customer')}
                    {document.finalized_at && <> · {t('editor.finalized_on', { date: formatDate(document.finalized_at) })}</>}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {!document.is_locked && <SaveStatus state={saveState} onRetry={onRetry} />}
                {children}
            </div>
        </header>
    );
}
