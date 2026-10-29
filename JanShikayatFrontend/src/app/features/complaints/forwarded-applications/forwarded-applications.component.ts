import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ApplicantRecord } from '../../../core/models/models';
import { ForwardRecord, ForwardService } from '../../../core/services/forward.service';
import { AuthService } from '../../../core/services/auth.service';
import { openBase64Document } from '../../../core/utils/document';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';
import { DateRange, inDateRange, isRangeActive } from '../../../core/utils/date-range';
import { DateField, DateRangeFilterComponent } from '../../../shared/date-range-filter/date-range-filter.component';

interface ForwardedRow {
  record: ApplicantRecord;
  forward: ForwardRecord;
}

/**
 * Applications forwarded to the logged-in user's branch (Tbl_UserLogin.Branch_Id);
 * Admin sees every forwarded application. The server decides which forwards are returned.
 */
@Component({
  selector: 'app-forwarded-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent, DateRangeFilterComponent],
  templateUrl: './forwarded-applications.component.html',
  styleUrl: '../applicant-records/applicant-records.component.scss'
})
export class ForwardedApplicationsComponent implements OnInit {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);
  private auth = inject(AuthService);

  rows: ForwardedRow[] = [];
  loading = true;
  errorMessage = '';
  searchTerm = '';
  readonly dateFields: DateField[] = [
    { key: 'forwarded', label: 'अग्रेषित दिनांक' },
    { key: 'received', label: 'आवेदन प्राप्ति की तिथि' },
    { key: 'closed', label: 'निष्पादन दिनांक' }
  ];
  dateRange: DateRange = { field: 'forwarded', from: '', to: '' };
  selected: ApplicantRecord | null = null;
  /** Forward of the open record: carries its closure when Admin has disposed of it */
  selectedForward: ForwardRecord | null = null;
  allowRemark = false;

  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  /** Non-admin logins mapped to neither a branch nor a Prashakha never receive forwards. */
  get hasBranch(): boolean {
    const u = this.auth.currentUser();
    return this.isAdmin || u?.branchId != null || u?.prashakhaId != null;
  }

  ngOnInit(): void {
    this.load();
  }

  load(force = false): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      forwards: this.forwardService.myForwards(force),
      records: this.applicantService.getApplicants(force)
    }).subscribe({
      next: ({ forwards, records }) => {
        const byId = new Map(records.map((r) => [r.id, r]));
        this.rows = forwards
          .map((forward) => ({ forward, record: byId.get(forward.applicantId)! }))
          .filter((row) => !!row.record);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : err?.status === 0
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर रिफ़्रेश करें।'
              : `अग्रेषित आवेदन लोड नहीं हो सके (त्रुटि ${err?.status ?? ''})। कृपया रिफ़्रेश करें।`;
      }
    });
  }

  get filtered(): ForwardedRow[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q && !isRangeActive(this.dateRange)) return this.rows;
    return this.rows.filter(
      ({ record: r, forward: f }) =>
        inDateRange(this.dateOf(r, f), this.dateRange) &&
        (!q ||
          r.applicationNo.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.mobileNumber.includes(q) ||
          r.districtName.toLowerCase().includes(q) ||
          f.branchLabel.toLowerCase().includes(q) ||
          f.complaintTypeLabel.toLowerCase().includes(q))
    );
  }

  private dateOf(r: ApplicantRecord, f: ForwardRecord): string | null | undefined {
    switch (this.dateRange.field) {
      case 'received':
        return r.applicationDate;
      case 'closed':
        return f.closedAt;
      default:
        return f.forwardedAt;
    }
  }

  /** "Village, Panchayat" without a stray comma when one is missing (village is optional). */
  joinNames(...names: string[]): string {
    return names.filter((n) => !!n?.trim()).join(', ') || '—';
  }

  /** View (eye) opens the details read-only; the Remarks button also lets the user add a remark. */
  openDetails(row: ForwardedRow, allowRemark: boolean): void {
    this.allowRemark = allowRemark;
    this.selectedForward = row.forward;
    this.selected = row.record;
  }

  openDoc(r: ApplicantRecord): void {
    if (r.documentBase64 && !openBase64Document(r.documentBase64)) {
      this.errorMessage = 'दस्तावेज़ खोला नहीं जा सका।';
    }
  }
}
