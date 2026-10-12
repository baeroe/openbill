import type { HTMLAttributes } from 'react';
import { cx } from '@/components/ui';

/** Card of the settings sections: page-coloured (bg) on the surface of the page, 18 px radius. */
export function SettingsCard({ flush = false, className, children, ...rest }: HTMLAttributes<HTMLElement> & { flush?: boolean }) {
    return (
        <section className={cx('settings-card min-w-0 rounded-lg bg-bg', flush ? 'overflow-hidden' : 'p-5', className)} {...rest}>
            {children}
        </section>
    );
}
