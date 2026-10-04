import { useNavigate } from 'react-router'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { PROFILE_LABELS, type ComplianceIssue } from '@/domain/compliance'
import type { Customer, ProfileId } from '@/domain/types'
import { cx } from '@/ui/cx'
import { fieldDomId } from '@/ui/CustomFieldInput'

/** Zeigt, was zum Abschließen fehlt, und springt per Klick zum Feld. */
export function CompliancePanel({ issues, profile, customer, locked }: { issues: ComplianceIssue[]; profile: ProfileId; customer: Customer | null; locked: boolean }) {
  const navigate = useNavigate()
  if (locked) return null

  const jump = (path: string) => {
    if (path.startsWith('org.')) return navigate(`/settings/organization#${fieldDomId(path)}`)
    if (path.startsWith('customer.') && customer) return navigate(`/customers/${customer.id}#${fieldDomId(path)}`)
    // Positionsdetails: zur Positions-ID springen, falls das genaue Feld eingeklappt ist
    const el = document.getElementById(fieldDomId(path)) ?? document.getElementById(fieldDomId(path.split('.').slice(0, 2).join('.') + '.title'))
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

  const ok = issues.length === 0
  return (
    <div data-testid="compliance" className={cx('rounded-[3px] border px-4 py-3', ok ? 'border-ok/30 bg-ok-soft' : 'border-line bg-copy-yellow')}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {ok ? <CircleCheck size={16} className="text-ok" /> : <CircleAlert size={16} className="text-copy-yellow-ink" />}
        <span className={ok ? 'text-ok' : 'text-copy-yellow-ink'}>
          {ok ? 'Bereit zum Abschließen' : `${issues.length} ${issues.length === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}`}
        </span>
        <span className="ml-auto text-xs font-normal text-muted">Profil: {PROFILE_LABELS[profile]}</span>
      </div>
      {!ok && (
        <ul className="mt-2 grid gap-0.5">
          {issues.map((i) => (
            <li key={i.path}>
              <button type="button" onClick={() => jump(i.path)} className="text-left text-[13px] text-copy-yellow-ink underline decoration-copy-yellow-ink/30 underline-offset-2 hover:decoration-copy-yellow-ink">
                {i.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
