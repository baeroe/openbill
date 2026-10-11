import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/** Surface with 18 px radius; `tinted` = panel tone inside the white workspace, `flush` = no padding. */
export function Card({ flush = false, tinted = false, className, children, ...rest }: HTMLAttributes<HTMLElement> & { flush?: boolean; tinted?: boolean }) {
    return (
        <section className={cx('min-w-0 rounded-lg', tinted ? 'bg-panel' : 'bg-surface', flush ? 'overflow-hidden' : 'p-5', className)} {...rest}>
            {children}
        </section>
    );
}

export function CardHead({ title, titleId, description, actions }: { title: ReactNode; titleId?: string; description?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-heading tracking-[-0.02em]">
                    {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}
