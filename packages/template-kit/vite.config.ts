import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The preview page as static bundle: dist/kit/index.html + dist/kit/assets/. The end user's `pnpm dev` serves it
// (kit-files/vite.config.js) together with the openbill-render plugin; it is never developed against this config.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist/kit',
        emptyOutDir: true,
        target: 'es2022',
        sourcemap: false,
    },
});
