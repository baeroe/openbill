import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/api/customers'
import { keys } from './keys'

export const useCustomers = (filter: api.CustomerFilter = {}) =>
  useQuery({ queryKey: keys.customers.list(filter), queryFn: () => api.listCustomers(filter), placeholderData: (prev) => prev })

export const useCustomer = (id: string | undefined) =>
  useQuery({ queryKey: keys.customers.detail(id ?? ''), queryFn: () => api.getCustomer(id!), enabled: !!id && id !== 'new' })

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.saveCustomer,
    onSuccess: (c) => {
      qc.setQueryData(keys.customers.detail(c.id), c)
      qc.invalidateQueries({ queryKey: keys.customers.all })
      qc.invalidateQueries({ queryKey: keys.documents.all })
    },
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteCustomer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.customers.all })
      qc.invalidateQueries({ queryKey: keys.documents.all })
    },
  })
}

export const emptyCustomer = api.emptyCustomer
