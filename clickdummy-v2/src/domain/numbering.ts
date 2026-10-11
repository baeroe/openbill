import type { NumberState } from './types'

export function formatDocumentNumber(pattern: string, date: Date, seq: number): string {
  const yyyy = String(date.getFullYear())
  return pattern
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yyyy.slice(-2))
    .replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'))
    .replace(/\{(0+)\}/g, (_m, zeros: string) => String(seq).padStart(zeros.length, '0'))
}

export function allocateNumber(state: NumberState, date: Date): { number: string; next: NumberState } {
  const year = date.getFullYear()
  const lastYear = state.lastYear === null ? year : Math.max(state.lastYear, year)
  if (!state.resetYearly) {
    return { number: formatDocumentNumber(state.pattern, date, state.nextSeq), next: { ...state, nextSeq: state.nextSeq + 1, lastYear } }
  }
  // Ein Zähler pro Jahr: rückdatierte Dokumente bekommen die nächste Nummer ihres Jahres, lastYear läuft nie rückwärts.
  const seqs: Record<string, number> = { ...(state.yearSeqs ?? {}) }
  if (state.lastYear !== null) seqs[state.lastYear] = state.nextSeq
  const seq = seqs[year] ?? 1
  seqs[year] = seq + 1
  return { number: formatDocumentNumber(state.pattern, date, seq), next: { ...state, yearSeqs: seqs, lastYear, nextSeq: seqs[lastYear] } }
}
