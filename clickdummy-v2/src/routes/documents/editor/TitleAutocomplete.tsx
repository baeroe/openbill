import { useId, useMemo, useRef, useState, type KeyboardEvent, useEffect } from 'react'
import { History } from 'lucide-react'
import type { PositionSuggestion } from '@/api/documents'
import { formatMoney } from '@/domain/format'
import type { Unit } from '@/domain/types'
import { cx } from '@/components/ui'

/**
 * Bezeichnung einer Position mit Vorschlägen aus früheren Dokumenten (ersetzt den Katalog).
 * Enter ohne gewählten Vorschlag ruft onEnter (neue Position darunter).
 */
export function TitleAutocomplete({ value, onChange, onPick, onEnter, suggestions, units, disabled, autoFocus, invalid, placeholder, path }: {
  value: string
  onChange(v: string): void
  onPick(s: PositionSuggestion): void
  onEnter?(): void
  suggestions: PositionSuggestion[]
  units: Unit[]
  disabled?: boolean
  autoFocus?: boolean
  invalid?: boolean
  placeholder: string
  path?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  // Fokus nach dem Einfügen einer neuen Position; per Effekt, weil autoFocus nach Klicks verloren geht
  useEffect(() => { if (autoFocus) requestAnimationFrame(() => input.current?.focus()) }, [autoFocus])

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return suggestions.filter((s) => s.title.toLowerCase().includes(q) && s.title.toLowerCase() !== q).slice(0, 6)
  }, [value, suggestions])
  const show = open && matches.length > 0

  const pick = (s: PositionSuggestion) => {
    onPick(s)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % matches.length) }
    else if (e.key === 'ArrowUp' && matches.length) { e.preventDefault(); setActive((a) => (a <= 0 ? matches.length - 1 : a - 1)) }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (show && active >= 0) pick(matches[active])
      else { setOpen(false); onEnter?.() }
    }
  }

  return (
    <div className="ac" data-path={path}>
      <input
        ref={input}
        className={cx('input pos__title', invalid && 'input--invalid')}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-label="Bezeichnung"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul className="ac__list" id={listId} role="listbox" aria-label="Frühere Positionen">
          <li className="ac__head" aria-hidden><History />Aus früheren Dokumenten</li>
          {matches.map((s, i) => (
            <li key={s.title} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={cx('ac__item', i === active && 'ac__item--active')}
              onMouseDown={(e) => { e.preventDefault(); pick(s) }} onMouseEnter={() => setActive(i)}>
              <span className="ac__title">{s.title}</span>
              <span className="ac__meta num">
                {formatMoney(s.unitPrice)}{units.find((u) => u.id === s.unitId) ? ` / ${units.find((u) => u.id === s.unitId)!.symbol}` : ''}
                {s.usedCount > 1 && ` · ${s.usedCount}× verwendet`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
