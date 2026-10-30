import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, OtpSendResult } from '../../../core/services/auth.service';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';
import { DigitBoxesComponent } from '../../../shared/digit-boxes/digit-boxes.component';

const REMEMBER_KEY = 'js_login_email';
/** Matches AuthController.GenerateCaptcha (6 characters) */
const CAPTCHA_LENGTH = 6;
/** Matches OtpCodeStore (6-digit codes) */
const OTP_LENGTH = 6;
/** Indian mobile number, 10 digits without +91 or 0 (AuthController.NormalizeMobile) */
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

type LoginMode = 'password' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DigitBoxesComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.group({
    email: [this.rememberedEmail(), [Validators.required]],
    password: ['', Validators.required],
    remember: [!!this.rememberedEmail()],
    captcha: ['', [Validators.required, Validators.minLength(CAPTCHA_LENGTH)]]
  });

  // OTP login: mobile → SMS, then the OTP
  otpForm = this.fb.group({
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_PATTERN)]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  // After a password login without a mobile number: number → SMS, then the OTP (or skip)
  mobileForm = this.fb.group({
    mobile: ['', [Validators.required, Validators.pattern(MOBILE_PATTERN)]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  readonly captchaLength = CAPTCHA_LENGTH;
  readonly otpLength = OTP_LENGTH;

  mode: LoginMode = 'password';
  /** Signed in with a password, but Tbl_UserLogin.MobileNo is missing: the "add mobile" popup is open */
  showMobileModal = false;
  readonly mobileLength = 10;
  /** An OTP was sent for the current flow, so its OTP box is showing */
  otpSent = false;
  /** Seconds until another OTP may be asked for */
  resendIn = 0;
  private resendTimer?: ReturnType<typeof setInterval>;

  loading = false;
  errorMessage = '';
  infoMessage = '';
  private infoTimer?: ReturnType<typeof setTimeout>;
  showPassword = false;

  // Captcha served by the backend (GET /Auth/generate-captcha).
  captchaImage = '';
  captchaId = '';
  captchaLoading = false;

  constructor() {
    this.refreshCaptcha();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  refreshCaptcha(): void {
    this.captchaLoading = true;
    this.form?.get('captcha')?.reset('');
    this.auth.generateCaptcha().subscribe({
      next: (c) => {
        this.captchaId = c.captchaId;
        this.captchaImage = c.captchaImage;
        this.captchaLoading = false;
      },
      error: () => {
        this.captchaLoading = false;
        this.errorMessage = 'कैप्चा लोड नहीं हो सका। कृपया सर्वर कनेक्शन जाँचें।';
      }
    });
  }

  forgotPassword(): void {
    this.errorMessage = '';
    clearTimeout(this.infoTimer);
    this.infoMessage = 'पासवर्ड रीसेट हेतु अपने विभागीय प्रशासक (Super Admin) से संपर्क करें।';
    this.infoTimer = setTimeout(() => (this.infoMessage = ''), MESSAGE_DURATION_MS);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.infoMessage = '';
    this.loading = true;
    this.errorMessage = '';
    const { email, password, remember, captcha } = this.form.value;

    this.auth.login(email!, password!, this.captchaId, (captcha ?? '').trim()).subscribe({
      next: (res) => {
        this.loading = false;
        this.saveRemembered(remember ? email! : null);
        if (res.mobileRequired) {
          // Signed in already; ask for a mobile number before going on (the user may skip)
          this.showMobileModal = true;
          this.resetOtpState();
          setTimeout(() => document.getElementById('link-mobile')?.focus());
          return;
        }
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || err?.message || 'यूज़रनेम, पासवर्ड या कैप्चा गलत है।';
        this.refreshCaptcha();
        // A used captcha is never valid again, so put the cursor where the new one goes
        setTimeout(() => document.getElementById('captcha')?.focus());
      }
    });
  }

  setMode(mode: LoginMode): void {
    if (this.mode === mode || this.loading) return;
    this.mode = mode;
    this.errorMessage = '';
    this.infoMessage = '';
    this.resetOtpState();
    this.otpForm.reset({ mobile: '', otp: '' });
    // Only the password login has a captcha; it starts with a fresh one each time
    if (mode === 'password') this.refreshCaptcha();
  }

  // ── OTP login ──

  sendLoginOtp(): void {
    const mobile = this.otpForm.get('mobile')!;
    if (mobile.invalid) {
      mobile.markAsTouched();
      return;
    }
    this.requestOtp(this.auth.sendLoginOtp(mobile.value!), 'otp-code');
  }

  verifyLoginOtp(): void {
    const otp = this.otpForm.get('otp')!;
    if (otp.invalid) {
      otp.markAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.auth.loginWithOtp(this.otpForm.get('mobile')!.value!, otp.value!).subscribe({
      next: () => {
        this.loading = false;
        this.stopResendTimer();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.messageOf(err, 'OTP गलत है।');
        otp.reset('');
        setTimeout(() => document.getElementById('otp-code')?.focus());
      }
    });
  }

  /** Back to the mobile number to change it. */
  changeLoginMobile(): void {
    this.otpSent = false;
    this.errorMessage = '';
    this.otpForm.get('otp')!.reset('');
  }

  // ── Add mobile after a password login ──

  sendMobileOtp(): void {
    const mobile = this.mobileForm.get('mobile')!;
    if (mobile.invalid) {
      mobile.markAsTouched();
      return;
    }
    this.requestOtp(this.auth.sendMobileOtp(mobile.value!), 'mobile-otp');
  }

  verifyMobileOtp(): void {
    const otp = this.mobileForm.get('otp')!;
    if (otp.invalid) {
      otp.markAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.auth.verifyMobileOtp(this.mobileForm.get('mobile')!.value!, otp.value!).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.status) {
          this.errorMessage = res.message || 'OTP गलत है।';
          otp.reset('');
          return;
        }
        this.stopResendTimer();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.messageOf(err, 'मोबाइल नंबर सत्यापित नहीं हो सका।');
      }
    });
  }

  changeLinkMobile(): void {
    this.otpSent = false;
    this.errorMessage = '';
    this.mobileForm.get('otp')!.reset('');
  }

  /** "Skip for now": the number is asked for again at the next password login. */
  skipMobile(): void {
    if (this.loading) return;
    this.stopResendTimer();
    this.showMobileModal = false;
    this.router.navigate(['/dashboard']);
  }

  /** Digits only in the mobile / OTP boxes, as the user types or pastes. */
  digitsOnly(ctrl: AbstractControl | null | undefined, max: number): void {
    if (!ctrl) return;
    const clean = String(ctrl.value ?? '').replace(/\D/g, '').slice(0, max);
    if (clean !== ctrl.value) ctrl.setValue(clean);
  }

  private requestOtp(request: Observable<OtpSendResult>, focusId: string): void {
    this.loading = true;
    this.errorMessage = '';
    this.infoMessage = '';
    request.subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.status) {
          this.errorMessage = res.message || 'OTP नहीं भेजा जा सका।';
          if (res.retryAfter) this.startResendTimer(res.retryAfter);
          return;
        }
        this.otpSent = true;
        this.infoMessage = res.message;
        this.startResendTimer(res.retryAfter ?? 60);
        setTimeout(() => document.getElementById(focusId)?.focus());
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.status === 429
            ? 'बहुत अधिक प्रयास। कृपया एक मिनट बाद पुनः प्रयास करें।'
            : this.messageOf(err, 'OTP नहीं भेजा जा सका। कृपया सर्वर कनेक्शन जाँचें।');
      }
    });
  }

  private startResendTimer(seconds: number): void {
    this.stopResendTimer();
    this.resendIn = seconds;
    this.resendTimer = setInterval(() => {
      if (--this.resendIn <= 0) this.stopResendTimer();
    }, 1000);
  }

  private stopResendTimer(): void {
    clearInterval(this.resendTimer);
    this.resendIn = 0;
  }

  private resetOtpState(): void {
    this.otpSent = false;
    this.stopResendTimer();
  }

  private messageOf(err: any, fallback: string): string {
    return err?.error?.message || err?.message || fallback;
  }

  private rememberedEmail(): string {
    try {
      return localStorage.getItem(REMEMBER_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private saveRemembered(email: string | null): void {
    try {
      if (email) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* storage unavailable — ignore */
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.infoTimer);
    clearInterval(this.resendTimer);
  }
}
