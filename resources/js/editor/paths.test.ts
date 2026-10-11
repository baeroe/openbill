import { describe, expect, it } from 'vitest';
import type { ApiPosition } from '@/api/types';
import { fieldErrors, issuePaths, violationPath } from './paths';

const p = (id: string): ApiPosition => ({ id, kind: 'item', title: '', description: '', quantity: '1', unit_id: null, unit_price: '0', tax_rate_id: null, custom: {} });
const draft = { groups: [{ id: 'g1', title: 'Konzept', positions: [p('a'), p('b')] }, { id: 'g2', title: null, positions: [p('c')] }] };

describe('violationPath', () => {
    it('maps position paths of the API to the field of that row', () => {
        expect(violationPath(draft, 'groups.0.positions.1.quantity')).toBe('positions.b.quantity');
        expect(violationPath(draft, 'groups.1.positions.0.unit_id')).toBe('positions.c.unit');
        expect(violationPath(draft, 'groups.0.positions.0.tax_rate_id')).toBe('positions.a.tax_rate');
        expect(violationPath(draft, 'groups.0.positions.0.custom.ticket')).toBe('positions.a.custom.ticket');
        expect(violationPath(draft, 'draft.groups.0.positions.1.unit_price')).toBe('positions.b.unit_price');
    });

    it('maps group and document paths', () => {
        expect(violationPath(draft, 'groups.0.title')).toBe('groups.g1.title');
        expect(violationPath(draft, 'customer_id')).toBe('document.customer');
        expect(violationPath(draft, 'contact_id')).toBe('document.contact');
        expect(violationPath(draft, 'due_date')).toBe('document.due_date');
        expect(violationPath(draft, 'custom.project_name')).toBe('document.custom.project_name');
        expect(violationPath(draft, 'template_id')).toBe('document.template');
    });

    it('keeps paths that already are field paths (compliance issues of a refused finalize)', () => {
        expect(violationPath(draft, 'positions.a.unit')).toBe('positions.a.unit');
        expect(violationPath(draft, 'document.due_date')).toBe('document.due_date');
        expect(violationPath(draft, 'customer.vat_id')).toBe('customer.vat_id');
        expect(violationPath(draft, 'org.iban')).toBe('org.iban');
    });

    it('falls back to the positions area for rows that no longer exist', () => {
        expect(violationPath(draft, 'groups.5.positions.0.title')).toBe('positions');
        expect(violationPath(draft, 'groups')).toBe('positions');
    });
});

describe('fieldErrors', () => {
    it('keeps the first message per field', () => {
        expect(
            fieldErrors(draft, [
                { path: 'groups.0.positions.0.quantity', message: 'Enter a number.' },
                { path: 'groups.0.positions.0.quantity', message: 'Second.' },
                { path: 'date', message: 'Date is missing.' },
            ]),
        ).toEqual({ 'positions.a.quantity': 'Enter a number.', 'document.date': 'Date is missing.' });
    });
});

describe('issuePaths', () => {
    it('collects the paths of compliance issues', () => {
        expect([...issuePaths([{ path: 'document.due_date', message: '', code: 'due_date_missing' }])]).toEqual(['document.due_date']);
    });
});
