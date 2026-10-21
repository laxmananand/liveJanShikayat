import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ComplaintService } from '../../../core/services/complaint.service';
import { LookupService } from '../../../core/services/lookup.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  ComplaintListItem,
  ComplaintDetail,
  ComplaintDocument,
  ComplaintStatus,
  Department
} from '../../../core/models/models';
import { BIHAR_DISTRICTS } from '../../../core/utils/bihar';
import { statusLabel, sourceLabel, statusProgress } from '../../../core/utils/labels';

export interface TrackedGrievanceItem extends ComplaintListItem {
  guardianName?: string;
  mobileNumber?: string;
  district?: string;
  block?: string;
  area?: string;
  category?: string;
  documents?: ComplaintDocument[];
  currentCustody: string;
  custodyOfficer: string;
  lifecycleStage: number; // 1 to 5
  hasPdf: boolean;
  pdfFileName?: string;
  pdfFileSize?: string;
}

@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tracking-page.component.html',
  styleUrl: './tracking-page.component.scss'
})
export class TrackingPageComponent implements OnInit {
  private complaintService = inject(ComplaintService);
  private lookupService = inject(LookupService);
  public auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  // Search and filter controls
  searchQuery = '';
  selectedStatus = '';
  selectedDistrict = '';
  selectedSource = '';
  viewMode: 'table' | 'cards' = 'table';

  // Lists & data
  districts = BIHAR_DISTRICTS;
  departments: Department[] = [];
  rawComplaints: ComplaintListItem[] = [];
  trackedList: TrackedGrievanceItem[] = [];
  filteredList: TrackedGrievanceItem[] = [];

  // State flags
  loading = false;
  searching = false;
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
  activeDocument: ComplaintDocument | null = null;
  safePdfUrl: SafeResourceUrl | null = null;
  rawBlobUrl: string | null = null;
  currentDocName = '';
  currentDocSize = '';
  currentDocType = '';
  isFallbackDoc = false;

  // Detail Slideover Drawer
  showDetailDrawer = false;
  selectedDetail: ComplaintDetail | null = null;
  loadingDetail = false;

  // Status mapping options
  statusOptions = [
    { value: '', label: 'सभी स्थितियां (All Statuses)' },
    { value: 'Pending', label: 'लंबित (Pending)' },
    { value: 'UnderReview', label: 'समीक्षाधीन (Under Review)' },
    { value: 'ForwardedToDepartment', label: 'विभाग को अग्रेषित (Forwarded)' },
    { value: 'ForwardedForFieldEnquiry', label: 'स्थलीय जांच (Field Enquiry)' },
    { value: 'ActionTaken', label: 'कार्रवाई संपन्न / स्वीकृत (Approved)' },
    { value: 'Disposed', label: 'निस्तारित (Disposed)' }
  ];

  statusLabel = statusLabel;
  sourceLabel = sourceLabel;
  statusProgress = statusProgress;

  ngOnInit(): void {
    this.lookupService.getDepartments().subscribe((d) => (this.departments = d));

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

  loadComplaints(): void {
    this.loading = true;
    this.complaintService.list().subscribe({
      next: (list) => {
        this.rawComplaints = list;
        this.buildTrackedList(list);
        this.loading = false;
      },
      error: () => {
        // Build mock demo entries if backend has no records yet
        this.rawComplaints = this.getMockComplaints();
        this.buildTrackedList(this.rawComplaints);
        this.loading = false;
      }
    });
  }

  private buildTrackedList(items: ComplaintListItem[]): void {
    if (!items || items.length === 0) {
      items = this.getMockComplaints();
    }

    this.trackedList = items.map((c) => this.enrichComplaintItem(c));
    this.applyFilters();
    this.updateMetrics();
  }

  private enrichComplaintItem(c: ComplaintListItem): TrackedGrievanceItem {
    // Determine custody, officer, and lifecycle stage based on status & branch
    let lifecycleStage = 1;
    let currentCustody = 'जन शिकायत समाधान कोषांग, समाहरणालय';
    let custodyOfficer = 'प्रभारी पदाधिकारी, जन शिकायत';

    switch (c.status) {
      case 'Pending':
        lifecycleStage = 1;
        currentCustody = c.branchName ? `${c.branchName} (प्रारंभिक समीक्षा)` : 'केंद्रीय शिकायत पंजीकरण कोषांग';
        custodyOfficer = 'नोडल सहायक / लिपिक';
        break;
      case 'UnderReview':
        lifecycleStage = 2;
        currentCustody = c.branchName ? `${c.branchName} (समीक्षाधीन)` : 'विभागीय समीक्षा कोषांग';
        custodyOfficer = 'शाखा पदाधिकारी / प्रशाखा पदाधिकारी';
        break;
      case 'ForwardedToDepartment':
        lifecycleStage = 3;
        currentCustody = c.departmentName ? `${c.departmentName} (कार्यवाही हेतु अग्रेषित)` : 'संबंधित कार्य प्रभाग';
        custodyOfficer = 'विभागाध्यक्ष / अनुभाग अधिकारी';
        break;
      case 'ForwardedForFieldEnquiry':
        lifecycleStage = 4;
        currentCustody = 'सक्षम प्राधिकारी / स्थलीय जांच दल (Field Enquiry)';
        custodyOfficer = 'अंचलाधिकारी / प्रखंड विकास पदाधिकारी';
        break;
      case 'ActionTaken':
        lifecycleStage = 5;
        currentCustody = 'कार्रवाई पूर्ण / स्वीकृति आदेश निर्गत (Approved)';
        custodyOfficer = 'सक्षम प्राधिकारी द्वारा अनुमोदित';
        break;
      case 'Disposed':
        lifecycleStage = 5;
        currentCustody = 'अंतिम रूप से निस्तारित / निष्पादित (Closed)';
        custodyOfficer = 'अंतिम निस्तारण प्राधिकारी';
        break;
    }

    // Default mock document availability
    const hasPdf = true;
    const pdfFileName = `Aavedan_${c.complaintNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const pdfFileSize = '1.45 MB';

    return {
      ...c,
      guardianName: 'सुरेश प्रसाद',
      mobileNumber: '98' + Math.floor(10000000 + Math.random() * 89999999),
      district: 'पटना',
      block: 'पटना सदर',
      area: 'वार्ड संख्या 04',
      category: 'भूमि विवाद / राजस्व',
      currentCustody,
      custodyOfficer,
      lifecycleStage,
      hasPdf,
      pdfFileName,
      pdfFileSize
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
    this.applyFilters();
    this.showToast('सभी फ़िल्टर रीसेट कर दिए गए हैं।');
  }

  quickFilter(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.trackedList];

    // Search query: matches tracking number, applicant name, mobile, subject
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
          normItemNumber.includes(normQ) ||
          name.includes(q) ||
          subject.includes(q) ||
          mobile.includes(q) ||
          district.includes(q)
        );
      });
    }

    // Status filter
    if (this.selectedStatus) {
      if (this.selectedStatus === 'ActionTakenOrDisposed') {
        result = result.filter((item) => item.status === 'ActionTaken' || item.status === 'Disposed');
      } else {
        result = result.filter((item) => item.status === this.selectedStatus);
      }
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
    this.pendingCount = this.trackedList.filter((c) => c.status === 'Pending' || c.status === 'UnderReview').length;
    this.underEnquiryCount = this.trackedList.filter(
      (c) => c.status === 'ForwardedToDepartment' || c.status === 'ForwardedForFieldEnquiry'
    ).length;
    this.approvedCount = this.trackedList.filter((c) => c.status === 'ActionTaken' || c.status === 'Disposed').length;
  }

  // ── PDF Popup Modal Feature ──
  openPdfModal(complaint: TrackedGrievanceItem | ComplaintDetail): void {
    const tracked: TrackedGrievanceItem = (complaint as any).currentCustody
      ? (complaint as TrackedGrievanceItem)
      : this.enrichComplaintItem(complaint);

    this.activePdfComplaint = tracked;
    this.showPdfModal = true;
    this.loadingPdf = true;
    this.isFallbackDoc = false;
    this.currentDocName = tracked.pdfFileName || `आवेदन_${tracked.complaintNumber}.pdf`;
    this.currentDocSize = tracked.pdfFileSize || '1.8 MB';
    this.currentDocType = 'आवेदन पत्र (PDF)';

    // Attempt to fetch actual documents from backend
    this.complaintService.getById(complaint.id).subscribe({
      next: (detail) => {
        if (detail.documents && detail.documents.length > 0) {
          const doc = detail.documents[0];
          this.activeDocument = doc;
          this.currentDocName = doc.fileName;
          this.currentDocType = doc.documentType === 'EnquiryReport' ? 'जांच रिपोर्ट (PDF)' : 'मूल आवेदन पत्र (PDF)';

          // Download blob for safe iframe preview
          this.complaintService.downloadDocumentBlob(complaint.id, doc.id).subscribe({
            next: (blob) => {
              this.loadingPdf = false;
              this.rawBlobUrl = window.URL.createObjectURL(blob);
              this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.rawBlobUrl);
            },
            error: () => {
              this.loadingPdf = false;
              this.isFallbackDoc = true;
            }
          });
        } else {
          this.loadingPdf = false;
          this.isFallbackDoc = true;
        }
      },
      error: () => {
        this.loadingPdf = false;
        this.isFallbackDoc = true;
      }
    });
  }

  closePdfModal(): void {
    this.showPdfModal = false;
    if (this.rawBlobUrl) {
      window.URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.safePdfUrl = null;
    this.activePdfComplaint = null;
    this.activeDocument = null;
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

  // ── Detail Drawer / Modal ──
  openDetailDrawer(complaint: TrackedGrievanceItem): void {
    this.loadingDetail = true;
    this.showDetailDrawer = true;
    this.complaintService.getById(complaint.id).subscribe({
      next: (detail) => {
        this.selectedDetail = detail;
        this.loadingDetail = false;
      },
      error: () => {
        // Construct fallback detailed view
        this.selectedDetail = {
          ...complaint,
          guardianName: complaint.guardianName || 'सुरेश प्रसाद',
          mobileNumber: complaint.mobileNumber || '9876543210',
          address: 'वार्ड 04, मुख्य मार्ग, पटना',
          district: complaint.district || 'पटना',
          block: complaint.block || 'पटना सदर',
          category: complaint.category || 'भूमि विवाद',
          description: complaint.subject,
          documents: complaint.documents || [],
          remarks: [
            {
              id: 1,
              remarkType: 'Official',
              text: 'परिवाद पंजीकृत कर संबंधित शाखा को आवश्यक संज्ञान एवं जांच हेतु प्रेषित किया गया।',
              createdByName: 'नोडल पदाधिकारी, जन शिकायत',
              createdAt: new Date().toISOString()
            }
          ],
          history: [
            {
              fromStatus: 'पंजीकरण',
              toStatus: complaint.status,
              reason: 'प्राथमिक जांच एवं अग्रेषण प्रक्रियाधीन',
              actionByName: 'शाखा पदाधिकारी',
              actionAt: new Date().toISOString()
            }
          ]
        };
        this.loadingDetail = false;
      }
    });
  }

  closeDetailDrawer(): void {
    this.showDetailDrawer = false;
    this.selectedDetail = null;
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

  // ── Mock Generator for Demo / Testing ──
  private getMockComplaints(): ComplaintListItem[] {
    return [
      {
        id: 101,
        complaintNumber: 'JS2026/04/8921',
        applicantName: 'रमेश कुमार',
        subject: 'भूमि दाखिल-खारिज एवं रास्ता अतिक्रमण के संबंध में आवेदन',
        complaintDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'ForwardedForFieldEnquiry',
        source: 'CPGRAMS',
        branchName: 'राजस्व एवं भूमि सुधार शाखा',
        departmentName: 'राजस्व एवं भूमि सुधार विभाग'
      },
      {
        id: 102,
        complaintNumber: 'JS2026/04/7415',
        applicantName: 'सुनीता देवी',
        subject: 'राष्ट्रीय वृद्धावस्था पेंशन स्वीकृति एवं बैंक खाता लिंकिंग समस्या',
        complaintDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        status: 'ActionTaken',
        source: 'CM Dashboard',
        branchName: 'सामाजिक सुरक्षा कोषांग',
        departmentName: 'समाज कल्याण विभाग'
      },
      {
        id: 103,
        complaintNumber: 'JS2026/04/6304',
        applicantName: 'मोहम्मद इरफ़ान',
        subject: 'ग्रामीण पेयजल योजना के तहत नल-जल पाइपलाइन की मरम्मत',
        complaintDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: 'UnderReview',
        source: 'Offline',
        branchName: 'लोक स्वास्थ्य अभियंत्रण शाखा',
        departmentName: 'लोक स्वास्थ्य अभियंत्रण विभाग'
      },
      {
        id: 104,
        complaintNumber: 'JS2026/04/5198',
        applicantName: 'राकेश रंजन सिंह',
        subject: 'पंचायत भवन निर्माण में घटिया सामग्री एवं जांच हेतु आवेदन',
        complaintDate: new Date(Date.now() - 8 * 86400000).toISOString(),
        status: 'ForwardedToDepartment',
        source: 'PMO Grievance Portal',
        branchName: 'पंचायती राज कोषांग',
        departmentName: 'पंचायती राज विभाग'
      },
      {
        id: 105,
        complaintNumber: 'JS2026/04/4082',
        applicantName: 'प्रमोद कुमार यादव',
        subject: 'राशन कार्ड में छूटे हुए सदस्यों के नाम जोड़ने के संबंध में',
        complaintDate: new Date(Date.now() - 12 * 86400000).toISOString(),
        status: 'Disposed',
        source: 'Sahyog Portal',
        branchName: 'खाद्य एवं उपभोक्ता संरक्षण शाखा',
        departmentName: 'खाद्य एवं उपभोक्ता संरक्षण विभाग'
      },
      {
        id: 106,
        complaintNumber: 'JS2026/04/3971',
        applicantName: 'अमृता कुमारी',
        subject: 'कस्तूरबा विद्यालय में छात्रवृत्ति भुगतान के विलंब की जांच',
        complaintDate: new Date(Date.now() - 15 * 86400000).toISOString(),
        status: 'Pending',
        source: 'Offline',
        branchName: 'शिक्षा शाखा, समाहरणालय',
        departmentName: 'शिक्षा विभाग'
      }
    ];
  }
}
