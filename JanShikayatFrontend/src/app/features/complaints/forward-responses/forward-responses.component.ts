import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ApplicantRecord } from '../../../core/models/models';
import { ForwardResponse, ForwardService } from '../../../core/services/forward.service';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';
import { DateRange, inDateRange } from '../../../core/utils/date-range';
import { DateField, DateRangeFilterComponent } from '../../../shared/date-range-filter/date-range-filter.component';

interface ResponseRow {
  record: ApplicantRecord;
  response: ForwardResponse;
}

type StatusTab = 'Pending' | 'Disposed' | '';

/**
 * Admin only: forwarded applications the receiving office (Branch / Section / District Administration)
 * has replied to with remarks. Admin reads the replies and closes the application, which moves it
 * from Pending to Disposed.
 */
@Component({
  selector: 'app-forward-responses',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent, DateRangeFilterComponent],
  templateUrl: './forward-responses.component.html',
  styleUrls: ['../applicant-records/applicant-records.component.scss', './forward-responses.component.scss']
})
export class ForwardResponsesComponent implements OnInit, OnDestroy {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);

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
  closeRemarks = '';
  savingClose = false;
  closeError = '';

  ngOnInit(): void {
    this.load();
  }

  load(force = false): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      responses: this.forwardService.responses(),
      records: this.applicantService.getApplicants(force)
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
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर रिफ़्रेश करें।'
              : `प्राप्त प्रतिवेदन लोड नहीं हो सके (त्रुटि ${err?.status ?? ''})। कृपया रिफ़्रेश करें।`;
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

  askClose(row: ResponseRow): void {
    if (row.response.isDisposed) return;
    this.closing = row;
    this.closeRemarks = '';
    this.closeError = '';
  }

  @HostListener('document:keydown.escape')
  cancelClose(): void {
    if (!this.savingClose) this.closing = null;
  }

  confirmClose(): void {
    const row = this.closing;
    if (!row || this.savingClose) return;

    this.savingClose = true;
    this.closeError = '';
    this.forwardService.closeApplication(row.response.applicantId, this.closeRemarks.trim()).subscribe({
      next: (c) => {
        row.response = {
          ...row.response,
          isDisposed: true,
          unseenCount: 0,
          closedAt: c.closedAt,
          closedBy: c.closedBy,
          closureRemarks: c.closureRemarks
        };
        this.rows = [...this.rows];
        this.savingClose = false;
        this.closing = null;
        this.showSuccess(`आवेदन संख्या ${row.record.applicationNo || row.record.id} (${row.record.applicantName}) बंद कर दिया गया — स्थिति: निष्पादित (Disposed)।`);
      },
      error: (err) => {
        this.savingClose = false;
        this.closeError = err?.error?.message || 'आवेदन बंद नहीं हो सका। / Could not close the application.';
      }
    });
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
