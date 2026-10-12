import { describe, expect, it } from 'vitest';
import type { Customer } from '@/api/types';
import { applyContact, contactErrors, contactName, defaultContact, draftOf, emptyCustomer, inputOf, makeDefault, newContact, removeContact, taxTag, type ContactDraft } from './customers';

const customer: Customer = {
    id: 'c1',
    number: 'K-1001',
    name: 'Hafenkontor Lindqvist GmbH',
    street: 'Am Sandtorkai 4',
    zip: '20457',
    city: 'Hamburg',
    country: 'DE',
    email: 'buchhaltung@hafenkontor.example',
    vat_id: 'DE987654321',
    tax_treatment: 'domestic',
    supply_type: 'services',
    locale: null,
    custom: { industry: 'Handel' },
    contacts: [
        { id: 'p1', salutation: 'Frau', first_name: 'Mira', last_name: 'Albers', position: 'Leitung E-Commerce', email: 'mira.albers@hafenkontor.example', phone: '', is_default: true, custom: {} },
        { id: 'p2', salutation: 'Herr', first_name: 'Ole', last_name: 'Brandt', position: 'Einkauf', email: '', phone: '', is_default: false, custom: {} },
    ],
    created_at: null,
    updated_at: null,
};

const keys = (contacts: ContactDraft[]) => contacts.map((c) => `${c.key}${c.is_default ? '*' : ''}`);

describe('draft ↔ API', () => {
    it('keeps the ids of existing contacts and sends new ones without id', () => {
        const draft = draftOf(customer);
        const added = { ...newContact(draft.contacts), first_name: 'Lena', last_name: 'Sommer' };
        const input = inputOf({ ...draft, contacts: applyContact(draft.contacts, added) });

        expect(input.contacts.map((c) => c.id)).toEqual(['p1', 'p2', undefined]);
        expect('key' in input.contacts[2]).toBe(false);
        expect(input).not.toHaveProperty('id');
        expect(input.custom).toEqual({ industry: 'Handel' });
        expect(input.supply_type).toBe('services');
    });

    it('starts a new customer empty and domestic', () => {
        expect(emptyCustomer()).toMatchObject({ name: '', number: '', country: 'DE', tax_treatment: 'domestic', supply_type: 'services', contacts: [] });
    });
});

describe('contacts', () => {
    it('makes the first new contact the default', () => {
        const first = newContact([]);
        expect(first.is_default).toBe(true);
        expect(newContact([first]).is_default).toBe(false);
    });

    it('keeps exactly one default', () => {
        const draft = draftOf(customer);
        const promoted = applyContact(draft.contacts, { ...draft.contacts[1], is_default: true });

        expect(keys(promoted)).toEqual(['p1', 'p2*']);
        expect(keys(makeDefault(promoted, 'p1'))).toEqual(['p1*', 'p2']);
        expect(keys(removeContact(draft.contacts, 'p1'))).toEqual(['p2*']);
        expect(removeContact(removeContact(draft.contacts, 'p1'), 'p2')).toEqual([]);
    });

    it('maps API errors of one contact to its fields', () => {
        const errors = { name: 'Name is required.', 'contacts.1.email': 'Invalid email.', 'contacts.1.custom.department': 'Too long.', 'contacts.10.email': 'Other contact.' };

        expect(contactErrors(errors, 1)).toEqual({ email: 'Invalid email.', 'custom.department': 'Too long.' });
        expect(contactErrors(errors, 0)).toEqual({});
    });

    it('names contacts and finds the default', () => {
        expect(contactName(customer.contacts[0])).toBe('Frau Mira Albers');
        expect(contactName(customer.contacts[0], false)).toBe('Mira Albers');
        expect(contactName({ salutation: '', first_name: ' ', last_name: '' })).toBe('');
        expect(defaultContact(customer.contacts)?.id).toBe('p1');
        expect(defaultContact([])).toBeNull();
    });
});

describe('taxTag', () => {
    it('tags only customers outside the domestic case', () => {
        expect(taxTag('domestic')).toBeNull();
        expect(taxTag('eu_reverse_charge')).toBe('tax_treatment.eu_reverse_charge_tag'); // no translations loaded in tests
    });
});
