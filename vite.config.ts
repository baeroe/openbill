import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import path from 'node:path';
import { defineConfig } from 'vite';

// Set inside the DDEV web container, e.g. https://openbill.ddev.site
const ddevUrl = process.env.DDEV_PRIMARY_URL_WITHOUT_PORT;

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: { '@': path.resolve(import.meta.dirname, 'resources/js') },
    },
    server: {
        // DDEV routes https://openbill.ddev.site:5173 to this port inside the container
        ...(ddevUrl
            ? {
                  host: '0.0.0.0',
                  port: 5173,
                  strictPort: true,
                  origin: `${ddevUrl}:5173`,
                  cors: { origin: /https?:\/\/([A-Za-z0-9\-.]+)?(\.ddev\.site)(?::\d+)?$/ },
              }
            : {}),
        watch: {
            ignored: ['**/storage/framework/views/**', '**/vendor/**', '**/prototypes/**', '**/docs/**', '**/.pnpm-store/**'],
        },
    },
});
