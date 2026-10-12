import { describe, expect, it } from 'vitest';
import { previewScenario } from './scenario';

describe('previewScenario', () => {
    it('shows an invoice when the template can do invoices, else a quote', () => {
        expect(previewScenario(['offer', 'confirmation', 'invoice', 'cancellation'])).toBe('short_invoice');
        expect(previewScenario(['offer'])).toBe('offer_with_options');
        expect(previewScenario(['confirmation'])).toBe('short_invoice');
        expect(previewScenario([])).toBe('short_invoice');
    });
});
