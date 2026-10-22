import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApplicantRecord } from '../../core/models/models';
import { ForwardOption } from '../../core/config/forward-options';
import { ForwardRecord, ForwardService } from '../../core/services/forward.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Forward popup: category → branch → complaint type (+ optional remark).
 * "Section" first asks for a Prashakha (Mst_Prashakha); that Prashakha's login receives the application.
 * Options come from Mst_Category → Mst_Branch (Home/Section/District_Categ) → Mst_Complain_Sub_Type.
 * The "Department" category instead lists Mst_Departments and shows that department's email in step 3;
 * sending it by email is not built yet, so that forward is a frontend-only demo (nothing is saved).
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
  private auth = inject(AuthService);

  /** The application to forward; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() forwarded = new EventEmitter<ForwardRecord>();

  categories: ForwardOption[] = [];
  branches: ForwardOption[] = [];
  complaintTypes: ForwardOption[] = [];
  prashakhas: ForwardOption[] = [];
  loadingPrashakhas = false;
  loadingCategories = false;
  loadingBranches = false;
  loadingTypes = false;
  /** Department id → "email, email2" from Mst_Departments */
  private departmentEmails = new Map<string, string>();
  submitting = false;
  errorMessage = '';

  form = this.fb.group({
    categoryId: ['', Validators.required],
    prashakhaId: [{ value: '', disabled: true }, Validators.required],
    branchId: [{ value: '', disabled: true }, Validators.required],
    complaintTypeId: [{ value: '', disabled: true }, Validators.required],
    remarks: ['', Validators.maxLength(500)]
  });

  /** Mst_Category row whose targets are Mst_Departments (matched by name, as its Category_Id has changed before). */
  get isDepartment(): boolean {
    const c = this.categories.find((x) => x.id === this.form.controls.categoryId.value);
    return c?.label.trim().toLowerCase() === 'department';
  }

  /** Section forwards go to a Prashakha first (matched by name, like Department). */
  get isSection(): boolean {
    const c = this.categories.find((x) => x.id === this.form.controls.categoryId.value);
    return c?.label.trim().toLowerCase() === 'section';
  }

  /** Section adds the Prashakha step, so later steps shift by one. */
  get stepOffset(): number {
    return this.isSection ? 1 : 0;
  }

  ngOnChanges(): void {
    // Every time the popup opens it starts empty
    if (this.record) {
      this.form.reset({ categoryId: '', prashakhaId: '', branchId: '', complaintTypeId: '', remarks: '' });
      this.form.controls.prashakhaId.disable();
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
    const { categoryId, prashakhaId, branchId, complaintTypeId } = this.form.controls;
    prashakhaId.reset('');
    prashakhaId.disable();
    branchId.reset('');
    branchId.disable();
    complaintTypeId.reset('');
    complaintTypeId.disable();
    this.branches = [];
    this.complaintTypes = [];
    const selected = categoryId.value;
    if (!selected) return;

    if (this.isSection) this.loadPrashakhas();

    this.loadingBranches = true;
    if (this.isDepartment) {
      this.masterService.getDepartments().subscribe({
        next: (list) => {
          if (categoryId.value !== selected) return;
          this.branches = list.map((d) => ({ id: String(d.departmentId), label: d.departmentName }));
          this.departmentEmails = new Map(
            list.map((d) => [String(d.departmentId), [d.email, d.email2].filter((e): e is string => !!e?.trim()).join(', ')])
          );
          this.loadingBranches = false;
          if (this.branches.length) branchId.enable();
        },
        error: () => {
          this.loadingBranches = false;
          this.errorMessage = 'विभाग लोड नहीं हो सके। / Could not load departments.';
        }
      });
      return;
    }
    this.masterService.getBranchesByCategory(+selected).subscribe({
      next: (list) => {
        // Ignore a reply for a category that is no longer selected
        if (categoryId.value !== selected) return;
        this.branches = list.map((b) => ({ id: String(b.complain_id), label: `${b.branch_Hindi?.trim()} / ${b.branch_Eng}` }));
        this.loadingBranches = false;
        // Section: the branch is picked only after the Prashakha
        if (this.branches.length && (!this.isSection || prashakhaId.value)) branchId.enable();
      },
      error: () => {
        this.loadingBranches = false;
        this.errorMessage = 'शाखाएँ लोड नहीं हो सकीं। / Could not load branches.';
      }
    });
  }

  private loadPrashakhas(): void {
    const { prashakhaId } = this.form.controls;
    this.loadingPrashakhas = true;
    this.masterService.getPrashakhas().subscribe({
      next: (list) => {
        this.prashakhas = list.map((p) => ({ id: String(p.id), label: p.name }));
        this.loadingPrashakhas = false;
        if (this.isSection && this.prashakhas.length) prashakhaId.enable();
      },
      error: () => {
        this.loadingPrashakhas = false;
        this.errorMessage = 'प्रशाखा लोड नहीं हो सकीं। / Could not load Prashakhas.';
      }
    });
  }

  onPrashakhaChange(): void {
    const { prashakhaId, branchId } = this.form.controls;
    prashakhaId.value && this.branches.length ? branchId.enable() : branchId.disable();
  }

  onBranchChange(): void {
    const { branchId, complaintTypeId } = this.form.controls;
    complaintTypeId.reset('');
    complaintTypeId.disable();
    this.complaintTypes = [];
    const selected = branchId.value;
    if (!selected) return;

    // Department: step 3 is the department's email, filled in and read-only
    if (this.isDepartment) {
      const email = this.departmentEmails.get(selected) ?? '';
      if (email) {
        this.complaintTypes = [{ id: 'email', label: email }];
        complaintTypeId.setValue('email');
      }
      return;
    }

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

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return c.enabled && c.touched && c.invalid;
  }

  submit(): void {
    if (!this.record) return;
    // Disabled controls are skipped by form.valid, so check the cascade explicitly
    const { categoryId, prashakhaId, branchId, complaintTypeId } = this.form.controls;
    this.form.markAllAsTouched();
    if (!categoryId.value || !branchId.value || !complaintTypeId.value || this.form.invalid) return;
    if (this.isSection && !prashakhaId.value) return;
    const prashakha = this.isSection ? this.prashakhas.find((p) => p.id === prashakhaId.value) : undefined;

    const category = this.categories.find((c) => c.id === categoryId.value)!;
    const branch = this.branches.find((b) => b.id === branchId.value)!;
    const type = this.complaintTypes.find((t) => t.id === complaintTypeId.value)!;

    this.submitting = true;
    const remarks = (this.form.controls.remarks.value ?? '').trim();

    if (this.isDepartment) {
      // DEMO: the email service is not built yet, so nothing is sent or saved.
      // Replace with the real email/forward API when it exists.
      const demo: ForwardRecord = {
        applicantId: this.record.id,
        categoryId: category.id,
        categoryLabel: category.label,
        branchId: branch.id,
        branchLabel: branch.label,
        complaintTypeId: type.id,
        complaintTypeLabel: type.label,
        remarks,
        forwardedBy: this.auth.currentUser()?.fullName ?? '',
        forwardedAt: new Date().toISOString()
      };
      setTimeout(() => {
        this.submitting = false;
        this.forwarded.emit(demo);
      }, 600);
      return;
    }

    this.forwardService
      .forward({
        applicantId: this.record.id,
        categoryId: category.id,
        categoryLabel: category.label,
        branchId: branch.id,
        branchLabel: branch.label,
        complaintTypeId: type.id,
        complaintTypeLabel: type.label,
        remarks,
        prashakhaId: prashakha ? +prashakha.id : null,
        prashakhaLabel: prashakha?.label ?? null
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
                ? 'आवेदन, प्रशाखा, शाखा या शिकायत का प्रकार मान्य नहीं है। / Application, Prashakha, branch or complaint type not found.'
                : 'अग्रेषण सहेजा नहीं जा सका। / Could not save the forward.';
        }
      });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record && !this.submitting) this.closed.emit();
  }
}
