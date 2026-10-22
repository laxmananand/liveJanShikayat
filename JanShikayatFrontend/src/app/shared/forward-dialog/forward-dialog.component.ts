import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApplicantRecord } from '../../core/models/models';
import { ForwardOption } from '../../core/config/forward-options';
import { ForwardRecord, ForwardService } from '../../core/services/forward.service';
import { MasterService } from '../../core/services/master.service';

/**
 * Forward popup: category → branch → complaint type (+ optional remark).
 * Options come from Mst_Category → Mst_Branch (Home/Section/Department_Categ) → Mst_Complain_Sub_Type.
 */
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
  private masterService = inject(MasterService);

  /** The application to forward; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() forwarded = new EventEmitter<ForwardRecord>();

  categories: ForwardOption[] = [];
  branches: ForwardOption[] = [];
  complaintTypes: ForwardOption[] = [];
  loadingCategories = false;
  loadingBranches = false;
  loadingTypes = false;
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
      this.branches = [];
      this.complaintTypes = [];
      this.submitting = false;
      this.errorMessage = '';
      this.loadCategories();
    }
  }

  private loadCategories(): void {
    this.loadingCategories = true;
    this.masterService.getForwardCategories().subscribe({
      next: (list) => {
        this.categories = list.map((c) => ({ id: String(c.category_Id), label: c.category }));
        this.loadingCategories = false;
      },
      error: () => {
        this.loadingCategories = false;
        this.errorMessage = 'श्रेणियाँ लोड नहीं हो सकीं। / Could not load categories.';
      }
    });
  }

  onCategoryChange(): void {
    const { categoryId, branchId, complaintTypeId } = this.form.controls;
    branchId.reset('');
    branchId.disable();
    complaintTypeId.reset('');
    complaintTypeId.disable();
    this.branches = [];
    this.complaintTypes = [];
    const selected = categoryId.value;
    if (!selected) return;

    this.loadingBranches = true;
    this.masterService.getBranchesByCategory(+selected).subscribe({
      next: (list) => {
        // Ignore a reply for a category that is no longer selected
        if (categoryId.value !== selected) return;
        this.branches = list.map((b) => ({ id: String(b.complain_id), label: `${b.branch_Hindi?.trim()} / ${b.branch_Eng}` }));
        this.loadingBranches = false;
        if (this.branches.length) branchId.enable();
      },
      error: () => {
        this.loadingBranches = false;
        this.errorMessage = 'शाखाएँ लोड नहीं हो सकीं। / Could not load branches.';
      }
    });
  }

  onBranchChange(): void {
    const { branchId, complaintTypeId } = this.form.controls;
    complaintTypeId.reset('');
    complaintTypeId.disable();
    this.complaintTypes = [];
    const selected = branchId.value;
    if (!selected) return;

    this.loadingTypes = true;
    this.masterService.getComplainSubTypes(+selected).subscribe({
      next: (list) => {
        if (branchId.value !== selected) return;
        this.complaintTypes = list.map((t) => ({ id: String(t.sub_Type_id), label: t.sub_Type }));
        this.loadingTypes = false;
        if (this.complaintTypes.length) complaintTypeId.enable();
      },
      error: () => {
        this.loadingTypes = false;
        this.errorMessage = 'शिकायत के प्रकार लोड नहीं हो सके। / Could not load complaint types.';
      }
    });
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

    const category = this.categories.find((c) => c.id === categoryId.value)!;
    const branch = this.branches.find((b) => b.id === branchId.value)!;
    const type = this.complaintTypes.find((t) => t.id === complaintTypeId.value)!;

    this.submitting = true;
    this.forwardService
      .forward({
        applicantId: this.record.id,
        categoryId: category.id,
        categoryLabel: category.label,
        branchId: branch.id,
        branchLabel: branch.label,
        complaintTypeId: type.id,
        complaintTypeLabel: type.label,
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
              : err?.status === 409
                ? 'यह आवेदन पहले ही अग्रेषित हो चुका है और लॉक है। / Already forwarded — locked.'
                : err?.status === 404
                ? 'आवेदन, शाखा या शिकायत का प्रकार मान्य नहीं है। / Application, branch or complaint type not found.'
                : 'अग्रेषण सहेजा नहीं जा सका। / Could not save the forward.';
        }
      });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record && !this.submitting) this.closed.emit();
  }
}
