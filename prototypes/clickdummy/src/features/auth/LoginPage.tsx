import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Logo } from '@/layout/Logo'
import { ThemeToggle } from '@/layout/ThemeToggle'
import { useSessionStore } from '@/store/sessionStore'
import { Button } from '@/ui/Button'

/** Eine Formularzelle wie auf einem gedruckten Beleg: Beschriftung oben links, Eingabe darunter. */
function FormCell({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group relative border-line-strong px-3 pt-2 pb-1.5 focus-within:bg-carbon-soft/40">
      <label htmlFor={id} className="block text-[11px] font-medium text-muted group-focus-within:text-carbon">{label}</label>
      <input id={id} className="w-full bg-transparent pb-0.5 text-[15px] text-ink outline-none placeholder:text-faint" {...rest} />
    </div>
  )
}

export function LoginPage() {
  const { user, login } = useSessionStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('mara@nordlicht.example')
  const [password, setPassword] = useState('')
  if (user) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login(email)
    navigate('/')
  }

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="grid w-full max-w-5xl items-center gap-14 lg:grid-cols-[1fr_440px]">
        <div className="max-w-md">
          <Logo className="mb-10" />
          <h1 className="font-cond text-[44px] leading-[1.02] font-semibold tracking-[-0.025em] sm:text-[56px]">
            Rechnungen, die aussehen, wie du sie willst.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">
            Eigene Felder für Dokumente und Positionen, eigene Templates in Liquid, E-Rechnung nach EN&nbsp;16931. Open Source und auf deinem Server.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[440px]">
          {/* Durchschläge: gelb und rosa, leicht versetzt hinter dem Original */}
          <div aria-hidden className="absolute inset-0 translate-x-[14px] translate-y-[16px] rotate-[2.2deg] rounded-[2px] bg-copy-pink shadow-sheet" />
          <div aria-hidden className="absolute inset-0 translate-x-[7px] translate-y-[8px] rotate-[1.1deg] rounded-[2px] bg-copy-yellow shadow-sheet" />

          <form onSubmit={submit} className="relative rounded-[2px] bg-sheet shadow-[0_1px_0_rgb(22_24_42/0.05),0_18px_40px_-18px_rgb(22_24_42/0.35)]">
            {/* Perforation zum Abreißen */}
            <div aria-hidden className="h-3 border-b border-dashed border-line-strong bg-[radial-gradient(circle,var(--desk)_2.5px,transparent_3px)] bg-[length:12px_12px] bg-[position:0_-6px] bg-repeat-x" />

            <div className="px-7 pt-6 pb-7">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="text-[13px] text-muted">Studio Nordlicht</p>
                  <h2 className="font-cond text-2xl font-semibold tracking-[-0.01em]">Anmelden</h2>
                </div>
                <div className="rounded-[2px] border border-line-strong px-2.5 py-1 text-right">
                  <p className="text-[10px] text-faint">Beleg-Nr.</p>
                  <p className="font-cond text-sm font-semibold text-carbon">0001</p>
                </div>
              </div>

              <div className="grid border border-line-strong [&>*+*]:border-t">
                <FormCell id="login-email" label="E-Mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <FormCell id="login-password" label="Passwort" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="beliebig" />
              </div>

              <Button type="submit" variant="primary" className="mt-5 h-10 w-full">Anmelden</Button>
              <p className="mt-4 text-xs leading-relaxed text-faint">
                Das ist ein Klickdummy. Jede Eingabe meldet dich an, alle Daten bleiben in deinem Browser.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
