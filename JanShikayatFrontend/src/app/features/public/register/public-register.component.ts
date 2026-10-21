import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicService } from '../../../core/services/public.service';
import { LookupService } from '../../../core/services/lookup.service';
import { Captcha, Department, PublicComplaintCreated } from '../../../core/models/models';
import { BIHAR_DISTRICTS, COMPLAINT_CATEGORY_SUGGESTIONS } from '../../../core/utils/bihar';
import { PORTAL_CONTACT } from '../../../core/config/portal.config';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Citizen online complaint registration (public, no login). */
@Component({
  selector: 'app-public-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './public-register.component.html',
  styleUrl: './public-register.component.scss'
})
export class PublicRegisterComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private publicService = inject(PublicService);
  private lookupService = inject(LookupService);

  contact = PORTAL_CONTACT;
  districts = BIHAR_DISTRICTS;
  categories = COMPLAINT_CATEGORY_SUGGESTIONS;
  departments: Department[] = [];

  selectedFile: File | null = null;
  fileError = '';
  submitting = false;
  errorMessage = '';
  created: PublicComplaintCreated | null = null;
  copied = false;

  captcha: Captcha | null = null;
  captchaLoading = false;
  captchaError = false;
  private captchaTimer: ReturnType<typeof setTimeout> | null = null;

  form = this.fb.group({
    applicantName: ['', [Validators.required, Validators.maxLength(200)]],
    guardianName: ['', [Validators.required, Validators.maxLength(200)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    address: ['', [Validators.required, Validators.maxLength(300)]],
    district: ['', Validators.required],
    block: ['', [Validators.required, Validators.maxLength(100)]],
    policeStation: ['', Validators.maxLength(100)],
    area: ['', Validators.maxLength(100)],
    oppositeParty: ['', Validators.maxLength(200)],
    subject: ['', [Validators.required, Validators.maxLength(300)]],
    category: ['', [Validators.required, Validators.maxLength(150)]],
    subCategory: ['', Validators.maxLength(150)],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    departmentId: [null as number | null],
    captchaCode: ['', [Validators.required, Validators.maxLength(10)]],
    declaration: [false, Validators.requiredTrue]
  });

  ngOnInit(): void {
    this.lookupService.getDepartments().subscribe({
      next: (d) => (this.departments = d),
      error: () => (this.departments = [])
    });
    this.refreshCaptcha();
  }

  ngOnDestroy(): void {
    if (this.captchaTimer) clearTimeout(this.captchaTimer);
  }

  /** Loads a new CAPTCHA (each one is single-use and expires after a few minutes). */
  refreshCaptcha(): void {
    if (this.captchaTimer) clearTimeout(this.captchaTimer);
    this.captchaLoading = true;
    this.captchaError = false;
    this.form.controls.captchaCode.reset('');

    this.publicService.captcha().subscribe({
      next: (c) => {
        this.captcha = c;
        this.captchaLoading = false;
        // Swap in a fresh image shortly before this one expires on the server.
        this.captchaTimer = setTimeout(() => this.refreshCaptcha(), Math.max(c.expiresInSeconds - 10, 10) * 1000);
      },
      error: () => {
        this.captcha = null;
        this.captchaLoading = false;
        this.captchaError = true;
      }
    });
  }

  invalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && control.touched;
  }

  get descriptionLength(): number {
    return this.form.value.description?.length ?? 0;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError = '';
    this.selectedFile = null;
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.fileError = 'केवल PDF फ़ाइल ही संलग्न की जा सकती है।';
    } else if (file.size > MAX_PDF_BYTES) {
      this.fileError = 'फ़ाइल का आकार 10 MB से अधिक नहीं होना चाहिए।';
    } else {
      this.selectedFile = file;
    }
    input.value = '';
  }

  removeFile(): void {
    this.selectedFile = null;
  }

  submit(): void {
    if (this.form.invalid || !this.captcha) {
      this.form.markAllAsTouched();
      this.errorMessage = 'कृपया सभी आवश्यक (*) जानकारी सही-सही भरें।';
      document.querySelector('.ng-invalid[formControlName]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const { declaration, ...payload } = this.form.getRawValue();
    const captchaId = this.captcha!.captchaId;

    this.publicService
      .submitComplaint(
        {
          applicantName: payload.applicantName!,
          guardianName: payload.guardianName!,
          mobileNumber: payload.mobileNumber!,
          email: payload.email || undefined,
          address: payload.address!,
          district: payload.district!,
          block: payload.block!,
          policeStation: payload.policeStation || undefined,
          area: payload.area || undefined,
          oppositeParty: payload.oppositeParty || undefined,
          subject: payload.subject!,
          category: payload.category!,
          subCategory: payload.subCategory || undefined,
          description: payload.description!,
          departmentId: payload.departmentId,
          captchaId,
          captchaCode: payload.captchaCode!
        },
        this.selectedFile
      )
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.created = res;
          if (this.captchaTimer) clearTimeout(this.captchaTimer);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          // The server discards a CAPTCHA once it has been checked, so always get a new one.
          this.refreshCaptcha();
          if (err.error?.code === 'CAPTCHA_INVALID') {
            this.errorMessage = 'सुरक्षा कोड गलत है या उसकी समय-सीमा समाप्त हो गई है। कृपया नया कोड दर्ज करें।';
          } else if (err.status === 429) {
            this.errorMessage = 'कम समय में बहुत अधिक शिकायतें भेजी गई हैं। कृपया कुछ मिनट बाद पुनः प्रयास करें।';
          } else if (err.status === 400) {
            this.errorMessage = err.error?.message
              ? `शिकायत दर्ज नहीं हो सकी: ${err.error.message}`
              : 'शिकायत दर्ज नहीं हो सकी। कृपया फ़ॉर्म की जानकारी जांचें।';
          } else {
            this.errorMessage = 'सर्वर से संपर्क नहीं हो सका। कृपया कुछ देर बाद पुनः प्रयास करें।';
          }
        }
      });
  }

  copyNumber(): void {
    if (!this.created) return;
    navigator.clipboard?.writeText(this.created.complaintNumber).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2200);
    });
  }

  startNew(): void {
    this.created = null;
    this.selectedFile = null;
    this.form.reset({ departmentId: null, declaration: false, district: '' });
    this.refreshCaptcha();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
