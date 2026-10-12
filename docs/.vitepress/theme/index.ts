import '@fontsource-variable/schibsted-grotesk';
import { inBrowser } from 'vitepress';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import Landing from './landing/Landing.vue';
import './style.css';

// pages live under /en and /de below the base (/ locally and on openbill.dev, DOCS_BASE for a sub-path): paths without a language
// (/, /development) land in English. Runs on GitHub Pages' 404 page too.
const base = import.meta.env.BASE_URL;
if (inBrowser && location.pathname.startsWith(base)) {
    const rest = location.pathname.slice(base.length);
    if (!/^(en|de)(\/|$)/.test(rest)) {
        location.replace(`${base}en/${rest}${location.search}${location.hash}`);
    }
}

export default {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        // the landing pages (docs/{en,de}/index.md) render <Landing /> from their frontmatter
        app.component('Landing', Landing);
    },
} satisfies Theme;
