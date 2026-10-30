import { Component, ElementRef, Input, QueryList, ViewChildren, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * One box per digit (e.g. a 10-digit mobile number), used as a form control: the value is the digits
 * typed so far as one string. Typing moves to the next box, Backspace to the previous one, and a
 * pasted number (+91 or a leading 0 dropped) fills all the boxes.
 */
@Component({
  selector: 'app-digit-boxes',
  standalone: true,
  imports: [CommonModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DigitBoxesComponent), multi: true }],
  template: `
    <div class="digit-boxes" role="group" [attr.aria-label]="ariaLabel" [class.invalid]="invalid" [class.readonly]="readonly">
      <input
        *ngFor="let d of digits; let i = index; trackBy: trackByIndex"
        #box
        type="text"
        inputmode="numeric"
        maxlength="1"
        autocomplete="off"
        [id]="i === 0 ? inputId : null"
        [value]="d"
        [readOnly]="readonly || disabled"
        [disabled]="disabled"
        [attr.aria-label]="(ariaLabel || 'अंक') + ' ' + (i + 1)"
        (input)="onInput(i, $event)"
        (keydown)="onKeydown(i, $event)"
        (paste)="onPaste(i, $event)"
        (focus)="select($event)"
        (blur)="onTouched()" />
    </div>
  `,
  styles: [`
    .digit-boxes {
      display: flex;
      gap: 5px;
    }
    input {
      flex: 1 1 0;
      min-width: 0;
      max-width: 38px;
      height: 40px;
      padding: 0;
      border: 1px solid #c0cbe3;
      border-radius: 6px;
      background: #ffffff;
      text-align: center;
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 1.1rem;
      font-weight: 700;
      color: #101d3b;
      outline: none;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    input:focus {
      border-color: #174bd9;
      box-shadow: 0 0 0 3px rgba(23, 75, 217, 0.15);
    }
    .invalid input { border-color: #e0918a; }
    .readonly input { background: #eef1f8; color: #4a5a7c; }
    @media (max-width: 380px) {
      .digit-boxes { gap: 3px; }
      input { height: 36px; font-size: 1rem; }
    }
  `]
})
export class DigitBoxesComponent implements ControlValueAccessor {
  @Input() set length(n: number) {
    this.digits = Array.from({ length: n }, (_, i) => this.digits[i] ?? '');
  }
  /** id of the first box, so a <label for> reaches it */
  @Input() inputId: string | null = null;
  @Input() ariaLabel = '';
  @Input() invalid = false;
  @Input() readonly = false;

  @ViewChildren('box') private boxes!: QueryList<ElementRef<HTMLInputElement>>;

  digits: string[] = Array(10).fill('');
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    const clean = String(value ?? '').replace(/\D/g, '');
    this.digits = this.digits.map((_, i) => clean[i] ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  /** Puts the cursor in the first empty box (or the last one). */
  focus(): void {
    const i = this.digits.findIndex((d) => !d);
    this.focusBox(i === -1 ? this.digits.length - 1 : i);
  }

  trackByIndex(i: number): number {
    return i;
  }

  onInput(i: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replace(/\D/g, '');
    if (!typed) {
      input.value = this.digits[i];
      return;
    }
    // Several digits at once (autofill, or typing over a selected box): spread them from here
    if (typed.length > 1) {
      this.fillFrom(i, typed);
      return;
    }
    this.digits[i] = typed;
    input.value = typed;
    this.emit();
    if (i < this.digits.length - 1) this.focusBox(i + 1);
  }

  onKeydown(i: number, event: KeyboardEvent): void {
    if (this.readonly || this.disabled) return;
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (this.digits[i]) {
        this.digits[i] = '';
      } else if (i > 0) {
        this.digits[i - 1] = '';
        this.focusBox(i - 1);
      }
      this.emit();
    } else if (event.key === 'ArrowLeft' && i > 0) {
      event.preventDefault();
      this.focusBox(i - 1);
    } else if (event.key === 'ArrowRight' && i < this.digits.length - 1) {
      event.preventDefault();
      this.focusBox(i + 1);
    }
  }

  onPaste(i: number, event: ClipboardEvent): void {
    event.preventDefault();
    if (this.readonly || this.disabled) return;
    let pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    // A whole mobile number with +91 or a leading 0: keep the last 10 digits
    if (pasted.length > this.digits.length) pasted = pasted.slice(-this.digits.length);
    if (pasted.length === this.digits.length) i = 0;
    if (pasted) this.fillFrom(i, pasted);
  }

  select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private fillFrom(start: number, value: string): void {
    let i = start;
    for (const ch of value) {
      if (i >= this.digits.length) break;
      this.digits[i++] = ch;
    }
    this.emit();
    this.focusBox(Math.min(i, this.digits.length - 1));
  }

  private emit(): void {
    this.digits = [...this.digits];
    this.onChange(this.digits.join(''));
  }

  private focusBox(i: number): void {
    setTimeout(() => this.boxes?.get(i)?.nativeElement.focus());
  }
}
