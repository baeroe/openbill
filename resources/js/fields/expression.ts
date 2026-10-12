import type { FieldScope, FieldType } from '@/api/types';

const MONEY = new Set(['net_total', 'tax_total', 'gross_total', 'optional_total', 'unit_price', 'total']);
const DATES = new Set(['date', 'due_date', 'valid_until', 'service_date', 'service_date_end']);
const TEXTS = new Set(['intro', 'closing']);

/** Where a field lives in Liquid; positions are read inside {% for p in … %}. */
export function liquidPath(scope: FieldScope, key: string): string {
    return `${scope === 'position' ? 'p' : scope}.${key}`;
}

/** Liquid expression with the fitting filter, inserted by the field bar of the template editor. */
export function expression(scope: FieldScope, key: string, type?: FieldType): string {
    const path = liquidPath(scope, key);
    if (key === 'legal_notes' && !type) return `{% for note in ${path} %}<p>{{ note }}</p>{% endfor %}`;
    if (key === 'tax_breakdown' && !type) return `{% for t in ${path} %}{{ t.percent }} %: {{ t.tax | money }}{% endfor %}`;
    if (type === 'image' || (!type && scope === 'org' && key === 'logo')) return `{% if ${path} != blank %}<img src="{{ ${path} }}" alt="">{% endif %}`;
    if (type === 'boolean') return `{% if ${path} %}{% endif %}`;
    if (type === 'money' || (!type && MONEY.has(key))) return `{{ ${path} | money }}`;
    if (type === 'date' || (!type && DATES.has(key))) return `{{ ${path} | date }}`;
    if (type === 'textarea' || (!type && TEXTS.has(key))) return `{{ ${path} | nl2br }}`;
    if (type === 'number' || (!type && key === 'quantity')) return `{{ ${path} | number: 2 }}`;
    return `{{ ${path} }}`;
}

export const SNIPPETS: { key: 'groups' | 'page_numbers'; code: string }[] = [
    {
        key: 'groups',
        code: '{% for g in groups %}\n  {% if g.has_title %}<h3>{{ g.title }}</h3>{% endif %}\n  {% for p in g.positions %}\n    {{ p.title }} {{ p.total | money }}\n  {% endfor %}\n  {% if g.has_title %}{{ g.total | money }}{% endif %}\n{% endfor %}',
    },
    { key: 'page_numbers', code: '{{ page.number }} / {{ page.total }}' },
];
