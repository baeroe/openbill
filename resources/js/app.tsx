import '@fontsource-variable/schibsted-grotesk';
import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { getLocale, initI18n } from '@/lib/i18n';
import { applyTheme, watchSystemTheme } from '@/lib/theme';
import type { SharedProps } from '@/types';

createInertiaApp({
    title: (title) => (title ? `${title} – openbill` : 'openbill'),
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx', { eager: true });
        return pages[`./pages/${name}.tsx`] as never;
    },
    setup({ el, App, props }) {
        initI18n(props.initialPage.props as unknown as SharedProps);
        applyTheme();
        watchSystemTheme();
        // translations are set once per page load: a visit that lands in another language reloads
        router.on('navigate', (event) => {
            if (event.detail.page.props.locale !== getLocale()) window.location.reload();
        });
        createRoot(el).render(<App {...props} />);
    },
    progress: { color: '#2F55D4', showSpinner: false },
});
