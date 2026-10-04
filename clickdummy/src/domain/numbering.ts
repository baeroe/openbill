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
  const seq = state.resetYearly && state.lastYear !== null && state.lastYear !== year ? 1 : state.nextSeq
  return { number: formatDocumentNumber(state.pattern, date, seq), next: { ...state, nextSeq: seq + 1, lastYear: year } }
}
