import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { formatMoney } from '@/domain/format'
import type { CatalogItem } from '@/domain/types'
import { useCatalogStore } from '@/store/catalogStore'
import { newId } from '@/store/ids'
import { useSettingsStore } from '@/store/settingsStore'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { CustomFieldInput } from '@/ui/CustomFieldInput'
import { cx } from '@/ui/cx'
import { Dialog } from '@/ui/Dialog'
import { controlClass, Input, Select, Textarea } from '@/ui/form'
import { NumberInput } from '@/ui/NumberInput'
import { PageHeader } from '@/ui/PageHeader'

function CatalogItemDialog({ item, onClose }: { item: CatalogItem; onClose(): void }) {
  const { units, taxRates, categories, fieldDefs, org } = useSettingsStore()
  const { upsertItem, removeItem, items } = useCatalogStore()
  const [i, setI] = useState(item)
  const set = (patch: Partial<CatalogItem>) => setI({ ...i, ...patch })
  const exists = items.some((x) => x.id === item.id)

  return (
    <Dialog
      open
      onClose={onClose}
      title={exists ? item.title : 'Neuer Katalogeintrag'}
      footer={
        <>
          {exists && <Button variant="ghost" className="mr-auto" icon={<Trash2 size={14} />} onClick={() => { removeItem(item.id); onClose() }}>Löschen</Button>}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={!i.title.trim()} onClick={() => { upsertItem(i); onClose() }}>Speichern</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Bezeichnung" value={i.title} onChange={(e) => set({ title: e.target.value })} wrapClassName="sm:col-span-2" autoFocus />
        <Textarea label="Beschreibung" rows={2} value={i.description} onChange={(e) => set({ description: e.target.value })} wrapClassName="sm:col-span-2" />
        <Select label="Kategorie" value={i.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || null })}>
          <option value="">Ohne Kategorie</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Einheit" value={i.unitId} onChange={(e) => set({ unitId: e.target.value })}>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </Select>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-price" className="text-[13px] font-medium text-muted">Preis (netto)</label>
          <NumberInput id="catalog-price" value={i.price} onValue={(price) => set({ price })} className="h-9" />
        </div>
        <Select label="Steuersatz" disabled={org.taxationMode === 'small_business'} hint={org.taxationMode === 'small_business' ? 'Als Kleinunternehmer ohne Umsatzsteuer.' : undefined} value={i.taxRateId} onChange={(e) => set({ taxRateId: e.target.value })}>
          {taxRates.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </Select>
        {fieldDefs.catalog.map((def) => (
          <CustomFieldInput key={def.id} id={`catalog-${def.key}`} def={def} value={i.custom[def.key]} onChange={(v) => set({ custom: { ...i.custom, [def.key]: v } })} />
        ))}
      </div>
      {exists && <p className="mt-4 text-xs text-muted">Änderungen gelten nur für neue Positionen. Bestehende Dokumente behalten ihre Werte.</p>}
    </Dialog>
  )
}

export function CatalogPage() {
  const items = useCatalogStore((s) => s.items)
  const { categories, units, taxRates, fieldDefs } = useSettingsStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CatalogItem | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = items.filter((i) => !q || `${i.title} ${i.description}`.toLowerCase().includes(q))
    return [...categories, { id: null as string | null, name: 'Ohne Kategorie' }]
      .map((c) => ({ category: c, items: visible.filter((i) => i.categoryId === c.id) }))
      .filter((g) => g.items.length)
  }, [items, categories, query])

  const create = () => setEditing({ id: newId(), title: '', description: '', categoryId: null, unitId: units[0]?.id ?? '', price: 0, taxRateId: taxRates[0]?.id ?? '', custom: {} })

  return (
    <>
      <PageHeader title="Katalog" meta="Wiederkehrende Leistungen und Artikel zum schnellen Einfügen" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={create}>Neuer Eintrag</Button>} />
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
        <input aria-label="Katalog durchsuchen" placeholder="Suchen" value={query} onChange={(e) => setQuery(e.target.value)} className={cx(controlClass(), 'h-9 pl-8')} />
      </div>
      <div className="grid gap-6">
        {groups.map(({ category, items }) => (
          <section key={category.id ?? 'none'}>
            <h2 className="mb-2 font-cond text-lg font-semibold">{category.name}</h2>
            <div className="divide-y divide-line rounded-[3px] border border-line bg-sheet shadow-sheet">
              {items.map((i) => (
                <button key={i.id} type="button" onClick={() => setEditing(i)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-left hover:bg-sheet-2">
                  <span className="min-w-48 flex-1">
                    <span className="block font-medium">{i.title}</span>
                    {i.description && <span className="block text-[13px] text-muted">{i.description}</span>}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {fieldDefs.catalog.filter((d) => i.custom[d.key]).map((d) => <Badge key={d.id}>{String(i.custom[d.key])}</Badge>)}
                  </span>
                  <span className="w-28 text-right text-sm">
                    <span className="font-medium">{formatMoney(i.price)}</span>
                    <span className="text-muted"> / {units.find((u) => u.id === i.unitId)?.symbol}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {editing && <CatalogItemDialog item={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
