import type { ReactNode } from 'react';
import type { DocumentStatus } from '@/api/types';
import { t } from '@/lib/i18n';
import { cx } from './cx';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ink';

const TONES: Record<Tone, string> = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    ink: 'bg-ink text-bg',
};

/** Pill with a dot in the text color; `plain` without the dot (counters). */
export function Badge({ tone = 'neutral', plain = false, children, className }: { tone?: Tone; plain?: boolean; children: ReactNode; className?: string }) {
    return (
        <span
            className={cx(
                'inline-flex h-6 items-center gap-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                plain ? 'px-2' : 'pr-2 pl-2 before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-[""]',
                TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

const STATUS_TONES: Record<DocumentStatus, Tone> = {
    draft: 'neutral',
    open: 'accent',
    accepted: 'ok',
    rejected: 'bad',
    done: 'ok',
    paid: 'ok',
    cancelled: 'neutral',
    closed: 'neutral',
};

/** Status of a document; an overdue invoice shows "Overdue" instead of "Open" (overdue is no status). */
export function StatusBadge({ status, overdue = false }: { status: DocumentStatus; overdue?: boolean }) {
    if (overdue) return <Badge tone="bad">{t('status.overdue')}</Badge>;
    return <Badge tone={STATUS_TONES[status]}>{t(`status.${status}`)}</Badge>;
}

const TAG_TONES = { accent: 'bg-accent-soft text-accent', neutral: 'bg-surface-2 text-muted', bad: 'bg-bad-soft text-bad' } as const;

/** Small label without dot; `neutral` is short for tone="neutral". */
export function Tag({ tone, neutral = false, children, className }: { tone?: keyof typeof TAG_TONES; neutral?: boolean; children: ReactNode; className?: string }) {
    return (
        <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-px text-xs font-medium whitespace-nowrap [&_svg]:size-3', TAG_TONES[tone ?? (neutral ? 'neutral' : 'accent')], className)}>
            {children}
        </span>
    );
}
