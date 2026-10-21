import { Injectable, signal } from '@angular/core';

export type FontSize = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'js_font_size';
const CLASS_BY_SIZE: Record<FontSize, string | null> = { normal: null, large: 'font-lg', xlarge: 'font-xl' };

/**
 * Accessibility text-size switcher (A / A+ / A++) shared by the public header
 * and the officer dashboard. Applies a class on <html> (see styles.scss) and
 * remembers the choice for the visitor.
 */
@Injectable({ providedIn: 'root' })
export class FontSizeService {
  size = signal<FontSize>(this.readStored());

  constructor() {
    this.apply(this.size());
  }

  set(size: FontSize): void {
    this.size.set(size);
    this.apply(size);
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // storage unavailable (private mode) — the choice just won't persist
    }
  }

  private apply(size: FontSize): void {
    const root = document.documentElement;
    root.classList.remove('font-lg', 'font-xl');
    const cls = CLASS_BY_SIZE[size];
    if (cls) root.classList.add(cls);
  }

  private readStored(): FontSize {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as FontSize | null;
      return stored && stored in CLASS_BY_SIZE ? stored : 'normal';
    } catch {
      return 'normal';
    }
  }
}
