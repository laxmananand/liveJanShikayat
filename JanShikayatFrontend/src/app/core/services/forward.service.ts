import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CachedRequest } from '../utils/cached-request';
import { AuthService } from './auth.service';

/** One forwarding of an application (the latest one is what the list shows). */
export interface ForwardRecord {
  applicantId: number;
  categoryId: string;
  categoryLabel: string;
  branchId: string;
  branchLabel: string;
  complaintTypeId: string;
  complaintTypeLabel: string;
  remarks: string;
  forwardedBy: string;
  forwardedAt: string; // ISO date-time
  /** Section forwards only: the Mst_Prashakha whose login receives it */
  prashakhaId?: number | null;
  prashakhaLabel?: string | null;
  /** District Administration forwards only: Mst_Regional_Office and one of its offices (vw_Office_Unit) */
  officeId?: number | null;
  officeLabel?: string | null;
  officeUnitCode?: number | null;
  officeUnitLabel?: string | null;
  /** Closed by Admin: the application is Disposed (otherwise Pending) */
  isDisposed?: boolean;
  closedAt?: string | null;
  closedBy?: string | null;
  closureRemarks?: string | null;
}

/** Fields the client sends; the server fills in who forwarded it and when. */
export type ForwardPayload = Omit<ForwardRecord, 'forwardedBy' | 'forwardedAt' | 'isDisposed' | 'closedAt' | 'closedBy' | 'closureRemarks'>;

/** Admin's Responses page: a forwarded application the receiving office has replied to. */
export interface ForwardResponse {
  applicantId: number;
  categoryLabel: string;
  branchLabel: string;
  complaintTypeLabel: string;
  prashakhaLabel?: string | null;
  officeLabel?: string | null;
  officeUnitLabel?: string | null;
  forwardedAt: string;
  /** Remarks by roles other than Admin; unseen = not yet opened by Admin */
  responseCount: number;
  unseenCount: number;
  lastResponseAt: string;
  lastRemark: string;
  lastRemarkBy: string;
  lastRemarkByRole: string | null;
  isDisposed: boolean;
  closedAt: string | null;
  closedBy: string | null;
  closureRemarks: string | null;
}

export interface ClosureRecord {
  applicantId: number;
  closureRemarks: string | null;
  closedBy: string;
  closedAt: string;
}

interface ApiEnvelope<T> {
  status: string; // "true" | "false"
  message: string;
  data: T;
}

/** Forwards stored in Tbl_Applicant_Forward via ApplicantController. */
@Injectable({ providedIn: 'root' })
export class ForwardService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/Applicant`;

  private latestCache = new CachedRequest(() => this.fetchLatest(), 60_000);
  private mineCache = new CachedRequest(
    () => this.http.get<ApiEnvelope<ForwardRecord[]>>(`${this.baseUrl}/get-my-forwards`).pipe(map((res) => res.data ?? [])),
    60_000
  );

  /** Admin's sidebar badge: pending applications with a reply not opened yet. */
  readonly unseenResponses = signal(0);

  constructor() {
    // A different user (or logout) must never see the previous user's cached data
    let lastUser = this.auth.currentUser()?.email;
    effect(() => {
      const user = this.auth.currentUser()?.email;
      if (user !== lastUser) {
        lastUser = user;
        this.latestCache.clear();
        this.mineCache.clear();
        this.unseenResponses.set(0);
      }
    });
  }

  /** API: POST /Applicant/forward-applicant (Admin only — others get 403) */
  forward(payload: ForwardPayload): Observable<ForwardRecord> {
    return this.http
      .post<ApiEnvelope<ForwardRecord>>(`${this.baseUrl}/forward-applicant`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.latestCache.invalidate();
          this.mineCache.invalidate();
        })
      );
  }

  /**
   * API: GET /Applicant/get-my-forwards → applications currently forwarded to the logged-in
   * user's branch, newest first (Admin gets every forwarded application). Cached; `force` refetches.
   */
  myForwards(force = false): Observable<ForwardRecord[]> {
    return this.mineCache.get(force);
  }

  /** API: GET /Applicant/get-forwards → latest forward per application id (cached; `force` refetches). */
  latestByApplicant(force = false): Observable<Map<number, ForwardRecord>> {
    return this.latestCache.get(force);
  }

  /** API: GET /Applicant/get-responses (Admin only) → replied-to forwarded applications, pending first. */
  responses(): Observable<ForwardResponse[]> {
    return this.http
      .get<ApiEnvelope<ForwardResponse[]>>(`${this.baseUrl}/get-responses`)
      .pipe(map((res) => res.data ?? []));
  }

  /** API: GET /Applicant/get-unseen-response-count (Admin only) → updates unseenResponses. */
  refreshUnseenResponses(): void {
    this.http.get<ApiEnvelope<number>>(`${this.baseUrl}/get-unseen-response-count`).subscribe({
      next: (res) => this.unseenResponses.set(res.data ?? 0),
      error: () => {}
    });
  }

  /** API: POST /Applicant/mark-responses-seen/{id} (Admin only) */
  markResponsesSeen(applicantId: number): Observable<unknown> {
    return this.http
      .post(`${this.baseUrl}/mark-responses-seen/${applicantId}`, null)
      .pipe(tap(() => this.refreshUnseenResponses()));
  }

  /** API: POST /Applicant/close-application (Admin only) → the application moves from Pending to Disposed. */
  closeApplication(applicantId: number, remarks: string): Observable<ClosureRecord> {
    return this.http
      .post<ApiEnvelope<ClosureRecord>>(`${this.baseUrl}/close-application`, { applicantId, remarks: remarks || null })
      .pipe(
        map((res) => res.data),
        tap(() => {
          this.latestCache.invalidate();
          this.mineCache.invalidate();
          this.refreshUnseenResponses();
        })
      );
  }

  private fetchLatest(): Observable<Map<number, ForwardRecord>> {
    return this.http.get<ApiEnvelope<ForwardRecord[]>>(`${this.baseUrl}/get-forwards`).pipe(
      map((res) => {
        // Rows come oldest first, so later forwards overwrite earlier ones
        const latest = new Map<number, ForwardRecord>();
        (res.data ?? []).forEach((f) => latest.set(f.applicantId, f));
        return latest;
      })
    );
  }
}
