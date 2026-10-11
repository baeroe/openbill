import { useMemo } from 'react'
import { buildDocumentView } from '@/domain/documentView'
import type { TemplateContextInput } from '@/domain/templateContext'
import { useCustomers } from '@/hooks/useCustomers'
import { useDocument, useDocuments } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'

/** Beispieldokument für Vorschauen: das gewählte oder die erste Rechnung (sonst das erste Dokument). */
export function useSampleContext(docId?: string) {
  const documents = useDocuments()
  const fallbackId = useMemo(() => {
    const list = documents.data ?? []
    return (list.find((d) => d.type === 'invoice') ?? list[0])?.id
  }, [documents.data])
  const id = docId || fallbackId
  const doc = useDocument(id)
  const settings = useSettings()
  const customers = useCustomers()

  const input = useMemo<TemplateContextInput | null>(() => {
    if (!doc.data || !settings.data || !customers.data || !documents.data) return null
    return buildDocumentView(doc.data, settings.data, customers.data, documents.data).contextInput
  }, [doc.data, settings.data, customers.data, documents.data])

  const error = documents.error ?? doc.error ?? settings.error ?? customers.error
  const retry = () => { documents.refetch(); doc.refetch(); settings.refetch(); customers.refetch() }
  return { input, sampleId: id, documents: documents.data ?? [], error, retry, isEmpty: documents.data?.length === 0 }
}
