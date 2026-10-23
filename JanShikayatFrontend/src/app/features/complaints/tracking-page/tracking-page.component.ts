import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { ApplicantService } from '../../../core/services/applicant.service';
import { ForwardRecord, ForwardService } from '../../../core/services/forward.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ApplicantRecord,
  ApplicantRemark,
  ComplaintDetail,
  ComplaintListItem,
  ComplaintStatus
} from '../../../core/models/models';
import { statusLabel, sourceLabel, statusProgress } from '../../../core/utils/labels';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';

/** One live application (Tbl_Applicant_Details) plus its latest forward (Tbl_Applicant_Forward). */
export interface TrackedGrievanceItem extends ComplaintListItem {
  record: ApplicantRecord;
  forward: ForwardRecord | null;
  guardianName?: string;
  mobileNumber?: string;
  district?: string;
  block?: string;
  area?: string;
  policeStation?: string;
  category?: string;
  currentCustody: string;
  custodyOfficer: string;
  lifecycleStage: number; // 1 to 5
  hasPdf: boolean;
  pdfFileName?: string;
  pdfFileSize?: string;
}

/** Detail drawer data: the live record shaped like a ComplaintDetail, plus the tracked row it came from. */
type TrackedDetail = ComplaintDetail & { tracked: TrackedGrievanceItem };

/** Decode a base64 document (with or without a `data:` prefix) into a Blob; null if it cannot be read. */
function base64ToBlob(documentBase64: string): Blob | null {
  const [header, base64] = documentBase64.startsWith('data:')
    ? documentBase64.split(',')
    : ['data:application/pdf;base64', documentBase64];
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/pdf';
  try {
    return new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: mime });
  } catch {
    return null;
  }
}

/** File size of a base64 document without decoding it. */
function base64Size(documentBase64: string): string {
  const base64 = documentBase64.includes(',') ? documentBase64.split(',')[1] : documentBase64;
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ApplicantDetailsModalComponent],
  templateUrl: './tracking-page.component.html',
  styleUrl: './tracking-page.component.scss'
})
export class TrackingPageComponent implements OnInit, OnDestroy {
  private applicantService = inject(ApplicantService);
  private forwardService = inject(ForwardService);
  public auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  // Search and filter controls
  searchQuery = '';
  selectedStatus = '';
  selectedDistrict = '';
  selectedSource = '';
  viewMode: 'table' | 'cards' = 'table';

  // Lists & data
  /** Districts that actually have applications (names as stored in the district master) */
  districts: string[] = [];
  trackedList: TrackedGrievanceItem[] = [];
  filteredList: TrackedGrievanceItem[] = [];

  // State flags
  loading = false;
  searching = false;
  errorMessage = '';
  copiedId = '';
  toastMessage = '';

  // KPI Metrics
  totalCount = 0;
  pendingCount = 0;
  underEnquiryCount = 0;
  approvedCount = 0;

  // PDF Viewer Modal State
  showPdfModal = false;
  loadingPdf = false;
  activePdfComplaint: TrackedGrievanceItem | null = null;
  safePdfUrl: SafeResourceUrl | null = null;
  rawBlobUrl: string | null = null;
  currentDocName = '';
  currentDocSize = '';
  currentDocType = '';
  isFallbackDoc = false;

  // Detail Slideover Drawer
  showDetailDrawer = false;
  selectedDetail: TrackedDetail | null = null;
  loadingDetail = false;

  /** Full application popup (same one as अंतिम आवेदन), with remarks */
  detailsRecord: ApplicantRecord | null = null;

  /** Card / chip filters that cover several statuses — each matches what its KPI card counts */
  private readonly statusGroups: Record<string, string[]> = {
    PendingOrReview: ['Pending', 'UnderReview'],
    ForwardedOrEnquiry: ['ForwardedToDepartment', 'ForwardedForFieldEnquiry'],
    ActionTakenOrDisposed: ['ActionTaken', 'Disposed']
  };

  // Status mapping options
  statusOptions = [
    { value: '', label: 'सभी स्थितियां (All Statuses)' },
    { value: 'Pending', label: 'लंबित (Pending)' },
    { value: 'UnderReview', label: 'समीक्षाधीन (Under Review)' },
    { value: 'ForwardedToDepartment', label: 'विभाग को अग्रेषित (Forwarded)' },
    { value: 'ForwardedForFieldEnquiry', label: 'स्थलीय जांच (Field Enquiry)' },
    { value: 'ActionTaken', label: 'कार्रवाई संपन्न / स्वीकृत (Approved)' },
    { value: 'Disposed', label: 'निस्तारित (Disposed)' },
    { value: 'PendingOrReview', label: 'लंबित + समीक्षाधीन' },
    { value: 'ForwardedOrEnquiry', label: 'अग्रेषित + स्थलीय जांच' },
    { value: 'ActionTakenOrDisposed', label: 'स्वीकृत + निस्तारित' }
  ];

  statusLabel = statusLabel;
  sourceLabel = sourceLabel;
  statusProgress = statusProgress;

  ngOnInit(): void {
    // Listen to query params if tracking specific ID from elsewhere
    this.route.queryParams.subscribe((params) => {
      if (params['search']) {
        this.searchQuery = params['search'];
      }
      if (params['status']) {
        this.selectedStatus = params['status'];
      }
      this.loadComplaints();
    });
  }

  ngOnDestroy(): void {
    this.revokePdfUrl();
  }

  /** Live data: every finalised application with its latest forward. `force` skips the in-memory cache. */
  loadComplaints(force = false): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      records: this.applicantService.getApplicants(force),
      forwards: this.forwardService.latestByApplicant(force)
    }).subscribe({
      next: ({ records, forwards }) => {
        this.trackedList = records.map((r) => this.toTracked(r, forwards.get(r.id) ?? null));
        this.districts = [...new Set(records.map((r) => r.districtName).filter(Boolean))].sort();
        this.applyFilters();
        this.updateMetrics();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.trackedList = [];
        this.applyFilters();
        this.updateMetrics();
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : err?.status === 0
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर रिफ़्रेश करें।'
              : `परिवाद लोड नहीं हो सके (त्रुटि ${err?.status ?? ''})। कृपया रिफ़्रेश करें।`;
      }
    });
  }

  /**
   * The only workflow data recorded so far is the forward: not forwarded = लंबित at the entry desk,
   * forwarded = अग्रेषित to the chosen branch / section.
   */
  private toTracked(r: ApplicantRecord, forward: ForwardRecord | null): TrackedGrievanceItem {
    const status: ComplaintStatus = forward ? 'ForwardedToDepartment' : 'Pending';
    const place = [r.villageName, r.panchayatName].filter((n) => !!n?.trim()).join(', ');

    return {
      id: r.id,
      complaintNumber: r.applicationNo || String(r.id),
      applicantName: r.applicantName,
      subject: forward?.complaintTypeLabel || `${sourceLabel(r.applicationSource)} के माध्यम से प्राप्त परिवाद`,
      complaintDate: r.applicationDate ?? '',
      status,
      source: r.applicationSource || 'Offline',
      branchName: forward?.branchLabel ?? '',
      departmentName: forward?.categoryLabel ?? null,
      record: r,
      forward,
      guardianName: r.fatherHusbandName,
      mobileNumber: r.mobileNumber,
      district: r.districtName,
      block: r.blockName,
      area: place,
      policeStation: r.policeStation,
      category: forward?.categoryLabel || 'अग्रेषण हेतु लंबित',
      currentCustody: forward
        ? forward.branchLabel + (forward.prashakhaLabel ? ` → ${forward.prashakhaLabel}` : '')
        : 'प्रविष्टि कोषांग (अग्रेषण हेतु लंबित)',
      custodyOfficer: forward
        ? `अग्रेषित: ${new Date(forward.forwardedAt).toLocaleDateString('en-GB').replace(/\//g, '-')}`
        : 'एडमिन / प्रविष्टि सहायक',
      lifecycleStage: forward ? 3 : 1,
      hasPdf: !!r.documentBase64,
      pdfFileName: `Aavedan_${(r.applicationNo || String(r.id)).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      pdfFileSize: r.documentBase64 ? base64Size(r.documentBase64) : 'दस्तावेज़ नहीं'
    };
  }

  // ── Search & Filter Logic ──
  onSearch(): void {
    this.searching = true;
    setTimeout(() => {
      this.applyFilters();
      this.searching = false;
      this.showToast(`खोज परिणाम: ${this.filteredList.length} परिवाद मिले।`);
    }, 200);
  }

  onReset(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedDistrict = '';
    this.selectedSource = '';
    // Reset also pulls fresh data from the server
    this.loadComplaints(true);
    this.showToast('सभी फ़िल्टर रीसेट कर दिए गए हैं।');
  }

  quickFilter(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.trackedList];

    // Search query: matches application number, applicant name, mobile, subject, district
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      const normQ = q.replace(/[^a-zA-Z0-9]/g, '');

      result = result.filter((item) => {
        const itemNumber = item.complaintNumber.toLowerCase();
        const normItemNumber = itemNumber.replace(/[^a-zA-Z0-9]/g, '');
        const name = (item.applicantName || '').toLowerCase();
        const subject = (item.subject || '').toLowerCase();
        const mobile = (item.mobileNumber || '').toLowerCase();
        const district = (item.district || '').toLowerCase();

        return (
          itemNumber.includes(q) ||
          (!!normQ && normItemNumber.includes(normQ)) ||
          name.includes(q) ||
          subject.includes(q) ||
          mobile.includes(q) ||
          district.includes(q)
        );
      });
    }

    // Status filter
    if (this.selectedStatus) {
      const statuses = this.statusGroups[this.selectedStatus] ?? [this.selectedStatus];
      result = result.filter((item) => statuses.includes(item.status));
    }

    // District filter
    if (this.selectedDistrict) {
      result = result.filter((item) => item.district === this.selectedDistrict);
    }

    // Source filter
    if (this.selectedSource) {
      result = result.filter((item) => item.source === this.selectedSource);
    }

    this.filteredList = result;
  }

  private updateMetrics(): void {
    this.totalCount = this.trackedList.length;
    const count = (group: string) => this.trackedList.filter((c) => this.statusGroups[group].includes(c.status)).length;
    this.pendingCount = count('PendingOrReview');
    this.underEnquiryCount = count('ForwardedOrEnquiry');
    this.approvedCount = count('ActionTakenOrDisposed');
  }

  // ── PDF Popup Modal (the document saved with the application) ──
  openPdfModal(item: TrackedGrievanceItem): void {
    this.revokePdfUrl();
    this.activePdfComplaint = item;
    this.showPdfModal = true;
    this.currentDocName = item.pdfFileName || `आवेदन_${item.complaintNumber}.pdf`;
    this.currentDocSize = item.pdfFileSize || '';
    this.currentDocType = 'मूल आवेदन पत्र (PDF)';

    const blob = item.record.documentBase64 ? base64ToBlob(item.record.documentBase64) : null;
    this.isFallbackDoc = !blob;
    if (blob) {
      this.rawBlobUrl = URL.createObjectURL(blob);
      this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawBlobUrl);
    }
    this.loadingPdf = false;
  }

  closePdfModal(): void {
    this.showPdfModal = false;
    this.revokePdfUrl();
    this.activePdfComplaint = null;
  }

  private revokePdfUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.safePdfUrl = null;
  }

  downloadCurrentPdf(): void {
    if (this.rawBlobUrl) {
      const a = document.createElement('a');
      a.href = this.rawBlobUrl;
      a.download = this.currentDocName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast('दस्तावेज़ डाउनलोड प्रारंभ हो गया है।');
    } else {
      window.print();
    }
  }

  openPdfInNewTab(): void {
    if (this.rawBlobUrl) {
      window.open(this.rawBlobUrl, '_blank');
    } else {
      window.print();
    }
  }

  printCurrentPdf(): void {
    window.print();
  }

  // ── Detail Drawer: live record, forward and remarks ──
  openDetailDrawer(item: TrackedGrievanceItem): void {
    this.showDetailDrawer = true;
    this.loadingDetail = true;
    this.selectedDetail = this.toDetail(item, []);
    this.applicantService.getRemarks(item.id).subscribe({
      next: (remarks) => {
        if (this.selectedDetail?.id === item.id) this.selectedDetail = this.toDetail(item, remarks);
        this.loadingDetail = false;
      },
      error: () => (this.loadingDetail = false)
    });
  }

  private toDetail(item: TrackedGrievanceItem, remarks: ApplicantRemark[]): TrackedDetail {
    const r = item.record;
    const f = item.forward;
    const history = [
      {
        fromStatus: '',
        toStatus: 'Pending',
        reason: 'आवेदन पंजीकृत एवं अंतिम रूप से दर्ज किया गया।',
        actionByName: 'प्रविष्टि कोषांग',
        actionAt: r.applicationDate ?? ''
      },
      ...(f
        ? [
            {
              fromStatus: 'Pending',
              toStatus: 'ForwardedToDepartment',
              reason:
                [f.categoryLabel, f.branchLabel, f.prashakhaLabel, f.complaintTypeLabel].filter(Boolean).join(' → ') +
                (f.remarks ? ` — ${f.remarks}` : ''),
              actionByName: f.forwardedBy,
              actionAt: f.forwardedAt
            }
          ]
        : []),
      ...remarks.map((m) => ({
        fromStatus: '',
        toStatus: 'टिप्पणी',
        reason: m.remark,
        actionByName: m.remarkBy + (m.remarkByRole ? ` (${m.remarkByRole})` : ''),
        actionAt: m.createdDate
      }))
    ].sort((a, b) => new Date(a.actionAt).getTime() - new Date(b.actionAt).getTime());

    return {
      ...item,
      tracked: item,
      guardianName: r.fatherHusbandName,
      mobileNumber: r.mobileNumber,
      address: r.address,
      district: r.districtName,
      block: r.blockName,
      area: item.area,
      email: r.emailId,
      category: item.category ?? '',
      description: [r.address, item.area, r.pinCode && `पिन: ${r.pinCode}`].filter(Boolean).join(' • '),
      documents: [],
      remarks: remarks.map((m) => ({
        id: m.id,
        remarkType: m.remarkByRole ?? '',
        text: m.remark,
        createdByName: m.remarkBy,
        createdAt: m.createdDate
      })),
      history
    };
  }

  closeDetailDrawer(): void {
    this.showDetailDrawer = false;
    this.selectedDetail = null;
  }

  /** Full application popup (all fields + remarks), shared with अंतिम आवेदन */
  openDetailsModal(item: TrackedGrievanceItem): void {
    this.detailsRecord = item.record;
  }

  // ── Clipboard & Utilities ──
  copyTrackingId(id: string, event?: Event): void {
    if (event) event.stopPropagation();
    navigator.clipboard.writeText(id);
    this.copiedId = id;
    this.showToast(`ट्रैकिंग आईडी (${id}) कॉपी हो गई है!`);
    setTimeout(() => {
      if (this.copiedId === id) this.copiedId = '';
    }, 2500);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => {
      this.toastMessage = '';
    }, 3200);
  }
}
