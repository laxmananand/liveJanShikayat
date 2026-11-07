import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicantRecord } from '../../core/models/models';
import {
  ForwardRecord,
  ForwardService,
  OFFICE_KIND,
  ReforwardRecord,
  ReforwardTarget
} from '../../core/services/forward.service';

/** One of the two receiver kinds a regional officer can pick: DM offices or SP offices. */
interface TargetGroup {
  officeId: number;
  /** Short label on the checkbox: DM / SP */
  short: string;
  title: string;
  subtitle: string;
  options: ReforwardTarget[];
  /** Sending to this kind is ticked */
  selected: boolean;
  /** Offices (unit codes) picked to send to now */
  picked: number[];
  /** Earlier onward forwards of this kind, by unit code: shown ticked and locked */
  sent: Map<number, ReforwardRecord>;
}

/**
 * Commissioner / IG / DIG: forward an application received from Admin onward to any number of DM and / or SP
 * offices of its division (Commissioner) or range (IG / DIG). The server supplies only offices of that jurisdiction;
 * the office of the application's own district is preselected. It can be forwarded again later to more offices, but
 * an office that already received it is shown locked.
 */
@Component({
  selector: 'app-reforward-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reforward-dialog.component.html',
  styleUrls: ['../forward-dialog/forward-dialog.component.scss', './reforward-dialog.component.scss']
})
export class ReforwardDialogComponent implements OnChanges {
  private forwardService = inject(ForwardService);

  /** The application to forward; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  /** Its forward to this regional office (carries the onward forwards already made). */
  @Input() forward: ForwardRecord | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() reforwarded = new EventEmitter<ReforwardRecord[]>();

  groups: TargetGroup[] = [];
  /** Group whose office list is open */
  openGroup: TargetGroup | null = null;
  remarks = '';
  loading = false;
  submitting = false;
  errorMessage = '';

  ngOnChanges(): void {
    this.remarks = '';
    this.errorMessage = '';
    this.submitting = false;
    this.openGroup = null;
    this.groups = this.emptyGroups();
    if (!this.record) return;

    const id = this.record.id;
    this.loading = true;
    this.forwardService.reforwardTargets(id).subscribe({
      next: (targets) => {
        if (this.record?.id !== id) return; // popup moved on to another record
        for (const g of this.groups) {
          g.options = targets.filter((t) => t.officeId === g.officeId);
          // The application's own district office is the likely receiver: tick it, the officer can change it
          const own = g.options.find((t) => t.isApplicantDistrict && !g.sent.has(t.unitCode));
          if (own) {
            g.picked = [own.unitCode];
            g.selected = true;
          }
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'DM / SP कार्यालयों की सूची लोड नहीं हो सकी। / Could not load DM / SP offices.';
      }
    });
  }

  private emptyGroups(): TargetGroup[] {
    const sent = (officeId: number) =>
      new Map((this.forward?.reforwards ?? []).filter((r) => r.toOfficeId === officeId).map((r) => [r.toOfficeUnitCode, r]));
    return [
      { officeId: OFFICE_KIND.DM, short: 'DM', title: 'जिलाधिकारी', subtitle: 'District Magistrate', options: [], selected: false, picked: [], sent: sent(OFFICE_KIND.DM) },
      { officeId: OFFICE_KIND.SP, short: 'SP', title: 'पुलिस अधीक्षक', subtitle: 'Superintendent of Police', options: [], selected: false, picked: [], sent: sent(OFFICE_KIND.SP) }
    ];
  }

  /** Offices of this kind it can still be sent to */
  available(g: TargetGroup): ReforwardTarget[] {
    return g.options.filter((o) => !g.sent.has(o.unitCode));
  }

  /** Every listed office already received it */
  get allSent(): boolean {
    return !this.loading && this.groups.every((g) => g.options.length > 0 && !this.available(g).length);
  }

  /** Ticked kinds with no office picked */
  get missingOffice(): boolean {
    return this.groups.some((g) => g.selected && !g.picked.length);
  }

  get canSubmit(): boolean {
    return !this.submitting && !this.loading && !this.missingOffice && this.groups.some((g) => g.selected && g.picked.length);
  }

  toggle(g: TargetGroup): void {
    const free = this.available(g);
    if (!free.length) return;
    g.selected = !g.selected;
    if (g.selected && !g.picked.length) {
      const pre = free.find((t) => t.isApplicantDistrict) ?? (free.length === 1 ? free[0] : null);
      if (pre) g.picked = [pre.unitCode];
    }
    this.openGroup = g.selected && !g.picked.length ? g : null;
  }

  toggleList(g: TargetGroup, event: Event): void {
    event.stopPropagation();
    if (!g.selected || this.submitting) return;
    this.openGroup = this.openGroup === g ? null : g;
  }

  isPicked(g: TargetGroup, unitCode: number): boolean {
    return g.picked.includes(unitCode);
  }

  pick(g: TargetGroup, unitCode: number): void {
    g.picked = this.isPicked(g, unitCode) ? g.picked.filter((u) => u !== unitCode) : [...g.picked, unitCode];
  }

  /** Text on the closed dropdown */
  summary(g: TargetGroup): string {
    if (!g.options.length) return '-- कोई कार्यालय उपलब्ध नहीं --';
    if (!g.picked.length) return '-- कार्यालय चुनें --';
    const labels = g.options.filter((o) => g.picked.includes(o.unitCode)).map((o) => o.unitLabel);
    return labels.length <= 2 ? labels.join(', ') : `${labels.length} कार्यालय चुने गए`;
  }

  submit(): void {
    if (!this.record || !this.canSubmit) return;
    const picks = (officeId: number) => {
      const g = this.groups.find((x) => x.officeId === officeId)!;
      return g.selected ? g.picked.filter((u) => !g.sent.has(u)) : [];
    };

    this.submitting = true;
    this.openGroup = null;
    this.errorMessage = '';
    this.forwardService
      .reforward({
        applicantId: this.record.id,
        dmUnitCodes: picks(OFFICE_KIND.DM),
        spUnitCodes: picks(OFFICE_KIND.SP),
        remarks: this.remarks.trim() || null
      })
      .subscribe({
        next: (saved) => {
          this.submitting = false;
          this.reforwarded.emit(saved);
        },
        error: (err) => {
          this.submitting = false;
          this.errorMessage =
            err?.status === 409
              ? 'चुने गए किसी कार्यालय को यह आवेदन पहले ही भेजा जा चुका है या आवेदन निष्पादित हो चुका है। / Already sent to a selected office, or disposed.'
              : err?.error?.message || 'आवेदन अग्रेषित नहीं हो सका। / Could not forward the application.';
        }
      });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.openGroup) {
      this.openGroup = null;
      return;
    }
    if (this.record && !this.submitting) this.closed.emit();
  }
}
