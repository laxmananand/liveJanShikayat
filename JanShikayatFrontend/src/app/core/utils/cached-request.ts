import { EMPTY, Observable, catchError, concat, finalize, of, shareReplay, tap } from 'rxjs';

/**
 * In-memory cache for one GET-style request (stale-while-revalidate).
 *
 * - Fresh (younger than ttlMs): the cached value is returned, no request is made.
 * - Stale: the cached value is emitted right away, then the fresh one once it arrives;
 *   if that refresh fails the cached data simply stays on screen.
 * - force (a Refresh button): only the fresh value is emitted, so the caller's loading state is
 *   visible until it arrives, and a failure reaches the caller.
 * - Nothing cached yet: one request is made. Callers arriving while it runs share it, and it keeps
 *   running when the page that started it is left, so quick sidebar navigation never restarts it.
 */
export class CachedRequest<T> {
  private value?: T;
  private fetchedAt = 0;
  private inflight$?: Observable<T>;

  constructor(
    private readonly fetcher: () => Observable<T>,
    private readonly ttlMs = 60_000
  ) {}

  /** Cached value first (if any), then a fresh one when the cache is stale; `force` emits only the fresh one. */
  get(force = false): Observable<T> {
    const hasValue = this.value !== undefined;
    if (hasValue && !force && Date.now() - this.fetchedAt < this.ttlMs) {
      return of(this.value as T);
    }
    const request$ = this.fetch();
    return hasValue && !force ? concat(of(this.value as T), request$.pipe(catchError(() => EMPTY))) : request$;
  }

  /** Mark stale after a change on the server: next get() shows the old data and refetches. */
  invalidate(): void {
    this.fetchedAt = 0;
  }

  /** Forget everything (e.g. on logout, so the next user never sees this data). */
  clear(): void {
    this.value = undefined;
    this.fetchedAt = 0;
    this.inflight$ = undefined;
  }

  private fetch(): Observable<T> {
    if (!this.inflight$) {
      const request$ = this.fetcher().pipe(
        tap((v) => {
          // Ignore a reply that lands after clear() replaced this request
          if (this.inflight$ !== request$) return;
          this.value = v;
          this.fetchedAt = Date.now();
        }),
        finalize(() => {
          if (this.inflight$ === request$) this.inflight$ = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.inflight$ = request$;
    }
    return this.inflight$;
  }
}

/** One CachedRequest per key (e.g. blocks per district), created on first use. */
export class CachedRequestMap<K, T> {
  private entries = new Map<K, CachedRequest<T>>();

  constructor(
    private readonly fetcher: (key: K) => Observable<T>,
    private readonly ttlMs = 60_000
  ) {}

  get(key: K, force = false): Observable<T> {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = new CachedRequest(() => this.fetcher(key), this.ttlMs);
      this.entries.set(key, entry);
    }
    return entry.get(force);
  }

  clear(): void {
    this.entries.clear();
  }
}
