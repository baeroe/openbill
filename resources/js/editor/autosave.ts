import type { DocumentDetail } from '@/api/types';
import { ApiError } from '@/lib/api';
import type { DraftPayload, SaveState } from './types';

export type AutosaveOptions = {
    delay?: number;
    retryDelays?: number[];
    revision(): number;
    payload(): DraftPayload | null;
    save(payload: DraftPayload): Promise<DocumentDetail>;
    onSaved(sent: DraftPayload, saved: DocumentDetail): void;
    onState(state: SaveState, error?: unknown, sent?: DraftPayload): void;
};

const RETRY = [2000, 5000, 15000, 30000];

/**
 * Debounced autosave of the editor draft (PATCH /api/documents/{id}): one save at a time, a follow-up save right after
 * when the draft changed meanwhile, retries with growing pauses on network and server errors, no retries for answers
 * that asking again cannot change (422 invalid input, 409 finalized elsewhere, 404 deleted elsewhere).
 */
export class Autosave {
    private savedRevision: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private inFlight: Promise<void> | null = null;
    private attempt = 0;
    private current: SaveState = 'saved';
    private stoppedFlag = false;

    constructor(private readonly options: AutosaveOptions) {
        this.savedRevision = options.revision();
    }

    /** stop() was called (draft deleted): this instance saves nothing anymore. */
    get stopped(): boolean {
        return this.stoppedFlag;
    }

    get state(): SaveState {
        return this.current;
    }

    /** Something is not on the server yet: an unsaved revision or a save on its way. */
    get pending(): boolean {
        return this.inFlight !== null || this.options.revision() !== this.savedRevision;
    }

    changed(): void {
        if (this.blocked() || this.options.revision() === this.savedRevision) return;
        this.attempt = 0;
        if (!this.inFlight) this.set('dirty');
        this.schedule(this.options.delay ?? 600);
    }

    flush(): Promise<void> {
        this.clear();
        if (this.blocked()) return Promise.resolve();
        if (this.inFlight) return this.inFlight.then(() => this.flush());
        const revision = this.options.revision();
        const payload = this.options.payload();
        if (payload === null || revision === this.savedRevision) return Promise.resolve();

        this.set('saving');
        this.inFlight = this.options.save(payload).then(
            (saved) => {
                this.inFlight = null;
                this.savedRevision = revision;
                this.attempt = 0;
                if (this.stoppedFlag) return;
                this.options.onSaved(payload, saved);
                if (this.options.revision() !== this.savedRevision) {
                    this.set('dirty');
                    this.schedule(0);
                } else {
                    this.set('saved');
                }
            },
            (error: unknown) => {
                this.inFlight = null;
                if (!this.stoppedFlag) this.fail(error, payload);
            },
        );
        return this.inFlight;
    }

    retry(): Promise<void> {
        this.attempt = 0;
        return this.flush();
    }

    /** The tab closes: hand the unsaved state to a keepalive request (the page will not see the answer). */
    flushKeepalive(send: (payload: DraftPayload) => void): void {
        if (this.blocked() || !this.pending) return;
        const payload = this.options.payload();
        if (payload === null) return;
        this.clear();
        send(payload);
    }

    /** The server state was loaded: the current revision counts as saved. */
    reset(): void {
        this.clear();
        this.savedRevision = this.options.revision();
        this.attempt = 0;
        if (!this.blocked()) this.set('saved');
    }

    /** No more saves (the draft is being deleted). */
    stop(): void {
        this.stoppedFlag = true;
        this.clear();
    }

    private blocked(): boolean {
        return this.stoppedFlag || this.current === 'locked' || this.current === 'gone';
    }

    private fail(error: unknown, sent: DraftPayload): void {
        if (error instanceof ApiError && error.status === 409 && error.reason === 'document_locked') return this.set('locked', error, sent);
        if (error instanceof ApiError && error.status === 404) return this.set('gone', error, sent);
        // 422 and other client errors do not change by asking again (401 sends to the login, 419 is retried in api())
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return this.set('invalid', error, sent);
        this.set('error', error, sent);
        const delays = this.options.retryDelays ?? RETRY;
        this.schedule(delays[Math.min(this.attempt, delays.length - 1)]);
        this.attempt++;
    }

    private schedule(delay: number): void {
        this.clear();
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, delay);
    }

    private clear(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private set(state: SaveState, error?: unknown, sent?: DraftPayload): void {
        this.current = state;
        this.options.onState(state, error, sent);
    }
}
