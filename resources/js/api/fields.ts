import useSWR from 'swr';
import { keys } from './keys';
import type { FieldDefinition, FieldScope } from './types';

/** Custom field definitions of one level (not paginated), in their configured order. */
export function useFieldDefinitions(scope: FieldScope) {
    return useSWR<FieldDefinition[]>(keys.fieldDefinitions(scope));
}
