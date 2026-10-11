import type { DocumentDetail } from '@/api/types';

/** The editable part of a document, held in the editor store. */
export type Draft = Pick<
    DocumentDetail,
    'id' | 'type' | 'status' | 'date' | 'customer_id' | 'contact_id' | 'service_date' | 'service_date_end' | 'due_date' | 'valid_until' | 'intro' | 'closing' | 'template_id' | 'locale' | 'custom' | 'groups'
>;

/** Body of PATCH /api/documents/{id} and the "draft" of POST /api/render: every draft field, groups replace all groups. */
export type DraftPayload = Omit<Draft, 'id' | 'type' | 'status'>;

/** Local id → id the server gave the group or position. */
export type IdMap = Record<string, string>;

/** saved/dirty/saving: normal; error: retrying; invalid: 422 at fields; locked: finalized elsewhere; gone: deleted elsewhere. */
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'invalid' | 'locked' | 'gone';
