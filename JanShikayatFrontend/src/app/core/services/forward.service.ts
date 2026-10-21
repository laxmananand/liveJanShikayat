import { Injectable, effect, inject } from '@angular/core';
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
}

/** Fields the client sends; the server fills in who forwarded it and when. */
export type ForwardPayload = Omit<ForwardRecord, 'forwardedBy' | 'forwardedAt'>;

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

  constructor() {
    // A different user (or logout) must never see the previous user's cached data
    let lastUser = this.auth.currentUser()?.email;
    effect(() => {
      const user = this.auth.currentUser()?.email;
      if (user !== lastUser) {
        lastUser = user;
        this.latestCache.clear();
      }
    });
  }

  /** API: POST /Applicant/forward-applicant (Admin only — others get 403) */
  forward(payload: ForwardPayload): Observable<ForwardRecord> {
    return this.http
      .post<ApiEnvelope<ForwardRecord>>(`${this.baseUrl}/forward-applicant`, payload)
      .pipe(
        map((res) => res.data),
        tap(() => this.latestCache.invalidate())
      );
  }

  /** API: GET /Applicant/get-forwards → latest forward per application id (cached; `force` refetches). */
  latestByApplicant(force = false): Observable<Map<number, ForwardRecord>> {
    return this.latestCache.get(force);
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
