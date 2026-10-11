import { Navigate, NavLink, Route, Routes } from 'react-router'
import { Building2, FileStack, Percent, TextQuote, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { DocTypeSettings } from './DocTypeSettings'
import { OrganizationSettings } from './OrganizationSettings'
import { TaxUnitSettings } from './TaxUnitSettings'
import { TextBlockSettings } from './TextBlockSettings'
import { UserSettings } from './UserSettings'
import './settings.css'

const SECTIONS = [
  { to: 'organization', label: 'Organisation', icon: Building2 },
  { to: 'doc-types', label: 'Dokumenttypen', icon: FileStack },
  { to: 'taxes-units', label: 'Steuern & Einheiten', icon: Percent },
  { to: 'text-blocks', label: 'Textbausteine', icon: TextQuote },
  { to: 'users', label: 'Benutzer', icon: UsersRound },
]

export function SettingsPage() {
  return (
    <div className="page">
      <PageHeader title="Einstellungen" description="Deine Firma, die Dokumenttypen und die Stammdaten für Steuern, Einheiten und Texte." />
      <div className="settings">
        <nav className="settings__nav" aria-label="Bereiche der Einstellungen">
          {SECTIONS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={`/settings/${to}`} className="settings__link"><Icon /><span>{label}</span></NavLink>
          ))}
        </nav>
        <div className="settings__body">
          <Routes>
            <Route index element={<Navigate to="/settings/organization" replace />} />
            <Route path="organization" element={<OrganizationSettings />} />
            <Route path="doc-types" element={<DocTypeSettings />} />
            <Route path="taxes-units" element={<TaxUnitSettings />} />
            <Route path="text-blocks" element={<TextBlockSettings />} />
            <Route path="users" element={<UserSettings />} />
            <Route path="*" element={<Navigate to="/settings/organization" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
