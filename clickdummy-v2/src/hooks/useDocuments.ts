import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/documents'
import type { DocStatus, DocType, Document } from '@/domain/types'
import { keys } from './keys'

export const useDocuments = (filter: api.DocumentFilter = {}) =>
  useQuery({ queryKey: keys.documents.list(filter), queryFn: () => api.listDocuments(filter), placeholderData: (prev) => prev })

export const useDocument = (id: string | undefined) =>
  useQuery({ queryKey: keys.documents.detail(id ?? ''), queryFn: () => api.getDocument(id!), enabled: !!id })

export const useDocumentChain = (id: string) =>
  useQuery({ queryKey: keys.documents.chain(id), queryFn: () => api.getDocumentChain(id) })

export const usePositionSuggestions = () =>
  useQuery({ queryKey: keys.documents.suggestions, queryFn: api.listPositionSuggestions, staleTime: 60_000 })

function useDocMutation<A>(fn: (a: A) => Promise<Document>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (doc) => {
      qc.setQueryData(keys.documents.detail(doc.id), doc)
      qc.invalidateQueries({ queryKey: keys.documents.all, predicate: (q) => q.queryKey[1] !== 'detail' || q.queryKey[2] !== doc.id })
    },
  })
}

export const useCreateDocument = () => useDocMutation(api.createDocument)
export const useDuplicateDocument = () => useDocMutation(api.duplicateDocument)
export const useRestoreDocument = () => useDocMutation(api.restoreDocument)
export const useSetDocumentStatus = () => useDocMutation((a: { id: string; status: DocStatus }) => api.setDocumentStatus(a.id, a.status))

/** Abschließen vergibt eine Nummer: auch die Einstellungen (Nummernkreis) neu laden. */
export function useFinalizeDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.finalizeDocument,
    onSuccess: (doc) => {
      qc.setQueryData(keys.documents.detail(doc.id), doc)
      qc.invalidateQueries({ queryKey: keys.documents.all })
      qc.invalidateQueries({ queryKey: keys.settings })
    },
  })
}

/** Speichern im Editor: schreibt still, ohne die Detail-Query neu zu laden (der Editor hält den Stand). */
export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.updateDocument,
    onSuccess: (doc) => {
      qc.setQueryData(keys.documents.detail(doc.id), doc)
      qc.invalidateQueries({ queryKey: ['documents', 'list'] })
      qc.invalidateQueries({ queryKey: keys.documents.suggestions })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.documents.detail(id) })
      qc.invalidateQueries({ queryKey: keys.documents.all })
    },
  })
}

export function useConvertDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { id: string; target: DocType }) => api.convertDocumentTo(a.id, a.target),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.documents.all }),
  })
}

export function useResetDemo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: api.resetDemo, onSuccess: () => qc.invalidateQueries() })
}
