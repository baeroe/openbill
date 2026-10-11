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

export type PositionKind = 'item' | 'text' | 'optional';
export type ComplianceProfile = 'basic' | 'en16931';
export type TextBlockKind = 'intro' | 'closing' | 'payment' | 'note';

/** A position as GET/PATCH /api/documents/{id} carries it; quantity and price are decimal strings. */
export type ApiPosition = {
    id: string;
    kind: PositionKind;
    title: string;
    description: string;
    quantity: string;
    unit_id: string | null;
    unit_price: string;
    tax_rate_id: string | null;
    custom: CustomValues;
};

/** title null = loose positions (no heading). */
export type ApiGroup = { id: string; title: string | null; positions: ApiPosition[] };

/** Compliance issue: path like "document.due_date", "positions.<id>.unit", "customer.vat_id", "org.iban". */
export type Issue = { path: string; message: string; code: string };

/**
 * Totals of the server (Totals::toArray()), all amounts as strings. lines/groups are keyed by position/group id;
 * an empty map may arrive as [] (POST /api/render does not wrap empty maps), reading a key gives undefined either way.
 */
export type Totals = {
    lines: Record<string, { net: string; tax_percent: string | null; tax_category: string | null }>;
    groups: Record<string, { title: string | null; net: string; optional_net: string }>;
    tax_breakdown: { category: string; percent: string; net: string; tax: string; gross: string }[];
    net: string;
    tax: string;
    gross: string;
    optional_net: string;
    legal_notes: string[];
    missing_tax_rate: boolean;
};

/** Item form of a document (GET /api/documents/{id}, answers of PATCH and the document actions). */
export type DocumentDetail = DocumentSummary & {
    service_date: string | null;
    service_date_end: string | null;
    intro: string;
    closing: string;
    template_id: string | null;
    custom: CustomValues;
    groups: ApiGroup[];
    totals: Totals | null;
    issues: Issue[];
    dropped_fields: string[];
};

export type Paper = { format: string; marginX: string; headerHeight: string; footerHeight: string };
export type RenderErrorItem = { part: string; file: string | null; line: number | null; message: string };

/** Answer of POST /api/render (PreviewResult::toArray()). */
export type RenderResponse = { header: string; body: string; footer: string; paper: Paper; errors: RenderErrorItem[]; totals: Totals; issues: Issue[] };

export type TaxRate = { id: string; label: string; percent: string; category: string; exemption_note: string | null; sort: number; archived_at: string | null };
export type Unit = { id: string; name: string; symbol: string; decimals: number; code: string; sort: number; archived_at: string | null };
export type TextBlock = { id: string; name: string; kind: TextBlockKind; body: string; updated_at: string | null };

/** GET /api/position-suggestions: earlier positions by title, values of their latest use. */
export type PositionSuggestion = {
    title: string;
    description: string;
    unit_id: string | null;
    unit_price: string;
    tax_rate_id: string | null;
    used_count: number;
    last_used: string;
};

/** Inertia prop "context" of documents/show (App\Actions\DescribeDocumentPage). */
export type DocumentPageContext = {
    profile: ComplianceProfile;
    next_number: string | null;
    small_business: boolean;
    chain: { id: string; type: DocumentType; status: DocumentStatus; number: string | null }[];
    templates: { id: string; name: string; document_types: DocumentType[] }[];
    allowed: { finalize: boolean; delete: boolean; duplicate: boolean; statuses: DocumentStatus[]; conversions: DocumentType[]; cancel: boolean };
};
