import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';

export type TabItem<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

/** Segmented switch as a pill. Arrow keys move between the tabs. */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange(value: T): void; label: string }) {
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        const index = items.findIndex((item) => item.value === value);
        const next = items[(index + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
        onChange(next.value);
        event.currentTarget.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
    };

    return (
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-surface-2 p-[3px]">
            {items.map((item) => (
                <button
                    key={item.value}
                    type="button"
                    role="tab"
                    data-value={item.value}
                    aria-selected={item.value === value}
                    tabIndex={item.value === value ? 0 : -1}
                    onClick={() => onChange(item.value)}
                    className="inline-flex h-[1.875rem] items-center gap-1.5 rounded-full px-3 text-sm font-strong whitespace-nowrap text-muted transition-colors hover:text-ink aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-tab [&_svg]:size-[0.9rem]"
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/** Filter pill (pressed = ink on bg), optionally with a count. */
export function PillButton({ pressed, count, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; count?: number }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            className={cx(
                'inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-2 hover:text-ink aria-pressed:bg-ink aria-pressed:text-bg aria-pressed:hover:bg-ink aria-pressed:hover:text-bg',
                className,
            )}
            {...rest}
        >
            {children}
            {count !== undefined && <span className="num opacity-60">{count}</span>}
        </button>
    );
}
