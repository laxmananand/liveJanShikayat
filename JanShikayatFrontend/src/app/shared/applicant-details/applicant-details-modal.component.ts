import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicantRecord, ApplicantRemark, ForwardHop } from '../../core/models/models';
import { ApplicantService } from '../../core/services/applicant.service';
import { ForwardRecord, ForwardService, OFFICE_KIND } from '../../core/services/forward.service';
import { openBase64Document, openBlobDocument } from '../../core/utils/document';
import { applicationStatus, statusLabel } from '../../core/utils/labels';

/** Hindi name of a regional office kind, shown under the receiver in the forward history. */
const OFFICE_KIND_LABEL: Record<number, string> = {
  [OFFICE_KIND.Commissioner]: 'प्रमंडलीय आयुक्त',
  [OFFICE_KIND.DM]: 'जिलाधिकारी',
  [OFFICE_KIND.IG]: 'पुलिस महानिरीक्षक',
  [OFFICE_KIND.DIG]: 'पुलिस उप-महानिरीक्षक',
  [OFFICE_KIND.SP]: 'पुलिस अधीक्षक',
  [OFFICE_KIND.SDO]: 'अनुमंडल पदाधिकारी',
  [OFFICE_KIND.DCLR]: 'भूमि सुधार उप समाहर्ता',
  [OFFICE_KIND.SDPO]: 'पुलिस उपाधीक्षक / अनुमंडल पुलिस पदाधिकारी'
};

/** Closure details of a Disposed application (from ForwardRecord / ForwardResponse). */
export interface ApplicationClosureInfo {
  closedAt?: string | null;
  closedBy?: string | null;
  closureRemarks?: string | null;
}

/** Must match MaxRemarkDocumentSize in ApplicantController. */
const MAX_REMARK_PDF_BYTES = 5 * 1024 * 1024;

/**
 * Popup with every field of one saved application, its whole forward chain (Admin → office → DM / SP → …, loaded
 * from GET /Applicant/forward-history) shown level by level, and every remark with the office that wrote it.
 */
@Component({
  selector: 'app-applicant-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './applicant-details-modal.component.html',
  styleUrl: './applicant-details-modal.component.scss'
})
export class ApplicantDetailsModalComponent implements OnChanges {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);

  /** The application to show; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  /** false: remarks are shown read-only (no box to add one). */
  @Input() allowRemark = true;
  /** Set when Admin has closed the application: it is shown as Disposed and no remark can be added. */
  @Input() closure: ApplicationClosureInfo | null = null;
  /** The latest forward of this application, when there is one: shown as "Forwarding details". */
  @Input() forward: ForwardRecord | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly statusLabel = statusLabel;
  readonly applicationStatus = applicationStatus;

  /** Forward chain in tree order: each hop followed by the hops that continue it. */
  history: ForwardHop[] = [];
  historyLoading = false;
  historyError = '';

  /** Department forwards go by email: the "complaint type" then holds the address. */
  isEmailForward(f: ForwardRecord): boolean {
    return f.complaintTypeId === 'email';
  }

  /** The first forward (Admin → office) */
  get firstHop(): ForwardHop | null {
    return this.history.find((h) => h.level === 1) ?? null;
  }

  /** शाखा picked when forwarding */
  get branch(): string {
    return this.firstHop?.branchLabel || this.forward?.branchLabel || '';
  }

  get complaintType(): string {
    return this.firstHop?.complaintTypeLabel || this.forward?.complaintTypeLabel || '';
  }

  /** Receiver of the first forward when only the forward record is known */
  get forwardTo(): string {
    const f = this.forward;
    return f ? f.officeUnitLabel || f.officeLabel || f.prashakhaLabel || f.branchLabel || '' : '';
  }

  officeKind(h: ForwardHop): string {
    return h.toOfficeId != null ? OFFICE_KIND_LABEL[h.toOfficeId] ?? '' : '';
  }

  /** Disposed / Pending / Forwarded / Registered, as far as this popup knows */
  get status(): string {
    if (this.closure) return 'Disposed';
    if (this.forward) return this.applicationStatus(this.forward);
    return this.history.length ? 'Forwarded' : 'Registered';
  }

  /** Orders hops depth-first, so every hop sits right under the one it continues. */
  private toTree(hops: ForwardHop[]): ForwardHop[] {
    const children = new Map<string | null, ForwardHop[]>();
    const ids = new Set(hops.map((h) => h.id));
    for (const h of hops) {
      const parent = h.parentId && ids.has(h.parentId) ? h.parentId : null;
      children.set(parent, [...(children.get(parent) ?? []), h]);
    }
    const out: ForwardHop[] = [];
    const walk = (parent: string | null) => {
      for (const h of children.get(parent) ?? []) {
        out.push(h);
        walk(h.id);
      }
    };
    walk(null);
    return out;
  }

  remarks: ApplicantRemark[] = [];
  remarksLoading = false;
  remarkText = '';
  savingRemark = false;
  remarkError = '';
  /** Optional PDF attached to the remark being written. */
  remarkFile: File | null = null;
  /** Remark whose PDF is being downloaded. */
  openingDocId: number | null = null;

  ngOnChanges(): void {
    this.remarks = [];
    this.remarkText = '';
    this.remarkFile = null;
    this.remarkError = '';
    this.history = [];
    this.historyError = '';
    if (!this.record) return;

    const id = this.record.id;
    this.historyLoading = true;
    this.applicantService.getForwardHistory(id).subscribe({
      next: (hops) => {
        if (this.record?.id !== id) return;
        this.history = this.toTree(hops);
        this.historyLoading = false;
      },
      error: () => {
        if (this.record?.id !== id) return;
        this.historyLoading = false;
        this.historyError = 'अग्रेषण विवरण लोड नहीं हो सका। / Could not load the forward history.';
      }
    });

    this.remarksLoading = true;
    this.applicantService.getRemarks(id).subscribe({
      next: (list) => {
        if (this.record?.id !== id) return; // popup moved on to another record
        this.remarks = list;
        this.remarksLoading = false;
      },
      error: () => {
        this.remarksLoading = false;
        this.remarkError = 'टिप्पणियाँ लोड नहीं हो सकीं। / Could not load remarks.';
      }
    });
  }

  addRemark(): void {
    const text = this.remarkText.trim();
    if (!this.record || !text || this.savingRemark) return;

    this.savingRemark = true;
    this.remarkError = '';
    this.applicantService.addRemark(this.record.id, text, this.remarkFile).subscribe({
      next: (saved) => {
        this.remarks = [...this.remarks, saved];
        this.reloadRemarks(); // fills in the writer's office
        this.forwardService.invalidate();
        this.remarkText = '';
        this.remarkFile = null;
        this.savingRemark = false;
      },
      error: (err) => {
        this.savingRemark = false;
        this.remarkError = err?.error?.message || 'टिप्पणी सहेजी नहीं जा सकी। / Could not save the remark.';
      }
    });
  }

  private reloadRemarks(): void {
    const id = this.record?.id;
    if (!id) return;
    this.applicantService.getRemarks(id).subscribe({
      next: (list) => {
        if (this.record?.id === id) this.remarks = list;
      },
      error: () => {} // the remark is saved and already listed; only its office label is missing
    });
  }

  onRemarkFile(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    input.value = ''; // picking the same file again after removing it must still fire (change)
    this.remarkError = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.remarkError = 'केवल PDF फ़ाइल संलग्न करें। / Only PDF files can be attached.';
      return;
    }
    if (file.size > MAX_REMARK_PDF_BYTES) {
      this.remarkError = 'PDF 5 MB से छोटी होनी चाहिए। / PDF must be smaller than 5 MB.';
      return;
    }
    this.remarkFile = file;
  }

  viewRemarkDoc(m: ApplicantRemark): void {
    if (this.openingDocId) return;
    // Opened during the click, so the popup blocker allows it; filled once the PDF arrives
    const tab = window.open('', '_blank');
    this.openingDocId = m.id;
    this.applicantService.getRemarkDocument(m.id).subscribe({
      next: (blob) => {
        this.openingDocId = null;
        openBlobDocument(blob, tab);
      },
      error: () => {
        this.openingDocId = null;
        tab?.close();
        alert('दस्तावेज़ खोला नहीं जा सका।');
      }
    });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record) this.closed.emit();
  }

  openDoc(r: ApplicantRecord): void {
    if (r.documentBase64 && !openBase64Document(r.documentBase64)) {
      alert('दस्तावेज़ खोला नहीं जा सका।');
    }
  }
}
