import type { ReactNode } from 'react'
import { STATUS_LABELS } from '@/domain/lifecycle'
import type { DocStatus } from '@/domain/types'
import { cx } from './cx'

export type Tone = 'neutral' | 'carbon' | 'yellow' | 'pink' | 'blue' | 'ok' | 'danger'
const tones: Record<Tone, string> = {
  neutral: 'bg-ink/6 text-muted',
  carbon: 'bg-carbon-soft text-carbon',
  yellow: 'bg-copy-yellow text-copy-yellow-ink',
  pink: 'bg-copy-pink text-copy-pink-ink',
  blue: 'bg-copy-blue text-copy-blue-ink',
  ok: 'bg-ok-soft text-ok',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex h-5 items-center gap-1 rounded-[3px] px-1.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

/** Status in den Farben der Durchschläge: Entwurf gelb, offen blau, erledigt grün, storniert/abgelehnt rosa. */
const STATUS_TONE: Record<DocStatus, Tone> = {
  draft: 'yellow', open: 'blue', accepted: 'ok', done: 'ok', paid: 'ok', closed: 'neutral', rejected: 'pink', cancelled: 'pink',
}

export function StatusBadge({ status, overdue }: { status: DocStatus; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger">Überfällig</Badge>
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
}
