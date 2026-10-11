import { useId, useMemo, useState } from 'react'
import { formatMoney } from '@/domain/format'
import type { CatalogItem } from '@/domain/types'
import { useCatalogStore } from '@/store/catalogStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cx } from '@/ui/cx'
import { controlClass } from '@/ui/form'

/** Bezeichnungsfeld mit Vorschlägen aus dem Katalog. Freitext bleibt möglich. */
export function CatalogAutocomplete({ id, value, onChange, onPick, disabled, placeholder, className }: {
  id: string
  value: string
  onChange(v: string): void
  onPick(item: CatalogItem): void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const items = useCatalogStore((s) => s.items)
  const { units, categories } = useSettingsStore()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)).slice(0, 8)
  }, [items, value])
  const show = open && matches.length > 0

  const pick = (item: CatalogItem) => { onPick(item); setOpen(false) }

  return (
    <div className="relative">
      <input
        id={id}
        aria-label="Bezeichnung"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length) }
          if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
        className={cx(controlClass(), 'h-8 font-medium', className)}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 z-20 mt-1 w-[min(420px,90vw)] overflow-hidden rounded-[4px] border border-line bg-sheet py-1 shadow-xl">
          <li className="px-3 pt-1 pb-1.5 text-[11px] text-faint">Aus dem Katalog übernehmen</li>
          {matches.map((item, i) => {
            const unit = units.find((u) => u.id === item.unitId)
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); pick(item) }}
                onMouseEnter={() => setActive(i)}
                className={cx('flex cursor-pointer items-baseline justify-between gap-4 px-3 py-1.5 text-sm', i === active && 'bg-carbon-soft')}
              >
                <span className="min-w-0">
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-2 text-xs text-muted">{categories.find((c) => c.id === item.categoryId)?.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{formatMoney(item.price)} / {unit?.symbol}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
