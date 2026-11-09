import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CachedRequest } from '../utils/cached-request';
import { AuthService } from './auth.service';
import { ComplaintStatus } from '../models/models';

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
  /** Forwarded, Pending or Disposed, worked out by the server */
  status?: ComplaintStatus;
  /** When the receiving office first replied: Forwarded → Pending */
  firstResponseAt?: string | null;
  /** Closed by Admin: the application is Disposed */
  isDisposed?: boolean;
  closedAt?: string | null;
  closedBy?: string | null;
  closureRemarks?: string | null;
  /** Onward forwards by the receiving Commissioner / IG / DIG to a DM and / or SP */
  reforwards?: ReforwardRecord[];
}

/** Mst_Regional_Office.Office_Id */
export const OFFICE_KIND = { Commissioner: 1, DM: 2, IG: 3, DIG: 4, SP: 5, SDO: 6, DCLR: 7, SDPO: 8 } as const;

/** Commissioner / IG / DIG logins can forward what they received onward to DM / SP. */
export function isRegionalOffice(officeId: number | null | undefined): boolean {
  return officeId === OFFICE_KIND.Commissioner || officeId === OFFICE_KIND.IG || officeId === OFFICE_KIND.DIG;
}

/**
 * Office kinds each sender forwards onward to: Commissioner / IG / DIG → DM / SP, DM → SDO / DCLR, SP → DSP / SDPO.
 * The next level (e.g. SDO / DCLR → CO, SDPO → थाना) is one more entry here plus its rows on the server.
 */
export const ONWARD_KINDS: Record<number, number[]> = {
  [OFFICE_KIND.Commissioner]: [OFFICE_KIND.DM, OFFICE_KIND.SP],
  [OFFICE_KIND.IG]: [OFFICE_KIND.DM, OFFICE_KIND.SP],
  [OFFICE_KIND.DIG]: [OFFICE_KIND.DM, OFFICE_KIND.SP],
  [OFFICE_KIND.DM]: [OFFICE_KIND.SDO, OFFICE_KIND.DCLR],
  [OFFICE_KIND.SP]: [OFFICE_KIND.SDPO]
};

/** Logins that can forward what they received onward to the offices under them. */
export function canForwardOnward(officeId: number | null | undefined): boolean {
  return officeId != null && !!ONWARD_KINDS[officeId]?.length;
}

/** One onward forward (Tbl_Applicant_Reforward): regional office → DM / SP, DM → SDO / DCLR, SP → DSP / SDPO. */
export interface ReforwardRecord {
  id: number;
  applicantId: number;
  fromOfficeId: number;
  fromOfficeUnitCode: number;
  fromOfficeLabel: string;
  toOfficeId: number;
  toOfficeUnitCode: number;
  toOfficeLabel: string;
  remarks: string | null;
  forwardedBy: string;
  forwardedAt: string;
  /** The onward forward that brought it to the sender (DM / SP → SDO / DCLR / SDPO), when there was one */
  parentReforwardId?: number | null;
}

/** An office under the logged-in user that it may forward to (see ONWARD_KINDS). */
export interface ReforwardTarget {
  officeId: number; // OFFICE_KIND: 2 DM, 5 SP, 6 SDO, 7 DCLR, 8 SDPO
  unitCode: number;
  unitLabel: string;
  /** The office of the application's own area: its district's DM / SP, subdivision's SDO / DCLR, thana's SDPO */
  isApplicantDistrict: boolean;
}

/** Offices to send to now, per kind; any number, each office once per application. */
export interface ReforwardPayload {
  applicantId: number;
  /** DM offices (Dist_Code) */
  dmUnitCodes?: number[];
  /** SP offices (SP_Code) */
  spUnitCodes?: number[];
  /** SDO / DCLR offices (subdivision code) */
  sdoUnitCodes?: number[];
  dclrUnitCodes?: number[];
  /** DSP / SDPO offices (SDPO_Code) */
  sdpoUnitCodes?: number[];
  remarks: string | null;
}

/** ReforwardPayload field that carries each office kind's picks */
export const PAYLOAD_FIELD: Record<number, keyof Omit<ReforwardPayload, 'applicantId' | 'remarks'>> = {
  [OFFICE_KIND.DM]: 'dmUnitCodes',
  [OFFICE_KIND.SP]: 'spUnitCodes',
  [OFFICE_KIND.SDO]: 'sdoUnitCodes',
  [OFFICE_KIND.DCLR]: 'dclrUnitCodes',
  [OFFICE_KIND.SDPO]: 'sdpoUnitCodes'
};

/**
 * Who actually receives a forward: the officer / office (District Administration), else the
 * Prashakha (Section), else the branch / department itself.
 */
export function forwardRecipient(f: Pick<ForwardRecord, 'branchLabel' | 'prashakhaLabel' | 'officeLabel' | 'officeUnitLabel'>): string {
  return f.officeUnitLabel || f.officeLabel || f.prashakhaLabel || f.branchLabel || '—';
}

/** Fields the client sends; the server fills in who forwarded it and when. */
export type ForwardPayload = Omit<ForwardRecord, 'forwardedBy' | 'forwardedAt' | 'status' | 'firstResponseAt' | 'isDisposed' | 'closedAt' | 'closedBy' | 'closureRemarks'>;

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

  /** API: GET /Applicant/reforward-targets/{id} (Commissioner / IG / DIG / DM / SP) → the offices under the login */
  reforwardTargets(applicantId: number): Observable<ReforwardTarget[]> {
    return this.http
      .get<ApiEnvelope<ReforwardTarget[]>>(`${this.baseUrl}/reforward-targets/${applicantId}`)
      .pipe(map((res) => res.data ?? []));
  }

  /** API: POST /Applicant/reforward-applicant (Commissioner / IG / DIG / DM / SP) → the onward forwards saved */
  reforward(payload: ReforwardPayload): Observable<ReforwardRecord[]> {
    return this.http
      .post<ApiEnvelope<ReforwardRecord[]>>(`${this.baseUrl}/reforward-applicant`, payload)
      .pipe(
        map((res) => res.data ?? []),
        tap(() => this.invalidate())
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

  /** A remark by the receiving office can change the status, so the cached forwards are stale after one. */
  invalidate(): void {
    this.latestCache.invalidate();
    this.mineCache.invalidate();
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
