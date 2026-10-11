import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ErrorState } from '@/components/ui'

/** Rendert Loading/Error einer Query einheitlich und reicht die Daten an children weiter. */
export function QueryGate<T>({ query, loading, children }: { query: UseQueryResult<T>; loading: ReactNode; children: (data: T) => ReactNode }) {
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data === undefined) return <>{loading}</>
  return <>{children(query.data)}</>
}
