import { useMemo, useState } from 'react'
import { RESERVED_KEYS } from '@/domain/fields'
import type { FieldDef } from '@/domain/types'
import { useSettingsStore } from '@/store/settingsStore'
import { cx } from '@/ui/cx'
import { controlClass } from '@/ui/form'

interface Group { title: string; prefix: string; core: string[]; custom: FieldDef[]; hint?: string }

const SNIPPETS = [
  { label: 'Positionen durchlaufen', code: '{% for p in positions %}\n  {{ p.title }} {{ p.total | money }}\n{% endfor %}' },
  { label: 'Steuern je Satz', code: '{% for t in document.tax_breakdown %}\n  {{ t.percent }} %: {{ t.tax | money }}\n{% endfor %}' },
  { label: 'Gesetzliche Hinweise', code: '{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}' },
  { label: 'Bedingung', code: '{% if document.due_date %}Fällig am {{ document.due_date | date }}{% endif %}' },
]
const FILTERS = ['money', 'date', 'number: 2', 'nl2br', 'upcase', 'default: "–"']

/** Alle verfügbaren Platzhalter; Klick fügt sie an der Cursorposition ein. */
export function FieldReference({ onInsert }: { onInsert(text: string): void }) {
  const { fieldDefs, docTypes } = useSettingsStore()
  const [q, setQ] = useState('')

  const groups: Group[] = useMemo(() => {
    const uniq = (defs: FieldDef[]) => defs.filter((d, i) => defs.findIndex((x) => x.key === d.key) === i)
    return [
      { title: 'Organisation', prefix: 'org', core: RESERVED_KEYS.org, custom: fieldDefs.org },
      { title: 'Kunde', prefix: 'customer', core: RESERVED_KEYS.customer, custom: fieldDefs.customer },
      { title: 'Ansprechpartner', prefix: 'contact', core: RESERVED_KEYS.contact, custom: fieldDefs.contact },
      { title: 'Dokument', prefix: 'document', core: RESERVED_KEYS.document.filter((k) => !['customer', 'contact', 'positions'].includes(k)), custom: uniq(Object.values(docTypes).flatMap((t) => t.documentFields)) },
      { title: 'Position', prefix: 'p', core: RESERVED_KEYS.position, custom: uniq(Object.values(docTypes).flatMap((t) => t.positionFields)), hint: 'innerhalb von {% for p in positions %}' },
      { title: 'Gruppe', prefix: 'g', core: ['title', 'total'], custom: [], hint: 'innerhalb von {% for g in groups %}' },
    ]
  }, [fieldDefs, docTypes])

  const match = (k: string) => !q || k.includes(q.toLowerCase())

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <input aria-label="Felder filtern" placeholder="Feld suchen" value={q} onChange={(e) => setQ(e.target.value)} className={cx(controlClass(), 'h-8')} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 text-[13px]">
        {groups.map((g) => {
          const core = g.core.filter(match)
          const custom = g.custom.filter((d) => match(d.key) || match(d.label.toLowerCase()))
          if (!core.length && !custom.length) return null
          return (
            <section key={g.prefix} className="mb-4">
              <p className="font-medium">{g.title}</p>
              {g.hint && <p className="font-mono text-[10.5px] text-faint">{g.hint}</p>}
              <ul className="mt-1 grid">
                {custom.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => onInsert(`{{ ${g.prefix}.${d.key} }}`)} title={`Eigenes Feld: ${d.label}`} className="flex w-full items-baseline justify-between gap-2 rounded-[3px] px-1.5 py-0.5 text-left hover:bg-carbon-soft">
                      <span className="font-mono text-[12px] text-carbon">{d.key}</span>
                      <span className="truncate text-[11px] text-faint">{d.label}</span>
                    </button>
                  </li>
                ))}
                {core.map((k) => (
                  <li key={k}>
                    <button type="button" onClick={() => onInsert(`{{ ${g.prefix}.${k} }}`)} className="w-full rounded-[3px] px-1.5 py-0.5 text-left font-mono text-[12px] text-muted hover:bg-carbon-soft hover:text-ink">{k}</button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        <section className="mb-4">
          <p className="font-medium">Filter</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {FILTERS.map((f) => <button key={f} type="button" onClick={() => onInsert(` | ${f}`)} className="rounded-[3px] bg-ink/5 px-1.5 py-0.5 font-mono text-[11.5px] hover:bg-carbon-soft">{f}</button>)}
          </div>
        </section>
        <section>
          <p className="font-medium">Bausteine</p>
          <ul className="mt-1 grid">
            {SNIPPETS.map((s) => <li key={s.label}><button type="button" onClick={() => onInsert(s.code)} className="w-full rounded-[3px] px-1.5 py-0.5 text-left text-muted hover:bg-carbon-soft hover:text-ink">{s.label}</button></li>)}
          </ul>
        </section>
      </div>
    </div>
  )
}
