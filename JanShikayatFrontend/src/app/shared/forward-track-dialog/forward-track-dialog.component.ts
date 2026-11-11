import { Component, EventEmitter, HostListener, Input, OnChanges, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplicantRecord, ApplicantRemark, ApplicationClosure, ForwardHop } from '../../core/models/models';
import { ApplicantService } from '../../core/services/applicant.service';
import { OFFICE_KIND, ONWARD_KINDS } from '../../core/services/forward.service';
import { openBlobDocument } from '../../core/utils/document';

/** Short name of a regional office kind, shown under its node */
const KIND_SHORT: Record<number, string> = {
  [OFFICE_KIND.Commissioner]: 'आयुक्त',
  [OFFICE_KIND.DM]: 'DM',
  [OFFICE_KIND.IG]: 'IG',
  [OFFICE_KIND.DIG]: 'DIG',
  [OFFICE_KIND.SP]: 'SP',
  [OFFICE_KIND.SDO]: 'SDO',
  [OFFICE_KIND.DCLR]: 'DCLR',
  [OFFICE_KIND.SDPO]: 'DSP/SDPO',
  [OFFICE_KIND.CO]: 'CO',
  [OFFICE_KIND.Thana]: 'थाना'
};

const KIND_LONG: Record<number, string> = {
  [OFFICE_KIND.Commissioner]: 'प्रमंडलीय आयुक्त',
  [OFFICE_KIND.DM]: 'जिलाधिकारी',
  [OFFICE_KIND.IG]: 'पुलिस महानिरीक्षक',
  [OFFICE_KIND.DIG]: 'पुलिस उप-महानिरीक्षक',
  [OFFICE_KIND.SP]: 'पुलिस अधीक्षक',
  [OFFICE_KIND.SDO]: 'अनुमंडल पदाधिकारी',
  [OFFICE_KIND.DCLR]: 'भूमि सुधार उप समाहर्ता',
  [OFFICE_KIND.SDPO]: 'पुलिस उपाधीक्षक / अनुमंडल पुलिस पदाधिकारी',
  [OFFICE_KIND.CO]: 'अंचल अधिकारी',
  [OFFICE_KIND.Thana]: 'थाना'
};

/**
 * Next level each office kind forwards to (the same list the Forward popup uses). A hop to such an office that has not
 * yet sent to one of these kinds gets a grey "pending" node, and so on down to CO / थाना.
 */
const NEXT_LEVEL = ONWARD_KINDS;

/** One circle of the graph: the application, a forward (done) or an expected next step (pending). */
interface TrackNode {
  id: string;
  hop: ForwardHop | null; // null: the application itself, or a pending step
  /** Office kind of a forward or a pending forward (null: the application, a branch) */
  kind: number | null;
  pending: boolean;
  title: string;
  sub: string;
  date: string | null;
  depth: number;
  children: TrackNode[];
  /** Number shown in a pending circle */
  step: number;
  /** Layout, in SVG units */
  x: number;
  y: number;
  /** Remarks written by this office */
  replies: ApplicantRemark[];
}

interface TrackEdge {
  d: string;
  done: boolean;
}

const COL_W = 108;
const ROW_H = 80;
const PAD_X = 52;
const PAD_Y = 28;
export const NODE_R = 15;

/**
 * "अग्रेषण प्रगति (Forward Progress)": the forward chain of one application as a tree (Admin → Commissioner / IG /
 * DIG → DM / SP → SDO / DCLR / SDPO → CO / थाना), with grey placeholders for levels not reached yet, and beside it
 * the action history of every office reached (forwarding note and remarks). The chart itself is display-only.
 * An application can branch out to several offices at every level. A closed application ends in a final "बंद / Closed"
 * node that every branch runs into (no grey placeholders then: nothing more can happen).
 */
@Component({
  selector: 'app-forward-track-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forward-track-dialog.component.html',
  styleUrl: './forward-track-dialog.component.scss'
})
export class ForwardTrackDialogComponent implements OnChanges {
  private applicantService = inject(ApplicantService);

  /** The application to track; null keeps the popup closed. */
  @Input() record: ApplicantRecord | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly r = NODE_R;
  loading = false;
  errorMessage = '';
  nodes: TrackNode[] = [];
  edges: TrackEdge[] = [];
  width = 400;
  height = 160;
  /** Right-hand "Action History": every office the application reached, with its remarks */
  history: TrackNode[] = [];
  private remarks: ApplicantRemark[] = [];
  /** Closure of the application (null while open) and its final node, right of the tree */
  closure: ApplicationClosure | null = null;
  closureNode: { x: number; y: number } | null = null;
  openingDocId: number | null = null;

  ngOnChanges(): void {
    this.nodes = [];
    this.edges = [];
    this.history = [];
    this.closure = null;
    this.closureNode = null;
    this.errorMessage = '';
    if (!this.record) return;

    const id = this.record.id;
    this.loading = true;
    forkJoin({
      hops: this.applicantService.getForwardHistory(id),
      remarks: this.applicantService.getRemarks(id),
      // An older server without the closure API still shows the chart
      closure: this.applicantService.getClosure(id).pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ hops, remarks, closure }) => {
        if (this.record?.id !== id) return; // popup moved on to another record
        this.remarks = remarks;
        this.closure = closure;
        this.build(hops);
        this.loading = false;
      },
      error: () => {
        if (this.record?.id !== id) return;
        this.loading = false;
        this.errorMessage = 'अग्रेषण प्रगति लोड नहीं हो सकी। / Could not load the forward progress.';
      }
    });
  }

  private build(hops: ForwardHop[]): void {
    const rec = this.record!;
    const root = this.node('root', null, false, rec.applicationNo || String(rec.id), 'आवेदन', rec.applicationDate, 0);
    // Admin's remarks stay on the application; a branch / section (no regional office) answers on its forward
    const isAdmin = (m: ApplicantRemark) => (m.remarkByRole ?? '').toLowerCase() === 'admin';
    const branchReplies = this.remarks.filter((m) => m.remarkByOfficeId == null && !isAdmin(m));
    const branchHop = hops.find((h) => h.level === 1 && h.toOfficeId == null);
    root.replies = this.remarks.filter((m) => isAdmin(m) || (!branchHop && m.remarkByOfficeId == null));

    // Done nodes, linked by parentId (hops come top level first)
    const byId = new Map<string, TrackNode>();
    for (const h of hops) {
      const parent = (h.parentId && byId.get(h.parentId)) || root;
      const n = this.node(h.id, h, false, this.kindShort(h), h.toLabel, h.forwardedAt, parent.depth + 1);
      n.kind = h.toOfficeId ?? null;
      n.replies =
        h === branchHop
          ? branchReplies
          : this.remarks.filter((m) => h.toOfficeId != null && m.remarkByOfficeId === h.toOfficeId && m.remarkByUnitCode === h.toUnitCode);
      parent.children.push(n);
      byId.set(h.id, n);
    }

    // Pending placeholders: not forwarded at all yet, or an office that has not sent to the level below it yet
    // (Commissioner / IG / DIG → DM / SP, DM → SDO / DCLR, SP → DSP/SDPO, SDO / DCLR → CO, DSP/SDPO → थाना), each
    // with the rest of its chain greyed out down to CO / थाना.
    // A closed application gets none: it can no longer be forwarded.
    if (!this.closure) {
      if (!root.children.length) {
        root.children.push(this.node('p-root', null, true, 'अग्रेषण', 'लंबित', null, 1));
      }
      for (const n of [...byId.values()]) this.addNextSteps(n);
    }

    // Layout: leaves one per row in tree order, a parent centred on its children
    const all: TrackNode[] = [];
    let row = 0;
    let maxDepth = 0;
    const place = (n: TrackNode) => {
      all.push(n);
      maxDepth = Math.max(maxDepth, n.depth);
      n.x = PAD_X + n.depth * COL_W;
      if (!n.children.length) {
        n.y = PAD_Y + row++ * ROW_H;
        return;
      }
      n.children.forEach(place);
      n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
    };
    place(root);

    this.nodes = all;
    // Sibling edges share the stub out of the parent and the vertical spine, so draw the grey (pending) ones first
    // and the green (done) ones on top — otherwise grey paints over green and the trunk looks broken.
    const edges: TrackEdge[] = all.flatMap((p) =>
      p.children.map((c) => {
        const mid = p.x + COL_W / 2;
        return {
          d: `M ${p.x + NODE_R} ${p.y} H ${mid} V ${c.y} H ${c.x - NODE_R}`,
          done: !c.pending
        };
      })
    );

    // Closed: a final node one column right of the deepest level, level with the application, which every branch's
    // last office runs into (each leaf has its own row, so the lines cross no other node)
    if (this.closure) {
      maxDepth += 1;
      const end = { x: PAD_X + maxDepth * COL_W, y: root.y };
      const mid = end.x - COL_W / 2;
      for (const leaf of all.filter((n) => !n.children.length)) {
        edges.push({ d: `M ${leaf.x + NODE_R} ${leaf.y} H ${mid} V ${end.y} H ${end.x - NODE_R}`, done: true });
      }
      this.closureNode = end;
    }

    this.edges = edges.sort((a, b) => Number(a.done) - Number(b.done));
    this.width = PAD_X * 2 + maxDepth * COL_W;
    this.height = PAD_Y + (row - 1) * ROW_H + 70;

    // Action history: Admin's own remarks (when any), then every office reached, in the chart's top-to-bottom order
    this.history = [...(root.replies.length ? [root] : []), ...all.filter((n) => n.hop)];
  }

  /**
   * Grey steps below node n: each office kind it forwards to that it has not sent to yet (and that kind's own chain).
   * CO / थाना are the last step; their action is their remarks, shown in the action history.
   */
  private addNextSteps(n: TrackNode): void {
    if (n.kind == null) return;
    for (const kind of NEXT_LEVEL[n.kind] ?? []) {
      if (n.children.some((c) => c.kind === kind)) continue;
      const p = this.node(`p-${n.id}-${kind}`, null, true, KIND_SHORT[kind], 'लंबित', null, n.depth + 1);
      p.kind = kind;
      n.children.push(p);
      this.addNextSteps(p);
    }
  }

  private node(id: string, hop: ForwardHop | null, pending: boolean, title: string, sub: string, date: string | null, depth: number): TrackNode {
    return { id, hop, kind: null, pending, title, sub, date, depth, children: [], step: depth + 1, x: 0, y: 0, replies: [] };
  }

  private kindShort(h: ForwardHop): string {
    return h.toOfficeId != null ? KIND_SHORT[h.toOfficeId] ?? 'कार्यालय' : 'शाखा';
  }

  kindLong(h: ForwardHop): string {
    return h.toOfficeId != null ? KIND_LONG[h.toOfficeId] ?? 'कार्यालय' : 'शाखा / विभाग';
  }

  /** SVG text has no ellipsis: cut long office names */
  clip(text: string, max = 24): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  /** Done nodes count towards the "x of y" summary */
  get doneCount(): number {
    return this.nodes.filter((n) => n.hop).length;
  }

  get pendingCount(): number {
    return this.nodes.filter((n) => n.pending).length;
  }

  viewRemarkDoc(m: ApplicantRemark): void {
    if (this.openingDocId) return;
    const tab = window.open('', '_blank'); // opened during the click so the popup blocker allows it
    this.openingDocId = m.id;
    this.applicantService.getRemarkDocument(m.id).subscribe({
      next: (blob) => {
        this.openingDocId = null;
        openBlobDocument(blob, tab);
      },
      error: () => {
        this.openingDocId = null;
        tab?.close();
        alert('दस्तावेज़ खोला नहीं जा सका।');
      }
    });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.record) this.closed.emit();
  }
}
