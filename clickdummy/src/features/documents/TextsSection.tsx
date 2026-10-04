import { useRef, useState } from 'react'
import { TextQuote } from 'lucide-react'
import type { Document, TextBlock } from '@/domain/types'
import { useDocumentStore } from '@/store/documentStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/ui/Button'
import { Textarea } from '@/ui/form'
import { Sheet } from '@/ui/Sheet'

function BlockMenu({ blocks, onPick }: { blocks: TextBlock[]; onPick(b: TextBlock): void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" icon={<TextQuote size={14} />} onClick={() => setOpen(!open)} aria-expanded={open}>Baustein einfügen</Button>
      {open && (
        <ul className="absolute right-0 z-20 mt-1 w-72 rounded-[4px] border border-line bg-sheet py-1 shadow-xl" onMouseLeave={() => setOpen(false)}>
          {blocks.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => { onPick(b); setOpen(false) }} className="block w-full px-3 py-2 text-left hover:bg-carbon-soft">
                <span className="block text-sm font-medium">{b.name}</span>
                <span className="block truncate text-xs text-muted">{b.body}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TextField({ label, value, locked, onChange }: { label: string; value: string; locked: boolean; onChange(v: string): void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const blocks = useSettingsStore((s) => s.textBlocks)
  const insert = (b: TextBlock) => {
    const el = ref.current
    const at = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const sep = value && at === value.length ? '\n' : ''
    onChange(value.slice(0, at) + sep + b.body + value.slice(end))
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {!locked && <BlockMenu blocks={blocks} onPick={insert} />}
      </div>
      <Textarea ref={ref} aria-label={label} rows={3} disabled={locked} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function TextsSection({ doc, locked }: { doc: Document; locked: boolean }) {
  const update = useDocumentStore((s) => s.updateDocument)
  return (
    <Sheet title="Einleitung und Schlusstext" description="Stehen vor und nach den Positionen. Platzhalter wie {{ contact.first_name }} werden ersetzt. Kopf- und Fußzeile jeder Seite kommen aus dem Template.">
      <div className="grid gap-4">
        <TextField label="Einleitung" value={doc.intro} locked={locked} onChange={(intro) => update(doc.id, { intro })} />
        <TextField label="Schlusstext" value={doc.closing} locked={locked} onChange={(closing) => update(doc.id, { closing })} />
      </div>
    </Sheet>
  )
}
