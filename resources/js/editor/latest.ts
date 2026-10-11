/** Wraps a request so that a new call aborts the one still running: only the latest answer can arrive. */
export function createLatest<A, R>(run: (arg: A, signal: AbortSignal) => Promise<R>): (arg: A) => Promise<R> {
    let controller: AbortController | null = null;
    return (arg) => {
        controller?.abort();
        const own = new AbortController();
        controller = own;
        return run(arg, own.signal).finally(() => {
            if (controller === own) controller = null;
        });
    };
}

export function isAbort(error: unknown): boolean {
    return (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
}
