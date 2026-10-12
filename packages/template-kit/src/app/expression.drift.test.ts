import { expect, it } from 'vitest';
// the field bar of the template editor; this test is the only place where the kit reads app code
import * as editor from '../../../../resources/js/fields/expression';
import type { FieldScope, FieldType } from '../shared/protocol';
import { expression, liquidPath } from './fields';

const CASES: [FieldScope, string, FieldType | undefined][] = [
    ['document', 'number', undefined],
    ['document', 'date', undefined],
    ['document', 'net_total', undefined],
    ['document', 'intro', undefined],
    ['document', 'legal_notes', undefined],
    ['document', 'tax_breakdown', undefined],
    ['org', 'logo', undefined],
    ['position', 'quantity', undefined],
    ['position', 'unit_price', undefined],
    ['document', 'po_number', 'text'],
    ['customer', 'note', 'textarea'],
    ['position', 'hours', 'number'],
    ['document', 'budget', 'money'],
    ['document', 'deadline', 'date'],
    ['document', 'rush', 'boolean'],
    ['customer', 'badge', 'image'],
    ['document', 'tier', 'select'],
];

it.each(CASES)('copies the same expression as the template editor for %s.%s (%s)', (scope, key, type) => {
    expect(expression(scope, key, type)).toBe(editor.expression(scope, key, type));
    expect(liquidPath(scope, key)).toBe(editor.liquidPath(scope, key));
});
