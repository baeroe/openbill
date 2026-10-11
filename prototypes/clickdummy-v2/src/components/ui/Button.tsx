import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from './cx'

type Variant = 'default' | 'primary' | 'soft' | 'ghost' | 'danger'
interface Common { variant?: Variant; size?: 'md' | 'sm'; icon?: ReactNode; iconOnly?: boolean; pending?: boolean }

const classes = ({ variant = 'default', size = 'md', iconOnly }: Common, extra?: string) =>
  cx('btn', variant !== 'default' && `btn--${variant}`, size === 'sm' && 'btn--sm', iconOnly && 'btn--icon', extra)

export const Button = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant, size, icon, iconOnly, pending, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={classes({ variant, size, iconOnly }, className)} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending ? <span className="spinner" aria-hidden /> : icon}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  )
})

export function ButtonLink({ variant, size, icon, iconOnly, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={classes({ variant, size, iconOnly }, className)} {...rest}>
      {icon}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </Link>
  )
}
