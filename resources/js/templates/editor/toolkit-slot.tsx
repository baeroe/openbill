import type { ReactNode } from 'react';

export type ToolkitSlotProps = {
    templateId: string;
    builtIn: boolean;
    /** Unsaved changes in the editor: the toolkit should start from the saved state. */
    dirty: boolean;
    /** Saves the editor (PUT /api/templates/{id}/files); false when invalid or failed. */
    save(): Promise<boolean>;
};

/**
 * Place of the "Download toolkit" button in the editor header (spec 7). Phase 9 replaces this body with the button and
 * its dialog (POST /{locale}/templates/{id}/toolkit) – no other editor file changes for that.
 */
export function ToolkitSlot(props: ToolkitSlotProps): ReactNode {
    void props;
    return null;
}
