import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { NewDocumentDialog, type NewDocumentOptions } from './new-document-dialog';

const NewDocumentContext = createContext<(options?: NewDocumentOptions) => void>(() => undefined);

/** One "new document" dialog for the whole app (shell button, key N, overview, customer page). */
export function NewDocumentProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<NewDocumentOptions | null>(null);
    // every opening mounts a fresh dialog: its start values come from the options of that opening
    const [session, setSession] = useState(0);
    const open = useCallback((next: NewDocumentOptions = {}) => {
        setOptions(next);
        setSession((current) => current + 1);
    }, []);

    return (
        <NewDocumentContext value={open}>
            {children}
            {options !== null && <NewDocumentDialog key={session} open options={options} onClose={() => setOptions(null)} />}
        </NewDocumentContext>
    );
}

export function useNewDocument(): (options?: NewDocumentOptions) => void {
    return useContext(NewDocumentContext);
}
