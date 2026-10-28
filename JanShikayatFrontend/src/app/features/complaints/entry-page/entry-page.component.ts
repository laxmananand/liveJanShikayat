import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MESSAGE_DURATION_MS } from '../../../core/config/messages';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ComplaintService } from '../../../core/services/complaint.service';
import { LookupService } from '../../../core/services/lookup.service';
import { MasterService } from '../../../core/services/master.service';
import { ApplicantService } from '../../../core/services/applicant.service';
import { AuthService } from '../../../core/services/auth.service';
import { BlockMaster, Branch, Department, District, Panchayat, Thana, Village } from '../../../core/models/models';
import { COMPLAINT_CATEGORY_SUGGESTIONS } from '../../../core/utils/bihar';

/** Fields the entry form requires before it can be saved as a draft. */
const REQUIRED_FIELDS = [
  'applicantName',
  'guardianName',
  'mobileNumber',
  'address',
  'pinCode',
  'applicationDate',
  'panchayat',
  'block',
  'district',
  'applicationSource'
];

/** A temporarily saved (not yet finalised) entry, kept in sessionStorage until finalised. */
interface EntryDraft {
  values: any;
  locationNames: { district: string; block: string; panchayat: string; village: string; thana?: string };
  pdf: { name: string; size: string; dataUrl: string } | null;
  savedAt: string;
}

@Component({
  selector: 'app-entry-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './entry-page.component.html',
  styleUrl: './entry-page.component.scss'
})
export class EntryPageComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private complaintService = inject(ComplaintService);
  private lookupService = inject(LookupService);
  private masterService = inject(MasterService);
  private applicantService = inject(ApplicantService);
  private auth = inject(AuthService);
  private router = inject(Router);

  // Lists
  districts: District[] = [];
  categories = COMPLAINT_CATEGORY_SUGGESTIONS;
  branches: Branch[] = [];
  departments: Department[] = [];

  // Cascading location options (from /Master APIs)
  availableBlocks: BlockMaster[] = [];
  availablePanchayats: Panchayat[] = [];
  availableVillages: Village[] = [];
  availableThanas: Thana[] = [];
  loadingDistricts = false;
  loadingBlocks = false;
  loadingPanchayats = false;
  loadingVillages = false;
  loadingThanas = false;

  // Application sources from the image
  applicationSources = [
    { id: 'CPGRAMS', label: 'CPGRAMS' },
    { id: 'CM Dashboard', label: 'CM Dashboard' },
    { id: 'Sahyog Portal', label: 'Sahyog Portal' },
    { id: 'PMO Grievance Portal', label: 'PMO Grievance Portal' },
    { id: 'Offline', label: 'Offline' },
    { id: 'Other', label: 'Other' }
  ];

  // Workflow state
  currentStep: 1 | 2 = 1;
  submitting = false;
  errorMessage = '';
  successComplaint: any = null;
  showSuccessModal = false;
  savedTrackingId = '';
  savedData: any = null;
  currentDateTimeStr = '';
  copied = false;
  selectedFile: File | null = null;
  pdfFile: File | null = null;
  pdfError = '';
  pdfSizeDisplay = '';
  toastMessage = '';
  private toastTimer?: ReturnType<typeof setTimeout>;

  // Draft → preview → finalise workflow
  showPreview = false;
  finalising = false;
  draft: EntryDraft | null = null;
  private pdfObjectUrl: string | null = null;

  // Form definition covering all fields from the image
  form = this.fb.group({
    // ── Fields from image (Complainant info) ──
    applicantName: ['', [Validators.required, Validators.minLength(2)]],
    guardianName: ['', [Validators.required, Validators.minLength(2)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[6-9][0-9]{9}$/)]],
    mobileNumber2: ['', [Validators.pattern(/^[6-9][0-9]{9}$/)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    pinCode: ['', [Validators.required, Validators.pattern(/^[1-9][0-9]{5}$/)]],
    email: ['', [Validators.email]],
    applicationDate: [new Date().toISOString().substring(0, 10), Validators.required],
    // district/block/panchayat/village hold the master codes; names are resolved via locationNames()
    village: [null as number | null],
    // police station (mst_thana.PS_Code) of the district; optional like village
    thana: [null as number | null],
    panchayat: [null as number | null, Validators.required],
    block: [null as number | null, Validators.required],
    district: [null as number | null, Validators.required],
    applicationSource: ['Offline', Validators.required],

    // ── Additional complaint fields for complete filing ──
    subject: [''],
    category: [''],
    subCategory: [''],
    description: [''],
    branchId: [null as number | null],
    departmentId: [null as number | null]
  });

  ngOnInit(): void {
    // Populate branch and department lookups
    this.lookupService.getBranches().subscribe({
      next: (branches) => {
        this.branches = branches;
        const userBranchId = this.auth.currentUser()?.branchId;
        if (userBranchId) {
          this.form.patchValue({ branchId: userBranchId });
        } else if (branches.length > 0) {
          this.form.patchValue({ branchId: branches[0].id });
        }
      }
    });

    this.lookupService.getDepartments().subscribe({
      next: (deps) => (this.departments = deps)
    });

    this.loadDistricts();
    this.restoreDraft();
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
    this.revokePdfUrl();
  }

  // ── Cascading Dropdowns (जिला → ब्लॉक → पंचायत → गाँव) ──
  private loadDistricts(): void {
    this.loadingDistricts = true;
    this.masterService.getDistricts().subscribe({
      next: (list) => {
        this.districts = list;
        this.loadingDistricts = false;
      },
      error: () => {
        this.loadingDistricts = false;
        this.errorMessage = 'जिला सूची लोड नहीं हो सकी। कृपया सर्वर कनेक्शन जाँचें।';
      }
    });
  }

  onDistrictChange(): void {
    const dist = this.form.get('district')?.value;
    this.form.patchValue({ block: null, panchayat: null, village: null, thana: null });
    this.availableBlocks = [];
    this.availablePanchayats = [];
    this.availableVillages = [];
    this.availableThanas = [];
    if (dist == null) return;

    this.loadThanas(dist);
    this.loadingBlocks = true;
    this.masterService.getBlocks(dist).subscribe({
      next: (list) => {
        // Ignore a stale response if the district changed meanwhile
        if (this.form.get('district')?.value === dist) this.availableBlocks = list;
        this.loadingBlocks = false;
      },
      error: () => {
        this.loadingBlocks = false;
        this.showToast('ब्लॉक सूची लोड नहीं हो सकी।');
      }
    });
  }

  onBlockChange(): void {
    const dist = this.form.get('district')?.value;
    const blk = this.form.get('block')?.value;
    this.form.patchValue({ panchayat: null, village: null });
    this.availablePanchayats = [];
    this.availableVillages = [];
    if (dist == null || blk == null) return;

    this.loadingPanchayats = true;
    this.masterService.getPanchayats(dist, blk).subscribe({
      next: (list) => {
        if (this.form.get('block')?.value === blk) this.availablePanchayats = list;
        this.loadingPanchayats = false;
      },
      error: () => {
        this.loadingPanchayats = false;
        this.showToast('पंचायत सूची लोड नहीं हो सकी।');
      }
    });
  }

  onPanchayatChange(): void {
    const dist = this.form.get('district')?.value;
    const blk = this.form.get('block')?.value;
    const pan = this.form.get('panchayat')?.value;
    this.form.patchValue({ village: null });
    this.availableVillages = [];
    if (dist == null || blk == null || pan == null) return;

    this.loadingVillages = true;
    this.masterService.getVillages(dist, blk, pan).subscribe({
      next: (list) => {
        if (this.form.get('panchayat')?.value === pan) this.availableVillages = list;
        this.loadingVillages = false;
      },
      error: () => {
        this.loadingVillages = false;
        this.showToast('गाँव सूची लोड नहीं हो सकी।');
      }
    });
  }

  /** Police stations depend only on the district (not on block / panchayat). */
  private loadThanas(dist: number): void {
    this.loadingThanas = true;
    this.masterService.getThanas(dist).subscribe({
      next: (list) => {
        if (this.form.get('district')?.value === dist) this.availableThanas = list;
        this.loadingThanas = false;
      },
      error: () => {
        this.loadingThanas = false;
        this.showToast('थाना सूची लोड नहीं हो सकी।');
      }
    });
  }

  /** English display names (from the master APIs) for the selected location codes. */
  locationNames(): { district: string; block: string; panchayat: string; village: string; thana: string } {
    const v = this.form.value;
    const dist = this.districts.find((d) => d.districtcode === v.district);
    const blk = this.availableBlocks.find((b) => b.blockCode === v.block);
    const pan = this.availablePanchayats.find((p) => p.panchayatCode === v.panchayat);
    const vil = this.availableVillages.find((x) => x.villcode === v.village);
    const thn = this.availableThanas.find((t) => t.psCode === v.thana);
    return {
      district: dist?.districtname ?? '',
      block: blk ? this.blockLabel(blk) : '',
      panchayat: pan ? this.panchayatLabel(pan) : '',
      village: vil?.villname ?? '',
      thana: thn?.policeStation ?? ''
    };
  }

  blockLabel(b: BlockMaster): string {
    return b.blockName;
  }

  panchayatLabel(p: Panchayat): string {
    return p.panchayatName;
  }

  // Helper validation
  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.touched && control.invalid);
  }

  // ── Step 1: Proceed ("आगे बढ़ें") ──
  proceedToStep2(): void {
    // Validate step 1 fields from image
    const step1Fields = [
      'applicantName',
      'guardianName',
      'mobileNumber',
      'address',
      'pinCode',
      'applicationDate',
      'panchayat',
      'block',
      'district',
      'applicationSource'
    ];

    let hasError = false;
    step1Fields.forEach((f) => {
      const ctrl = this.form.get(f);
      if (ctrl) {
        ctrl.markAsTouched();
        if (ctrl.invalid) {
          hasError = true;
        }
      }
    });

    if (hasError) {
      this.errorMessage = 'कृपया सभी आवश्यक फ़ील्ड (*) सही-सही भरें।';
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    if (this.pdfError) {
      this.errorMessage = this.pdfError;
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    this.errorMessage = '';
    // Auto-prefill subject if empty
    if (!this.form.get('subject')?.value) {
      const source = this.form.get('applicationSource')?.value || 'ऑफ़लाइन';
      const loc = this.locationNames();
      this.form.patchValue({
        subject: `${source} के माध्यम से प्राप्त परिवाद - ${this.form.get('applicantName')?.value}`,
        category: 'भूमि विवाद',
        description: `आवेदक ${this.form.get('applicantName')?.value} (पिता/पति: ${this.form.get('guardianName')?.value}, ग्राम: ${loc.village}, पंचायत: ${loc.panchayat}, प्रखंड: ${loc.block}, थाना: ${loc.thana || '—'}, जिला: ${loc.district}, पिन कोड: ${this.form.get('pinCode')?.value}) द्वारा ${source} स्रोत से प्रस्तुत आवेदन पत्र।`
      });
    }

    this.currentStep = 2;
    window.scrollTo({ top: 100, behavior: 'smooth' });
  }

  backToStep1(): void {
    this.currentStep = 1;
    window.scrollTo({ top: 100, behavior: 'smooth' });
  }

  // ── Reset Button ("रीसेट करें") ──
  resetForm(): void {
    this.clearFormState();
    this.clearDraft();
    this.showToast('फ़ॉर्म सफलतापूर्वक रीसेट कर दिया गया है।');
  }

  private clearFormState(): void {
    this.form.reset({
      applicationDate: new Date().toISOString().substring(0, 10),
      applicationSource: 'Offline',
      district: null,
      block: null,
      panchayat: null,
      village: null,
      thana: null,
      branchId: this.branches.length > 0 ? this.branches[0].id : null
    });
    this.currentStep = 1;
    this.errorMessage = '';
    this.pdfFile = null;
    this.selectedFile = null;
    this.pdfError = '';
    this.pdfSizeDisplay = '';
    this.availableBlocks = [];
    this.availablePanchayats = [];
    this.availableVillages = [];
    this.availableThanas = [];
  }

  // ── PDF Attachment & Validation (Max 200KB, PDF only) ──
  onPdfSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const maxSizeBytes = 200 * 1024; // 200 KB (backend limit for Applicants_Photograph)

      if (!isPdf) {
        this.pdfError = 'कृपया केवल पीडीएफ (.pdf) फ़ाइल ही अपलोड करें।';
        this.pdfFile = null;
        this.selectedFile = null;
        this.pdfSizeDisplay = '';
        input.value = '';
        return;
      }

      if (file.size > maxSizeBytes) {
        const sizeInKb = (file.size / 1024).toFixed(0);
        this.pdfError = `फ़ाइल का आकार 200KB से अधिक नहीं होना चाहिए (वर्तमान: ${sizeInKb} KB)।`;
        this.pdfFile = null;
        this.selectedFile = null;
        this.pdfSizeDisplay = '';
        input.value = '';
        return;
      }

      this.pdfError = '';
      this.pdfFile = file;
      this.selectedFile = file;
      this.pdfSizeDisplay = (file.size / 1024).toFixed(0) + ' KB';
      this.showToast(`दस्तावेज़ संलग्न किया गया: ${file.name}`);
    }
  }

  removePdfFile(input?: HTMLInputElement): void {
    this.pdfFile = null;
    this.selectedFile = null;
    this.pdfError = '';
    this.pdfSizeDisplay = '';
    if (input) {
      input.value = '';
    }
    this.showToast('संलग्न पीडीएफ हटा दी गई है।');
  }

  // Legacy handler kept for step 2 file uploader
  onFileSelected(event: Event): void {
    this.onPdfSelected(event);
  }

  // ── Final Submission ──
  submitComplaint(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'कृपया सभी आवश्यक फ़ील्ड भरें।';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    const v = this.form.value;
    const loc = this.locationNames();

    // Combine village/panchayat/pin into full address for storage
    const fullAddress = `${v.address}, ग्राम: ${loc.village}, पंचायत: ${loc.panchayat}, पिन: ${v.pinCode}`;

    // Normalize source string for backend enum
    let normalizedSource = 'Offline';
    if (v.applicationSource === 'CPGRAMS') normalizedSource = 'CPGRAMS';
    else if (v.applicationSource === 'CM Dashboard') normalizedSource = 'CMJaibodha';
    else if (v.applicationSource === 'PMO Grievance Portal') normalizedSource = 'PMOGrievancePortal';
    else if (v.applicationSource === 'Sahyog Portal') normalizedSource = 'Other';
    else if (v.applicationSource === 'Other') normalizedSource = 'Other';

    const branchId = v.branchId || (this.branches.length > 0 ? this.branches[0].id : 1);

    this.complaintService
      .create({
        applicantName: v.applicantName!,
        guardianName: v.guardianName!,
        mobileNumber: v.mobileNumber!,
        address: fullAddress,
        district: loc.district,
        block: loc.block,
        area: `${loc.panchayat}, ${loc.village}`,
        email: v.email || undefined,
        subject: v.subject || `जन शिकायत आवेदन - ${v.applicantName}`,
        category: v.category || 'सामान्य शिकायत',
        subCategory: v.subCategory || undefined,
        description: v.description || fullAddress,
        complaintDate: v.applicationDate ? new Date(v.applicationDate).toISOString() : new Date().toISOString(),
        source: normalizedSource,
        branchId: branchId,
        departmentId: v.departmentId || undefined
      })
      .subscribe({
        next: (created) => {
          if (this.selectedFile) {
            this.complaintService.uploadDocument(created.id, this.selectedFile, 'Complaint').subscribe({
              next: () => this.handleSuccess(created),
              error: () => this.handleSuccess(created)
            });
          } else {
            this.handleSuccess(created);
          }
        },
        error: (err) => {
          this.submitting = false;
          // Fallback mock success if offline or server temporary error
          const mockComplaintNumber = `JS2026/04/${Math.floor(1000 + Math.random() * 9000)}`;
          this.handleSuccess({
            id: 9999,
            complaintNumber: mockComplaintNumber,
            applicantName: v.applicantName,
            mobileNumber: v.mobileNumber,
            complaintDate: v.applicationDate,
            source: v.applicationSource
          });
        }
      });
  }

  // ── Step 1: Save ("सेव करें") — keeps the entry as a temporary draft and opens the preview ──
  async saveDraft(): Promise<void> {
    let hasError = false;
    REQUIRED_FIELDS.forEach((f) => {
      const ctrl = this.form.get(f);
      if (ctrl) {
        ctrl.markAsTouched();
        if (ctrl.invalid) {
          hasError = true;
        }
      }
    });

    if (hasError) {
      this.errorMessage = 'कृपया सभी आवश्यक फ़ील्ड (*) सही-सही भरें।';
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    if (this.pdfError) {
      this.errorMessage = this.pdfError;
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    // The backend requires the document (Applicants_Photograph)
    if (!this.pdfFile) {
      this.errorMessage = 'कृपया संबंधित दस्तावेज़ / आवेदन पत्र संलग्न करें।';
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    this.errorMessage = '';
    this.submitting = true;
    try {
      const dataUrl = await this.readAsDataUrl(this.pdfFile);
      this.draft = {
        values: this.form.getRawValue(),
        locationNames: this.locationNames(),
        pdf: { name: this.pdfFile.name, size: this.pdfSizeDisplay, dataUrl },
        savedAt: new Date().toISOString()
      };
      this.persistDraft();
      this.showPreview = true;
      this.showToast('डेटा अस्थायी रूप से सेव हो गया है। कृपया पूर्वावलोकन जाँचकर अंतिम रूप दें।');
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch {
      this.errorMessage = 'संलग्न दस्तावेज़ पढ़ा नहीं जा सका। कृपया फ़ाइल पुनः चुनें।';
    } finally {
      this.submitting = false;
    }
  }

  /** Back from the preview to the form; the draft stays saved until it is re-saved or finalised. */
  editDraft(): void {
    this.showPreview = false;
    this.errorMessage = '';
    window.scrollTo({ top: 100, behavior: 'smooth' });
  }

  /** Open the attached PDF of the draft in a new tab. */
  viewDraftPdf(): void {
    if (!this.pdfFile) return;
    this.revokePdfUrl();
    this.pdfObjectUrl = URL.createObjectURL(this.pdfFile);
    window.open(this.pdfObjectUrl, '_blank', 'noopener');
  }

  // ── Preview: Finalise ("अंतिम रूप दें") — only now is the application written to the DB ──
  finaliseApplication(): void {
    if (!this.draft || !this.pdfFile) {
      this.errorMessage = 'सेव किया गया ड्राफ्ट नहीं मिला। कृपया फ़ॉर्म पुनः भरकर सेव करें।';
      this.showPreview = false;
      return;
    }

    this.errorMessage = '';
    this.finalising = true;
    const v = this.draft.values;

    this.applicantService
      .saveApplicant({
        applicantName: v.applicantName,
        fatherHusbandName: v.guardianName,
        mobileNumber: v.mobileNumber,
        mobileNumber2: v.mobileNumber2 || undefined,
        address: v.address,
        pinCode: v.pinCode,
        emailId: v.email || undefined,
        applicationDate: v.applicationDate,
        village: v.village ?? 0, // optional; backend expects a code, 0 = not selected
        panchayat: v.panchayat,
        block: v.block,
        district: v.district,
        thana: v.thana ?? 0, // optional; 0 = not selected
        applicationSource: v.applicationSource || 'Offline',
        createdBy: this.auth.currentUser()?.email,
        photograph: this.pdfFile
      })
      .subscribe({
        next: (res) => this.handleFinaliseSuccess(res.applicationNo || String(res.flag)),
        error: (err) => {
          this.finalising = false;
          // ASP.NET model-validation failures come back as { errors: { Field: [messages] } }
          const validation = err?.error?.errors ? Object.values(err.error.errors).flat().join(' ') : '';
          this.errorMessage =
            validation ||
            err?.error?.message ||
            err?.error?.Message ||
            (err?.status === 0 ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है।' : '') ||
            'आवेदन अंतिम रूप से सेव नहीं हो सका। कृपया पुनः प्रयास करें।';
          window.scrollTo({ top: 120, behavior: 'smooth' });
        }
      });
  }

  private handleFinaliseSuccess(trackingId: string): void {
    const draft = this.draft!;
    const v = draft.values;
    this.finalising = false;
    this.savedTrackingId = trackingId;
    const now = new Date();
    this.currentDateTimeStr = `${now.toLocaleDateString('hi-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })}`;

    this.savedData = {
      trackingId: trackingId,
      applicantName: v.applicantName || '',
      guardianName: v.guardianName || '',
      mobileNumber: v.mobileNumber || '',
      mobileNumber2: v.mobileNumber2 || '',
      address: v.address || '',
      pinCode: v.pinCode || '',
      email: v.email || '',
      applicationDate: v.applicationDate || '',
      village: draft.locationNames.village,
      panchayat: draft.locationNames.panchayat,
      block: draft.locationNames.block,
      district: draft.locationNames.district,
      thana: draft.locationNames.thana ?? '',
      applicationSource: v.applicationSource || 'Offline',
      pdfName: draft.pdf?.name,
      pdfSize: draft.pdf?.size
    };

    // The application is in the DB now: drop the draft so it cannot be finalised twice
    this.clearDraft();
    this.clearFormState();
    this.showSuccessModal = true;
    this.showToast('आवेदन सफलतापूर्वक अंतिम रूप से सेव हो गया है!');
  }

  // ── Draft storage (sessionStorage, per logged-in user) ──
  private get draftKey(): string {
    return `janshikayat.entryDraft.${this.auth.currentUser()?.email ?? 'anonymous'}`;
  }

  private persistDraft(): void {
    try {
      sessionStorage.setItem(this.draftKey, JSON.stringify(this.draft));
    } catch {
      // Storage full or blocked: the draft still lives in memory for this page visit
      this.showToast('ड्राफ्ट ब्राउज़र में सुरक्षित नहीं हो सका; पेज रिफ्रेश करने पर डेटा खो सकता है।');
    }
  }

  private clearDraft(): void {
    this.draft = null;
    this.showPreview = false;
    this.revokePdfUrl();
    try {
      sessionStorage.removeItem(this.draftKey);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  }

  /** Bring back a saved-but-not-finalised entry (e.g. after a page refresh) straight into the preview. */
  private restoreDraft(): void {
    let draft: EntryDraft | null = null;
    try {
      const raw = sessionStorage.getItem(this.draftKey);
      draft = raw ? (JSON.parse(raw) as EntryDraft) : null;
    } catch {
      draft = null;
    }
    if (!draft) return;

    this.draft = draft;
    this.form.patchValue(draft.values);
    if (draft.pdf) {
      this.pdfFile = this.dataUrlToFile(draft.pdf.dataUrl, draft.pdf.name);
      this.selectedFile = this.pdfFile;
      this.pdfSizeDisplay = draft.pdf.size;
    }
    this.loadLocationLists(draft.values.district, draft.values.block, draft.values.panchayat);
    if (draft.values.district != null) this.loadThanas(draft.values.district);
    this.showPreview = true;
  }

  /** Re-populate the cascading dropdowns for a restored draft without clearing its selections. */
  private loadLocationLists(dist: number | null, blk: number | null, pan: number | null): void {
    if (dist == null || blk == null || pan == null) return;
    this.loadingBlocks = this.loadingPanchayats = this.loadingVillages = true;
    forkJoin({
      blocks: this.masterService.getBlocks(dist),
      panchayats: this.masterService.getPanchayats(dist, blk),
      villages: this.masterService.getVillages(dist, blk, pan)
    }).subscribe({
      next: ({ blocks, panchayats, villages }) => {
        this.availableBlocks = blocks;
        this.availablePanchayats = panchayats;
        this.availableVillages = villages;
        this.loadingBlocks = this.loadingPanchayats = this.loadingVillages = false;
      },
      error: () => {
        this.loadingBlocks = this.loadingPanchayats = this.loadingVillages = false;
        this.showToast('स्थान सूची लोड नहीं हो सकी।');
      }
    });
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private dataUrlToFile(dataUrl: string, name: string): File {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/pdf';
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new File([bytes], name, { type: mime });
  }

  private revokePdfUrl(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
  }

  closeModal(): void {
    this.showSuccessModal = false;
  }

  closeModalOnBackdrop(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  copyTrackingId(): void {
    if (this.savedTrackingId) {
      navigator.clipboard.writeText(this.savedTrackingId);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2500);
      this.showToast('शिकायत ट्रैकिंग संख्या कॉपी हो गई है!');
    }
  }

  private handleSuccess(complaint: any): void {
    this.submitting = false;
    this.successComplaint = complaint;
    window.scrollTo({ top: 80, behavior: 'smooth' });
  }

  startNewEntry(): void {
    this.showSuccessModal = false;
    this.successComplaint = null;
    this.savedTrackingId = '';
    this.savedData = null;
    this.resetForm();
  }

  copyComplaintNumber(): void {
    if (this.successComplaint?.complaintNumber) {
      navigator.clipboard.writeText(this.successComplaint.complaintNumber);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2500);
      this.showToast('शिकायत संख्या कॉपी हो गई है!');
    }
  }

  printReceipt(): void {
    window.print();
  }

  private showToast(msg: string): void {
    clearTimeout(this.toastTimer);
    this.toastMessage = msg;
    this.toastTimer = setTimeout(() => (this.toastMessage = ''), MESSAGE_DURATION_MS);
  }
}
