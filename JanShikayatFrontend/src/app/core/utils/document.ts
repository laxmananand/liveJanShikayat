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
    // Only the most recently opened document is kept alive
    if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    window.open(lastObjectUrl, '_blank', 'noopener');
    return true;
  } catch {
    return false;
  }
}
