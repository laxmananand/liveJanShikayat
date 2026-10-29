import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ApplicantService } from '../../../core/services/applicant.service';
import {
  PendencyApplication,
  PendencyFilter,
  PendencyLevel,
  PendencyRow,
  PendencyStatus,
  ReportService
} from '../../../core/services/report.service';
import { ApplicantRecord } from '../../../core/models/models';
import { roleLabel } from '../../../core/utils/labels';
import { toDayKey } from '../../../core/utils/date-range';
import { ApplicantDetailsModalComponent } from '../../../shared/applicant-details/applicant-details-modal.component';

/** Drill-down order; each level's code / name live in the query string (d / dn, b / bn, t / tn, p / pn). */
const LEVELS: { level: PendencyLevel; code: string; name: string; label: string; heading: string }[] = [
  { level: 'district', code: 'd', name: 'dn', label: 'जिला', heading: 'District' },
  { level: 'block', code: 'b', name: 'bn', label: 'प्रखंड / अंचल', heading: 'Block' },
  { level: 'thana', code: 't', name: 'tn', label: 'थाना', heading: 'Police Station' },
  { level: 'panchayat', code: 'p', name: 'pn', label: 'पंचायत', heading: 'Panchayat' }
];

const STATUS_TEXT: Record<PendencyApplication['status'], string> = {
  Unforwarded: 'अग्रसारण हेतु लंबित',
  Pending: 'कार्यालय स्तर पर लंबित',
  Disposed: 'निष्पादित'
};

const STATUS_FILTER_TEXT: Record<PendencyStatus, string> = {
  '': 'सभी आवेदन',
  unforwarded: 'अग्रसारण हेतु लंबित',
  pending: 'कार्यालय स्तर पर लंबित',
  disposed: 'निष्पादित'
};

/**
 * पेंडेंसी रिपोर्ट: District → Block → Thana → Panchayat counts, then the applications behind a count.
 * Every login sees only its own hierarchy; the server applies it (Admin all, Branch / Prashakha /
 * Commissioner / DM the applications forwarded to them).
 */
@Component({
  selector: 'app-pendency-report',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicantDetailsModalComponent],
  templateUrl: './pendency-report.component.html',
  styleUrls: ['../../complaints/applicant-records/applicant-records.component.scss', './pendency-report.component.scss']
})
export class PendencyReportComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private reportService = inject(ReportService);
  private applicantService = inject(ApplicantService);
  private auth = inject(AuthService);

  readonly today = toDayKey(new Date());

  /** Index into LEVELS of the rows shown; ignored while the application list is open. */
  levelIndex = 0;
  listView = false;
  status: PendencyStatus = '';
  filter: PendencyFilter = {};
  /** Selected district / block / thana / panchayat names, for the heading */
  trail: { label: string; name: string }[] = [];

  /** Date inputs; applied to the report by Search */
  fromDate = '';
  toDate = '';

  rows: PendencyRow[] = [];
  applications: PendencyApplication[] = [];
  loading = false;
  errorMessage = '';
  generatedAt: Date | null = null;

  selected: ApplicantRecord | null = null;
  opening = false;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => this.readState(q));
  }

  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  /** Who the report covers, under the title. */
  get scopeText(): string {
    const user = this.auth.currentUser();
    if (!user) return '';
    if (this.isAdmin) return 'सभी आवेदन (राज्य स्तर)';
    return `${user.fullName} (${roleLabel(user.role)}) को अग्रेषित आवेदन`;
  }

  get canGoBack(): boolean {
    return this.listView || this.levelIndex > 0;
  }

  get hint(): string {
    const next = LEVELS[this.levelIndex + 1];
    return next
      ? `*${this.level.label} के नाम पर क्लिक करें — ${next.label}-वार आवेदन स्थिति देखने हेतु; संख्या पर क्लिक करने से आवेदनों की सूची खुलेगी।`
      : `*${this.level.label} के नाम या संख्या पर क्लिक करें — आवेदनों की सूची देखने हेतु।`;
  }

  get statusFilterText(): string {
    return STATUS_FILTER_TEXT[this.status];
  }

  statusText(s: PendencyApplication['status']): string {
    return STATUS_TEXT[s] ?? s;
  }

  get totals(): Omit<PendencyRow, 'code' | 'name'> {
    return this.rows.reduce(
      (t, r) => ({
        total: t.total + r.total,
        unforwarded: t.unforwarded + r.unforwarded,
        pending: t.pending + r.pending,
        disposed: t.disposed + r.disposed
      }),
      { total: 0, unforwarded: 0, pending: 0, disposed: 0 }
    );
  }

  /** Rows without a master entry (thana / panchayat not chosen on the form) have code 0. */
  rowName(row: PendencyRow): string {
    return row.name || (row.code === 0 ? `${this.level.label} अचयनित` : String(row.code));
  }

  // ── Navigation (all state is in the URL, so the browser's back button works too) ──

  /** Name click: the next level for this row, or its applications at the last level. */
  drill(row: PendencyRow): void {
    if (this.levelIndex === LEVELS.length - 1) {
      this.openList('', row);
      return;
    }
    this.navigate(this.withRow(row));
  }

  /** Count click: the applications behind it. A row's count adds the row to the filter; the total row does not. */
  openList(status: PendencyStatus, row: PendencyRow | null): void {
    const params = row ? this.withRow(row) : { ...this.route.snapshot.queryParams };
    params['view'] = 'list';
    params['status'] = status || null;
    params['row'] = row ? '1' : null;
    this.navigate(params);
  }

  back(): void {
    const params: Params = { ...this.route.snapshot.queryParams };
    if (this.listView) {
      // The list was opened from a row: going back also leaves that row
      if (params['row']) this.clearFrom(params, this.deepestIndex());
      params['view'] = params['status'] = params['row'] = null;
    } else {
      this.clearFrom(params, this.levelIndex - 1);
    }
    this.navigate(params);
  }

  search(): void {
    const from = this.fromDate && this.toDate && this.fromDate > this.toDate ? this.toDate : this.fromDate;
    this.navigate({ ...this.route.snapshot.queryParams, from: from || null, to: this.toDate || null });
  }

  clearDates(): void {
    this.fromDate = this.toDate = '';
    this.search();
  }

  refresh(): void {
    this.load();
  }

  private withRow(row: PendencyRow): Params {
    const params: Params = { ...this.route.snapshot.queryParams };
    params[this.level.code] = row.code;
    params[this.level.name] = this.rowName(row);
    return params;
  }

  /** Removes the code / name of LEVELS[index] and every level below it. */
  private clearFrom(params: Params, index: number): void {
    LEVELS.slice(Math.max(index, 0)).forEach((l) => (params[l.code] = params[l.name] = null));
  }

  /** Index of the deepest level that has a code in the URL. */
  private deepestIndex(): number {
    const q = this.route.snapshot.queryParamMap;
    let i = -1;
    LEVELS.forEach((l, idx) => q.has(l.code) && (i = idx));
    return i;
  }

  private navigate(queryParams: Params): void {
    // null values drop out of the URL
    const clean = Object.fromEntries(Object.entries(queryParams).filter(([, v]) => v !== null && v !== undefined && v !== ''));
    this.router.navigate([], { relativeTo: this.route, queryParams: clean });
  }

  private readState(q: ParamMap): void {
    const num = (key: string) => (q.has(key) && q.get(key) !== '' && !isNaN(Number(q.get(key))) ? Number(q.get(key)) : null);

    this.filter = {
      district: num('d'),
      block: num('b'),
      thana: num('t'),
      panchayat: num('p'),
      fromDate: q.get('from') ?? '',
      toDate: q.get('to') ?? ''
    };
    this.fromDate = this.filter.fromDate ?? '';
    this.toDate = this.filter.toDate ?? '';

    // A level is open when every level above it has been chosen
    let index = 0;
    while (index < LEVELS.length - 1 && num(LEVELS[index].code) !== null) index++;
    this.trail = LEVELS.filter((l) => num(l.code) !== null).map((l) => ({ label: l.label, name: q.get(l.name) || q.get(l.code)! }));

    this.listView = q.get('view') === 'list';
    const status = (q.get('status') ?? '') as PendencyStatus;
    this.status = status in STATUS_FILTER_TEXT ? status : '';
    this.levelIndex = index;
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.errorMessage = '';
    const request: Observable<PendencyRow[] | PendencyApplication[]> = this.listView
      ? this.reportService.pendencyApplications(this.filter, this.status)
      : this.reportService.pendency(this.level.level, this.filter);

    request.subscribe({
      next: (data) => {
        if (this.listView) this.applications = data as PendencyApplication[];
        else this.rows = data as PendencyRow[];
        this.generatedAt = new Date();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.rows = [];
        this.applications = [];
        this.errorMessage =
          err?.status === 401
            ? 'सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।'
            : err?.status === 0
              ? 'सर्वर से संपर्क नहीं हो सका। कृपया जाँचें कि बैकएंड चल रहा है, फिर रिफ़्रेश करें।'
              : `रिपोर्ट लोड नहीं हो सकी (त्रुटि ${err?.status ?? ''})। कृपया रिफ़्रेश करें।`;
      }
    });
  }

  // ── Application details ──

  view(app: PendencyApplication): void {
    this.opening = true;
    this.applicantService.getApplicants().subscribe({
      next: (records) => {
        this.opening = false;
        this.selected = records.find((r) => r.id === app.applicantId) ?? null;
        if (!this.selected) this.errorMessage = 'आवेदन का विवरण नहीं मिला।';
      },
      error: () => {
        this.opening = false;
        this.errorMessage = 'आवेदन का विवरण लोड नहीं हो सका।';
      }
    });
  }

  forwardedTo(app: PendencyApplication): string {
    if (!app.branchLabel) return '—';
    const office = app.officeUnitLabel || app.officeLabel || app.prashakhaLabel;
    return office ? `${app.branchLabel} • ${office}` : app.branchLabel;
  }

  // ── Export ──

  /** CSV with a BOM, so Excel opens the Hindi text correctly. */
  exportToExcel(): void {
    const header = this.listView
      ? ['क्रम सं.', 'आवेदन संख्या', 'आवेदक का नाम', 'पिता/पति का नाम', 'मोबाइल', 'जिला', 'प्रखंड', 'पंचायत', 'गाँव', 'थाना',
         'आवेदन प्राप्ति की तिथि', 'अग्रेषित', 'शिकायत का प्रकार', 'अग्रेषित दिनांक', 'स्थिति', 'निष्पादन दिनांक', 'दिन']
      : ['क्रम सं.', this.level.label, 'कुल आवेदन', ...(this.isAdmin ? ['अग्रसारण हेतु लंबित'] : []), 'कार्यालय स्तर पर लंबित', 'निष्पादित'];

    const day = (v: string | null) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '');
    const body: (string | number)[][] = this.listView
      ? this.applications.map((a, i) => [
          i + 1, a.applicationNo ?? '', a.applicantName, a.fatherHusbandName ?? '', a.mobileNumber ?? '', a.districtName,
          a.blockName, a.panchayatName, a.villageName, a.policeStation, day(a.applicationDate), this.forwardedTo(a),
          a.complaintTypeLabel ?? '', day(a.forwardedAt), this.statusText(a.status), day(a.closedAt), a.pendingDays
        ])
      : [
          ...this.rows.map((r, i) => [i + 1, this.rowName(r), r.total, ...(this.isAdmin ? [r.unforwarded] : []), r.pending, r.disposed]),
          ['', 'कुल', this.totals.total, ...(this.isAdmin ? [this.totals.unforwarded] : []), this.totals.pending, this.totals.disposed]
        ];

    const title = ['पेंडेंसी रिपोर्ट', ...this.trail.map((t) => `${t.label}: ${t.name}`), this.listView ? this.statusFilterText : ''].filter(Boolean);
    const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [title, header, ...body].map((line) => line.map(csvCell).join(',')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Pendency_Report_${this.listView ? 'Applications' : this.level.heading.replace(' ', '_')}_${this.today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
