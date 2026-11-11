import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicantRecord } from '../../core/models/models';
import { ClosureRecord, ForwardService } from '../../core/services/forward.service';

/**
 * "Close application" confirmation: an optional closing remark, then the application moves to Disposed (no more
 * remarks or forwards, SMS to the applicant). Used by Admin and the DM / SP it reached (Responses page) and by the
 * branch / section it was forwarded to (Forwarded Applications page). The server decides who may close.
 */
@Component({
  selector: 'app-close-application-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './close-application-dialog.component.html',
  styleUrl: './close-application-dialog.component.scss'
})
export class CloseApplicationDialogComponent implements OnChanges {
  private forwardService = inject(ForwardService);

  /** The application to close; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  @Output() cancelled = new EventEmitter<void>();
  @Output() closedApplication = new EventEmitter<ClosureRecord>();

  remarks = '';
  saving = false;
  errorMessage = '';

  ngOnChanges(): void {
    this.remarks = '';
    this.saving = false;
    this.errorMessage = '';
  }

  @HostListener('document:keydown.escape')
  cancel(): void {
    if (this.record && !this.saving) this.cancelled.emit();
  }

  confirm(): void {
    if (!this.record || this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.forwardService.closeApplication(this.record.id, this.remarks.trim()).subscribe({
      next: (c) => {
        this.saving = false;
        this.closedApplication.emit(c);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.message || 'आवेदन बंद नहीं हो सका। / Could not close the application.';
      }
    });
  }
}
