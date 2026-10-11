import { describe, expect, it } from 'vitest'
import { fieldsFor, slugifyKey, validateFieldDef } from './fields'
import type { FieldDef } from './types'

const def = (over: Partial<FieldDef>): FieldDef => ({
  id: 'x', scope: 'document', key: 'project_name', label: 'Projektname', type: 'text', required: false,
  defaultValue: null, help: '', options: [], docTypes: ['invoice'], ...over,
})

describe('slugifyKey', () => {
  it('transliterates umlauts and snake-cases', () => {
    expect(slugifyKey('Größe der Fläche')).toBe('groesse_der_flaeche')
    expect(slugifyKey('  2. Ansprechpartner ')).toBe('f_2_ansprechpartner')
  })
})

describe('validateFieldDef', () => {
  it('rejects core keys, duplicates in the same scope and missing doc types', () => {
    expect(validateFieldDef(def({ key: 'number' }), [])).toEqual([expect.stringContaining('reserviert')])
    expect(validateFieldDef(def({ id: 'y' }), [def({})])).toEqual([expect.stringContaining('schon vergeben')])
    expect(validateFieldDef(def({ docTypes: [] }), [])).toEqual([expect.stringContaining('Dokumenttyp')])
  })
  it('allows the same key on another scope', () => {
    expect(validateFieldDef(def({ id: 'y', scope: 'customer', docTypes: [] }), [def({})])).toEqual([])
  })
})

describe('fieldsFor', () => {
  it('filters document fields by doc type but not customer fields', () => {
    const defs = [def({ id: 'a' }), def({ id: 'b', key: 'po', docTypes: ['offer'] }), def({ id: 'c', scope: 'customer', key: 'industry', docTypes: [] })]
    expect(fieldsFor(defs, 'document', 'invoice').map((d) => d.id)).toEqual(['a'])
    expect(fieldsFor(defs, 'customer', 'invoice').map((d) => d.id)).toEqual(['c'])
  })
})
