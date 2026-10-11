import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

interface FieldProps { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; className?: string; children: (id: string) => ReactNode; path?: string }

/** Beschriftetes Feld. `path` macht es für die Prüfanzeige anspringbar. */
export function Field({ label, hint, error, aside, className, children, path }: FieldProps) {
  const id = useId()
  return (
    <div className={cx('field', className)} data-path={path}>
      {label && <label className="field__label" htmlFor={id}>{label}{aside}</label>}
      {children(id)}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; wrapClassName?: string; path?: string }
export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput({ label, hint, error, aside, wrapClassName, className, path, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
      {(id) => <input ref={ref} id={rest.id ?? id} className={cx('input', !!error && 'input--invalid', className)} aria-invalid={!!error || undefined} {...rest} />}
    </Field>
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; wrapClassName?: string; path?: string }
export function Select({ label, hint, error, aside, wrapClassName, className, children, path, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
      {(id) => <select id={rest.id ?? id} className={cx('select', !!error && 'input--invalid', className)} {...rest}>{children}</select>}
    </Field>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: ReactNode; aside?: ReactNode; wrapClassName?: string; path?: string }
export function Textarea({ label, hint, error, aside, wrapClassName, className, path, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} aside={aside} className={wrapClassName} path={path}>
      {(id) => <textarea id={rest.id ?? id} className={cx('textarea', className)} {...rest} />}
    </Field>
  )
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx('check', className)}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}

export function Switch({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cx('switch', className)}>
      <input type="checkbox" role="switch" {...rest} />
      <span>{label}</span>
    </label>
  )
}

/** Zahlenfeld mit deutschem Komma. Speichert erst beim Verlassen, damit Tippen nicht springt. */
export function NumberInput({ value, onValue, decimals = 2, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number; onValue(n: number): void; decimals?: number }) {
  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: Math.max(decimals, 2), useGrouping: false }) : '')
  return (
    <input
      key={value}
      inputMode="decimal"
      defaultValue={fmt(value)}
      onBlur={(e) => {
        const n = parseFloat(e.currentTarget.value.replace(/\./g, '').replace(',', '.'))
        const next = Number.isFinite(n) ? n : 0
        if (next !== value) onValue(next)
        else e.currentTarget.value = fmt(value)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      className={cx('input input--num', className)}
      {...rest}
    />
  )
}
