/** A from–to filter on one date column of a list; from / to are yyyy-MM-dd ('' = open end). */
export interface DateRange {
  field: string;
  from: string;
  to: string;
}

/** Local calendar day as yyyy-MM-dd (what <input type="date"> uses). */
export function toDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Calendar day of a server date: a value without a time zone ("2026-10-28" or "2026-10-28T14:05:00")
 * is already local, so its date part is used as is; a zoned value (…Z / +05:30) is converted to local time.
 */
export function dayKeyOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  if (!hasZone && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : toDayKey(d);
}

export function isRangeActive(range: DateRange): boolean {
  return !!(range.from || range.to);
}

/** Both ends inclusive. A row without the date is hidden only while a range is set. */
export function inDateRange(value: string | null | undefined, range: DateRange): boolean {
  if (!isRangeActive(range)) return true;
  const day = dayKeyOf(value);
  if (!day) return false;
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
}
