import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

// The Node side of the kit (Vite plugin, CLI) as plain ESM for Node 24 in dist/kit/tooling: fflate is bundled in,
// vite stays the end user's own dependency, Node built-ins stay imports.
export default defineConfig({
    build: {
        outDir: 'dist/kit/tooling',
        emptyOutDir: true,
        target: 'node24',
        minify: false,
        ssr: true,
        rolldownOptions: {
            input: { plugin: 'src/tooling/plugin.ts', cli: 'src/tooling/cli.ts' },
            external: ['vite', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
            output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunks/[name].js' },
        },
    },
    ssr: { noExternal: true },
});
