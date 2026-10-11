const pad = (n: number) => String(n).padStart(2, '0')
export const dateToIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const isoToDate = (iso: string): Date => new Date(`${iso}T00:00:00`)
export const todayIso = (): string => dateToIso(new Date())
export const addDays = (iso: string, days: number): string => {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + days)
  return dateToIso(d)
}
