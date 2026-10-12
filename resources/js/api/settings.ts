import useSWR from 'swr';
import { keys } from './keys';
import type { ComplianceProfile, DocumentType } from './types';

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
