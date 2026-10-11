import { Link } from 'react-router'
import { DOC_TYPE_LABELS } from '@/domain/lifecycle'
import type { Document } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { StatusBadge } from '@/ui/Badge'
import { cx } from '@/ui/cx'

/** Verlauf der Dokumentkette: Vorgänger, aktuelles Dokument, Nachfolger. */
export function DocumentChain({ doc }: { doc: Document }) {
  const documents = useDocumentStore((s) => s.documents)
  const before: Document[] = []
  let cursor = documents.find((d) => d.id === doc.sourceId)
  while (cursor) {
    before.unshift(cursor)
    const sourceId: string | null = cursor.sourceId
    cursor = documents.find((d) => d.id === sourceId)
  }
  const after = documents.filter((d) => d.sourceId === doc.id)
  const chain = [...before, doc, ...after]
  if (chain.length === 1) return null

  return (
    <div data-testid="document-chain" className="rounded-[3px] border border-line bg-sheet px-4 py-3 shadow-sheet">
      <p className="mb-2 text-[13px] font-medium text-muted">Verlauf</p>
      <ol className="relative grid gap-2 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line-strong">
        {chain.map((d) => (
          <li key={d.id} className="relative flex items-center gap-3 pl-5">
            <span className={cx('absolute left-0 size-[11px] rounded-full border-2 bg-sheet', d.id === doc.id ? 'border-carbon bg-carbon' : 'border-line-strong')} />
            {d.id === doc.id ? (
              <span className="text-sm font-medium">{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}</span>
            ) : (
              <Link to={`/documents/${d.id}`} className="text-sm hover:text-carbon">{DOC_TYPE_LABELS[d.type]} {d.number ?? '(Entwurf)'}</Link>
            )}
            <span className="ml-auto"><StatusBadge status={d.status} /></span>
          </li>
        ))}
      </ol>
    </div>
  )
}
