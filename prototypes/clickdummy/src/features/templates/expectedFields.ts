import { RESERVED_KEYS } from '@/domain/fields'
import type { Template } from '@/domain/types'
import type { SettingsData } from '@/store/settingsStore'

/** Erwartete Felder eines Templates, die in den unterstützten Dokumenttypen nicht definiert sind. */
export function missingExpectedFields(template: Template, settings: SettingsData): string[] {
  return template.manifest.expectedFields
    .filter((f) => {
      if (RESERVED_KEYS[f.scope].includes(f.key)) return false
      if (f.scope === 'document' || f.scope === 'position') {
        return !template.manifest.documentTypes.every((t) => {
          const defs = f.scope === 'document' ? settings.docTypes[t].documentFields : settings.docTypes[t].positionFields
          return defs.some((d) => d.key === f.key)
        })
      }
      return !settings.fieldDefs[f.scope].some((d) => d.key === f.key)
    })
    .map((f) => `${f.scope}.${f.key}`)
}
