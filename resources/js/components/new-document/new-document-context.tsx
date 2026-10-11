import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { NewDocumentDialog, type NewDocumentOptions } from './new-document-dialog';

const NewDocumentContext = createContext<(options?: NewDocumentOptions) => void>(() => undefined);

/** One "new document" dialog for the whole app (shell button, key N, overview, customer page). */
export function NewDocumentProvider({ children }: { children: ReactNode }) {
    const [options, setOptions] = useState<NewDocumentOptions | null>(null);
    const open = useCallback((next: NewDocumentOptions = {}) => setOptions(next), []);

    return (
        <NewDocumentContext value={open}>
            {children}
            <NewDocumentDialog open={options !== null} options={options ?? {}} onClose={() => setOptions(null)} />
        </NewDocumentContext>
    );
}

export function useNewDocument(): (options?: NewDocumentOptions) => void {
    return useContext(NewDocumentContext);
}
