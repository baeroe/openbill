import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { seed } from '@/data/seed'
import type { Template } from '@/domain/types'
import { builtInTemplates } from '@/templates'
import { newId } from './ids'
import { upsert } from './listUtils'

/** Eigene Templates aus älteren Ständen (ohne Kopf-/Fußzeile, mit altem margin) auf das aktuelle Format bringen. */
function normalizeTemplate(t: Template): Template {
  const paper = (t.manifest?.paper ?? {}) as Partial<Template['manifest']['paper']> & { margin?: string }
  const side = paper.margin?.trim().split(/\s+/)
  return {
    ...t,
    header: t.header ?? '',
    footer: t.footer ?? '',
    manifest: {
      ...t.manifest,
      paper: {
        format: paper.format ?? 'A4',
        marginX: paper.marginX ?? side?.[side.length > 1 ? 1 : 0] ?? '20mm',
        headerHeight: paper.headerHeight ?? '20mm',
        footerHeight: paper.footerHeight ?? '20mm',
      },
    },
  }
}

interface TemplateState {
  templates: Template[]
  upsertTemplate(t: Template): void
  removeTemplate(id: string): void
  duplicateTemplate(id: string): string
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: seed().templates,
      upsertTemplate: (t) => set((s) => ({ templates: upsert(s.templates, t) })),
      removeTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id || t.builtIn) })),
      duplicateTemplate: (id) => {
        const src = get().templates.find((t) => t.id === id)
        if (!src) throw new Error(`Template ${id} nicht gefunden`)
        const copy: Template = { ...src, id: newId(), builtIn: false, manifest: { ...src.manifest, name: `${src.manifest.name} (Kopie)`, author: 'Mara Lindqvist' } }
        set((s) => ({ templates: [...s.templates, copy] }))
        return copy.id
      },
    }),
    {
      name: 'openbill:templates',
      version: 1,
      migrate: () => ({ templates: seed().templates }) as never,
      partialize: (s) => ({ templates: s.templates.filter((t) => !t.builtIn) }),
      // Mitgelieferte Templates kommen immer aus dem Code, eigene aus dem Speicher.
      merge: (persisted, current) => ({
        ...current,
        templates: [...builtInTemplates, ...(Array.isArray((persisted as { templates?: unknown })?.templates) ? (persisted as { templates: Template[] }).templates : []).filter((t) => t && !t.builtIn).map(normalizeTemplate)],
      }),
    },
  ),
)
