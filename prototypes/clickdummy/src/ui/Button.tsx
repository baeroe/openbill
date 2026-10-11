import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-carbon text-carbon-ink hover:brightness-110 shadow-sheet',
  secondary: 'bg-sheet text-ink border border-line-strong hover:border-ink/40 hover:bg-sheet-2',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-sheet text-danger border border-danger/40 hover:bg-danger-soft',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[5px] font-medium whitespace-nowrap transition-[background,border-color,filter] duration-100 disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        !children && (size === 'sm' ? 'w-7 px-0' : 'w-9 px-0'),
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})
