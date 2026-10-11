import type { ReactNode } from 'react'
import { STATUS_LABELS } from '@/domain/lifecycle'
import type { DocStatus } from '@/domain/types'
import { cx } from './cx'

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'ink'

export function Badge({ tone = 'neutral', plain, children, className }: { tone?: Tone; plain?: boolean; children: ReactNode; className?: string }) {
  return <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, plain && 'badge--plain', className)}>{children}</span>
}

const STATUS_TONE: Record<DocStatus, Tone> = {
  draft: 'neutral', open: 'accent', accepted: 'ok', rejected: 'bad', done: 'ok', paid: 'ok', cancelled: 'neutral', closed: 'neutral',
}

export function StatusBadge({ status, overdue }: { status: DocStatus; overdue?: boolean }) {
  if (overdue) return <Badge tone="bad">Überfällig</Badge>
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
}
