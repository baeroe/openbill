import { defineConfig } from 'vitest/config';

// Page geometry and breaks are plain functions; the component is checked with static markup (no DOM needed).
export default defineConfig({
    test: {
        include: ['src/**/*.test.{ts,tsx}'],
        environment: 'node',
    },
});
