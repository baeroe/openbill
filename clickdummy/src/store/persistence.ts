/**
 * merge-Funktion für zustand/persist: übernimmt den gespeicherten Stand nur, wenn er die erwartete Form hat.
 * Sonst bleibt der aktuelle Stand (die Demo-Daten) — eine kaputte localStorage-Version führt nie zum Absturz.
 */
export const mergeOrSeed =
  <T extends object>(valid: (s: Record<string, unknown>) => boolean) =>
  (persisted: unknown, current: T): T =>
    persisted && typeof persisted === 'object' && valid(persisted as Record<string, unknown>) ? { ...current, ...(persisted as Partial<T>) } : current

export const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v)
