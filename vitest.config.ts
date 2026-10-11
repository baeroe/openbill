import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests of resources/js: plain functions only (lib/, api/keys, layouts/nav). Pages are covered by Pest
// (Inertia props) and Playwright (e2e/), so there is no DOM here.
export default defineConfig({
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'resources/js') } },
    test: {
        include: ['resources/js/**/*.test.ts'],
        environment: 'node',
    },
});
