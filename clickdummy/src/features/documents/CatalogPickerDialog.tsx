import { useMemo, useState } from 'react'
import { formatMoney } from '@/domain/format'
import { useCatalogStore } from '@/store/catalogStore'
import { useDocumentStore } from '@/store/documentStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { Checkbox, Input } from '@/ui/form'

export function CatalogPickerDialog({ open, onClose, docId }: { open: boolean; onClose(): void; docId: string }) {
  const items = useCatalogStore((s) => s.items)
  const { categories, units } = useSettingsStore()
  const insert = useDocumentStore((s) => s.insertCatalogItem)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = items.filter((i) => !q || i.title.toLowerCase().includes(q))
    return [...categories, { id: null, name: 'Ohne Kategorie' }]
      .map((c) => ({ category: c, items: visible.filter((i) => i.categoryId === c.id) }))
      .filter((g) => g.items.length)
  }, [items, categories, query])

  const apply = () => {
    picked.forEach((id) => insert(docId, items.find((i) => i.id === id)!))
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Aus dem Katalog übernehmen"
      footer={<><Button onClick={onClose}>Abbrechen</Button><Button variant="primary" disabled={!picked.length} onClick={apply}>{picked.length ? `${picked.length} übernehmen` : 'Übernehmen'}</Button></>}
    >
      <Input aria-label="Katalog durchsuchen" placeholder="Suchen" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <div className="mt-4 grid gap-4">
        {groups.map(({ category, items }) => (
          <div key={category.id ?? 'none'}>
            <p className="mb-1.5 text-[13px] font-medium text-muted">{category.name}</p>
            <div className="grid gap-1.5">
              {items.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-3 rounded-[3px] border border-line px-3 py-2">
                  <Checkbox
                    label={i.title}
                    hint={i.description || undefined}
                    checked={picked.includes(i.id)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))}
                  />
                  <span className="shrink-0 text-sm text-muted">{formatMoney(i.price)} / {units.find((u) => u.id === i.unitId)?.symbol}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
