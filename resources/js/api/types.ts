/** Shapes of the REST API (phase 4, docs/superpowers/plans/2026-10-11-phase-04-api.md "Interfaces"). Amounts are strings. */

export type DocumentType = 'offer' | 'confirmation' | 'invoice' | 'cancellation';
export type DocumentStatus = 'draft' | 'open' | 'accepted' | 'rejected' | 'done' | 'paid' | 'cancelled' | 'closed';
export type TaxTreatment = 'domestic' | 'eu_reverse_charge' | 'third_country';
export type FieldScope = 'org' | 'customer' | 'contact' | 'document' | 'position';
export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select' | 'boolean' | 'image';

/** Value of a custom field: text, date (YYYY-MM-DD), number/amount as string with a dot, yes/no, or empty. */
export type CustomValue = string | number | boolean | null;
export type CustomValues = Record<string, CustomValue>;

export const DOCUMENT_TYPES: DocumentType[] = ['offer', 'confirmation', 'invoice', 'cancellation'];
export const DOCUMENT_STATUSES: DocumentStatus[] = ['draft', 'open', 'accepted', 'rejected', 'done', 'paid', 'cancelled', 'closed'];

export type Contact = {
    id: string;
    salutation: string;
    first_name: string;
    last_name: string;
    position: string;
    email: string;
    phone: string;
    is_default: boolean;
    custom: CustomValues;
};

export type Customer = {
    id: string;
    number: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    email: string;
    vat_id: string;
    tax_treatment: TaxTreatment;
    locale: string | null;
    custom: CustomValues;
    contacts: Contact[];
    created_at: string | null;
    updated_at: string | null;
};

/** What SaveCustomer takes. "contacts" is the complete list; contacts without id are new. */
export type ContactInput = Omit<Contact, 'id'> & { id?: string };
export type CustomerInput = Omit<Customer, 'id' | 'contacts' | 'created_at' | 'updated_at'> & { contacts: ContactInput[] };

/** List form of a document (GET /api/documents). */
export type DocumentSummary = {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    number: string | null;
    date: string;
    customer_id: string | null;
    customer_name: string | null;
    contact_id: string | null;
    due_date: string | null;
    valid_until: string | null;
    locale: string;
    source_id: string | null;
    cancelled_by_id: string | null;
    is_locked: boolean;
    is_overdue: boolean;
    finalized_at: string | null;
    paid_at: string | null;
    net_total: string;
    tax_total: string;
    gross_total: string;
    created_at: string | null;
    updated_at: string | null;
};

export type DocumentFilters = {
    type?: DocumentType | null;
    status?: DocumentStatus | 'overdue' | null;
    customer_id?: string | null;
    q?: string | null;
};

export type FieldDefinition = {
    id: string;
    scope: FieldScope;
    key: string;
    label: string;
    type: FieldType;
    required: boolean;
    default_value: string | number | boolean | null;
    help: string;
    options: string[];
    doc_types: DocumentType[];
    sort: number;
};
