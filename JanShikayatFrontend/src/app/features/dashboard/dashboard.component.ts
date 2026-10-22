import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { ApplicantService } from '../../core/services/applicant.service';
import { ForwardService } from '../../core/services/forward.service';
import { AuthService } from '../../core/services/auth.service';
import { ApplicantRecord, DashboardSummary } from '../../core/models/models';
import { roleLabel } from '../../core/utils/labels';
import { ApplicantDetailsModalComponent } from '../../shared/applicant-details/applicant-details-modal.component';

interface StatusTile {
  status: string;
  label: string;
  icon: string;
  tone: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ApplicantDetailsModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  summary: DashboardSummary | null = null;
  tiles: StatusTile[] = [];
  loading = true;
  recent: ApplicantRecord[] = [];
  byDistrict: { name: string; count: number }[] = [];
  receivedToday = 0;
  receivedThisMonth = 0;
  selected: ApplicantRecord | null = null;

  roleLabel = roleLabel;

  flowSteps = [
    { title: 'शिकायत प्राप्त', sub: 'शाखा / ऑनलाइन पोर्टल' },
    { title: 'समीक्षा', sub: 'जांच टिप्पणी' },
    { title: 'अग्रेषण', sub: 'विभाग / सक्षम प्राधिकारी' },
    { title: 'कार्रवाई', sub: 'Field Enquiry व रिपोर्ट' },
    { title: 'निस्तारण', sub: 'समापन टिप्पणी' }
  ];

  constructor(
    private applicantService: ApplicantService,
    private forwardService: ForwardService,
    public auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(force = false): void {
    this.loading = true;
    // Admin sees every application; everyone else only those currently forwarded to them
    forkJoin({
      list: this.applicantService.getApplicants(force),
      mine: this.isAdmin ? of(null) : this.forwardService.myForwards(force).pipe(map((f) => new Set(f.map((x) => x.applicantId))))
    }).subscribe({
      next: ({ list: all, mine }) => {
        const list = mine ? all.filter((r) => mine.has(r.id)) : all;
        const s = this.summarise(list);
        this.summary = s;
        this.tiles = [
          { status: 'Pending', label: 'लंबित', icon: 'fa-hourglass-half', tone: 'amber', value: s.pending },
          { status: 'UnderReview', label: 'समीक्षाधीन', icon: 'fa-magnifying-glass', tone: 'navy', value: s.underReview },
          { status: 'ForwardedToDepartment', label: 'विभाग को अग्रेषित', icon: 'fa-share-nodes', tone: 'violet', value: s.forwarded },
          { status: 'ForwardedForFieldEnquiry', label: 'क्षेत्रीय जांच / कार्रवाई में', icon: 'fa-magnifying-glass-location', tone: 'red', value: s.underFieldEnquiry },
          { status: 'Disposed', label: 'निष्पादित', icon: 'fa-circle-check', tone: 'green', value: s.disposed }
        ];
        this.loading = false;
      },
      error: () => {
        this.summary = null;
        this.loading = false;
      }
    });
  }

  /**
   * Build the counts from GET /Applicant/get-all. The API has no status or source yet,
   * so every application counts as pending and none as an online (citizen) submission.
   */
  private summarise(list: ApplicantRecord[]): DashboardSummary {
    const now = new Date();
    const today = now.toDateString();
    const dates = list.map((r) => (r.applicationDate ? new Date(r.applicationDate) : null));
    this.receivedToday = dates.filter((d) => d?.toDateString() === today).length;
    this.receivedThisMonth = dates.filter(
      (d) => d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    ).length;

    // get-all returns newest first (ORDER BY ID DESC); sort anyway so the card never depends on it
    this.recent = [...list].sort((a, b) => b.id - a.id).slice(0, 5);

    const counts = new Map<string, number>();
    list.forEach((r) => {
      const name = r.districtName || 'अज्ञात';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    this.byDistrict = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      totalComplaints: list.length,
      pending: list.length,
      underReview: 0,
      forwarded: 0,
      underFieldEnquiry: 0,
      disposed: 0,
      onlineSubmissions: 0
    };
  }

  get isAdmin(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  /** Admin's full list, or the user's Forwarded Applications page. */
  get listLink(): string {
    return this.isAdmin ? '/complaints' : '/complaints/forwarded';
  }

  get canRegisterComplaint(): boolean {
    return this.auth.hasRole('SuperAdmin');
  }

  get canSeeOnlineComplaints(): boolean {
    return this.isAdmin;
  }

  share(value: number): number {
    const total = this.summary?.totalComplaints ?? 0;
    return total ? Math.round((value / total) * 100) : 0;
  }

  navigateToComplaints(status?: string): void {
    if (!this.isAdmin) {
      this.router.navigate([this.listLink]);
      return;
    }
    this.router.navigate(['/complaints'], status ? { queryParams: { status } } : {});
  }

  navigateToOnline(): void {
    this.router.navigate(['/complaints'], { queryParams: { source: 'Online' } });
  }
}
