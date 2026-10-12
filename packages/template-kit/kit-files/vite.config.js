import { defineConfig } from 'vite';
import { openbillRender } from './tooling/plugin.js';

// pnpm dev: the preview page (index.html, assets/) plus the plugin that renders template/ on your openbill instance.
export default defineConfig({
    plugins: [openbillRender()],
    // only this computer: the preview renders real documents
    server: { host: 'localhost', port: 5180 },
    clearScreen: false,
    // the page is prebuilt: nothing to pre-bundle
    optimizeDeps: { noDiscovery: true, include: [] },
});
