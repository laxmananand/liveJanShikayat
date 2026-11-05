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

/** One of the two receivers a regional officer can pick: the DM or the SP office. */
interface TargetGroup {
  officeId: number;
  title: string;
  subtitle: string;
  icon: string;
  options: ReforwardTarget[];
  /** Sending to this kind is ticked */
  selected: boolean;
  unitCode: number | null;
  /** Already sent (one-time per kind): shown locked */
  sent: ReforwardRecord | null;
}

/**
 * Commissioner / IG / DIG: forward an application received from Admin onward to the DM and / or SP of its
 * division (Commissioner) or range (IG / DIG). The server supplies only offices of that jurisdiction; the office
 * of the application's own district is preselected. Each kind can be sent once, so a sent one is shown locked.
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
  remarks = '';
  loading = false;
  submitting = false;
  errorMessage = '';

  ngOnChanges(): void {
    this.remarks = '';
    this.errorMessage = '';
    this.submitting = false;
    this.groups = this.emptyGroups();
    if (!this.record) return;

    const id = this.record.id;
    this.loading = true;
    this.forwardService.reforwardTargets(id).subscribe({
      next: (targets) => {
        if (this.record?.id !== id) return; // popup moved on to another record
        for (const g of this.groups) {
          g.options = targets.filter((t) => t.officeId === g.officeId);
          const own = g.options.find((t) => t.isApplicantDistrict);
          // The application's own district office is the likely receiver: tick it, the officer can change it
          if (!g.sent && own) {
            g.unitCode = own.unitCode;
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
    const sent = (officeId: number) => this.forward?.reforwards?.find((r) => r.toOfficeId === officeId) ?? null;
    return [
      {
        officeId: OFFICE_KIND.DM,
        title: 'जिलाधिकारी',
        subtitle: 'District Magistrate',
        icon: 'fa-landmark',
        options: [],
        selected: false,
        unitCode: null,
        sent: sent(OFFICE_KIND.DM)
      },
      {
        officeId: OFFICE_KIND.SP,
        title: 'पुलिस अधीक्षक',
        subtitle: 'Superintendent of Police',
        icon: 'fa-shield-halved',
        options: [],
        selected: false,
        unitCode: null,
        sent: sent(OFFICE_KIND.SP)
      }
    ];
  }

  get allSent(): boolean {
    return this.groups.every((g) => !!g.sent);
  }

  /** Ticked kinds that still lack an office */
  get missingOffice(): boolean {
    return this.groups.some((g) => !g.sent && g.selected && g.unitCode == null);
  }

  get canSubmit(): boolean {
    return !this.submitting && !this.loading && !this.missingOffice && this.groups.some((g) => !g.sent && g.selected);
  }

  toggle(g: TargetGroup): void {
    if (g.sent || !g.options.length) return;
    g.selected = !g.selected;
    if (g.selected && g.unitCode == null) {
      g.unitCode = (g.options.find((t) => t.isApplicantDistrict) ?? (g.options.length === 1 ? g.options[0] : null))?.unitCode ?? null;
    }
  }

  submit(): void {
    if (!this.record || !this.canSubmit) return;
    const pick = (officeId: number) => {
      const g = this.groups.find((x) => x.officeId === officeId)!;
      return !g.sent && g.selected ? g.unitCode : null;
    };

    this.submitting = true;
    this.errorMessage = '';
    this.forwardService
      .reforward({
        applicantId: this.record.id,
        dmUnitCode: pick(OFFICE_KIND.DM),
        spUnitCode: pick(OFFICE_KIND.SP),
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
              ? 'यह आवेदन पहले ही इस DM / SP को भेजा जा चुका है या निष्पादित हो चुका है। / Already forwarded or disposed.'
              : err?.error?.message || 'आवेदन अग्रेषित नहीं हो सका। / Could not forward the application.';
        }
      });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record && !this.submitting) this.closed.emit();
  }
}
