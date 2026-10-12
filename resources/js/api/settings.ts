import useSWR, { mutate } from 'swr';
import { api, apiUpload } from '@/lib/api';
import { keys } from './keys';
import type { ComplianceProfile, CustomValues, DocumentType } from './types';

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
