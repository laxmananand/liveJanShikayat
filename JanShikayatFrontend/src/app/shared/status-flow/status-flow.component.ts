import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { STATUS_STAGES, statusStageIndex } from '../../core/utils/labels';

/**
 * प्राप्त → समीक्षा → अग्रेषित → कार्रवाई → निस्तारित pill bar from the portal
 * design, driven by a real complaint status.
 */
@Component({
  selector: 'app-status-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-flow-bar">
      <ng-container *ngFor="let stage of stages; let i = index; let last = last">
        <div class="flow-pill" [class.active]="i < current" [class.current]="i === current" [class.done]="i === current && isFinal">
          <i *ngIf="i < current || (i === current && isFinal)" class="fa-solid fa-circle-check"></i>
          <i *ngIf="i === current && !isFinal" class="fa-solid fa-arrows-spin fa-spin"></i>
          {{ stage.label }}
        </div>
        <span class="flow-arrow" *ngIf="!last"><i class="fa-solid fa-chevron-right"></i></span>
      </ng-container>
    </div>
  `,
  styles: [`
    .status-flow-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .flow-pill {
      font-size: 0.72rem; font-weight: 800; color: #4a5a7c; background: #e7ecf6;
      padding: 7px 14px; border-radius: 99px; display: inline-flex; align-items: center; gap: 6px;
    }
    .flow-pill.active { background: #142344; color: #fff; }
    .flow-pill.current {
      background: #174bd9; color: #fff;
    }
    .flow-pill.done { background: #15803d; }
    .flow-arrow { color: #7a89aa; font-size: 0.65rem; }
    @media (max-width: 575.98px) {
      .status-flow-bar { gap: 6px; }
      .flow-pill { font-size: 0.68rem; padding: 5px 10px; }
      .flow-arrow { font-size: 0.55rem; }
    }
  `]
})
export class StatusFlowComponent {
  @Input() status: string | null | undefined = null;

  stages = STATUS_STAGES;

  get current(): number {
    return statusStageIndex(this.status);
  }

  get isFinal(): boolean {
    return this.status === 'Disposed';
  }
}
