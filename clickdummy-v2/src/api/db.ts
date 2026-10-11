import { DB_VERSION, seed, type Db } from './seed'

const STORAGE_KEY = 'openbill:db'

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed?.version === DB_VERSION && Array.isArray(parsed.documents)) return parsed
    }
  } catch {
    // Kaputter Speicher: auf Demo-Daten zurückfallen
  }
  return seed()
}

/** Die „Datenbank“ des Klickdummys. Wird nach jeder Änderung im localStorage gesichert. */
export let db: Db = load()

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Speicher voll oder gesperrt: Daten bleiben bis zum Neuladen erhalten
  }
}

export function resetDb() {
  db = seed()
  persist()
}

const latencyMs = () => 120 + Math.random() * 280
export const latency = (ms = latencyMs()) => new Promise((r) => setTimeout(r, ms))

/** Fehlerfall auslösbar: localStorage.setItem("api:fail", "1") */
export function maybeFail() {
  let fail = false
  try { fail = localStorage.getItem('api:fail') === '1' } catch { /* ignore */ }
  if (fail) throw new ApiError('Der Server ist nicht erreichbar (simuliert).')
}

export class ApiError extends Error {
  details?: unknown
  constructor(message: string, details?: unknown) {
    super(message)
    this.details = details
  }
}

/** Kopie, damit Aufrufer nie den internen Zustand verändern (wie bei einer echten API). */
export const clone = <T>(v: T): T => structuredClone(v)

export const newId = (prefix = 'id') => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
export const nowIso = () => new Date().toISOString()
