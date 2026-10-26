let lastObjectUrl: string | null = null;

/**
 * Open a base64 document (with or without a `data:` prefix) in a new tab. Browsers block
 * opening `data:` URLs in a tab, so it is turned into a Blob and opened through an object URL.
 * Returns false if the base64 could not be decoded.
 */
export function openBase64Document(documentBase64: string): boolean {
  const [header, base64] = documentBase64.startsWith('data:')
    ? documentBase64.split(',')
    : ['data:application/pdf;base64', documentBase64];
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/pdf';
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    openBlobDocument(new Blob([bytes], { type: mime }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a Blob (e.g. a PDF downloaded from the API) in a new tab. After an async download, pass a
 * tab opened during the click (`window.open('', '_blank')`) so popup blockers let it through.
 */
export function openBlobDocument(blob: Blob, tab?: Window | null): void {
  // Only the most recently opened document is kept alive
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  lastObjectUrl = URL.createObjectURL(blob);
  if (tab) tab.location.href = lastObjectUrl;
  else window.open(lastObjectUrl, '_blank', 'noopener');
}
