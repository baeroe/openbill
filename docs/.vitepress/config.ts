import { defineConfig, type DefaultTheme, type HeadConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

// Published on GitHub Pages under /openbill/ until the docs get a domain of their own (.github/workflows/docs.yml sets
// DOCS_BASE and DOCS_URL). Locally and in DDEV the site lives at /.
const base = process.env.DOCS_BASE ?? '/';
/** Absolute address of the published docs without trailing slash (llms.txt links, link previews); unset locally. */
const site = process.env.DOCS_URL?.replace(/\/$/, '');
const description = 'Open, self-hosted quotes and invoices with custom fields, Liquid templates and EN 16931 e-invoices.';

// every page exists in docs/en and docs/de under the same file name (tests/Unit/DocsTest.php)
const hosting = ['setup', 'reverse-proxy', 'backup', 'upgrading'];
const pages = ['documents', 'custom-fields', 'templates', 'template-toolkit', 'e-invoice', 'settings', 'api', 'mcp', 'development'];

const sidebar = (prefix: string, t: Record<string, string>): DefaultTheme.SidebarItem[] => [
    { text: t.hosting, items: hosting.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
    { text: t.guide, items: pages.map((p) => ({ text: t[p], link: `${prefix}/${p}` })) },
];

const en: Record<string, string> = {
    guide: 'Guide',
    hosting: 'Self-hosting',
    setup: 'Setup',
    'reverse-proxy': 'Reverse proxy',
    backup: 'Backup',
    upgrading: 'Upgrading',
    documents: 'Documents',
    'custom-fields': 'Custom fields',
    settings: 'Settings',
    templates: 'Templates',
    'template-toolkit': 'Template toolkit',
    'e-invoice': 'E-invoices',
    api: 'REST API',
    mcp: 'MCP',
    development: 'Development',
};

const de: Record<string, string> = {
    guide: 'Anleitung',
    hosting: 'Betrieb',
    setup: 'Einrichtung',
    'reverse-proxy': 'Reverse Proxy',
    backup: 'Datensicherung',
    upgrading: 'Aktualisieren',
    documents: 'Dokumente',
    'custom-fields': 'Eigene Felder',
    settings: 'Einstellungen',
    templates: 'Templates',
    'template-toolkit': 'Template-Toolkit',
    'e-invoice': 'E-Rechnung',
    api: 'REST-API',
    mcp: 'MCP',
    development: 'Entwicklung',
};

export default defineConfig({
    base,
    title: 'openbill',
    cleanUrls: true,
    lastUpdated: true,
    // docs/history is the project's memory, docs/superpowers holds specs and plans: not part of the site
    srcExclude: ['history/**', 'superpowers/**', 'README.md'],
    // head entries are not rewritten to the base by VitePress
    head: [
        ['link', { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' }],
        ['meta', { name: 'theme-color', content: '#f4f4f2' }],
        ['meta', { property: 'og:title', content: 'openbill' }],
        ['meta', { property: 'og:description', content: description }],
        ...(site ? ([['meta', { property: 'og:image', content: `${site}/screenshots/en/editor.png` }]] satisfies HeadConfig[]) : []),
    ],
    vite: {
        // agents get the English docs only
        // the plugin puts the base after the domain itself: the origin only (https://baeroe.github.io)
        plugins: [llmstxt({ workDir: 'en', ...(site ? { domain: new URL(site).origin } : {}) })],
        // dev server behind DDEV (https://openbill.ddev.site:5174): Vite only answers known hosts
        server: { allowedHosts: ['.ddev.site'] },
    },

    locales: {
        root: {
            label: 'English',
            lang: 'en',
            // English lives under /en like German under /de; links without a prefix are redirected in the theme
            link: '/en/',
            description: description,
            themeConfig: {
                nav: [{ text: 'Guide', link: '/en/setup' }, { text: 'Releases', link: 'https://github.com/baeroe/openbill/releases' }],
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
                nav: [{ text: 'Anleitung', link: '/de/setup' }, { text: 'Releases', link: 'https://github.com/baeroe/openbill/releases' }],
                sidebar: sidebar('/de', de),
                editLink: { pattern: 'https://github.com/baeroe/openbill/edit/main/docs/:path', text: 'Seite bearbeiten' },
                footer: { message: 'Veröffentlicht unter der MIT-Lizenz.', copyright: '© 2026 Rafael Haußmann' },
                outline: { label: 'Auf dieser Seite' },
                docFooter: { prev: 'Zurück', next: 'Weiter' },
                lastUpdated: { text: 'Zuletzt aktualisiert' },
                langMenuLabel: 'Sprache wechseln',
                darkModeSwitchLabel: 'Darstellung',
                lightModeSwitchTitle: 'Zu hell wechseln',
                darkModeSwitchTitle: 'Zu dunkel wechseln',
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
