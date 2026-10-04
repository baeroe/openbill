import { Navigate, NavLink, Route, Routes } from 'react-router'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { DocType } from '@/domain/types'
import { cx } from '@/ui/cx'
import { PageHeader } from '@/ui/PageHeader'
import { CustomFieldsSettings } from './CustomFieldsSettings'
import { DocumentTypeSettings } from './DocumentTypeSettings'
import { CategorySettings, TaxSettings, TextBlockSettings, UnitSettings, UserSettings } from './MasterData'
import { OrganizationSettings } from './OrganizationSettings'

const TYPES: DocType[] = ['offer', 'confirmation', 'invoice', 'cancellation']
const SECTIONS: { title: string; links: { to: string; label: string }[] }[] = [
  { title: 'Allgemein', links: [{ to: 'organization', label: 'Organisation' }, { to: 'users', label: 'Benutzer' }] },
  { title: 'Dokumenttypen', links: TYPES.map((t) => ({ to: `document-types/${t}`, label: DOC_TYPE_LABELS[t] })) },
  { title: 'Daten', links: [{ to: 'fields', label: 'Eigene Felder' }, { to: 'taxes', label: 'Steuersätze' }, { to: 'units', label: 'Einheiten' }, { to: 'categories', label: 'Kategorien' }, { to: 'text-blocks', label: 'Textbausteine' }] },
]

export function SettingsLayout() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Einstellungen" />
      <div className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Einstellungen" className="flex gap-4 overflow-x-auto md:flex-col md:gap-5">
          {SECTIONS.map((s) => (
            <div key={s.title} className="shrink-0">
              <p className="mb-1 px-2 text-xs text-faint">{s.title}</p>
              <ul className="flex gap-0.5 md:flex-col">
                {s.links.map((l) => (
                  <li key={l.to}>
                    <NavLink to={`/settings/${l.to}`} className={({ isActive }) => cx('block rounded-[4px] px-2 py-1 text-sm whitespace-nowrap', isActive ? 'bg-sheet font-medium shadow-sheet' : 'text-muted hover:text-ink')}>
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          <Routes>
            <Route index element={<Navigate to="organization" replace />} />
            <Route path="organization" element={<OrganizationSettings />} />
            <Route path="users" element={<UserSettings />} />
            <Route path="document-types/:type" element={<DocumentTypeSettings />} />
            <Route path="fields" element={<CustomFieldsSettings />} />
            <Route path="taxes" element={<TaxSettings />} />
            <Route path="units" element={<UnitSettings />} />
            <Route path="categories" element={<CategorySettings />} />
            <Route path="text-blocks" element={<TextBlockSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
