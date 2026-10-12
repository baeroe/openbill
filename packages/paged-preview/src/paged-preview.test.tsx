import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as api from './index';
import { DEFAULT_LABELS, PagedPreview } from './paged-preview';

const parts = { header: '<html><body>Head</body></html>', body: '<html><body><p>Body</p></body></html>', footer: '<html><body>Foot</body></html>' };
const paper = { format: 'A4', marginX: '20mm', headerHeight: '30mm', footerHeight: '20mm' };

describe('PagedPreview', () => {
    it('exports the documented interface', () => {
        expect(Object.keys(api).sort()).toEqual(['DEFAULT_LABELS', 'PAGE_GAP', 'PagedPreview', 'computePageBreaks', 'pageGeometry', 'toPx']);
        expect(DEFAULT_LABELS.page(3)).toBe('Page 3');
    });

    it('renders one page with header, body and footer in script-less frames', () => {
        const html = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} />);

        expect(html.match(/class="pp-page"/g)).toHaveLength(1);
        // measurement frame + header + body + footer, all without script rights
        expect(html.match(/<iframe/g)).toHaveLength(4);
        expect(html.match(/sandbox="allow-same-origin"/g)).toHaveLength(4);
        expect(html).not.toContain('allow-scripts');
        expect(html).toContain('aria-label="Document preview"');
    });

    it('uses the given labels and shows guides only when asked', () => {
        const plain = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} />);
        const guided = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} showGuides labels={{ document: 'Dokumentvorschau', header: 'Kopfzeile', body: 'Inhalt', footer: 'Fußzeile' }} />);

        expect(plain).not.toContain('pp-guide');
        expect(guided.match(/class="pp-guide"/g)).toHaveLength(3);
        expect(guided).toContain('>Kopfzeile<');
        expect(guided).toContain('aria-label="Dokumentvorschau"');
    });

    it('emphasizes one zone without showing the other guides', () => {
        const html = renderToStaticMarkup(<PagedPreview parts={parts} paper={paper} highlight="footer" />);

        expect(html.match(/pp-guide pp-guide--on/g)).toHaveLength(1);
        expect(html.match(/class="pp-guide"/g)).toBeNull();
    });
});
