import type { FieldScope } from '@/api/types';

/**
 * What the EN 16931 profile requires per level (labels only; the rules live in App\Domain\Compliance\ComplianceChecker).
 * Keys: fields.profile.<scope>_<item>.
 */
export const PROFILE_REQUIREMENTS: Partial<Record<FieldScope, string[]>> = {
    org: ['org_address', 'org_tax_id', 'org_registration', 'org_iban'],
    customer: ['customer_address', 'customer_vat_id'],
    document: ['document_service_date', 'document_due_date'],
    position: ['position_unit', 'position_quantity'],
};
