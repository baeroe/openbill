import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

// no height here: single-line controls add h-control, the textarea grows (two height classes would conflict)
const CONTROL =
    'w-full min-w-0 rounded-md border-0 bg-surface-2 px-3 text-md text-ink transition-[background-color,box-shadow] placeholder:text-faint hover:bg-surface-3 focus:bg-surface focus:shadow-[0_0_0_2px_var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-transparent read-only:shadow-[inset_0_0_0_1px_var(--surface-3)]';
const INVALID = 'shadow-[0_0_0_2px_var(--bad)] hover:shadow-[0_0_0_2px_var(--bad)]';

/**
 * Classes of a text control (tinted field, kobalt ring on focus, red ring when invalid). `extra` may only add
 * properties the base does not set (or longhands like pl-9 after px-3): two classes for the same CSS property
 * have no defined winner in Tailwind.
 */
export function controlClass(invalid = false, extra?: string): string {
    return cx(CONTROL, invalid && INVALID, extra);
}

type FieldProps = {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    aside?: ReactNode;
    className?: string;
    /** Marks the field for jumps from error lists (data-path, e.g. "contacts.0.email"). */
    path?: string;
    children: (id: string, describedBy: string | undefined) => ReactNode;
};

/** Labelled field with hint or error below. */
export function Field({ label, hint, error, aside, className, path, children }: FieldProps) {
    const id = useId();
    const messageId = `${id}-message`;
    const message = error || hint;

    return (
        <div className={cx('grid min-w-0 content-start gap-1.5', className)} data-path={path}>
            {label && (
                <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-muted">
                    {label}
                    {aside && <span className="ml-auto">{aside}</span>}
                </label>
            )}
            {children(id, message ? messageId : undefined)}
            {message && (
                <span id={messageId} className={cx('text-xs', error ? 'text-bad' : 'text-muted')}>
                    {message}
                </span>
            )}
        </div>
    );
}

type FieldExtras = { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; wrapClassName?: string; path?: string };

export function TextInput({ label, hint, error, aside, wrapClassName, path, className, ref, ...rest }: FieldExtras & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & { ref?: Ref<HTMLInputElement> }) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => <input ref={ref} id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={controlClass(!!error, cx('h-control', className))} {...rest} />}
        </Field>
    );
}

/** Native select with the chevron, without label (filters, compact rows). */
export function SelectControl({ invalid = false, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
    return (
        <span className={cx('relative grid min-w-0', className)}>
            <select className={controlClass(invalid, 'h-control cursor-pointer appearance-none pr-9')} aria-invalid={invalid || undefined} {...rest}>
                {children}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
        </span>
    );
}

export function Select({ label, hint, error, aside, wrapClassName, path, children, ...rest }: FieldExtras & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => (
                <SelectControl id={id} invalid={!!error} aria-describedby={describedBy} {...rest}>
                    {children}
                </SelectControl>
            )}
        </Field>
    );
}

export function Textarea({ label, hint, error, aside, wrapClassName, path, className, ...rest }: FieldExtras & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>) {
    return (
        <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
            {(id, describedBy) => (
                <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={controlClass(!!error, cx('min-h-22 resize-y py-2 leading-normal', className))} {...rest} />
            )}
        </Field>
    );
}

/** Search field with the magnifier inside. */
export function SearchInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
    return (
        <span className={cx('relative flex min-w-0 items-center', className)}>
            <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
            <input type="search" className={controlClass(false, 'h-control pl-9')} {...rest} />
        </span>
    );
}

export function Checkbox({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode }) {
    return (
        <label className={cx('inline-flex cursor-pointer items-center gap-2 select-none', className)}>
            <span className="relative inline-grid size-[1.125rem] shrink-0">
                <input type="checkbox" className="peer size-full cursor-pointer appearance-none rounded-[6px] bg-surface-3 transition-colors checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60" {...rest} />
                <Check aria-hidden strokeWidth={3} className="pointer-events-none absolute inset-0 m-auto size-3 text-accent-ink opacity-0 peer-checked:opacity-100" />
            </span>
            <span>{label}</span>
        </label>
    );
}

export function Switch({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & { label: ReactNode }) {
    return (
        <label className={cx('inline-flex cursor-pointer items-center gap-3 select-none', className)}>
            <span className="relative inline-grid h-[1.375rem] w-9 shrink-0">
                <input type="checkbox" role="switch" className="peer size-full cursor-pointer appearance-none rounded-full bg-surface-3 transition-colors checked:bg-accent disabled:cursor-not-allowed disabled:opacity-60" {...rest} />
                <span aria-hidden className="pointer-events-none absolute top-[3px] left-[3px] size-4 rounded-full bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-transform peer-checked:translate-x-3.5" />
            </span>
            <span>{label}</span>
        </label>
    );
}
