import type { ReactNode } from 'react';
import { initials } from '@/lib/format';
import { cx } from './cx';

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-13 text-lg' } as const;

/** Round initials (or an icon as children). Decorative: the name is always written next to it. */
export function Avatar({ name, size = 'md', tone = 'neutral', children }: { name: string; size?: keyof typeof SIZES; tone?: 'neutral' | 'accent'; children?: ReactNode }) {
    return (
        <span
            aria-hidden
            className={cx(
                'grid shrink-0 place-items-center rounded-full font-bold tracking-[-0.02em] [&_svg]:size-5',
                SIZES[size],
                tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-3 text-ink',
            )}
        >
            {children ?? initials(name)}
        </span>
    );
}
