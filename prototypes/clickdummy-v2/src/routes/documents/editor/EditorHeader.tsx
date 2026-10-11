import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Ban, Check, ChevronDown, CloudOff, Copy, Download, Lock, MoreHorizontal, PanelRightOpen, Repeat2, Trash2 } from 'lucide-react'
import { Button, Dialog, Menu, MenuItem, StatusBadge } from '@/components/ui'
import { canConvert, CONVERSIONS } from '@/domain/convert'
import { formatDate } from '@/domain/format'
import { DOC_TYPE_LABELS, isOverdue, nextStatuses, STATUS_ACTION_LABELS, STATUS_LABELS } from '@/domain/lifecycle'
import { allocateNumber } from '@/domain/numbering'
import { todayIso } from '@/domain/dates'
import type { ComplianceIssue } from '@/domain/compliance'
import type { Customer, DocType, Document, Settings } from '@/domain/types'
import { useConvertDocument, useDeleteDocument, useDuplicateDocument, useFinalizeDocument, useRestoreDocument, useSetDocumentStatus } from '@/hooks/useDocuments'
import { toast } from '@/store/toast'
import { useUiStore } from '@/store/ui'
import type { SaveState } from './useDraft'
import { jumpTo } from './jump'

const SAVE_LABELS: Record<SaveState, string> = { saved: 'Gespeichert', dirty: 'Ungespeichert', saving: 'Speichert …', error: 'Nicht gespeichert' }
const CONVERT_LABELS: Record<DocType, string> = { offer: 'Angebot', confirmation: 'Auftragsbestätigung', invoice: 'Rechnung', cancellation: 'Storno' }

export function EditorHeader({ doc, customer, settings, issues, saveState, flush, discard }: {
  doc: Document
  customer: Customer | null
  settings: Settings
  issues: ComplianceIssue[]
  saveState: SaveState
  flush(): Promise<void>
  discard(): void
}) {
  const navigate = useNavigate()
  const finalize = useFinalizeDocument()
  const setStatus = useSetDocumentStatus()
  const convert = useConvertDocument()
  const duplicate = useDuplicateDocument()
  const remove = useDeleteDocument()
  const restore = useRestoreDocument()
  const previewOpen = useUiStore((s) => s.previewOpen)
  const togglePreview = useUiStore((s) => s.togglePreview)
  const [confirm, setConfirm] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const isDraft = doc.status === 'draft'
  const label = DOC_TYPE_LABELS[doc.type]
  const project = typeof doc.custom.project_name === 'string' ? doc.custom.project_name : ''
  const statuses = isDraft ? [] : nextStatuses(doc.type, doc.status)
  const conversions = CONVERSIONS[doc.type].filter((t) => t !== 'cancellation' && canConvert(doc, t))
  const canCancel = canConvert(doc, 'cancellation')
  const nextNumber = isDraft ? allocateNumber(settings.docTypes[doc.type].numbering, new Date(`${doc.date || todayIso()}T00:00:00`)).number : null

  const startFinalize = async () => {
    if (issues.length) {
      toast.error(issues.length === 1 ? '1 Pflichtangabe fehlt noch.' : `${issues.length} Pflichtangaben fehlen noch.`)
      if (!jumpTo(issues[0].path)) document.getElementById('check-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    await flush()
    setConfirm(true)
  }

  const doFinalize = () => finalize.mutate(doc.id, {
    onSuccess: (d) => { setConfirm(false); toast.success(`${label} ${d.number} abgeschlossen`) },
    onError: (e) => {
      setConfirm(false)
      const details = (e as { details?: unknown }).details
      toast.error(e.message)
      if (Array.isArray(details) && details[0]?.path) jumpTo((details[0] as ComplianceIssue).path)
    },
  })

  const doConvert = (target: DocType) => convert.mutate({ id: doc.id, target }, {
    onSuccess: ({ document, droppedFields }) => {
      setConfirmCancel(false)
      navigate(`/documents/${document.id}`)
      toast.success(`${CONVERT_LABELS[target]} als Entwurf angelegt`)
      if (droppedFields.length) toast.info(`Nicht übernommen, weil das Feld für ${CONVERT_LABELS[target]} nicht gilt: ${droppedFields.join(', ')}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const doDuplicate = async () => {
    await flush()
    duplicate.mutate(doc.id, {
      onSuccess: (d) => { navigate(`/documents/${d.id}`); toast.success('Kopie als Entwurf angelegt') },
      onError: (e) => toast.error(e.message),
    })
  }

  const doDelete = () => {
    discard()
    const copy = doc
    remove.mutate(doc.id, {
      onSuccess: () => {
        navigate('/documents')
        toast.success('Entwurf gelöscht', { label: 'Rückgängig', run: () => restore.mutate(copy, { onSuccess: (d) => navigate(`/documents/${d.id}`) }) })
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <header className="ed-head">
      <div className="ed-head__title">
        <div className="row row--wrap" style={{ gap: 'var(--sp-2)' }}>
          <h1>{label} <span className="num">{doc.number ?? ''}</span></h1>
          <StatusBadge status={doc.status} overdue={isOverdue(doc, todayIso())} />
        </div>
        <p className="ed-head__sub">
          {customer?.name ?? 'Noch kein Kunde'}
          {project && <> · {project}</>}
          {!isDraft && doc.finalizedAt && <> · abgeschlossen am {formatDate(doc.finalizedAt.slice(0, 10))}</>}
        </p>
      </div>

      <div className="ed-head__actions">
        {isDraft && (
          <span className={`save save--${saveState}`} role="status">
            {saveState === 'error' ? <CloudOff /> : saveState === 'saved' ? <Check /> : <span className="save__dot" />}
            {SAVE_LABELS[saveState]}
          </span>
        )}

        <Menu trigger={({ toggle, ref, open }) => (
          <Button ref={ref} variant="ghost" iconOnly icon={<MoreHorizontal />} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Weitere Aktionen</Button>
        )}>
          {(close) => (
            <>
              {!previewOpen && <MenuItem icon={<PanelRightOpen />} onClick={() => { close(); togglePreview() }}>Vorschau einblenden</MenuItem>}
              <MenuItem icon={<Download />} onClick={() => { close(); toast.info('Im Klickdummy gibt es kein PDF. In openbill rendert Gotenberg Inhalt, Kopf- und Fußzeile.') }}>PDF herunterladen</MenuItem>
              {doc.type !== 'cancellation' && <MenuItem icon={<Copy />} disabled={duplicate.isPending} onClick={() => { close(); void doDuplicate() }}>Duplizieren</MenuItem>}
              {canCancel && <><div className="menu__sep" /><MenuItem danger icon={<Ban />} onClick={() => { close(); setConfirmCancel(true) }}>Stornieren</MenuItem></>}
              {isDraft && <><div className="menu__sep" /><MenuItem danger icon={<Trash2 />} disabled={remove.isPending} onClick={() => { close(); doDelete() }}>Entwurf löschen</MenuItem></>}
            </>
          )}
        </Menu>

        {statuses.length > 0 && (
          <Menu trigger={({ toggle, ref, open }) => (
            <Button ref={ref} pending={setStatus.isPending} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Status ändern<ChevronDown /></Button>
          )}>
            {(close) => statuses.map((s) => (
              <MenuItem key={s} onClick={() => { close(); setStatus.mutate({ id: doc.id, status: s }, { onSuccess: () => toast.success(`Status auf „${STATUS_LABELS[s]}“ gesetzt`), onError: (e) => toast.error(e.message) }) }}>
                {STATUS_ACTION_LABELS[s] ?? s}
              </MenuItem>
            ))}
          </Menu>
        )}

        {conversions.length === 1 && (
          <Button variant="primary" icon={<Repeat2 />} pending={convert.isPending} onClick={() => doConvert(conversions[0])}>In {CONVERT_LABELS[conversions[0]]} umwandeln</Button>
        )}
        {conversions.length > 1 && (
          <Menu trigger={({ toggle, ref, open }) => (
            <Button ref={ref} variant="primary" icon={<Repeat2 />} pending={convert.isPending} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>Umwandeln<ChevronDown /></Button>
          )}>
            {(close) => conversions.map((t) => <MenuItem key={t} onClick={() => { close(); doConvert(t) }}>In {CONVERT_LABELS[t]}</MenuItem>)}
          </Menu>
        )}

        {isDraft && (
          <Button variant="primary" icon={<Lock />} pending={finalize.isPending} onClick={() => void startFinalize()}>Abschließen</Button>
        )}
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`${label} abschließen?`}
        description={`Das Dokument bekommt die Nummer ${nextNumber} und lässt sich danach nicht mehr ändern.${doc.type === 'invoice' ? ' Korrekturen gehen dann nur noch über ein Storno.' : ''}`}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Abbrechen</Button>
          <Button variant="primary" icon={<Lock />} pending={finalize.isPending} onClick={doFinalize}>Abschließen</Button>
        </>} />

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title={`${doc.number} stornieren?`}
        description="openbill legt ein Storno als Entwurf an, mit allen Positionen und negativen Beträgen. Sobald du das Storno abschließt, steht die Rechnung auf „Storniert“."
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Abbrechen</Button>
          <Button variant="danger" icon={<Ban />} pending={convert.isPending} onClick={() => doConvert('cancellation')}>Storno anlegen</Button>
        </>} />
    </header>
  )
}
