import { TextQuote } from 'lucide-react'
import { Button, Menu, MenuItem, Textarea } from '@/components/ui'
import type { Document, TextBlock } from '@/domain/types'

const KIND_ORDER: Record<'intro' | 'closing', TextBlock['kind'][]> = { intro: ['intro', 'note', 'payment', 'closing'], closing: ['closing', 'payment', 'note', 'intro'] }

function BlockMenu({ blocks, which, onInsert }: { blocks: TextBlock[]; which: 'intro' | 'closing'; onInsert(body: string): void }) {
  const sorted = [...blocks].sort((a, b) => KIND_ORDER[which].indexOf(a.kind) - KIND_ORDER[which].indexOf(b.kind))
  return (
    <Menu trigger={({ toggle, ref, open }) => (
      <Button ref={ref} variant="ghost" size="sm" icon={<TextQuote />} onClick={toggle} aria-haspopup="menu" aria-expanded={open} disabled={!blocks.length}>Baustein einfügen</Button>
    )}>
      {(close) => sorted.map((b) => (
        <MenuItem key={b.id} onClick={() => { onInsert(b.body); close() }}>
          <span style={{ display: 'grid', minWidth: 0 }}>
            <span>{b.name}</span>
            <span className="muted" style={{ fontSize: 'var(--text-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '18rem' }}>{b.body.split('\n')[0]}</span>
          </span>
        </MenuItem>
      ))}
    </Menu>
  )
}

/** Einleitung und Schlusstext, frei oder aus Bausteinen. */
export function TextsSection({ doc, blocks, readOnly, update, which }: { doc: Document; blocks: TextBlock[]; readOnly: boolean; update(fn: (d: Document) => Document): void; which: 'intro' | 'closing' }) {
  const value = doc[which]
  const label = which === 'intro' ? 'Einleitung' : 'Schlusstext'
  const insert = (body: string) => update((d) => ({ ...d, [which]: d[which].trim() ? `${d[which].trimEnd()}\n\n${body}` : body }))
  return (
    <Textarea
      label={label}
      aside={!readOnly && <span style={{ marginLeft: 'auto' }}><BlockMenu blocks={blocks} which={which} onInsert={insert} /></span>}
      value={value}
      disabled={readOnly}
      rows={3}
      className="texts__area"
      placeholder={which === 'intro' ? 'Steht vor den Positionen, z. B. eine kurze Anrede.' : 'Steht nach den Summen, z. B. Zahlungsbedingungen und Gruß.'}
      hint={!readOnly ? 'Platzhalter wie {{ contact.first_name }} werden in der Vorschau ersetzt.' : undefined}
      onChange={(e) => update((d) => ({ ...d, [which]: e.target.value }))}
    />
  )
}
