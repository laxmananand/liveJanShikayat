import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ComplaintService } from '../../../core/services/complaint.service';
import { LookupService } from '../../../core/services/lookup.service';
import { AuthService } from '../../../core/services/auth.service';
import { Branch, Department } from '../../../core/models/models';
import { sourceLabel } from '../../../core/utils/labels';
import { BIHAR_DISTRICTS, COMPLAINT_CATEGORY_SUGGESTIONS } from '../../../core/utils/bihar';

@Component({
  selector: 'app-complaint-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './complaint-entry.component.html',
  styleUrl: './complaint-entry.component.scss'
})
export class ComplaintEntryComponent implements OnInit {
  private fb = inject(FormBuilder);
  private complaintService = inject(ComplaintService);
  private lookupService = inject(LookupService);
  private auth = inject(AuthService);
  private router = inject(Router);

  branches: Branch[] = [];
  departments: Department[] = [];
  submitting = false;
  errorMessage = '';
  selectedFile: File | null = null;

  sources = ['Offline', 'CPGRAMS', 'CMJaibodha', 'PMOGrievancePortal', 'Other'];
  sourceLabel = sourceLabel;
  districts = BIHAR_DISTRICTS;
  categories = COMPLAINT_CATEGORY_SUGGESTIONS;

  form = this.fb.group({
    applicantName: ['', Validators.required],
    guardianName: ['', Validators.required],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    email: [''],
    address: ['', Validators.required],
    district: ['', Validators.required],
    block: ['', Validators.required],
    policeStation: [''],
    area: [''],
    oppositeParty: [''],
    subject: ['', Validators.required],
    category: ['', Validators.required],
    subCategory: [''],
    description: ['', Validators.required],
    complaintDate: [new Date().toISOString().substring(0, 10), Validators.required],
    source: ['Offline', Validators.required],
    branchId: [null as number | null, Validators.required],
    departmentId: [null as number | null]
  });

  ngOnInit(): void {
    this.lookupService.getBranches().subscribe((b) => {
      this.branches = b;
      const userBranchId = this.auth.currentUser()?.branchId;
      if (userBranchId) {
        this.form.patchValue({ branchId: userBranchId });
      }
    });
    this.lookupService.getDepartments().subscribe((d) => (this.departments = d));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type !== 'application/pdf') {
        this.errorMessage = 'केवल पीडीएफ फ़ाइलें ही संलग्न की जा सकती हैं।';
        this.selectedFile = null;
        return;
      }
      this.errorMessage = '';
      this.selectedFile = file;
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const value = this.form.value;

    this.complaintService
      .create({
        applicantName: value.applicantName!,
        guardianName: value.guardianName!,
        mobileNumber: value.mobileNumber!,
        address: value.address!,
        district: value.district!,
        block: value.block!,
        policeStation: value.policeStation || undefined,
        area: value.area || undefined,
        email: value.email || undefined,
        oppositeParty: value.oppositeParty || undefined,
        subject: value.subject!,
        category: value.category!,
        subCategory: value.subCategory || undefined,
        description: value.description!,
        complaintDate: value.complaintDate ? new Date(value.complaintDate).toISOString() : undefined,
        source: value.source!,
        branchId: value.branchId!,
        departmentId: value.departmentId || undefined
      })
      .subscribe({
        next: (created) => {
          if (this.selectedFile) {
            this.complaintService.uploadDocument(created.id, this.selectedFile, 'Complaint').subscribe({
              next: () => this.router.navigate(['/complaints', created.id]),
              error: () => this.router.navigate(['/complaints', created.id])
            });
          } else {
            this.router.navigate(['/complaints', created.id]);
          }
        },
        error: () => {
          this.submitting = false;
          this.errorMessage = 'शिकायत दर्ज नहीं हो सकी। कृपया फ़ॉर्म जांचें और पुनः प्रयास करें।';
        }
      });
  }
}
