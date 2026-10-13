import useSWR, { mutate } from 'swr';
import { api, apiUpload } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';
import { keys } from './keys';
import { invalidate } from './paged';
import type { ComplianceProfile, CustomValues, DocumentType, TaxRate, TextBlock, TextBlockKind, Unit } from './types';

/** GET /api/document-types (DocumentTypeResource). */
export type DocumentTypeSetting = {
    type: DocumentType;
    profile: ComplianceProfile;
    template_id: string | null;
    default_intro_block_id: string | null;
    default_closing_block_id: string | null;
    payment_term_days: number | null;
    validity_days: number | null;
    numbering: { pattern: string; reset_yearly: boolean; next_value: number; next_number: string };
};

export function useDocumentTypes() {
    return useSWR<DocumentTypeSetting[]>(keys.documentTypes());
}

/** GET /api/organization (OrganizationResource). */
export type Organization = {
    id: string;
    name: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    has_logo: boolean;
    vat_id: string;
    tax_number: string;
    registration_id: string;
    iban: string;
    bic: string;
    bank_name: string;
    email: string;
    phone: string;
    website: string;
    taxation_mode: 'regular' | 'small_business';
    locale: string;
    custom: CustomValues;
    updated_at: string | null;
};

export type OrganizationInput = Omit<Organization, 'id' | 'has_logo' | 'updated_at'>;

export function useOrganization() {
    return useSWR<Organization>(keys.organization());
}

export async function saveOrganization(input: OrganizationInput): Promise<Organization> {
    const saved = await api<Organization>(keys.organization(), { method: 'PATCH', body: input });
    await mutate(keys.organization(), saved, { revalidate: false });
    return saved;
}

export async function uploadLogo(file: File): Promise<void> {
    const form = new FormData();
    form.append('logo', file);
    await apiUpload('/api/organization/logo', form);
    await mutate(keys.organization());
}

export async function removeLogo(): Promise<void> {
    await api<void>('/api/organization/logo', { method: 'DELETE' });
    await mutate(keys.organization());
}

/** Changes with every new logo, so the browser does not show a cached old one. */
export const logoUrl = (organization: Organization): string => `/api/organization/logo?v=${encodeURIComponent(organization.updated_at ?? '')}`;

export type DocumentTypeInput = {
    profile: ComplianceProfile;
    template_id: string | null;
    default_intro_block_id: string | null;
    default_closing_block_id: string | null;
    payment_term_days: number | null;
    validity_days: number | null;
    numbering: NumberingInput;
};

/** Pattern, yearly reset and – only when changed – the next running number of a number range. */
export type NumberingInput = { pattern: string; reset_yearly: boolean; next_value?: number };

export async function saveDocumentType(type: DocumentType, input: DocumentTypeInput): Promise<DocumentTypeSetting> {
    const saved = await api<DocumentTypeSetting>(`/api/document-types/${type}`, { method: 'PATCH', body: input });
    await mutate(keys.documentTypes());
    return saved;
}

export type NumberPreview = { number: string | null; valid: boolean; message: string | null };

/** Next number for the pattern being typed, from the server (250 ms after the last keystroke). */
export function useNumberPreview(type: DocumentType, pattern: string, resetYearly: boolean, nextValue: number | null) {
    const key = useDebounced(keys.numberPreview(type, pattern, resetYearly, nextValue), 250);
    return useSWR<NumberPreview>(pattern.trim() ? key : null, { keepPreviousData: true, revalidateOnFocus: false });
}

/** GET /api/customer-numbering (CustomerNumberingResource): number range of new customers without a number. */
export type CustomerNumbering = { pattern: string; reset_yearly: boolean; next_value: number; next_number: string };

export function useCustomerNumbering() {
    return useSWR<CustomerNumbering>(keys.customerNumbering());
}

export async function saveCustomerNumbering(input: NumberingInput): Promise<CustomerNumbering> {
    const saved = await api<CustomerNumbering>(keys.customerNumbering(), { method: 'PATCH', body: input });
    await mutate(keys.customerNumbering(), saved, { revalidate: false });
    return saved;
}

export function useCustomerNumberPreview(pattern: string, resetYearly: boolean, nextValue: number | null) {
    const key = useDebounced(keys.customerNumberPreview(pattern, resetYearly, nextValue), 250);
    return useSWR<NumberPreview>(pattern.trim() ? key : null, { keepPreviousData: true, revalidateOnFocus: false });
}

export type TaxRateInput = Pick<TaxRate, 'label' | 'percent' | 'category' | 'exemption_note'>;
export type UnitInput = Pick<Unit, 'name' | 'symbol' | 'decimals' | 'code'>;
export type TextBlockInput = { name: string; kind: TextBlockKind; body: string };

const write = async <T>(url: string, method: 'POST' | 'PATCH' | 'DELETE', prefix: string, body?: unknown, keepalive = false): Promise<T> => {
    const result = await api<T>(url, { method, body, keepalive });
    void invalidate(prefix);
    return result;
};

export const saveTaxRate = (input: TaxRateInput, id?: string) => write<TaxRate>(id ? `/api/tax-rates/${id}` : '/api/tax-rates', id ? 'PATCH' : 'POST', '/api/tax-rates', input);
export const archiveTaxRate = (id: string) => write<void>(`/api/tax-rates/${id}`, 'DELETE', '/api/tax-rates');
export const restoreTaxRate = (id: string) => write<TaxRate>(`/api/tax-rates/${id}/restore`, 'POST', '/api/tax-rates', {});
export const saveUnit = (input: UnitInput, id?: string) => write<Unit>(id ? `/api/units/${id}` : '/api/units', id ? 'PATCH' : 'POST', '/api/units', input);
export const archiveUnit = (id: string) => write<void>(`/api/units/${id}`, 'DELETE', '/api/units');
export const restoreUnit = (id: string) => write<Unit>(`/api/units/${id}/restore`, 'POST', '/api/units', {});
export const saveTextBlock = (input: TextBlockInput, id?: string) => write<TextBlock>(id ? `/api/text-blocks/${id}` : '/api/text-blocks', id ? 'PATCH' : 'POST', '/api/text-blocks', input);
export const deleteTextBlock = (id: string, options: { keepalive: boolean } = { keepalive: false }) => write<void>(`/api/text-blocks/${id}`, 'DELETE', '/api/text-blocks', undefined, options.keepalive);
