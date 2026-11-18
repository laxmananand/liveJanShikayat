import { Observable } from 'rxjs';

let lastObjectUrl: string | null = null;

/**
 * Download a document and open it in a new tab. Call it from the click itself: the tab is opened
 * straight away (so popup blockers allow it) and filled when the file arrives; closed again on error.
 */
export function openDownloadedDocument(download: Observable<Blob>, onError: () => void): void {
  const tab = window.open('', '_blank');
  download.subscribe({
    next: (blob) => openBlobDocument(blob, tab),
    error: () => {
      tab?.close();
      onError();
    }
  });
}

/** "1.25 MB" / "340 KB" for a size in bytes. */
export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
