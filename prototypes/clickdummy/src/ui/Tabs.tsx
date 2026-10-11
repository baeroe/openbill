import type { ReactNode } from 'react'
import { cx } from './cx'

export function Tabs<T extends string>({ tabs, value, onChange, className }: {
  tabs: { id: T; label: ReactNode; count?: number }[]
  value: T
  onChange(id: T): void
  className?: string
}) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
            t.id === value ? 'border-carbon font-medium text-ink' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="text-xs text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
