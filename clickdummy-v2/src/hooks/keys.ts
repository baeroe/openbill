import type { CustomerFilter } from '@/api/customers'
import type { DocumentFilter } from '@/api/documents'

/** Zentrale Query-Keys, damit Invalidierung nicht rät. */
export const keys = {
  settings: ['settings'] as const,
  customers: {
    all: ['customers'] as const,
    list: (f: CustomerFilter = {}) => ['customers', 'list', f] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  documents: {
    all: ['documents'] as const,
    list: (f: DocumentFilter = {}) => ['documents', 'list', f] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
    chain: (id: string) => ['documents', 'chain', id] as const,
    suggestions: ['documents', 'suggestions'] as const,
  },
  templates: {
    all: ['templates'] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
  },
}
