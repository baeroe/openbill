import { isoToDate } from './dates'

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const date = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatMoney = (n: number): string => money.format(n)
export const formatDate = (iso: string | null | undefined): string => (iso ? date.format(isoToDate(iso)) : '')
export const formatDecimal = (n: number, decimals = 0): string =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 3) }).format(n)
