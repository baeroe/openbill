import { inBrowser } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

// pages live under /en and /de: links without a prefix (/, /development) land in English
if (inBrowser && !/^\/(en|de)(\/|$)/.test(location.pathname)) {
    location.replace(`/en${location.pathname}${location.search}${location.hash}`);
}

export default DefaultTheme;
