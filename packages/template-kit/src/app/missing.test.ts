import { expect, it } from 'vitest';
import { SAMPLE_SCHEMA } from '../tooling/test-support/fake-openbill';
import { missingExpectedFields } from './missing';

it('marks expected fields that are neither core nor custom fields of their level', () => {
    const manifest = {
        expectedFields: [
            { scope: 'document' as const, key: 'po_number', type: 'text' as const },
            { scope: 'document' as const, key: 'number', type: 'text' as const },
            { scope: 'customer' as const, key: 'loyalty_level', type: 'select' as const },
        ],
    };

    expect(missingExpectedFields(manifest, SAMPLE_SCHEMA)).toEqual([{ scope: 'customer', key: 'loyalty_level', type: 'select' }]);
    expect(missingExpectedFields(null, SAMPLE_SCHEMA)).toEqual([]);
    expect(missingExpectedFields(manifest, null)).toEqual([]);
});
