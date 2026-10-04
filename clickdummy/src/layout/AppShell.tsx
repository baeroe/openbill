import { useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router'
import { BookOpen, FileText, LayoutGrid, LogOut, RotateCcw, Settings, SquareCode, Users } from 'lucide-react'
import { resetDemo } from '@/store/reset'
import { useSessionStore } from '@/store/sessionStore'
import { cx } from '@/ui/cx'
import { ConfirmDialog } from '@/ui/Dialog'
import { toast } from '@/ui/Toast'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Übersicht', icon: LayoutGrid, end: true },
  { to: '/documents', label: 'Dokumente', icon: FileText },
  { to: '/customers', label: 'Kunden', icon: Users },
  { to: '/catalog', label: 'Katalog', icon: BookOpen },
  { to: '/templates', label: 'Templates', icon: SquareCode },
  { to: '/settings', label: 'Einstellungen', icon: Settings },
]

export function AppShell() {
  const { user, logout } = useSessionStore()
  const [confirmReset, setConfirmReset] = useState(false)
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-line px-3 py-3 md:sticky md:top-0 md:h-screen md:w-56 md:border-r md:py-5">
        <div className="flex items-center justify-between px-2">
          <Logo />
          <div className="md:hidden"><ThemeToggle /></div>
        </div>
        <nav aria-label="Hauptnavigation" className="-mx-1 flex gap-0.5 overflow-x-auto px-1 md:mx-0 md:mt-4 md:flex-col md:overflow-visible md:px-0">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cx(
                'flex items-center gap-2.5 rounded-[5px] px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors',
                isActive ? 'bg-sheet font-medium text-ink shadow-sheet' : 'text-muted hover:bg-ink/5 hover:text-ink',
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden flex-col gap-3 px-2 md:flex">
          <ThemeToggle />
          <button type="button" onClick={() => setConfirmReset(true)} className="flex items-center gap-2 text-left text-xs text-muted hover:text-ink">
            <RotateCcw size={13} /> Demo-Daten zurücksetzen
          </button>
          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-xs text-faint">Studio Nordlicht</p>
            </div>
            <button type="button" onClick={logout} aria-label="Abmelden" title="Abmelden" className="text-faint hover:text-ink">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <Outlet />
      </main>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { resetDemo(); toast('Demo-Daten zurückgesetzt.') }}
        title="Demo-Daten zurücksetzen?"
        text="Alle Änderungen im Klickdummy gehen verloren. Kunden, Dokumente, Templates und Einstellungen werden auf den Ausgangszustand gesetzt."
        confirmLabel="Zurücksetzen"
        danger
      />
    </div>
  )
}
