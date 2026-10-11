import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { LogIn } from 'lucide-react'
import { Button, TextInput } from '@/components/ui'
import { Logo } from '@/layout/Logo'
import { useUiStore } from '@/store/ui'
import './LoginPage.css'

export function LoginPage() {
  const signedIn = useUiStore((s) => s.signedIn)
  const signIn = useUiStore((s) => s.signIn)
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  if (signedIn) return <Navigate to="/" replace />

  return (
    <div className="login">
      <div className="login__form">
        <div className="brand" style={{ padding: 0 }}><Logo /><span>openbill</span></div>
        <div>
          <h1>Willkommen zurück</h1>
          <p className="lead">Melde dich an, um Angebote und Rechnungen von Studio Nordlicht zu bearbeiten.</p>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault()
          setPending(true)
          setTimeout(() => { signIn(); navigate('/') }, 450)
        }}>
          <TextInput label="E-Mail" type="email" name="email" autoComplete="username" defaultValue="kai@nordlicht.example" required />
          <TextInput label="Passwort" type="password" name="password" autoComplete="current-password" defaultValue="demo-passwort" required />
          <Button type="submit" variant="primary" icon={<LogIn />} pending={pending} style={{ marginTop: 'var(--sp-2)' }}>Anmelden</Button>
          <p className="field__hint">Klickdummy: Jede Eingabe funktioniert. Alle Daten bleiben in deinem Browser.</p>
        </form>
      </div>
      <div className="login__art" aria-hidden>
        <div className="login-sheets">
          <div className="login-sheet login-sheet--back">
            <div className="ls-line" style={{ width: '40%' }} /><div className="ls-line" style={{ width: '70%' }} /><div className="ls-line" style={{ width: '55%' }} />
          </div>
          <div className="login-sheet">
            <div className="ls-head"><b>Studio Nordlicht</b><span>Rechnung RE-2026-0043</span></div>
            <div className="ls-group">Konzept &amp; UX<span>3.170,00 €</span></div>
            <div className="ls-row"><span>Discovery-Workshop</span><span>890,00 €</span></div>
            <div className="ls-row"><span>Wireframes &amp; Klickpfade</span><span>2.280,00 €</span></div>
            <div className="ls-group">Umsetzung<span>4.940,00 €</span></div>
            <div className="ls-row"><span>Frontend-Entwicklung</span><span>4.940,00 €</span></div>
            <div className="ls-total"><span>Gesamt</span><span>9.650,90 €</span></div>
          </div>
          <div className="login-chip"><span className="badge badge--ok">Bezahlt</span><span>am 9. Oktober</span></div>
        </div>
      </div>
    </div>
  )
}
