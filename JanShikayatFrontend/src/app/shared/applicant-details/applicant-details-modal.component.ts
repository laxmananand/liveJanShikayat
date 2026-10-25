import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicantRecord, ApplicantRemark } from '../../core/models/models';
import { ApplicantService } from '../../core/services/applicant.service';
import { openBase64Document } from '../../core/utils/document';

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

  ngOnChanges(): void {
    this.remarks = [];
    this.remarkText = '';
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
    this.applicantService.addRemark(this.record.id, text).subscribe({
      next: (saved) => {
        this.remarks = [...this.remarks, saved];
        this.remarkText = '';
        this.savingRemark = false;
      },
      error: () => {
        this.savingRemark = false;
        this.remarkError = 'टिप्पणी सहेजी नहीं जा सकी। / Could not save the remark.';
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
