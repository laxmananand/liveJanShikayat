import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';
import { ApplicantService } from '../../../core/services/applicant.service';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicantRecord } from '../../../core/models/models';
import { ClosureRecord, ForwardResponse, ForwardService } from '../../../core/services/forward.service';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';
import { CloseApplicationDialogComponent } from '../../../shared/close-application-dialog/close-application-dialog.component';
import { DateRange, inDateRange } from '../../../core/utils/date-range';
import { DateField, DateRangeFilterComponent } from '../../../shared/date-range-filter/date-range-filter.component';

interface ResponseRow {
  record: ApplicantRecord;
  response: ForwardResponse;
}

type StatusTab = 'Pending' | 'Disposed' | '';

/**
 * Responses received (Admin, DM, SP): forwarded applications with replies (remarks).
 *   Admin: replies by any receiving office (Branch / Section / District Administration) and whether each application
 *     is closed; it cannot close (the branch / section or the DM / SP does).
 *   DM / SP: replies by the offices under it in that application's chain (SDO / DCLR / DSP-SDPO / CO / थाना);
 *     closes the applications that reached it.
 * Opening a row's remarks marks its replies as seen for this login only.
 */
@Component({
  selector: 'app-forward-responses',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent, DateRangeFilterComponent, CloseApplicationDialogComponent],
  templateUrl: './forward-responses.component.html',
  styleUrls: ['../applicant-records/applicant-records.component.scss', './forward-responses.component.scss']
})
export class ForwardResponsesComponent implements OnInit, OnDestroy {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);
  private auth = inject(AuthService);

  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  rows: ResponseRow[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';
  private successTimer?: ReturnType<typeof setTimeout>;
  searchTerm = '';
  statusTab: StatusTab = 'Pending';
  readonly dateFields: DateField[] = [
    { key: 'response', label: 'प्रतिवेदन दिनांक' },
    { key: 'forwarded', label: 'अग्रेषित दिनांक' },
    { key: 'closed', label: 'निष्पादन दिनांक' }
  ];
  dateRange: DateRange = { field: 'response', from: '', to: '' };

  /** Row whose details / remarks are open */
  selected: ResponseRow | null = null;
  /** Row waiting for the close confirmation */
  closing: ResponseRow | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      responses: this.forwardService.responses(),
      records: this.applicantService.getApplicants()
    }).subscribe({
      next: ({ responses, records }) => {
        const byId = new Map(records.map((r) => [r.id, r]));
        this.rows = responses
          .map((response) => ({ response, record: byId.get(response.applicantId)! }))
          .filter((row) => !!row.record);
        this.loading = false;
        this.forwardService.refreshUnseenResponses();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : err?.status === 0
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर पृष्ठ पुनः लोड करें।'
              : `प्राप्त प्रतिवेदन लोड नहीं हो सके (त्रुटि ${err?.status ?? ''})। कृपया पृष्ठ पुनः लोड करें।`;
      }
    });
  }

  count(tab: StatusTab): number {
    return tab ? this.rows.filter((r) => this.statusOf(r) === tab).length : this.rows.length;
  }

  statusOf(row: ResponseRow): 'Pending' | 'Disposed' {
    return row.response.isDisposed ? 'Disposed' : 'Pending';
  }

  get filtered(): ResponseRow[] {
    const q = this.searchTerm.trim().toLowerCase();
    return this.rows.filter(
      (row) =>
        (!this.statusTab || this.statusOf(row) === this.statusTab) &&
        inDateRange(this.dateOf(row.response), this.dateRange) &&
        (!q ||
          row.record.applicationNo.toLowerCase().includes(q) ||
          row.record.applicantName.toLowerCase().includes(q) ||
          row.record.mobileNumber.includes(q) ||
          row.response.branchLabel.toLowerCase().includes(q) ||
          row.response.lastRemark.toLowerCase().includes(q))
    );
  }

  private dateOf(f: ForwardResponse): string | null {
    switch (this.dateRange.field) {
      case 'forwarded':
        return f.forwardedAt;
      case 'closed':
        return f.closedAt;
      default:
        return f.lastResponseAt;
    }
  }

  forwardedTo(f: ForwardResponse): string {
    return [f.categoryLabel, f.prashakhaLabel, f.officeUnitLabel || f.officeLabel].filter((n) => !!n).join(' • ');
  }

  /** Opening the remarks marks the replies as seen, which clears the "new" tag and the sidebar badge. */
  openDetails(row: ResponseRow): void {
    this.selected = row;
    if (row.response.unseenCount > 0) {
      this.forwardService.markResponsesSeen(row.response.applicantId).subscribe({
        next: () => (row.response.unseenCount = 0),
        error: () => {}
      });
    }
  }

  /**
   * Who closes an open application. District Administration forward: every DM / SP it reached (both → whoever
   * closes first); none yet → after the Commissioner / IG / DIG forwards it to a DM / SP. Else the branch / section.
   */
  closerOf(f: ForwardResponse): string {
    if (!(f.officeLabel || f.officeUnitLabel)) return f.prashakhaLabel ? 'प्रशाखा / Section' : 'शाखा / Branch';
    if (f.reachedDm && f.reachedSp) return 'DM या SP (जो पहले करे)';
    if (f.reachedDm) return 'DM';
    if (f.reachedSp) return 'SP';
    return 'DM / SP (क्षेत्रीय कार्यालय द्वारा भेजे जाने पर)';
  }

  /** Only the DM / SP closes here (Admin views only; a branch / section closes on its Forwarded Applications page). */
  askClose(row: ResponseRow): void {
    if (row.response.isDisposed || !row.response.canClose) return;
    this.closing = row;
  }

  onClosed(c: ClosureRecord): void {
    const row = this.closing;
    this.closing = null;
    if (!row) return;
    row.response = {
      ...row.response,
      isDisposed: true,
      unseenCount: 0,
      closedAt: c.closedAt,
      closedBy: c.closedBy,
      closureRemarks: c.closureRemarks
    };
    this.rows = [...this.rows];
    this.showSuccess(`आवेदन संख्या ${row.record.applicationNo || row.record.id} (${row.record.applicantName}) बंद कर दिया गया — स्थिति: निष्पादित (Disposed)।`);
  }

  /** The success alert hides itself after MESSAGE_DURATION_MS; a newer message restarts the timer. */
  private showSuccess(message: string): void {
    clearTimeout(this.successTimer);
    this.successMessage = message;
    this.successTimer = setTimeout(() => (this.successMessage = ''), MESSAGE_DURATION_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.successTimer);
  }
}
