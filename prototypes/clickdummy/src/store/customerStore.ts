import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seed } from '@/data/seed'
import type { Contact, Customer } from '@/domain/types'
import { upsert, without } from './listUtils'
import { mergeOrSeed } from './persistence'

interface CustomerState {
  customers: Customer[]
  upsertCustomer(c: Customer): void
  removeCustomer(id: string): void
  upsertContact(customerId: string, contact: Contact): void
  removeContact(customerId: string, contactId: string): void
  setDefaultContact(customerId: string, contactId: string): void
}

const ensureDefault = (contacts: Contact[]) =>
  contacts.some((x) => x.isDefault) ? contacts : contacts.map((x, i) => ({ ...x, isDefault: i === 0 }))
const patch = (list: Customer[], id: string, fn: (c: Customer) => Customer) => list.map((c) => (c.id === id ? fn(c) : c))

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customers: seed().customers,
      upsertCustomer: (c) => set((s) => ({ customers: upsert(s.customers, c) })),
      removeCustomer: (id) => set((s) => ({ customers: without(s.customers, id) })),
      upsertContact: (customerId, contact) =>
        set((s) => ({ customers: patch(s.customers, customerId, (c) => ({ ...c, contacts: ensureDefault(upsert(c.contacts, contact)) })) })),
      removeContact: (customerId, contactId) =>
        set((s) => ({ customers: patch(s.customers, customerId, (c) => ({ ...c, contacts: ensureDefault(without(c.contacts, contactId)) })) })),
      setDefaultContact: (customerId, contactId) =>
        set((s) => ({ customers: patch(s.customers, customerId, (c) => ({ ...c, contacts: c.contacts.map((x) => ({ ...x, isDefault: x.id === contactId })) })) })),
    }),
    { name: 'openbill:customers', version: 1, migrate: () => ({ customers: seed().customers }) as never, partialize: (s) => ({ customers: s.customers }), merge: mergeOrSeed((s) => Array.isArray(s.customers)) },
  ),
)
