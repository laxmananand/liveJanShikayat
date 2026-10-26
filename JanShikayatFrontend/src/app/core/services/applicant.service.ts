import { Injectable, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { ApplicantRecord, ApplicantRemark, SaveApplicantPayload, SaveApplicantResponse } from '../models/models';
import { environment } from '../../../environments/environment';
import { CachedRequest } from '../utils/cached-request';
import { AuthService } from './auth.service';

/** Read a property regardless of the backend's JSON casing (camelCase / PascalCase / ALLCAPS). */
function pick(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row && row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

/** Applicant details served by the backend's ApplicantController. */
@Injectable({ providedIn: 'root' })
export class ApplicantService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/Applicant`;

  /** get-all is heavy (documents as base64), so it is kept in memory across sidebar navigation. */
  private applicantsCache = new CachedRequest(() => this.fetchApplicants(), 60_000);

  constructor() {
    // A different user (or logout) must never see the previous user's cached data
    let lastUser = this.auth.currentUser()?.email;
    effect(() => {
      const user = this.auth.currentUser()?.email;
      if (user !== lastUser) {
        lastUser = user;
        this.applicantsCache.clear();
      }
    });
  }

  /** API: POST /Applicant/save-janshikayat_applicant-details (multipart/form-data → TblApplicantDetails) */
  saveApplicant(p: SaveApplicantPayload): Observable<SaveApplicantResponse> {
    const fd = new FormData();
    fd.append('Applicant_Name', p.applicantName);
    fd.append('Father_Husband_Name', p.fatherHusbandName);
    fd.append('Mobile_Number', p.mobileNumber);
    if (p.mobileNumber2) fd.append('Mobile_Number2', p.mobileNumber2);
    fd.append('Address', p.address);
    fd.append('Pin_Code', p.pinCode);
    if (p.emailId) fd.append('Email_Id', p.emailId);
    fd.append('Application_Date', p.applicationDate);
    fd.append('Village', String(p.village));
    fd.append('Panchayat', String(p.panchayat));
    fd.append('Block', String(p.block));
    fd.append('District', String(p.district));
    fd.append('Thana', String(p.thana || 0));
    fd.append('Application_Source', p.applicationSource);
    if (p.createdBy) fd.append('CreatedBy', p.createdBy);
    fd.append('Applicants_Photograph', p.photograph, p.photograph.name);
    return this.http
      .post<SaveApplicantResponse>(`${this.baseUrl}/save-janshikayat_applicant-details`, fd)
      .pipe(tap(() => this.applicantsCache.invalidate()));
  }

  /**
   * API: GET /Applicant/get-all → list of saved applicants (requires a valid JWT).
   * Served from memory: may emit the cached list first and the refreshed one after; `force` always refetches.
   */
  getApplicants(force = false): Observable<ApplicantRecord[]> {
    return this.applicantsCache.get(force);
  }

  private fetchApplicants(): Observable<ApplicantRecord[]> {
    return this.http.get<any[]>(`${this.baseUrl}/get-all`).pipe(
      map((rows) =>
        (rows ?? []).map((r) => ({
          id: pick(r, 'id', 'ID', 'Id') ?? 0,
          applicationNo: pick(r, 'application_No', 'Application_No', 'applicationNo') ?? '',
          applicantName: pick(r, 'applicant_Name', 'Applicant_Name', 'applicantName') ?? '',
          fatherHusbandName: pick(r, 'father_Husband_Name', 'Father_Husband_Name') ?? '',
          mobileNumber: pick(r, 'mobile_Number', 'Mobile_Number') ?? '',
          mobileNumber2: pick(r, 'mobile_Number2', 'Mobile_Number2') ?? '',
          address: pick(r, 'address', 'Address') ?? '',
          pinCode: pick(r, 'pin_Code', 'Pin_Code') ?? '',
          emailId: pick(r, 'email_Id', 'Email_Id') ?? '',
          applicationDate: pick(r, 'application_Date', 'Application_Date') ?? null,
          villageName: pick(r, 'villname', 'vILLNAME', 'VILLNAME') ?? '',
          panchayatName: pick(r, 'panchayatName', 'PanchayatName') ?? '',
          blockName: pick(r, 'blockName', 'BlockName') ?? '',
          districtName: pick(r, 'districtname', 'dISTRICTNAME', 'DISTRICTNAME') ?? '',
          thanaCode: Number(pick(r, 'thana', 'Thana') ?? 0),
          policeStation: pick(r, 'police_Station', 'Police_Station', 'policeStation') ?? '',
          documentBase64: pick(r, 'documentPath', 'DocumentPath') ?? null,
          applicationSource: pick(r, 'application_Source', 'Application_Source') ?? 'Offline'
        }))
      )
    );
  }

  /** API: GET /Applicant/get-remarks/{id} → remarks on one application, oldest first (any logged-in role). */
  getRemarks(applicantId: number): Observable<ApplicantRemark[]> {
    return this.http
      .get<{ data: ApplicantRemark[] }>(`${this.baseUrl}/get-remarks/${applicantId}`)
      .pipe(map((res) => res.data ?? []));
  }

  /** API: POST /Applicant/add-remark (multipart: ApplicantId, Remark, optional PDF Document) (any logged-in role). */
  addRemark(applicantId: number, remark: string, document?: File | null): Observable<ApplicantRemark> {
    const fd = new FormData();
    fd.append('ApplicantId', String(applicantId));
    fd.append('Remark', remark);
    if (document) fd.append('Document', document, document.name);
    return this.http
      .post<{ data: ApplicantRemark }>(`${this.baseUrl}/add-remark`, fd)
      .pipe(map((res) => res.data));
  }

  /** API: GET /Applicant/get-remark-document/{remarkId} → the PDF attached to a remark (any logged-in role). */
  getRemarkDocument(remarkId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/get-remark-document/${remarkId}`, { responseType: 'blob' });
  }
}
