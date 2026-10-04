import { formatMoney } from '@/domain/format'
import type { Totals } from '@/domain/totals'

export function TotalsPanel({ totals }: { totals: Totals }) {
  return (
    <div className="ml-auto w-full max-w-sm rounded-[3px] border border-line bg-sheet px-5 py-4 text-sm shadow-sheet">
      <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
        <dt className="text-muted">Netto</dt>
        <dd data-testid="total-net" className="text-right">{formatMoney(totals.net)}</dd>
        {totals.taxBreakdown.filter((t) => t.percent > 0).map((t) => (
          <div key={`${t.category}${t.percent}`} className="contents">
            <dt className="text-muted">USt. {t.percent} % auf {formatMoney(t.net)}</dt>
            <dd className="text-right">{formatMoney(t.tax)}</dd>
          </div>
        ))}
        <dt className="mt-1.5 border-t border-ink pt-2 font-semibold">Gesamt</dt>
        <dd data-testid="total-gross" className="mt-1.5 border-t border-ink pt-2 text-right font-cond text-lg leading-none font-semibold">{formatMoney(totals.gross)}</dd>
        {totals.optionalNet !== 0 && (
          <>
            <dt className="text-xs text-muted">Optionale Positionen, netto</dt>
            <dd data-testid="total-optional" className="text-right text-xs text-muted">{formatMoney(totals.optionalNet)}</dd>
          </>
        )}
      </dl>
      {totals.legalNotes.length > 0 && (
        <ul className="mt-3 border-t border-dashed border-line pt-3 text-xs text-muted">
          {totals.legalNotes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  )
}
