import { describe, expect, it } from 'vitest';
import { expression, liquidPath } from './expression';

describe('expression', () => {
    it('uses p inside the position loop', () => {
        expect(liquidPath('position', 'ticket')).toBe('p.ticket');
        expect(liquidPath('document', 'number')).toBe('document.number');
    });

    it('adds the matching filter for core fields and custom field types', () => {
        expect(expression('document', 'gross_total')).toBe('{{ document.gross_total | money }}');
        expect(expression('document', 'due_date')).toBe('{{ document.due_date | date }}');
        expect(expression('document', 'intro')).toBe('{{ document.intro | nl2br }}');
        expect(expression('position', 'quantity')).toBe('{{ p.quantity | number: 2 }}');
        expect(expression('document', 'project_name', 'text')).toBe('{{ document.project_name }}');
        expect(expression('customer', 'budget', 'money')).toBe('{{ customer.budget | money }}');
        expect(expression('position', 'month', 'date')).toBe('{{ p.month | date }}');
        expect(expression('contact', 'note', 'textarea')).toBe('{{ contact.note | nl2br }}');
        expect(expression('position', 'hours', 'number')).toBe('{{ p.hours | number: 2 }}');
    });

    it('wraps images and yes/no fields', () => {
        expect(expression('document', 'stamp', 'image')).toBe('{% if document.stamp != blank %}<img src="{{ document.stamp }}" alt="">{% endif %}');
        expect(expression('org', 'logo')).toBe('{% if org.logo != blank %}<img src="{{ org.logo }}" alt="">{% endif %}');
        expect(expression('document', 'urgent', 'boolean')).toBe('{% if document.urgent %}{% endif %}');
    });

    it('turns lists into loops', () => {
        expect(expression('document', 'legal_notes')).toBe('{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}');
        expect(expression('document', 'tax_breakdown')).toContain('{% for t in document.tax_breakdown %}');
    });
});
