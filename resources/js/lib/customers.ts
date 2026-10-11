import type { Contact, ContactInput, Customer, CustomerInput, TaxTreatment } from '@/api/types';
import { t } from '@/lib/i18n';

export const TAX_TREATMENTS: TaxTreatment[] = ['domestic', 'eu_reverse_charge', 'third_country'];

/** Country choices of the customer form; a stored country outside the list stays selectable. */
export const COUNTRIES = ['DE', 'AT', 'CH', 'NL', 'BE', 'FR', 'IT', 'ES', 'DK', 'SE', 'PL', 'CZ', 'GB', 'US'];

/** Short tag in lists; domestic customers get none. */
export function taxTag(treatment: TaxTreatment): string | null {
    if (treatment === 'eu_reverse_charge') return t('tax_treatment.eu_reverse_charge_tag');
    if (treatment === 'third_country') return t('tax_treatment.third_country_tag');
    return null;
}

export function defaultContact<T extends { is_default: boolean }>(contacts: T[]): T | null {
    return contacts.find((contact) => contact.is_default) ?? contacts[0] ?? null;
}

export function contactName(contact: Pick<Contact, 'salutation' | 'first_name' | 'last_name'>, withSalutation = true): string {
    return [withSalutation ? contact.salutation : '', contact.first_name, contact.last_name]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
}

/** A contact in the form; `key` identifies it in lists and the drawer, also before it has an id. */
export type ContactDraft = ContactInput & { key: string };
export type CustomerDraft = Omit<CustomerInput, 'contacts'> & { contacts: ContactDraft[] };

export function emptyCustomer(): CustomerDraft {
    return { number: '', name: '', street: '', zip: '', city: '', country: 'DE', email: '', vat_id: '', tax_treatment: 'domestic', locale: null, custom: {}, contacts: [] };
}

export function draftOf(customer: Customer): CustomerDraft {
    return {
        number: customer.number,
        name: customer.name,
        street: customer.street,
        zip: customer.zip,
        city: customer.city,
        country: customer.country,
        email: customer.email,
        vat_id: customer.vat_id,
        tax_treatment: customer.tax_treatment,
        locale: customer.locale,
        custom: { ...customer.custom },
        contacts: customer.contacts.map((contact) => ({ ...contact, custom: { ...contact.custom }, key: contact.id })),
    };
}

/** What SaveCustomer gets: every field and the complete contact list in form order (errors come back as contacts.<index>.…). */
export function inputOf(draft: CustomerDraft): CustomerInput {
    return {
        number: draft.number,
        name: draft.name,
        street: draft.street,
        zip: draft.zip,
        city: draft.city,
        country: draft.country,
        email: draft.email,
        vat_id: draft.vat_id,
        tax_treatment: draft.tax_treatment,
        locale: draft.locale,
        custom: draft.custom,
        contacts: draft.contacts.map((contact) => ({
            ...(contact.id ? { id: contact.id } : {}),
            salutation: contact.salutation,
            first_name: contact.first_name,
            last_name: contact.last_name,
            position: contact.position,
            email: contact.email,
            phone: contact.phone,
            is_default: contact.is_default,
            custom: contact.custom,
        })),
    };
}

let sequence = 0;

export function newContact(contacts: ContactDraft[]): ContactDraft {
    sequence += 1;
    return { key: `new-${sequence}`, salutation: '', first_name: '', last_name: '', position: '', email: '', phone: '', is_default: contacts.length === 0, custom: {} };
}

/** Exactly one default as long as there are contacts (SaveCustomer enforces the same). */
function withOneDefault(contacts: ContactDraft[], preferred?: string): ContactDraft[] {
    if (contacts.length === 0) return contacts;
    const key = preferred ?? contacts.find((contact) => contact.is_default)?.key ?? contacts[0].key;
    return contacts.map((contact) => ({ ...contact, is_default: contact.key === key }));
}

/** Adds the contact or replaces the one with the same key. */
export function applyContact(contacts: ContactDraft[], contact: ContactDraft): ContactDraft[] {
    const exists = contacts.some((item) => item.key === contact.key);
    const next = exists ? contacts.map((item) => (item.key === contact.key ? contact : item)) : [...contacts, contact];
    return withOneDefault(next, contact.is_default ? contact.key : undefined);
}

export function makeDefault(contacts: ContactDraft[], key: string): ContactDraft[] {
    return withOneDefault(contacts, key);
}

export function removeContact(contacts: ContactDraft[], key: string): ContactDraft[] {
    return withOneDefault(contacts.filter((contact) => contact.key !== key));
}

/** Errors of contact <index> from the API paths "contacts.<index>.<field>", keyed by field ("email", "custom.department"). */
export function contactErrors(errors: Record<string, string>, index: number): Record<string, string> {
    const prefix = `contacts.${index}.`;
    return Object.fromEntries(
        Object.entries(errors)
            .filter(([path]) => path.startsWith(prefix))
            .map(([path, message]) => [path.slice(prefix.length), message]),
    );
}
