/** Hands a fetched file to the browser as download (object URL on a temporary link). */
export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    // Safari starts the download asynchronously: revoke a moment later
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
