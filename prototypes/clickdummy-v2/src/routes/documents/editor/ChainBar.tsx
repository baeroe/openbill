import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { DOC_TYPE_LABELS, STATUS_LABELS } from '@/domain/lifecycle'
import { useDocumentChain } from '@/hooks/useDocuments'
import { cx } from '@/components/ui'

/** Kette des Dokuments: Angebot → Auftragsbestätigung → Rechnung → Storno. */
export function ChainBar({ id }: { id: string }) {
  const { data } = useDocumentChain(id)
  if (!data || data.length < 2) return null
  return (
    <nav className="chain" aria-label="Dokumentkette">
      {data.map((d, i) => (
        <span key={d.id} className="chain__step">
          {i > 0 && <ChevronRight className="chain__sep" aria-hidden />}
          <Link to={`/documents/${d.id}`} className={cx('chain__link', d.id === id && 'is-current')} aria-current={d.id === id ? 'page' : undefined}
            title={`${DOC_TYPE_LABELS[d.type]}, ${STATUS_LABELS[d.status]}`}>
            {DOC_TYPE_LABELS[d.type]} <span className="num">{d.number ?? 'Entwurf'}</span>
          </Link>
        </span>
      ))}
    </nav>
  )
}
