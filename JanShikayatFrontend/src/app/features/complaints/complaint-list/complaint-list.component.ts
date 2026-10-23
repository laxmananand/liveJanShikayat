import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ApplicantRecord } from '../../../core/models/models';
import { statusLabel } from '../../../core/utils/labels';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';

/**
 * Real complaints from GET /Applicant/get-all. The API has no status or source yet,
 * so every application counts as "Pending" and as an offline (department) entry.
 */
const DEFAULT_STATUS = 'Pending';

@Component({
  selector: 'app-complaint-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent],
  templateUrl: './complaint-list.component.html',
  styleUrl: './complaint-list.component.scss'
})
export class ComplaintListComponent implements OnInit {
  private all: ApplicantRecord[] = [];
  complaints: ApplicantRecord[] = [];
  districts: string[] = [];
  loading = true;
  errorMessage = '';
  statusFilter = '';
  sourceFilter = '';
  districtFilter = '';
  searchTerm = '';
  selected: ApplicantRecord | null = null;

  statuses = [
    { value: '', label: 'सभी स्थितियां' },
    { value: 'Pending', label: 'लंबित' },
    { value: 'UnderReview', label: 'समीक्षाधीन' },
    { value: 'ForwardedToDepartment', label: 'विभाग को अग्रेषित' },
    { value: 'ForwardedForFieldEnquiry', label: 'क्षेत्रीय जांच हेतु अग्रेषित' },
    { value: 'ActionTaken', label: 'कार्रवाई की गई' },
    { value: 'Disposed', label: 'निष्पादित' }
  ];

  defaultStatus = DEFAULT_STATUS;
  statusLabel = statusLabel;

  constructor(
    private applicantService: ApplicantService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Filters live in the URL (dashboard tiles and the sidebar link to /complaints?status=… / ?source=…)
    this.route.queryParams.subscribe((params) => {
      this.statusFilter = params['status'] ?? '';
      this.sourceFilter = params['source'] ?? '';
      this.applyLocalFilters();
    });
    this.load();
  }

  get hasFilters(): boolean {
    return !!(this.statusFilter || this.districtFilter || this.searchTerm);
  }

  applyFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: this.statusFilter || null, source: this.sourceFilter || null }
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.districtFilter = '';
    this.applyFilters();
    this.applyLocalFilters();
  }

  load(force = false): void {
    this.loading = true;
    this.errorMessage = '';
    this.applicantService.getApplicants(force).subscribe({
      next: (list) => {
        this.all = list;
        this.districts = [...new Set(list.map((r) => r.districtName).filter(Boolean))].sort();
        this.loading = false;
        this.applyLocalFilters();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : 'शिकायतें लोड नहीं हो सकीं। कृपया सर्वर कनेक्शन जाँचें।';
      }
    });
  }

  /** get-all returns everything, so status / district / search are filtered here. */
  applyLocalFilters(): void {
    // No citizen (online) complaints come from this API yet
    if (this.sourceFilter === 'Online') {
      this.complaints = [];
      return;
    }
    const q = this.searchTerm.trim().toLowerCase();
    this.complaints = this.all.filter(
      (r) =>
        (!this.statusFilter || this.statusFilter === DEFAULT_STATUS) &&
        (!this.districtFilter || r.districtName === this.districtFilter) &&
        (!q ||
          String(r.id).includes(q) ||
          r.applicationNo.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.fatherHusbandName.toLowerCase().includes(q) ||
          r.mobileNumber.includes(q) ||
          r.districtName.toLowerCase().includes(q) ||
          r.blockName.toLowerCase().includes(q) ||
          r.villageName.toLowerCase().includes(q) ||
          r.policeStation.toLowerCase().includes(q))
    );
  }

  openComplaint(r: ApplicantRecord): void {
    this.selected = r;
  }
}
