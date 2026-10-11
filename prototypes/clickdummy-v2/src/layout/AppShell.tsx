import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router'
import { FileText, LayoutGrid, ListPlus, LogOut, Menu as MenuIcon, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Settings, SquareCode, Sun, Users } from 'lucide-react'
import { Button, cx, Dialog, Menu, MenuItem } from '@/components/ui'
import { NewDocumentDialog } from '@/routes/documents/NewDocumentDialog'
import { useResetDemo } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'
import { toast } from '@/store/toast'
import { useUiStore, type ThemePref } from '@/store/ui'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Übersicht', icon: LayoutGrid, end: true },
  { to: '/documents', label: 'Dokumente', icon: FileText },
  { to: '/customers', label: 'Kunden', icon: Users },
  { to: '/templates', label: 'Templates', icon: SquareCode },
]
const SETUP = [
  { to: '/fields', label: 'Eigene Felder', icon: ListPlus },
  { to: '/settings', label: 'Einstellungen', icon: Settings },
]
const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Wie das System', icon: Monitor },
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
]

export function AppShell() {
  const signedIn = useUiStore((s) => s.signedIn)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newDoc, setNewDoc] = useState(false)
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])

  // „N“ öffnet überall „Neues Dokument“, solange kein Eingabefeld fokussiert ist
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, [contenteditable], .cm-editor, [role="dialog"]')) return
      e.preventDefault()
      setNewDoc(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!signedIn) return <Navigate to="/login" replace />

  return (
    <div className={cx('shell', collapsed && 'shell--collapsed')}>
      <aside className={cx('sidebar', mobileOpen && 'sidebar--open')} aria-label="Seitenleiste">
        <Link to="/" className="brand"><Logo /><span>openbill</span></Link>
        <Button variant="primary" className="sidebar__new" icon={<Plus />} onClick={() => setNewDoc(true)} title="Neues Dokument (N)">
          <span>Neues Dokument</span>
        </Button>
        <nav className="nav" aria-label="Hauptnavigation">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav__link" title={collapsed ? label : undefined}><Icon /><span>{label}</span></NavLink>
          ))}
          <div className="nav__sep" />
          <div className="nav__group-label">Einrichten</div>
          {SETUP.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav__link" title={collapsed ? label : undefined}><Icon /><span>{label}</span></NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <UserMenu collapsed={collapsed} />
          <button type="button" className="nav__link" onClick={toggleSidebar} style={{ border: 0, background: 'transparent', cursor: 'pointer' }} title={collapsed ? 'Seitenleiste ausklappen' : undefined}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Einklappen</span>
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="drawer-overlay" style={{ zIndex: 44 }} onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <div className="topbar">
          <Button variant="ghost" iconOnly icon={<MenuIcon />} onClick={() => setMobileOpen(true)}>Navigation öffnen</Button>
          <Link to="/" className="brand"><Logo /><span>openbill</span></Link>
          <span className="spacer" />
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setNewDoc(true)}>Neu</Button>
        </div>
        <main className="workspace" id="main">
          <Outlet />
        </main>
      </div>
      <NewDocumentDialog open={newDoc} onClose={() => setNewDoc(false)} />
    </div>
  )
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { data: settings } = useSettings()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const signOut = useUiStore((s) => s.signOut)
  const reset = useResetDemo()
  const [confirm, setConfirm] = useState(false)
  const user = settings?.users[0]
  const initials = (user?.name ?? 'KB').split(' ').map((p) => p[0]).join('').slice(0, 2)
  return (
    <>
      <Menu align="left" placement="up" trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" className="user-chip nav__link" style={{ height: 'auto', border: 0, background: open ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', textAlign: 'left' }} onClick={toggle} aria-haspopup="menu" aria-expanded={open} title={collapsed ? user?.name : undefined}>
          <span className="avatar">{initials}</span>
          <div style={{ minWidth: 0 }}>
            <div className="user-chip__name">{user?.name ?? 'Angemeldet'}</div>
            <div className="user-chip__org">{settings?.org.name ?? ' '}</div>
          </div>
        </button>
      )}>
        {(close) => (
          <>
            <div className="menu__label">Darstellung</div>
            {THEMES.map(({ value, label, icon: Icon }) => (
              <MenuItem key={value} icon={<Icon />} aria-checked={theme === value} role="menuitemradio" onClick={() => { setTheme(value); close() }}>
                {label}{theme === value && <span className="spacer" />}{theme === value && <span className="tag">aktiv</span>}
              </MenuItem>
            ))}
            <div className="menu__sep" />
            <MenuItem icon={<RotateCcw />} onClick={() => { close(); setConfirm(true) }}>Demo-Daten zurücksetzen</MenuItem>
            <MenuItem icon={<LogOut />} onClick={() => { close(); signOut() }}>Abmelden</MenuItem>
          </>
        )}
      </Menu>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Demo-Daten zurücksetzen?"
        description="Alle Änderungen im Klickdummy gehen verloren. Kunden, Dokumente, Templates und Einstellungen starten wieder im Ausgangszustand."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Abbrechen</Button>
          <Button variant="danger" pending={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => { setConfirm(false); toast.success('Demo-Daten zurückgesetzt') } })}>Zurücksetzen</Button>
        </>} />
    </>
  )
}
