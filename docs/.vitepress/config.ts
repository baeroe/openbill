import { defineConfig, type DefaultTheme } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// every page exists in docs/en and docs/de under the same file name (tests/Unit/DocsTest.php)
const pages = ['documents', 'templates', 'e-invoice', 'development'];

const sidebar = (prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] => [
    { text: t.guide, items: pages.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
];

const en: Record<string, string> = {
    guide: 'Guide',
    documents: 'Documents',
    templates: 'Templates',
    'e-invoice': 'E-invoices',
    development: 'Development',
};

const de: Record<string, string> = {
    guide: 'Anleitung',
    documents: 'Dokumente',
    templates: 'Templates',
    'e-invoice': 'E-Rechnung',
    development: 'Entwicklung',
};

export default defineConfig({
    title: 'openbill',
    cleanUrls: true,
    lastUpdated: true,
    // docs/history is the project's memory, docs/superpowers holds specs and plans: not part of the site
    srcExclude: ['history/**', 'superpowers/**', 'README.md'],
    head: [
        ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
        ['meta', { name: 'theme-color', content: '#f4f4f2' }],
    ],
    appearance: false,
    vite: {
        // agents get the English docs only
        plugins: [llmstxt({ workDir: 'en' })],
        // dev server behind DDEV (https://openbill.ddev.site:5174): Vite only answers known hosts
        server: { allowedHosts: ['.ddev.site'] },
    },

    locales: {
        root: {
            label: 'English',
            lang: 'en',
            // English lives under /en like German under /de; links without a prefix are redirected in the theme
            link: '/en/',
            description: 'Open, self-hosted quotes and invoices with custom fields, Liquid templates and e-invoices.',
            themeConfig: {
                nav: [{ text: 'Guide', link: '/en/development' }],
                sidebar: sidebar('/en', en),
                editLink: { pattern: 'https://github.com/baeroe/openbill/edit/main/docs/:path', text: 'Edit this page' },
                footer: { message: 'Released under the MIT License.', copyright: '© 2026 Rafael Haußmann' },
            },
        },
        de: {
            label: 'Deutsch',
            lang: 'de',
            link: '/de/',
            description: 'Offene, selbst gehostete Angebote und Rechnungen mit eigenen Feldern, Liquid-Templates und E-Rechnung.',
            themeConfig: {
                nav: [{ text: 'Anleitung', link: '/de/development' }],
                sidebar: sidebar('/de', de),
                editLink: { pattern: 'https://github.com/baeroe/openbill/edit/main/docs/:path', text: 'Seite bearbeiten' },
                footer: { message: 'Veröffentlicht unter der MIT-Lizenz.', copyright: '© 2026 Rafael Haußmann' },
                outline: { label: 'Auf dieser Seite' },
                docFooter: { prev: 'Zurück', next: 'Weiter' },
                lastUpdated: { text: 'Zuletzt aktualisiert' },
                langMenuLabel: 'Sprache wechseln',
                returnToTopLabel: 'Nach oben',
                sidebarMenuLabel: 'Menü',
                skipToContentLabel: 'Zum Inhalt springen',
                notFound: {
                    title: 'Seite nicht gefunden',
                    quote: 'Diese Seite gibt es nicht (mehr).',
                    linkLabel: 'Zur Startseite',
                    linkText: 'Zur Startseite',
                },
            },
        },
    },

    themeConfig: {
        logo: { src: '/favicon.svg', alt: '' },
        socialLinks: [{ icon: 'github', link: 'https://github.com/baeroe/openbill' }],
        search: {
            provider: 'local',
            options: {
                locales: {
                    de: {
                        translations: {
                            button: { buttonText: 'Suchen', buttonAriaLabel: 'Suchen' },
                            modal: {
                                noResultsText: 'Keine Ergebnisse für',
                                resetButtonTitle: 'Suche zurücksetzen',
                                displayDetails: 'Details anzeigen',
                                footer: { selectText: 'auswählen', navigateText: 'navigieren', closeText: 'schließen' },
                            },
                        },
                    },
                },
            },
        },
    },
});
