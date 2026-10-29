import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateRange, isRangeActive, toDayKey } from '../../core/utils/date-range';

export interface DateField {
  key: string;
  label: string;
}

type Preset = 'today' | '7d' | '30d' | 'month';

/**
 * From–to date filter for the application lists, with a column picker (when the list has more than
 * one date) and quick presets. Two-way bound: [(range)]; the list does the filtering with inDateRange().
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './date-range-filter.component.html',
  styleUrl: './date-range-filter.component.scss'
})
export class DateRangeFilterComponent {
  @Input() fields: DateField[] = [];
  @Input({ required: true }) range!: DateRange;
  @Output() rangeChange = new EventEmitter<DateRange>();

  readonly today = toDayKey(new Date());

  readonly presets: { key: Preset; label: string }[] = [
    { key: 'today', label: 'आज' },
    { key: '7d', label: '7 दिन' },
    { key: '30d', label: '30 दिन' },
    { key: 'month', label: 'इस माह' }
  ];

  get active(): boolean {
    return isRangeActive(this.range);
  }

  set(patch: Partial<DateRange>): void {
    const next = { ...this.range, ...patch };
    // Keep the range valid when one end is moved past the other
    if (next.from && next.to && next.from > next.to) {
      if (patch.from !== undefined) next.to = next.from;
      else next.from = next.to;
    }
    this.range = next;
    this.rangeChange.emit(next);
  }

  /** Presets run up to today; "7 दिन" / "30 दिन" include today. */
  private presetFrom(p: Preset): string {
    const start = new Date();
    if (p === '7d') start.setDate(start.getDate() - 6);
    else if (p === '30d') start.setDate(start.getDate() - 29);
    else if (p === 'month') start.setDate(1);
    return toDayKey(start);
  }

  applyPreset(p: Preset): void {
    this.set({ from: this.presetFrom(p), to: this.today });
  }

  isPreset(p: Preset): boolean {
    return this.range.to === this.today && this.range.from === this.presetFrom(p);
  }

  clear(): void {
    this.set({ from: '', to: '' });
  }
}
