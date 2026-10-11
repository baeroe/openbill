import { AlertTriangle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';
import { t } from '@/lib/i18n';
import { Button } from './button';
import { cx } from './cx';

export function Skeleton({ w = '100%', h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
    return (
        <span
            aria-hidden
            className={cx('block animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-3)_50%,var(--surface-2)_75%)] bg-[length:400%_100%]', className)}
            style={{ width: w, height: h, borderRadius: r }}
        />
    );
}

/** Placeholder in the shape of a list. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="grid gap-4 px-5 py-4" aria-busy="true" aria-label={t('common.loading')}>
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <Skeleton w={96} h={12} />
                    <Skeleton w={`${40 + ((i * 17) % 30)}%`} h={12} />
                    <span className="flex-1" />
                    <Skeleton w={72} h={20} r={999} />
                    <Skeleton w={84} h={12} />
                </div>
            ))}
        </div>
    );
}

export function EmptyState({ icon, title, children, actions, compact = false }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode; compact?: boolean }) {
    return (
        <div className={cx('grid animate-fade-in justify-items-center gap-3 text-center', compact ? 'px-4 py-6' : 'px-6 py-12')}>
            <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-[1.375rem]">{icon}</div>
            <h3 className="text-lg">{title}</h3>
            {children && <p className="max-w-[46ch] text-muted">{children}</p>}
            {actions && <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>}
        </div>
    );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
    return (
        <div role="alert" className="grid animate-fade-in justify-items-center gap-3 px-6 py-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad [&_svg]:size-[1.375rem]">
                <AlertTriangle aria-hidden />
            </div>
            <h3 className="text-lg">{title ?? t('errors.title')}</h3>
            <p className="max-w-[46ch] text-muted">{errorMessage(error)}</p>
            {onRetry && (
                <div className="mt-2">
                    <Button icon={<RotateCw />} onClick={onRetry}>
                        {t('common.retry')}
                    </Button>
                </div>
            )}
        </div>
    );
}

export type NoticeTone = 'neutral' | 'warn' | 'ok' | 'bad' | 'accent';

const NOTICE_TONES: Record<NoticeTone, string> = {
    neutral: 'bg-surface-2',
    warn: 'bg-warn-soft text-warn',
    ok: 'bg-ok-soft text-ok',
    bad: 'bg-bad-soft text-bad',
    accent: 'bg-accent-soft text-accent',
};

export function Notice({ tone = 'neutral', icon, children, className }: { tone?: NoticeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cx('flex items-start gap-3 rounded-md px-4 py-3 text-sm [&_b]:font-heading [&>svg]:mt-px [&>svg]:size-[1.1rem] [&>svg]:shrink-0', NOTICE_TONES[tone], className)}>
            {icon}
            <span>{children}</span>
        </div>
    );
}
