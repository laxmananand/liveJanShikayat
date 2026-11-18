import { Component, EventEmitter, Input, Output, Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';

export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Number of pages for total rows (at least 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The page actually shown: page kept inside 1..pageCount (a filter may have shrunk the list). */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/** Index of the first row of the shown page, for running serial numbers (offset + i + 1). */
export function pageOffset(page: number, total: number, pageSize: number): number {
  return (clampPage(page, total, pageSize) - 1) * pageSize;
}

/** `rows | paginate: page : pageSize` → the rows of that page (page is 1-based and clamped). */
@Pipe({ name: 'paginate', standalone: true })
export class PaginatePipe implements PipeTransform {
  transform<T>(rows: readonly T[] | null | undefined, page: number, pageSize: number): T[] {
    if (!rows) return [];
    const start = pageOffset(page, rows.length, pageSize);
    return rows.slice(start, start + pageSize);
  }
}

/**
 * Page controls under a table: "1–25 / 340", first / previous / page numbers / next / last and rows per page.
 * The list stays complete in the component (filters, search and counts work on all of it); only the
 * rows shown are paged. Two-way bound: [(page)] and [(pageSize)].
 */
@Component({
  selector: 'app-paginator',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (total > 0) {
      <nav class="pager" aria-label="पृष्ठ / Pages">
        <span class="pager-info">{{ from }}–{{ to }} / {{ total }}</span>

        @if (pages > 1) {
          <div class="pager-buttons">
            <button type="button" (click)="go(1)" [disabled]="current === 1" title="पहला पृष्ठ / First" aria-label="First page">«</button>
            <button type="button" (click)="go(current - 1)" [disabled]="current === 1" title="पिछला / Previous" aria-label="Previous page">‹</button>
            @for (p of window; track p) {
              <button type="button" [class.active]="p === current" (click)="go(p)" [attr.aria-current]="p === current ? 'page' : null">{{ p }}</button>
            }
            <button type="button" (click)="go(current + 1)" [disabled]="current === pages" title="अगला / Next" aria-label="Next page">›</button>
            <button type="button" (click)="go(pages)" [disabled]="current === pages" title="अंतिम पृष्ठ / Last" aria-label="Last page">»</button>
          </div>
        }

        <label class="pager-size">
          प्रति पृष्ठ
          <select [ngModel]="pageSize" (ngModelChange)="setSize($event)">
            @for (s of sizes; track s) {
              <option [ngValue]="s">{{ s }}</option>
            }
          </select>
        </label>
      </nav>
    }
  `,
  styles: [`
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 16px;
      padding: 12px 4px 4px;
      font-size: 0.85rem;
      color: var(--muted, #4a5a7c);
    }
    .pager-info { font-variant-numeric: tabular-nums; }
    .pager-buttons { display: flex; flex-wrap: wrap; gap: 4px; }
    .pager-buttons button {
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid var(--line, #cad3e6);
      border-radius: var(--radius-sm, 6px);
      background: var(--white, #fff);
      color: var(--ink, #101d3b);
      font: inherit;
      cursor: pointer;
    }
    .pager-buttons button:hover:not(:disabled):not(.active) { background: var(--mint, #e7ecf6); }
    .pager-buttons button.active {
      background: var(--accent, #174bd9);
      border-color: var(--accent, #174bd9);
      color: #fff;
      font-weight: 600;
      cursor: default;
    }
    .pager-buttons button:disabled { opacity: 0.45; cursor: default; }
    .pager-size { display: flex; align-items: center; gap: 6px; }
    .pager-size select {
      height: 32px;
      padding: 0 6px;
      border: 1px solid var(--line, #cad3e6);
      border-radius: var(--radius-sm, 6px);
      background: var(--white, #fff);
      color: var(--ink, #101d3b);
      font: inherit;
    }
    @media (max-width: 575.98px) {
      .pager { justify-content: center; }
      .pager-buttons button { min-width: 30px; height: 30px; }
    }
  `]
})
export class PaginatorComponent {
  @Input({ required: true }) total = 0;
  @Input() page = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Input() pageSize = DEFAULT_PAGE_SIZE;
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly sizes = PAGE_SIZES;

  get pages(): number {
    return pageCount(this.total, this.pageSize);
  }

  get current(): number {
    return clampPage(this.page, this.total, this.pageSize);
  }

  get from(): number {
    return pageOffset(this.page, this.total, this.pageSize) + 1;
  }

  get to(): number {
    return Math.min(this.total, this.from + this.pageSize - 1);
  }

  /** Up to 5 page numbers around the current one. */
  get window(): number[] {
    const last = this.pages;
    const start = Math.max(1, Math.min(this.current - 2, last - 4));
    const end = Math.min(last, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  go(page: number): void {
    const target = clampPage(page, this.total, this.pageSize);
    if (target === this.current && target === this.page) return;
    this.page = target;
    this.pageChange.emit(target);
  }

  setSize(size: number): void {
    this.pageSize = size;
    this.pageSizeChange.emit(size);
    this.page = 1;
    this.pageChange.emit(1);
  }
}
