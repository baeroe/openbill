import { formatMoney } from '@/domain/format'
import { TAX_CATEGORY_LABELS } from '@/domain/taxCategories'
import type { Totals } from '@/domain/totals'

export function TotalsPanel({ totals }: { totals: Totals }) {
  return (
    <div className="totals" aria-label="Summen">
      <div className="totals__row"><span>Netto</span><span className="num">{formatMoney(totals.net)}</span></div>
      {totals.taxBreakdown.map((t) => (
        <div key={`${t.category}${t.percent}`} className="totals__row totals__row--sub">
          <span>{t.percent > 0 ? `USt. ${t.percent} % auf ${formatMoney(t.net)}` : `${TAX_CATEGORY_LABELS[t.category]} auf ${formatMoney(t.net)}`}</span>
          <span className="num">{formatMoney(t.tax)}</span>
        </div>
      ))}
      <div className="totals__row totals__row--gross"><span>Gesamt</span><span className="num">{formatMoney(totals.gross)}</span></div>
      {totals.optionalNet !== 0 && (
        <div className="totals__row totals__row--sub"><span>Optionale Positionen, nicht enthalten</span><span className="num">{formatMoney(totals.optionalNet)}</span></div>
      )}
      {totals.legalNotes.map((n) => <p key={n} className="totals__note">{n}</p>)}
    </div>
  )
}
