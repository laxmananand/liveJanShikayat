import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ApplicantRecord } from '../../../core/models/models';
import { ForwardRecord, ForwardService, ReforwardRecord, forwardRecipient, isRegionalOffice } from '../../../core/services/forward.service';
import { ReforwardDialogComponent } from '../../../shared/reforward-dialog/reforward-dialog.component';
import { AuthService } from '../../../core/services/auth.service';
import { applicationStatus, statusLabel } from '../../../core/utils/labels';
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
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent, DateRangeFilterComponent, ReforwardDialogComponent],
  templateUrl: './forwarded-applications.component.html',
  styleUrl: '../applicant-records/applicant-records.component.scss'
})
export class ForwardedApplicationsComponent implements OnInit, OnDestroy {
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

  applicationStatus = applicationStatus;
  statusLabel = statusLabel;
  readonly recipient = forwardRecipient;

  /** Row whose "Forward to DM / SP" popup is open */
  reforwarding: ForwardedRow | null = null;
  infoMessage = '';
  private infoTimer?: ReturnType<typeof setTimeout>;

  /** Commissioner / IG / DIG logins forward what they received onward to DM / SP. */
  get isRegional(): boolean {
    return !this.isAdmin && isRegionalOffice(this.auth.currentUser()?.officeId);
  }

  sentCount(f: ForwardRecord): number {
    return f.reforwards?.length ?? 0;
  }

  hasSent(f: ForwardRecord, officeId: number): boolean {
    return !!f.reforwards?.some((r) => r.toOfficeId === officeId);
  }

  openReforward(row: ForwardedRow): void {
    if (row.forward.isDisposed) return;
    this.reforwarding = row;
  }

  onReforwarded(saved: ReforwardRecord[]): void {
    const row = this.reforwarding;
    this.reforwarding = null;
    if (!row) return;
    row.forward = { ...row.forward, reforwards: [...(row.forward.reforwards ?? []), ...saved] };
    this.infoMessage = `आवेदन संख्या ${row.record.applicationNo || row.record.id} (${row.record.applicantName}) ${saved
      .map((r) => `"${r.toOfficeLabel}"`)
      .join(' व ')} को अग्रेषित किया गया। / Forwarded successfully.`;
    clearTimeout(this.infoTimer);
    this.infoTimer = setTimeout(() => (this.infoMessage = ''), MESSAGE_DURATION_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.infoTimer);
  }

  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  /** Non-admin logins mapped to no branch, Prashakha or regional office never receive forwards. */
  get hasBranch(): boolean {
    const u = this.auth.currentUser();
    return this.isAdmin || u?.branchId != null || u?.prashakhaId != null || u?.officeId != null;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      forwards: this.forwardService.myForwards(),
      records: this.applicantService.getApplicants()
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
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर पृष्ठ पुनः लोड करें।'
              : `अग्रेषित आवेदन लोड नहीं हो सके (त्रुटि ${err?.status ?? ''})। कृपया पृष्ठ पुनः लोड करें।`;
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
