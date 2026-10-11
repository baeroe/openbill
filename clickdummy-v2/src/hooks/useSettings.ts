import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/settings'
import type { DocType, DocTypeConfig } from '@/domain/types'
import { keys } from './keys'

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.getSettings })
}

/** Einstellungen ändern wirkt auf Dokumente (Summen, Prüfung): beides neu laden. */
function useSettingsMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.settings })
      qc.invalidateQueries({ queryKey: keys.documents.all })
    },
  })
}

export const useUpdateOrganization = () => useSettingsMutation(api.updateOrganization)
export const useUpdateDocTypeConfig = () => useSettingsMutation((a: { type: DocType; patch: Partial<DocTypeConfig> }) => api.updateDocTypeConfig(a.type, a.patch))
export const useSaveFieldDef = () => useSettingsMutation(api.saveFieldDef)
export const useDeleteFieldDef = () => useSettingsMutation(api.deleteFieldDef)
export const useReorderFieldDefs = () => useSettingsMutation(api.reorderFieldDefs)
export const useSaveTaxRate = () => useSettingsMutation(api.saveTaxRate)
export const useDeleteTaxRate = () => useSettingsMutation(api.deleteTaxRate)
export const useSaveUnit = () => useSettingsMutation(api.saveUnit)
export const useDeleteUnit = () => useSettingsMutation(api.deleteUnit)
export const useSaveTextBlock = () => useSettingsMutation(api.saveTextBlock)
export const useDeleteTextBlock = () => useSettingsMutation(api.deleteTextBlock)
export const useInviteUser = () => useSettingsMutation(api.inviteUser)
export const useDeleteUser = () => useSettingsMutation(api.deleteUser)
