import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ComplaintService } from '../../../core/services/complaint.service';
import { LookupService } from '../../../core/services/lookup.service';
import { AuthService } from '../../../core/services/auth.service';
import { CompetentAuthorityDesignation, ComplaintDetail, Department } from '../../../core/models/models';
import { statusLabel, sourceLabel, remarkTypeLabel, statusProgress } from '../../../core/utils/labels';
import { StatusFlowComponent } from '../../../shared/status-flow/status-flow.component';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';

@Component({
  selector: 'app-complaint-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, StatusFlowComponent],
  templateUrl: './complaint-detail.component.html',
  styleUrl: './complaint-detail.component.scss'
})
export class ComplaintDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private complaintService = inject(ComplaintService);
  private lookupService = inject(LookupService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);

  complaint: ComplaintDetail | null = null;
  loading = true;
  complaintId!: number;

  departments: Department[] = [];
  authorities: CompetentAuthorityDesignation[] = [];

  busy = false;
  message = '';
  private messageTimer?: ReturnType<typeof setTimeout>;
  errorMessage = '';
  reportFile: File | null = null;

  statusLabel = statusLabel;
  sourceLabel = sourceLabel;
  remarkTypeLabel = remarkTypeLabel;
  statusProgress = statusProgress;

  remarkForm = this.fb.group({
    remarkType: ['Enquiry', Validators.required],
    text: ['', [Validators.required, Validators.maxLength(3000)]]
  });

  forwardForm = this.fb.group({
    targetType: ['department', Validators.required], // 'department' | 'authority'
    departmentId: [null as number | null],
    competentAuthorityDesignationId: [null as number | null],
    reason: ['', Validators.required]
  });

  actionForm = this.fb.group({
    text: ['', [Validators.required, Validators.maxLength(3000)]]
  });

  closeForm = this.fb.group({
    closureRemarks: ['', [Validators.required, Validators.maxLength(1000)]]
  });

  ngOnInit(): void {
    this.complaintId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    this.lookupService.getDepartments().subscribe((d) => (this.departments = d));
    this.lookupService.getCompetentAuthorities().subscribe((a) => (this.authorities = a));
  }

  load(): void {
    this.loading = true;
    this.complaintService.getById(this.complaintId).subscribe({
      next: (c) => {
        this.complaint = c;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'शिकायत नहीं मिली या आपके पास इसे देखने की अनुमति नहीं है।';
      }
    });
  }

  get canAddRemarkOrForward(): boolean {
    return this.auth.hasRole('DepartmentHead', 'CompetentAuthority', 'SuperAdmin');
  }

  get canForward(): boolean {
    return this.auth.hasRole('DepartmentHead', 'SuperAdmin');
  }

  get canMarkActionTaken(): boolean {
    return this.auth.hasRole('CompetentAuthority', 'DepartmentHead', 'SuperAdmin');
  }

  get canClose(): boolean {
    return this.auth.hasRole('DepartmentHead', 'CompetentAuthority', 'SuperAdmin');
  }

  get isClosed(): boolean {
    return this.complaint?.status === 'Disposed';
  }

  onReportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.errorMessage = 'केवल पीडीएफ फ़ाइलें ही अपलोड की जा सकती हैं।';
        return;
      }
      this.reportFile = file;
      this.errorMessage = '';
    }
  }

  viewDocument(documentId: number): void {
    this.complaintService.downloadDocumentBlob(this.complaintId, documentId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => (this.errorMessage = 'दस्तावेज़ खोलने में विफल।')
    });
  }

  uploadReport(): void {
    if (!this.reportFile) return;
    this.busy = true;
    this.complaintService.uploadDocument(this.complaintId, this.reportFile, 'EnquiryReport').subscribe({
      next: () => {
        this.busy = false;
        this.reportFile = null;
        this.showMessage('रिपोर्ट सफलतापूर्वक अपलोड की गई।');
        this.load();
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'रिपोर्ट अपलोड करने में विफल।';
      }
    });
  }

  submitRemark(): void {
    if (this.remarkForm.invalid) {
      this.remarkForm.markAllAsTouched();
      return;
    }
    this.busy = true;
    const { remarkType, text } = this.remarkForm.value;
    this.complaintService.addRemark(this.complaintId, remarkType!, text!).subscribe({
      next: () => {
        this.busy = false;
        this.remarkForm.reset({ remarkType: 'Enquiry', text: '' });
        this.showMessage('टिप्पणी जोड़ी गई।');
        this.load();
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'टिप्पणी जोड़ने में विफल।';
      }
    });
  }

  submitForward(): void {
    if (this.forwardForm.invalid) {
      this.forwardForm.markAllAsTouched();
      return;
    }
    const { targetType, departmentId, competentAuthorityDesignationId, reason } = this.forwardForm.value;

    if (targetType === 'department' && !departmentId) {
      this.errorMessage = 'अग्रेषित करने हेतु विभाग चुनें।';
      return;
    }
    if (targetType === 'authority' && !competentAuthorityDesignationId) {
      this.errorMessage = 'अग्रेषित करने हेतु सक्षम प्राधिकारी चुनें।';
      return;
    }

    this.busy = true;
    this.complaintService
      .forward(this.complaintId, {
        departmentId: targetType === 'department' ? departmentId! : undefined,
        competentAuthorityDesignationId: targetType === 'authority' ? competentAuthorityDesignationId! : undefined,
        reason: reason!
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.forwardForm.reset({ targetType: 'department', reason: '' });
          this.showMessage('शिकायत अग्रेषित की गई।');
          this.load();
        },
        error: () => {
          this.busy = false;
          this.errorMessage = 'शिकायत अग्रेषित करने में विफल।';
        }
      });
  }

  submitActionTaken(): void {
    if (this.actionForm.invalid) {
      this.actionForm.markAllAsTouched();
      return;
    }
    this.busy = true;
    this.complaintService.markActionTaken(this.complaintId, this.actionForm.value.text!).subscribe({
      next: () => {
        this.busy = false;
        this.actionForm.reset();
        this.showMessage('कार्रवाई दर्ज की गई।');
        this.load();
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'कार्रवाई दर्ज करने में विफल।';
      }
    });
  }

  submitClose(): void {
    if (this.closeForm.invalid) {
      this.closeForm.markAllAsTouched();
      return;
    }
    this.busy = true;
    this.complaintService.close(this.complaintId, this.closeForm.value.closureRemarks!).subscribe({
      next: () => {
        this.busy = false;
        this.showMessage('प्रकरण बंद कर दिया गया।');
        this.load();
      },
      error: () => {
        this.busy = false;
        this.errorMessage = 'प्रकरण बंद करने में विफल।';
      }
    });
  }

  /** Success messages hide themselves after MESSAGE_DURATION_MS; a newer message restarts the timer. */
  private showMessage(message: string): void {
    clearTimeout(this.messageTimer);
    this.message = message;
    this.messageTimer = setTimeout(() => (this.message = ''), MESSAGE_DURATION_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.messageTimer);
  }
}
