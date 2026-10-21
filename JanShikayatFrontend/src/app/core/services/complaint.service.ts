import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ComplaintDetail,
  ComplaintDocument,
  ComplaintListItem,
  ComplaintRemark,
  ComplaintStatus,
  CreateComplaintPayload,
  DashboardSummary
} from '../models/models';
import { AuthService } from './auth.service';
import { MockDbService, buildSamplePdf, mockError, mockResponse } from '../mock/mock-db.service';
import { ComplaintRecord, MOCK_BRANCHES, MOCK_DEPARTMENTS } from '../mock/mock-data';

/**
 * MOCK IMPLEMENTATION — reads/writes the in-browser MockDbService instead of the API.
 * It reproduces the old backend's rules (role-scoped visibility, who may perform
 * which action, status transitions, audit history) so the UI behaves the same.
 * Public method signatures match the old HTTP version; swap each body for the
 * HttpClient call noted above it when the new backend is ready.
 */
@Injectable({ providedIn: 'root' })
export class ComplaintService {
  private db = inject(MockDbService);
  private auth = inject(AuthService);

  /** API: GET /complaints?status=&source=&search= */
  list(params?: { status?: string; search?: string; source?: string }): Observable<ComplaintListItem[]> {
    return mockResponse(() => {
      let rows = this.scoped();
      if (params?.status) rows = rows.filter((c) => c.status.toLowerCase() === params.status!.toLowerCase());
      if (params?.source) rows = rows.filter((c) => c.source.toLowerCase() === params.source!.toLowerCase());
      if (params?.search) {
        const search = params.search.trim();
        const numberSearch = search.replace(/-/g, '').toUpperCase();
        rows = rows.filter(
          (c) => c.complaintNumber.includes(numberSearch) || c.applicantName.includes(search) || c.subject.includes(search)
        );
      }
      return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => this.toListItem(c));
    });
  }

  /** API: GET /complaints/{id} */
  getById(id: number): Observable<ComplaintDetail> {
    return mockResponse(() => this.toDetail(this.findScoped(id)));
  }

  /** API: POST /complaints (BranchOfficer, SuperAdmin) */
  create(payload: CreateComplaintPayload): Observable<ComplaintDetail> {
    return mockResponse(() => {
      this.requireRole('BranchOfficer', 'SuperAdmin');
      if (!MOCK_BRANCHES.some((b) => b.id === payload.branchId)) throw mockError(400, { message: 'Invalid branch.' });

      const now = new Date().toISOString();
      const record = this.db.insertComplaint({
        complaintNumber: this.db.nextComplaintNumber(),
        applicantName: payload.applicantName,
        guardianName: payload.guardianName,
        mobileNumber: payload.mobileNumber,
        email: payload.email,
        address: payload.address,
        district: payload.district,
        block: payload.block,
        policeStation: payload.policeStation,
        area: payload.area,
        oppositeParty: payload.oppositeParty,
        subject: payload.subject,
        category: payload.category,
        subCategory: payload.subCategory,
        description: payload.description,
        complaintDate: payload.complaintDate ?? now,
        source: payload.source,
        branchId: payload.branchId,
        departmentId: payload.departmentId ?? null,
        competentAuthorityDesignationId: null,
        status: 'Pending',
        createdAt: now,
        documents: [],
        remarks: [],
        history: [
          { fromStatus: 'Pending', toStatus: 'Pending', reason: 'Complaint registered.', actionByName: this.userName(), actionAt: now }
        ]
      });
      return this.toDetail(record);
    });
  }

  /** API: POST /complaints/{id}/documents  (multipart: file, documentType) */
  uploadDocument(complaintId: number, file: File, documentType: string): Observable<ComplaintDocument> {
    return mockResponse(() => {
      const complaint = this.find(complaintId);
      if (!file || file.size === 0) throw mockError(400, { message: 'No file uploaded.' });

      const doc = {
        id: this.db.nextDocumentId(),
        fileName: file.name,
        documentType: documentType || 'Complaint',
        uploadedAt: new Date().toISOString()
      };
      complaint.documents.push(doc);
      this.db.storeFile(doc.id, file);
      this.db.save();
      return { ...doc, downloadUrl: this.downloadUrl(complaintId, doc.id) };
    });
  }

  /** API: POST /complaints/{id}/remarks (DepartmentHead, CompetentAuthority, SuperAdmin) */
  addRemark(complaintId: number, remarkType: string, text: string): Observable<ComplaintRemark> {
    return mockResponse(() => {
      this.requireRole('DepartmentHead', 'CompetentAuthority', 'SuperAdmin');
      const complaint = this.find(complaintId);
      const remark = this.pushRemark(complaint, remarkType, text);
      // Same as the old backend: the first remark moves a new complaint into review (no history row).
      if (complaint.status === 'Pending') complaint.status = 'UnderReview';
      this.db.save();
      return remark;
    });
  }

  /** API: POST /complaints/{id}/forward (DepartmentHead, SuperAdmin) */
  forward(
    complaintId: number,
    payload: { departmentId?: number; competentAuthorityDesignationId?: number; reason: string }
  ): Observable<{ message: string; status: string }> {
    return mockResponse(() => {
      this.requireRole('DepartmentHead', 'SuperAdmin');
      const complaint = this.find(complaintId);
      const from = complaint.status;

      if (payload.departmentId) {
        complaint.departmentId = payload.departmentId;
        complaint.status = 'ForwardedToDepartment';
      } else if (payload.competentAuthorityDesignationId) {
        complaint.competentAuthorityDesignationId = payload.competentAuthorityDesignationId;
        complaint.status = 'ForwardedForFieldEnquiry';
      } else {
        throw mockError(400, { message: 'Specify either a department or a competent authority to forward to.' });
      }

      this.pushHistory(complaint, from, payload.reason);
      this.db.save();
      return { message: 'Complaint forwarded.', status: complaint.status };
    });
  }

  /** API: POST /complaints/{id}/action-taken (CompetentAuthority, DepartmentHead, SuperAdmin) */
  markActionTaken(complaintId: number, text: string): Observable<{ message: string; status: string }> {
    return mockResponse(() => {
      this.requireRole('CompetentAuthority', 'DepartmentHead', 'SuperAdmin');
      const complaint = this.find(complaintId);
      const from = complaint.status;
      complaint.status = 'ActionTaken';
      this.pushRemark(complaint, 'Official', text);
      this.pushHistory(complaint, from, 'Action taken; report submitted.');
      this.db.save();
      return { message: 'Action recorded.', status: complaint.status };
    });
  }

  /** API: POST /complaints/{id}/close (DepartmentHead, CompetentAuthority, SuperAdmin) */
  close(complaintId: number, closureRemarks: string): Observable<{ message: string; status: string }> {
    return mockResponse(() => {
      this.requireRole('DepartmentHead', 'CompetentAuthority', 'SuperAdmin');
      const complaint = this.find(complaintId);
      const from = complaint.status;
      complaint.status = 'Disposed';
      complaint.closureRemarks = closureRemarks;
      complaint.closedAt = new Date().toISOString();
      this.pushHistory(complaint, from, closureRemarks);
      this.db.save();
      return { message: 'Case closed.', status: complaint.status };
    });
  }

  /** API: GET /complaints/{id}/documents/{documentId}/download */
  downloadUrl(complaintId: number, documentId: number): string {
    return `mock://complaints/${complaintId}/documents/${documentId}/download`;
  }

  /** API: GET /complaints/{id}/documents/{documentId}/download (responseType: blob) */
  downloadDocumentBlob(complaintId: number, documentId: number): Observable<Blob> {
    return mockResponse(() => {
      const complaint = this.find(complaintId);
      const doc = complaint.documents.find((d) => d.id === documentId);
      if (!doc) throw mockError(404);
      return (
        this.db.getFile(documentId) ??
        buildSamplePdf([
          'Jan Shikayat - Sample Document',
          `Complaint No.: ${complaint.complaintNumber}`,
          `File: ${doc.fileName}`,
          `Type: ${doc.documentType}`,
          `Uploaded: ${new Date(doc.uploadedAt).toLocaleString('en-IN')}`,
          '',
          'This placeholder PDF is generated by the frontend-only template.',
          'The real file will be served by the backend API once it is connected.'
        ])
      );
    });
  }

  /** API: GET /dashboard/summary  (counts all complaints, like the old backend) */
  dashboardSummary(): Observable<DashboardSummary> {
    return mockResponse(() => {
      const all = this.db.complaints;
      const count = (...statuses: ComplaintStatus[]) => all.filter((c) => statuses.includes(c.status)).length;
      return {
        totalComplaints: all.length,
        pending: count('Pending'),
        underReview: count('UnderReview'),
        forwarded: count('ForwardedToDepartment'),
        underFieldEnquiry: count('ForwardedForFieldEnquiry', 'ActionTaken'),
        disposed: count('Disposed'),
        onlineSubmissions: all.filter((c) => c.source === 'Online').length
      };
    });
  }

  // ---- Mock backend internals ---------------------------------------------

  /** What the signed-in role may see (same rules as the old ScopedQueryAsync). */
  private scoped(): ComplaintRecord[] {
    const user = this.auth.currentUser();
    const all = this.db.complaints;
    if (!user) throw mockError(401);

    switch (user.role) {
      case 'SuperAdmin':
        return all;
      case 'BranchOfficer':
        return user.branchId ? all.filter((c) => c.branchId === user.branchId) : [];
      case 'DepartmentHead':
        return user.departmentId ? all.filter((c) => c.departmentId === user.departmentId) : [];
      case 'CompetentAuthority':
        return all.filter((c) => ['ForwardedForFieldEnquiry', 'ActionTaken', 'Disposed'].includes(c.status));
      default:
        return [];
    }
  }

  private findScoped(id: number): ComplaintRecord {
    const complaint = this.scoped().find((c) => c.id === id);
    if (!complaint) throw mockError(404);
    return complaint;
  }

  /** Unscoped lookup — the old backend's action endpoints only checked role, not scope. */
  private find(id: number): ComplaintRecord {
    if (!this.auth.isLoggedIn()) throw mockError(401);
    const complaint = this.db.complaints.find((c) => c.id === id);
    if (!complaint) throw mockError(404);
    return complaint;
  }

  private requireRole(...roles: string[]): void {
    if (!this.auth.isLoggedIn()) throw mockError(401);
    if (!this.auth.hasRole(...roles)) throw mockError(403);
  }

  private userName(): string {
    return this.auth.currentUser()?.fullName ?? '';
  }

  private pushRemark(complaint: ComplaintRecord, remarkType: string, text: string): ComplaintRemark {
    const remark: ComplaintRemark = {
      id: this.db.nextRemarkId(),
      remarkType,
      text,
      createdByName: this.userName(),
      createdAt: new Date().toISOString()
    };
    complaint.remarks.push(remark);
    return remark;
  }

  private pushHistory(complaint: ComplaintRecord, fromStatus: ComplaintStatus, reason: string | null): void {
    complaint.history.push({
      fromStatus,
      toStatus: complaint.status,
      reason,
      actionByName: this.userName(),
      actionAt: new Date().toISOString()
    });
  }

  private toListItem(c: ComplaintRecord): ComplaintListItem {
    const dept = MOCK_DEPARTMENTS.find((d) => d.id === c.departmentId);
    return {
      id: c.id,
      complaintNumber: c.complaintNumber,
      applicantName: c.applicantName,
      subject: c.subject,
      complaintDate: c.complaintDate,
      status: c.status,
      source: c.source,
      branchName: MOCK_BRANCHES.find((b) => b.id === c.branchId)?.name ?? '',
      departmentName: dept ? dept.nameHindi ?? dept.name : null
    };
  }

  private toDetail(c: ComplaintRecord): ComplaintDetail {
    const byDate = <T>(key: keyof T) => (a: T, b: T) => String(a[key]).localeCompare(String(b[key]));
    return {
      ...this.toListItem(c),
      guardianName: c.guardianName,
      mobileNumber: c.mobileNumber,
      address: c.address,
      district: c.district,
      block: c.block,
      policeStation: c.policeStation,
      area: c.area,
      email: c.email,
      oppositeParty: c.oppositeParty,
      category: c.category,
      subCategory: c.subCategory,
      description: c.description,
      closureRemarks: c.closureRemarks,
      closedAt: c.closedAt,
      documents: c.documents.map((d) => ({ ...d, downloadUrl: this.downloadUrl(c.id, d.id) })),
      remarks: [...c.remarks].sort(byDate<ComplaintRemark>('createdAt')),
      history: [...c.history].sort(byDate('actionAt'))
    };
  }
}
