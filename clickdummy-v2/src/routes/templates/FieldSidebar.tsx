import { CORE_FIELDS, FIELD_TYPE_LABELS, fieldsFor, SCOPE_LABELS, SCOPE_LIQUID } from '@/domain/fields'
import { FIELD_SCOPES, type FieldDef, type FieldScope, type FieldType } from '@/domain/types'
import { cx } from '@/components/ui'

const MONEY_KEYS = new Set(['net_total', 'tax_total', 'gross_total', 'optional_total', 'unit_price', 'total'])
const DATE_KEYS = new Set(['date', 'due_date', 'valid_until', 'service_date', 'service_date_end'])
const LIST_KEYS = new Set(['tax_breakdown', 'legal_notes'])

/** Liquid-Ausdruck für ein Feld, mit passendem Filter. */
function expression(scope: FieldScope, key: string, type?: FieldType): string {
  const path = `${SCOPE_LIQUID[scope]}.${key}`
  if (LIST_KEYS.has(key)) return key === 'legal_notes'
    ? `{% for note in document.legal_notes %}{{ note }}{% endfor %}`
    : `{% for t in document.tax_breakdown %}{{ t.percent }} %: {{ t.tax | money }}{% endfor %}`
  if (type === 'money' || (!type && MONEY_KEYS.has(key))) return `{{ ${path} | money }}`
  if (type === 'date' || (!type && DATE_KEYS.has(key))) return `{{ ${path} | date }}`
  if (type === 'textarea' || key === 'intro' || key === 'closing') return `{{ ${path} | nl2br }}`
  if (type === 'number' || key === 'quantity') return `{{ ${path} | number: 2 }}`
  return `{{ ${path} }}`
}

const SNIPPETS: { label: string; code: string }[] = [
  { label: 'Positionen nach Gruppen', code: '{% for g in groups %}\n  {% if g.has_title %}<h3>{{ g.title }}</h3>{% endif %}\n  {% for p in g.positions %}\n    {{ p.title }} {{ p.total | money }}\n  {% endfor %}\n  {% if g.has_title %}Summe {{ g.total | money }}{% endif %}\n{% endfor %}' },
  { label: 'Seitenzahl', code: 'Seite {{ page.number }} von {{ page.total }}' },
]

/** „Verfügbare Felder“: Kernfelder und eigene Felder je Ebene, Klick fügt den Ausdruck ein. */
export function FieldSidebar({ fieldDefs, onInsert, disabled }: { fieldDefs: FieldDef[]; onInsert(code: string): void; disabled: string | null }) {
  return (
    <div className="tpl-fields">
      {disabled && <p className="field__hint" style={{ padding: '0 var(--sp-2)' }}>{disabled}</p>}
      {FIELD_SCOPES.map((scope) => {
        const custom = fieldsFor(fieldDefs, scope)
        return (
          <div key={scope} className="tpl-fields__group">
            <div className="tpl-fields__head">{SCOPE_LABELS[scope]}<span className="key">{SCOPE_LIQUID[scope]}</span></div>
            {CORE_FIELDS[scope].map((f) => (
              <FieldButton key={f.key} label={f.label} code={expression(scope, f.key)} keyPath={`${SCOPE_LIQUID[scope]}.${f.key}`} onInsert={onInsert} disabled={!!disabled} />
            ))}
            {custom.map((d) => (
              <FieldButton key={d.id} custom label={d.label} type={FIELD_TYPE_LABELS[d.type]} code={expression(scope, d.key, d.type)} keyPath={`${SCOPE_LIQUID[scope]}.${d.key}`} onInsert={onInsert} disabled={!!disabled} />
            ))}
          </div>
        )
      })}
      <div className="tpl-snippets">
        <span>Bausteine</span>
        {SNIPPETS.map((s) => (
          <button key={s.label} type="button" disabled={!!disabled} onClick={() => onInsert(s.code)} title={s.code}>
            <span className="key">{s.label}</span>
          </button>
        ))}
        <span>Filter: <span className="key">money</span> <span className="key">date</span> <span className="key">number: 2</span> <span className="key">nl2br</span></span>
        <span>Positionen laufen über <span className="key">{'{% for g in groups %}'}</span> und darin <span className="key">{'{% for p in g.positions %}'}</span>.</span>
        <span>Ein Punkt markiert eigene Felder.</span>
      </div>
    </div>
  )
}

function FieldButton({ label, type, code, keyPath, onInsert, disabled, custom }: { label: string; type?: string; code: string; keyPath: string; onInsert(c: string): void; disabled: boolean; custom?: boolean }) {
  return (
    <button type="button" className={cx('tpl-field', custom && 'tpl-field--custom')} disabled={disabled} onClick={() => onInsert(code)} title={disabled ? undefined : `${code} einfügen`}>
      <span className="tpl-field__label">{label}</span>
      {type && <span className="tpl-field__type">{type}</span>}
      <span className="tpl-field__key">{keyPath}</span>
    </button>
  )
}
