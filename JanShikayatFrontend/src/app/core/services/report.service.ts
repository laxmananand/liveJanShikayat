import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PendencyLevel = 'district' | 'block' | 'thana' | 'panchayat';
export type PendencyStatus = '' | 'unforwarded' | 'pending' | 'disposed';

/** Drill-down filters; a missing code is "any", thana / panchayat 0 = applications saved without one. */
export interface PendencyFilter {
  district?: number | null;
  block?: number | null;
  thana?: number | null;
  panchayat?: number | null;
  /** yyyy-MM-dd, on the application date; both ends inclusive */
  fromDate?: string;
  toDate?: string;
}

/** One district / block / thana / panchayat row of the Pendency Report. */
export interface PendencyRow {
  code: number;
  name: string;
  total: number;
  /** Not forwarded yet (Admin only) */
  unforwarded: number;
  /** Forwarded, not closed */
  pending: number;
  disposed: number;
}

/** An application behind a Pendency Report count. */
export interface PendencyApplication {
  applicantId: number;
  applicationNo: string | null;
  applicantName: string;
  fatherHusbandName: string | null;
  mobileNumber: string | null;
  applicationDate: string | null;
  districtName: string;
  blockName: string;
  panchayatName: string;
  villageName: string;
  policeStation: string;
  categoryLabel: string | null;
  branchLabel: string | null;
  complaintTypeLabel: string | null;
  prashakhaLabel: string | null;
  officeLabel: string | null;
  officeUnitLabel: string | null;
  forwardedAt: string | null;
  closedAt: string | null;
  status: 'Unforwarded' | 'Pending' | 'Disposed';
  /** Days since the application was received, up to today or its closure */
  pendingDays: number;
}

interface ApiEnvelope<T> {
  status: string;
  message: string;
  data: T;
}

/**
 * Pendency Report (ApplicantController). The server limits every result to the logged-in user's
 * hierarchy: Admin all, Branch / Prashakha / Commissioner / DM only the applications forwarded to them.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/Applicant`;

  /** API: GET /Applicant/pendency-report → counts grouped by `level` */
  pendency(level: PendencyLevel, filter: PendencyFilter): Observable<PendencyRow[]> {
    return this.http
      .get<ApiEnvelope<PendencyRow[]>>(`${this.baseUrl}/pendency-report`, { params: toParams({ ...filter, level }) })
      .pipe(map((res) => res.data ?? []));
  }

  /** API: GET /Applicant/pendency-applications → the applications behind a count */
  pendencyApplications(filter: PendencyFilter, status: PendencyStatus): Observable<PendencyApplication[]> {
    return this.http
      .get<ApiEnvelope<PendencyApplication[]>>(`${this.baseUrl}/pendency-applications`, { params: toParams({ ...filter, status }) })
      .pipe(map((res) => res.data ?? []));
  }
}

/** Query string without empty values (null / undefined / ''); 0 is kept, it is a real filter. */
function toParams(values: Record<string, string | number | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
  }
  return params;
}
