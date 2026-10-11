import type { Template } from '@/domain/types'
import { ApiError, clone, db, latency, maybeFail, newId, persist } from './db'

export async function listTemplates(): Promise<Template[]> {
  await latency()
  maybeFail()
  return clone(db.templates)
}

export async function getTemplate(id: string): Promise<Template> {
  await latency()
  maybeFail()
  const t = db.templates.find((x) => x.id === id)
  if (!t) throw new ApiError('Dieses Template gibt es nicht mehr.')
  return clone(t)
}

export async function saveTemplate(t: Template): Promise<Template> {
  await latency()
  maybeFail()
  if (t.builtIn) throw new ApiError('Mitgelieferte Templates lassen sich nicht ändern. Dupliziere es, um es anzupassen.')
  db.templates = db.templates.map((x) => (x.id === t.id ? t : x))
  persist()
  return clone(t)
}

export async function duplicateTemplate(id: string): Promise<Template> {
  await latency()
  maybeFail()
  const src = db.templates.find((x) => x.id === id)
  if (!src) throw new ApiError('Dieses Template gibt es nicht mehr.')
  const copy: Template = { ...clone(src), id: newId('tpl'), builtIn: false, manifest: { ...clone(src.manifest), name: `${src.manifest.name} (Kopie)`, author: db.settings.org.name, version: '1.0.0' } }
  db.templates = [...db.templates, copy]
  persist()
  return clone(copy)
}

/** Simulierter ZIP-Import: legt ein Paket mit dem Namen der Datei an. */
export async function importTemplate(fileName: string): Promise<Template> {
  await latency(900)
  maybeFail()
  if (!fileName.toLowerCase().endsWith('.zip')) throw new ApiError('Ein Template-Paket ist eine ZIP-Datei mit manifest.json, header.liquid, template.liquid, footer.liquid und styles.css.')
  const base = db.templates[0]
  const name = fileName.replace(/\.zip$/i, '').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  const t: Template = { ...clone(base), id: newId('tpl'), builtIn: false, manifest: { ...clone(base.manifest), name, author: 'Importiert', description: `Importiert aus ${fileName}.` } }
  db.templates = [...db.templates, t]
  persist()
  return clone(t)
}

export async function deleteTemplate(id: string): Promise<void> {
  await latency()
  maybeFail()
  const t = db.templates.find((x) => x.id === id)
  if (t?.builtIn) throw new ApiError('Mitgelieferte Templates lassen sich nicht löschen.')
  if (Object.values(db.settings.docTypes).some((c) => c.templateId === id)) throw new ApiError('Das Template ist noch einem Dokumenttyp zugewiesen.')
  db.templates = db.templates.filter((x) => x.id !== id)
  persist()
}
