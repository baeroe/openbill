import { Skeleton } from '@/components/ui'

/** Platzhalter in Form eines Formulars mit zwei Spalten. */
export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card stack" aria-busy="true" aria-label="Wird geladen">
      <Skeleton w={180} h={18} />
      <div className="grid-2">
        {Array.from({ length: rows * 2 }, (_, i) => (
          <div key={i} className="stack stack--sm"><Skeleton w={90} h={11} /><Skeleton h={38} r={12} /></div>
        ))}
      </div>
    </div>
  )
}
