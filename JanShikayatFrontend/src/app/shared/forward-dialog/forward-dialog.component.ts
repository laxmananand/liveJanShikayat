import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApplicantRecord } from '../../core/models/models';
import { FORWARD_CATEGORIES, ForwardCategory, ForwardOption } from '../../core/config/forward-options';
import { ForwardRecord, ForwardService } from '../../core/services/forward.service';

/** Forward popup: category → branch → complaint type (+ optional remark). */
@Component({
  selector: 'app-forward-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forward-dialog.component.html',
  styleUrl: './forward-dialog.component.scss'
})
export class ForwardDialogComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private forwardService = inject(ForwardService);

  /** The application to forward; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() forwarded = new EventEmitter<ForwardRecord>();

  categories = FORWARD_CATEGORIES;
  submitting = false;
  errorMessage = '';

  form = this.fb.group({
    categoryId: ['', Validators.required],
    branchId: [{ value: '', disabled: true }, Validators.required],
    complaintTypeId: [{ value: '', disabled: true }, Validators.required],
    remarks: ['', Validators.maxLength(500)]
  });

  ngOnChanges(): void {
    // Every time the popup opens it starts empty
    if (this.record) {
      this.form.reset({ categoryId: '', branchId: '', complaintTypeId: '', remarks: '' });
      this.form.controls.branchId.disable();
      this.form.controls.complaintTypeId.disable();
      this.submitting = false;
      this.errorMessage = '';
    }
  }

  get category(): ForwardCategory | undefined {
    return this.categories.find((c) => c.id === this.form.controls.categoryId.value);
  }

  get branches(): ForwardOption[] {
    return this.category?.branches ?? [];
  }

  get complaintTypes(): ForwardOption[] {
    return this.category?.complaintTypes ?? [];
  }

  label(o: ForwardOption): string {
    return `${o.hi} / ${o.en}`;
  }

  onCategoryChange(): void {
    const { branchId, complaintTypeId } = this.form.controls;
    branchId.reset('');
    complaintTypeId.reset('');
    complaintTypeId.disable();
    this.category ? branchId.enable() : branchId.disable();
  }

  onBranchChange(): void {
    const { branchId, complaintTypeId } = this.form.controls;
    complaintTypeId.reset('');
    branchId.value ? complaintTypeId.enable() : complaintTypeId.disable();
  }

  isInvalid(name: 'categoryId' | 'branchId' | 'complaintTypeId' | 'remarks'): boolean {
    const c = this.form.controls[name];
    return c.enabled && c.touched && c.invalid;
  }

  submit(): void {
    if (!this.record) return;
    // Disabled controls are skipped by form.valid, so check the cascade explicitly
    const { categoryId, branchId, complaintTypeId } = this.form.controls;
    this.form.markAllAsTouched();
    if (!categoryId.value || !branchId.value || !complaintTypeId.value || this.form.invalid) return;

    const category = this.category!;
    const branch = category.branches.find((b) => b.id === branchId.value)!;
    const type = category.complaintTypes.find((t) => t.id === complaintTypeId.value)!;

    this.submitting = true;
    this.forwardService
      .forward({
        applicantId: this.record.id,
        categoryId: category.id,
        categoryLabel: this.label(category),
        branchId: branch.id,
        branchLabel: this.label(branch),
        complaintTypeId: type.id,
        complaintTypeLabel: this.label(type),
        remarks: (this.form.controls.remarks.value ?? '').trim()
      })
      .subscribe({
        next: (saved) => {
          this.submitting = false;
          this.forwarded.emit(saved);
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage =
            err?.status === 403
              ? 'केवल एडमिन आवेदन अग्रेषित कर सकते हैं। / Only Admin can forward applications.'
              : 'अग्रेषण सहेजा नहीं जा सका। / Could not save the forward.';
        }
      });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record && !this.submitting) this.closed.emit();
  }
}
