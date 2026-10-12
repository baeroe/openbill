import { defineConfig } from 'vitest/config';

// Tooling (env, client, runtime, plugin, CLI) runs in Node; the preview page is checked through its plain functions.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        testTimeout: 20_000,
    },
});
