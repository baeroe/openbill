import type { ReactNode } from 'react'

export interface TabItem<T extends string> { value: T; label: ReactNode; icon?: ReactNode }

/** Segment-Umschalter als Pille. Pfeiltasten wechseln den Tab. */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange(v: T): void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
        const i = items.findIndex((t) => t.value === value)
        const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length]
        onChange(next.value)
        ;(e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus()
      }}>
      {items.map((t) => (
        <button key={t.value} type="button" role="tab" data-value={t.value} className="tab" aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1} onClick={() => onChange(t.value)}>
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  )
}
