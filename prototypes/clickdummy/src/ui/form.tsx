import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

interface FieldChrome {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  badge?: ReactNode
  mono?: boolean
}

export const controlClass = (opts: { mono?: boolean; error?: boolean } = {}) =>
  cx(
    'w-full rounded-[5px] border bg-sheet px-2.5 text-sm text-ink placeholder:text-faint transition-colors',
    'hover:border-line-strong focus:border-carbon focus:outline-none focus:ring-2 focus:ring-carbon/20',
    'disabled:cursor-not-allowed disabled:bg-sheet-2 disabled:text-muted',
    opts.error ? 'border-danger' : 'border-line',
    opts.mono && 'font-mono text-[13px]',
  )

function Wrap({ id, label, hint, error, badge, children, className }: FieldChrome & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-medium text-muted">
          {label}
          {badge}
        </label>
      )}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  )
}

type InputProps = FieldChrome & InputHTMLAttributes<HTMLInputElement> & { wrapClassName?: string }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, badge, mono, className, wrapClassName, id, ...rest }, ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} badge={badge} className={wrapClassName}>
      <input ref={ref} id={fid} className={cx(controlClass({ mono, error: !!error }), 'h-9', className)} aria-invalid={!!error} {...rest} />
    </Wrap>
  )
})

type TextareaProps = FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement> & { wrapClassName?: string }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, badge, mono, className, wrapClassName, id, rows = 3, ...rest }, ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} badge={badge} className={wrapClassName}>
      <textarea ref={ref} id={fid} rows={rows} className={cx(controlClass({ mono, error: !!error }), 'py-2 leading-relaxed', className)} {...rest} />
    </Wrap>
  )
})

type SelectProps = FieldChrome & SelectHTMLAttributes<HTMLSelectElement> & { wrapClassName?: string }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, badge, mono, className, wrapClassName, id, children, ...rest }, ref,
) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Wrap id={fid} label={label} hint={hint} error={error} badge={badge} className={wrapClassName}>
      <select
        ref={ref}
        id={fid}
        className={cx(controlClass({ mono, error: !!error }), 'h-9 appearance-none bg-[length:10px] bg-[right_10px_center] bg-no-repeat pr-7', className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%238d92a5' stroke-width='1.5'/%3E%3C/svg%3E\")" }}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  )
})

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; hint?: ReactNode; type?: 'checkbox' | 'radio' }
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, hint, id, className, type = 'checkbox', ...rest }, ref) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className={cx('flex items-start gap-2.5', className)}>
      <input ref={ref} id={fid} type={type} className="mt-[3px] size-4 shrink-0 accent-[var(--carbon)]" {...rest} />
      <label htmlFor={fid} className="text-sm">
        <span className="text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  )
})

/** Zahl aus deutscher oder englischer Eingabe; leer → 0. */
export const parseNumber = (v: string): number => {
  const normalized = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}
