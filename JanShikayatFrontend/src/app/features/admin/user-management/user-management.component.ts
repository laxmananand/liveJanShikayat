import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, RegisterUserPayload } from '../../../core/services/auth.service';
import { LookupService } from '../../../core/services/lookup.service';
import { Branch, Department } from '../../../core/models/models';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss'
})
export class UserManagementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private lookupService = inject(LookupService);

  branches: Branch[] = [];
  departments: Department[] = [];
  submitting = false;
  message = '';
  errorMessage = '';

  roles = [
    { value: 'BranchOfficer', label: 'शाखा अधिकारी', icon: 'fa-building-user', title: 'शाखा अधिकारी', help: 'अपनी शाखा में प्राप्त शिकायतें दर्ज करता है एवं PDF संलग्न करता है।' },
    { value: 'DepartmentHead', label: 'विभागाध्यक्ष', icon: 'fa-user-tie', title: 'विभागाध्यक्ष', help: 'विभाग को अग्रेषित एवं नागरिक पोर्टल से प्राप्त शिकायतों की समीक्षा, अग्रेषण व समापन।' },
    { value: 'CompetentAuthority', label: 'सक्षम प्राधिकारी', icon: 'fa-magnifying-glass-location', title: 'सक्षम प्राधिकारी', help: 'क्षेत्रीय जांच, जांच रिपोर्ट अपलोड एवं कार्रवाई दर्ज करता है।' },
    { value: 'SuperAdmin', label: 'सुपर एडमिन', icon: 'fa-user-shield', title: 'सुपर एडमिन', help: 'सभी शिकायतें (ऑनलाइन सहित) देखता है, खाते बनाता है और कोई भी कार्य कर सकता है।' }
  ];

  form = this.fb.group({
    fullName: ['', Validators.required],
    designation: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['BranchOfficer', Validators.required],
    branchId: [null as number | null],
    departmentId: [null as number | null]
  });

  ngOnInit(): void {
    this.lookupService.getBranches().subscribe((b) => (this.branches = b));
    this.lookupService.getDepartments().subscribe((d) => (this.departments = d));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.message = '';
    this.errorMessage = '';

    this.auth.register(this.form.value as RegisterUserPayload).subscribe({
      next: () => {
        this.submitting = false;
        this.message = `${this.form.value.email} के लिए खाता बनाया गया।`;
        this.form.reset({ role: 'BranchOfficer' });
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err.error?.errors?.join(', ') || err.error?.message || 'खाता नहीं बनाया जा सका।';
      }
    });
  }
}
