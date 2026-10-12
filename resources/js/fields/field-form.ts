import type { FieldDefinitionInput } from '@/api/fields';
import { DOCUMENT_TYPES, type DocumentType, type FieldScope } from '@/api/types';

const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Preview of the key the server would build (App\Domain\Fields\KeySlugger::slug); the server decides. */
export function slugKey(label: string): string {
    const base = label
        .toLowerCase()
        .replace(/[äöüß]/g, (c) => TRANSLIT[c])
        .normalize('NFKD')
        .replace(/\p{Mn}/gu, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (base === '') return '';
    return /^[a-z]/.test(base) ? base : `f_${base}`;
}

export const hasDocTypes = (scope: FieldScope): boolean => scope === 'document' || scope === 'position';

/** null: the last type cannot be removed (delete the field instead). */
export function toggleDocType(current: DocumentType[], type: DocumentType): DocumentType[] | null {
    const next = current.includes(type) ? current.filter((t) => t !== type) : DOCUMENT_TYPES.filter((t) => t === type || current.includes(t));
    return next.length === 0 ? null : next;
}

export function moveId(ids: string[], index: number, direction: -1 | 1): string[] {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return ids;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

export function emptyDefinition(scope: FieldScope): FieldDefinitionInput {
    return { scope, key: '', label: '', type: 'text', required: false, default_value: null, help: '', options: [], doc_types: hasDocTypes(scope) ? [...DOCUMENT_TYPES] : [] };
}
