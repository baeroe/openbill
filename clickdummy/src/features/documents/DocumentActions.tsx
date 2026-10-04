import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Copy, Lock, Trash2 } from 'lucide-react'
import type { ComplianceIssue } from '@/domain/compliance'
import { canConvert, CONVERSIONS } from '@/domain/convert'
import { DOC_TYPE_LABELS, nextStatuses, STATUS_ACTION_LABELS } from '@/domain/lifecycle'
import type { DocType, Document } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { Button } from '@/ui/Button'
import { ConfirmDialog } from '@/ui/Dialog'
import { toast } from '@/ui/Toast'
import { CONVERT_LABELS } from './labels'

export function DocumentActions({ doc, issues }: { doc: Document; issues: ComplianceIssue[] }) {
  const { finalizeDocument, setStatus, convertTo, duplicateDocument, deleteDraft } = useDocumentStore()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'finalize' | 'delete' | null>(null)

  const convert = (target: DocType) => {
    const { id, droppedFields } = convertTo(doc.id, target)
    navigate(`/documents/${id}`)
    if (droppedFields.length) toast(`Nicht übernommen, weil das Feld im Zieltyp fehlt: ${droppedFields.join(', ')}`, 'warn')
    else toast(`${DOC_TYPE_LABELS[target]} als Entwurf angelegt.`)
  }
  const finalize = () => {
    const r = finalizeDocument(doc.id)
    if (r.ok) toast(`${DOC_TYPE_LABELS[doc.type]} abgeschlossen.`)
    else toast('Es fehlen noch Angaben.', 'danger')
  }
  const duplicate = () => {
    const id = duplicateDocument(doc.id)
    navigate(`/documents/${id}`)
    toast('Kopie als Entwurf angelegt.')
  }

  if (doc.status === 'draft') {
    return (
      <>
        <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirm('delete')}>Löschen</Button>
        <Button size="sm" icon={<Copy size={14} />} onClick={duplicate}>Duplizieren</Button>
        <Button variant="primary" icon={<Lock size={14} />} disabled={issues.length > 0} title={issues.length ? 'Erst alle Pflichtangaben ausfüllen' : undefined} onClick={() => setConfirm('finalize')}>
          Abschließen
        </Button>
        <ConfirmDialog
          open={confirm === 'finalize'}
          onClose={() => setConfirm(null)}
          onConfirm={finalize}
          title={`${DOC_TYPE_LABELS[doc.type]} abschließen?`}
          text={<>Das Dokument bekommt seine Nummer und lässt sich danach nicht mehr ändern. {doc.type === 'invoice' && 'Korrekturen gehen dann nur noch über ein Storno.'}</>}
          confirmLabel="Abschließen"
        />
        <ConfirmDialog
          open={confirm === 'delete'}
          onClose={() => setConfirm(null)}
          onConfirm={() => { deleteDraft(doc.id); navigate('/documents'); toast('Entwurf gelöscht.') }}
          title="Entwurf löschen?"
          text="Der Entwurf wird endgültig entfernt."
          confirmLabel="Löschen"
          danger
        />
      </>
    )
  }

  const statuses = nextStatuses(doc.type, doc.status)
  const conversions = CONVERSIONS[doc.type].filter((t) => canConvert(doc, t))
  const existingStorno = doc.type === 'invoice' && !doc.cancelledById && useDocumentStore.getState().documents.some((d) => d.sourceId === doc.id && d.type === 'cancellation')
  return (
    <>
      <Button size="sm" icon={<Copy size={14} />} onClick={duplicate}>Duplizieren</Button>
      {statuses.map((s) => (
        <Button key={s} size="sm" onClick={() => { setStatus(doc.id, s); toast(`Status: ${STATUS_ACTION_LABELS[s]?.replace('Als ', '').replace(' markieren', '')}.`) }}>
          {STATUS_ACTION_LABELS[s]}
        </Button>
      ))}
      {conversions.map((t) => (
        <Button key={t} variant={t === 'cancellation' ? 'danger' : 'primary'} size={t === 'cancellation' ? 'sm' : 'md'} onClick={() => convert(t)}>
          {t === 'cancellation' && existingStorno ? 'Storno-Entwurf öffnen' : CONVERT_LABELS[t]}
        </Button>
      ))}
    </>
  )
}
