import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Bar that slides in at the bottom while a settings form has unsaved changes (submit = form submit). */
export function SaveBar({ dirty, pending, onReset, label }: { dirty: boolean; pending: boolean; onReset(): void; label?: string }) {
    if (!dirty && !pending) return null;
    return (
        <div role="region" aria-label={t('settings.unsaved_region')} className="sticky bottom-4 z-20 flex animate-fade-in flex-wrap items-center gap-2 rounded-full bg-ink py-2 pr-2 pl-5 text-sm font-medium text-bg shadow-float">
            <span>{t('settings.unsaved')}</span>
            <span className="flex-1" />
            <button type="button" onClick={onReset} disabled={pending} className="h-control-sm rounded-full px-3 text-bg opacity-75 transition-opacity hover:opacity-100 disabled:opacity-40">
                {t('settings.discard')}
            </button>
            <Button size="sm" variant="primary" type="submit" pending={pending}>
                {label ?? t('settings.save')}
            </Button>
        </div>
    );
}
