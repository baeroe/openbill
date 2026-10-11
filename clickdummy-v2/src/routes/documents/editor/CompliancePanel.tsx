import { Link } from 'react-router'
import { AlertCircle, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react'
import { PROFILE_LABELS, type ComplianceIssue } from '@/domain/compliance'
import type { Document, ProfileId } from '@/domain/types'
import { cx } from '@/components/ui'
import { jumpTo } from './jump'

function externalLink(path: string, doc: Document): { to: string; label: string } | null {
  if (path.startsWith('org.')) return { to: '/settings', label: 'In den Einstellungen' }
  if ((path.startsWith('customer.') || path.startsWith('contact.')) && doc.customerId) return { to: `/customers/${doc.customerId}`, label: 'Beim Kunden' }
  return null
}

export function CompliancePanel({ issues, profile, doc, id }: { issues: ComplianceIssue[]; profile: ProfileId; doc: Document; id?: string }) {
  const ok = issues.length === 0
  return (
    <section id={id} className={cx('check-panel', ok ? 'check-panel--ok' : 'check-panel--warn')} aria-live="polite">
      <div className="check-panel__head">
        {ok ? <CheckCircle2 /> : <AlertCircle />}
        <div>
          <b>{ok ? 'Bereit zum Abschließen' : issues.length === 1 ? '1 Pflichtangabe fehlt' : `${issues.length} Pflichtangaben fehlen`}</b>
          <span>Profil: {PROFILE_LABELS[profile]}</span>
        </div>
      </div>
      {!ok && (
        <ul className="check-panel__list">
          {issues.map((i) => {
            const ext = externalLink(i.path, doc)
            return (
              <li key={i.path + i.message}>
                {ext ? (
                  <Link to={ext.to} className="check-panel__item">{i.message}<span className="check-panel__where">{ext.label}<ArrowUpRight /></span></Link>
                ) : (
                  <button type="button" className="check-panel__item" onClick={() => jumpTo(i.path)}>{i.message}<ChevronRight /></button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
