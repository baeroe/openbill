import { Ruler } from 'lucide-react'
import { cx } from './cx'

/** Blendet Hilfslinien für Kopfzeile, Inhalt und Fußzeile ein — wie in einem Layoutprogramm. */
export function GuidesToggle({ value, onChange }: { value: boolean; onChange(v: boolean): void }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => onChange(!value)}
      title="Kopfzeile, Inhalt und Fußzeile als Hilfslinien anzeigen"
      className={cx('inline-flex h-7 items-center gap-1.5 rounded-[5px] border px-2.5 text-[13px] font-medium transition-colors', value ? 'border-carbon/40 bg-carbon-soft text-carbon' : 'border-line-strong bg-sheet text-muted hover:text-ink')}
    >
      <Ruler size={14} /> Bereiche
    </button>
  )
}
