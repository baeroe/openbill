import type { Issue } from '@/api/types';
import type { Violation } from '@/lib/api';
import type { Draft } from './types';

/** Position fields whose data-path differs from the API key (issue paths use "unit" and "tax_rate"). */
const POSITION_FIELD: Record<string, string> = { unit_id: 'unit', tax_rate_id: 'tax_rate' };
const DOCUMENT_FIELD: Record<string, string> = { customer_id: 'customer', contact_id: 'contact', template_id: 'template' };

/**
 * data-path of the field a validation error of PATCH /api/documents/{id} (or of "draft." in POST /api/render) belongs to.
 * Index paths are resolved against the groups that were sent.
 */
export function violationPath(draft: Pick<Draft, 'groups'>, apiPath: string): string {
    const path = apiPath.startsWith('draft.') ? apiPath.slice('draft.'.length) : apiPath;
    // compliance issues (422 of finalize) already carry field paths
    if (/^(positions|document|customer|contact|org)(\.|$)/.test(path)) return path;

    const position = /^groups\.(\d+)\.positions\.(\d+)\.(.+)$/.exec(path);
    if (position) {
        const row = draft.groups[Number(position[1])]?.positions[Number(position[2])];
        return row ? `positions.${row.id}.${POSITION_FIELD[position[3]] ?? position[3]}` : 'positions';
    }
    const group = /^groups\.(\d+)\.(.+)$/.exec(path);
    if (group) {
        const target = draft.groups[Number(group[1])];
        return target && !group[2].startsWith('positions') ? `groups.${target.id}.${group[2]}` : 'positions';
    }
    if (path === 'groups' || path.startsWith('groups.')) return 'positions';

    const [head, ...rest] = path.split('.');
    return ['document', DOCUMENT_FIELD[head] ?? head, ...rest].join('.');
}

export function fieldErrors(draft: Pick<Draft, 'groups'>, violations: Violation[]): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const violation of violations) errors[violationPath(draft, violation.path)] ??= violation.message;
    return errors;
}

export function issuePaths(issues: Issue[]): Set<string> {
    return new Set(issues.map((issue) => issue.path));
}
