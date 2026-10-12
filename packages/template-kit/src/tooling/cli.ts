import { pathToFileURL } from 'node:url';
import { createClient, OpenbillError } from './client';
import { KitConfigError, readKitEnv } from './env';
import { pack } from './pack';
import { pull } from './pull';
import { push } from './push';
import { TemplateProblemError } from './template-files';

export type Io = {
    root: string;
    out(line: string): void;
    err(line: string): void;
    fetch?: typeof fetch;
    environment?: Record<string, string | undefined>;
};

export const USAGE = 'Usage: pnpm push | pnpm pull [--force] | pnpm run pack [--out <file.zip>]';

function option(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

/** push, pull and pack of the template kit; returns the exit code (0 done, 1 failed, 2 wrong call). */
export async function main(argv: string[], io: Io): Promise<number> {
    const [command, ...args] = argv;
    try {
        if (command === 'pack') {
            await pack(io.root, { out: option(args, '--out'), log: io.out });
            return 0;
        }
        if (command !== 'push' && command !== 'pull') {
            io.err(USAGE);
            return 2;
        }
        const env = readKitEnv(io.root, io.environment ?? process.env);
        const client = createClient(env, io.fetch);
        if (command === 'push') await push(io.root, env, client, io.out);
        else await pull(io.root, env, client, { force: args.includes('--force'), log: io.out });
        return 0;
    } catch (error) {
        if (error instanceof OpenbillError) {
            io.err(error.failure.message);
            error.failure.details.forEach((detail) => io.err(`  - ${detail}`));
            return 1;
        }
        if (error instanceof TemplateProblemError) {
            io.err(error.message);
            error.problems.forEach((problem) => io.err(`  - ${problem}`));
            return 1;
        }
        if (error instanceof KitConfigError) {
            io.err(error.message);
            return 1;
        }
        throw error;
    }
}

// started as `node tooling/cli.js …` (package.json scripts of the kit), not when imported by tests
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 24) {
        console.error(`The openbill template toolkit needs Node.js 24 or newer (this is ${process.versions.node}).`);
        process.exitCode = 1;
    } else {
        process.exitCode = await main(process.argv.slice(2), { root: process.cwd(), out: (line) => console.log(line), err: (line) => console.error(line) });
    }
}
