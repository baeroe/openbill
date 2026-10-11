import { Link } from '@inertiajs/react';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode, Ref } from 'react';
import { cx } from './cx';

export function Spinner({ className }: { className?: string }) {
    return <span aria-hidden className={cx('inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}

export type ButtonVariant = 'default' | 'primary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';
type Look = { variant?: ButtonVariant; size?: ButtonSize; iconOnly?: boolean };

const VARIANTS: Record<ButtonVariant, string> = {
    default: 'bg-surface-2 text-ink hover:bg-surface-3',
    primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
    soft: 'bg-accent-soft text-accent hover:bg-accent-soft-hover',
    ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
    danger: 'bg-bad-soft text-bad hover:bg-bad hover:text-surface',
};

/** Pill button classes; also for links that look like buttons. */
export function buttonClass({ variant = 'default', size = 'md', iconOnly = false }: Look = {}, extra?: string): string {
    return cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-strong whitespace-nowrap no-underline transition-[background-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' ? 'h-control-sm text-sm' : 'h-control text-md',
        iconOnly ? (size === 'sm' ? 'w-control-sm' : 'w-control') : size === 'sm' ? 'px-3' : 'px-4',
        VARIANTS[variant],
        extra,
    );
}

type ButtonProps = Look &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        icon?: ReactNode;
        pending?: boolean;
        ref?: Ref<HTMLButtonElement>;
    };

/** Icon-only buttons keep their text for screen readers (children become sr-only). */
export function Button({ variant, size, iconOnly, icon, pending = false, className, children, disabled, type = 'button', ref, ...rest }: ButtonProps) {
    return (
        <button ref={ref} type={type} className={buttonClass({ variant, size, iconOnly }, className)} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
            {pending ? <Spinner className="size-[0.9rem]" /> : icon}
            {iconOnly ? <span className="sr-only">{children}</span> : children}
        </button>
    );
}

type ButtonLinkProps = Look & ComponentProps<typeof Link> & { icon?: ReactNode };

export function ButtonLink({ variant, size, iconOnly, icon, className, children, ...rest }: ButtonLinkProps) {
    return (
        <Link className={buttonClass({ variant, size, iconOnly }, typeof className === 'string' ? className : undefined)} {...rest}>
            {icon}
            {iconOnly ? <span className="sr-only">{children as ReactNode}</span> : (children as ReactNode)}
        </Link>
    );
}
