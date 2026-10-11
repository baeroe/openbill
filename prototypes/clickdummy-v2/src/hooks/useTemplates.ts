import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/templates'
import { keys } from './keys'

export const useTemplates = () => useQuery({ queryKey: keys.templates.all, queryFn: api.listTemplates })
export const useTemplate = (id: string | undefined) =>
  useQuery({ queryKey: keys.templates.detail(id ?? ''), queryFn: () => api.getTemplate(id!), enabled: !!id })

function useTemplateMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.templates.all })
      qc.invalidateQueries({ queryKey: keys.settings })
    },
  })
}

export const useSaveTemplate = () => useTemplateMutation(api.saveTemplate)
export const useDuplicateTemplate = () => useTemplateMutation(api.duplicateTemplate)
export const useImportTemplate = () => useTemplateMutation(api.importTemplate)
export const useDeleteTemplate = () => useTemplateMutation(api.deleteTemplate)
