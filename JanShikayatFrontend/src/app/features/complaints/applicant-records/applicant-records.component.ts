import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ApplicantRecord } from '../../../core/models/models';
import { openBase64Document } from '../../../core/utils/document';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';
import { ForwardDialogComponent } from '../../../shared/forward-dialog/forward-dialog.component';
import { ForwardRecord, ForwardService } from '../../../core/services/forward.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-applicant-records',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ApplicantDetailsModalComponent, ForwardDialogComponent],
  templateUrl: './applicant-records.component.html',
  styleUrl: './applicant-records.component.scss'
})
export class ApplicantRecordsComponent implements OnInit {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);
  private auth = inject(AuthService);

  /** Only Admin forwards; other roles view and add remarks (via the details popup). */
  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  records: ApplicantRecord[] = [];
  loading = true;
  errorMessage = '';
  searchTerm = '';
  selected: ApplicantRecord | null = null;
  forwarding: ApplicantRecord | null = null;
  /** Latest forward per application id */
  forwards = new Map<number, ForwardRecord>();
  infoMessage = '';

  ngOnInit(): void {
    this.load();
  }

  load(force = false): void {
    this.forwardService.latestByApplicant(force).subscribe({ next: (m) => (this.forwards = m), error: () => {} });
    this.loading = true;
    this.errorMessage = '';
    this.applicantService.getApplicants(force).subscribe({
      next: (list) => {
        this.records = list;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        // Say whether the server was unreachable (status 0) or failed (5xx), so the cause is visible on screen
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : err?.status === 0
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर रिफ़्रेश करें।'
              : `आवेदक सूची लोड नहीं हो सकी (त्रुटि ${err?.status ?? ''})। कृपया रिफ़्रेश करें।`;
      }
    });
  }

  get filtered(): ApplicantRecord[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.records;
    return this.records.filter(
      (r) =>
        r.applicationNo.toLowerCase().includes(q) ||
        r.applicantName.toLowerCase().includes(q) ||
        r.mobileNumber.includes(q) ||
        r.districtName.toLowerCase().includes(q)
    );
  }

  /** Forwarding is one-time: a forwarded application is locked. */
  forward(r: ApplicantRecord): void {
    if (this.forwards.has(r.id)) return;
    this.forwarding = r;
  }

  onForwarded(f: ForwardRecord): void {
    this.forwards = new Map(this.forwards).set(f.applicantId, f);
    const appNo = `आवेदन संख्या ${this.forwarding?.applicationNo || f.applicantId} (${this.forwarding?.applicantName})`;
    this.infoMessage =
      f.complaintTypeId === 'email'
        ? `${appNo} "${f.branchLabel}" को ईमेल (${f.complaintTypeLabel}) पर भेजा गया — डेमो, ईमेल सेवा अभी उपलब्ध नहीं; रिफ्रेश पर यह हट जाएगा। / Emailed to the department (demo only, not saved).`
        : `${appNo} "${f.branchLabel}" को अग्रेषित किया गया। / Forwarded successfully.`;
    this.forwarding = null;
    setTimeout(() => (this.infoMessage = ''), 5000);
  }

  /** "Village, Panchayat" without a stray comma when one is missing (village is optional). */
  joinNames(...names: string[]): string {
    return names.filter((n) => !!n?.trim()).join(', ') || '—';
  }

  openDetails(r: ApplicantRecord): void {
    this.selected = r;
  }

  openDoc(r: ApplicantRecord): void {
    if (r.documentBase64 && !openBase64Document(r.documentBase64)) {
      this.errorMessage = 'दस्तावेज़ खोला नहीं जा सका।';
    }
  }
}
