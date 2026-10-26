import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicantRecord, ApplicantRemark } from '../../core/models/models';
import { ApplicantService } from '../../core/services/applicant.service';
import { openBase64Document, openBlobDocument } from '../../core/utils/document';

/** Must match MaxRemarkDocumentSize in ApplicantController. */
const MAX_REMARK_PDF_BYTES = 5 * 1024 * 1024;

/** Popup with every field of one saved application (from GET /Applicant/get-all), plus its remarks. */
@Component({
  selector: 'app-applicant-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './applicant-details-modal.component.html',
  styleUrl: './applicant-details-modal.component.scss'
})
export class ApplicantDetailsModalComponent implements OnChanges {
  private applicantService = inject(ApplicantService);

  /** The application to show; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  /** false: remarks are shown read-only (no box to add one). */
  @Input() allowRemark = true;
  @Output() closed = new EventEmitter<void>();

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
    if (!this.record) return;

    const id = this.record.id;
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
