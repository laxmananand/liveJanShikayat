import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';

const REMEMBER_KEY = 'js_login_email';
/** Matches AuthController.GenerateCaptcha (6 characters) */
const CAPTCHA_LENGTH = 6;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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

  readonly captchaLength = CAPTCHA_LENGTH;

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
      next: () => {
        this.loading = false;
        this.saveRemembered(remember ? email! : null);
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
  }
}
