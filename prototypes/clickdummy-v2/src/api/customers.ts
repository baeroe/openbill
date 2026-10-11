import { defaultCustomValues, fieldsFor } from '@/domain/fields'
import type { Customer } from '@/domain/types'
import { ApiError, clone, db, latency, maybeFail, newId, nowIso, persist } from './db'

export interface CustomerFilter { query?: string }

export async function listCustomers(filter: CustomerFilter = {}): Promise<Customer[]> {
  await latency()
  maybeFail()
  const q = filter.query?.trim().toLowerCase()
  const list = q
    ? db.customers.filter((c) => [c.name, c.number, c.email, c.address.city, ...c.contacts.map((x) => `${x.firstName} ${x.lastName}`)].join(' ').toLowerCase().includes(q))
    : db.customers
  return clone([...list].sort((a, b) => a.name.localeCompare(b.name, 'de')))
}

export async function getCustomer(id: string): Promise<Customer> {
  await latency()
  maybeFail()
  const c = db.customers.find((x) => x.id === id)
  if (!c) throw new ApiError('Diesen Kunden gibt es nicht mehr.')
  return clone(c)
}

export function emptyCustomer(): Customer {
  const nextNo = Math.max(1000, ...db.customers.map((c) => Number(c.number.replace(/\D/g, '')) || 0)) + 1
  return {
    id: '', number: `K-${nextNo}`, name: '', address: { street: '', zip: '', city: '', country: 'DE' }, email: '', vatId: '',
    taxTreatment: 'domestic', contacts: [], custom: defaultCustomValues(fieldsFor(db.settings.fieldDefs, 'customer')), createdAt: '',
  }
}

export async function saveCustomer(input: Customer): Promise<Customer> {
  await latency()
  maybeFail()
  if (!input.name.trim()) throw new ApiError('Der Kunde braucht einen Namen.')
  const contacts = input.contacts.map((c) => ({ ...c, id: c.id || newId('con') }))
  if (contacts.length && !contacts.some((c) => c.isDefault)) contacts[0].isDefault = true
  const customer: Customer = { ...input, contacts, id: input.id || newId('cus'), createdAt: input.createdAt || nowIso() }
  db.customers = db.customers.some((c) => c.id === customer.id) ? db.customers.map((c) => (c.id === customer.id ? customer : c)) : [customer, ...db.customers]
  persist()
  return clone(customer)
}

export async function deleteCustomer(id: string): Promise<void> {
  await latency()
  maybeFail()
  if (db.documents.some((d) => d.customerId === id && d.status !== 'draft')) throw new ApiError('Der Kunde hat abgeschlossene Dokumente und kann nicht gelöscht werden.')
  db.customers = db.customers.filter((c) => c.id !== id)
  db.documents = db.documents.filter((d) => d.customerId !== id)
  persist()
}
