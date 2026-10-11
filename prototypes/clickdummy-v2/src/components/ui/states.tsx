import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { cx } from './cx'

export function Skeleton({ w = '100%', h = 14, r, className }: { w?: number | string; h?: number | string; r?: number; className?: string }) {
  return <span className={cx('skeleton', className)} style={{ display: 'block', width: w, height: h, borderRadius: r }} aria-hidden />
}

/** Platzhalter in der Form einer Liste. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="stack" style={{ padding: 'var(--sp-4) var(--sp-5)' }} aria-busy="true" aria-label="Wird geladen">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row" style={{ gap: 'var(--sp-4)' }}>
          <Skeleton w={96} h={12} />
          <Skeleton w={`${40 + ((i * 17) % 30)}%`} h={12} />
          <span className="spacer" />
          <Skeleton w={72} h={20} r={999} />
          <Skeleton w={84} h={12} />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children, actions }: { icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="state enter">
      <div className="state__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = 'Das hat nicht geklappt' }: { error: unknown; onRetry?(): void; title?: string }) {
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler.'
  return (
    <div className="state state--error enter" role="alert">
      <div className="state__icon"><AlertTriangle /></div>
      <h3>{title}</h3>
      <p>{message} Prüfe die Verbindung und versuche es noch einmal.</p>
      {onRetry && <div className="row"><Button icon={<RotateCw />} onClick={onRetry}>Erneut versuchen</Button></div>}
    </div>
  )
}
