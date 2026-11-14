import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';

type CalendarView = 'month' | 'year' | 'multi-year';

/** Parse 'yyyy-MM-dd' as a local date (new Date(str) would shift by timezone). */
function parseIso(value: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function toIso(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A typed year below this is a slip (the text parser accepts "1/1/999"), not a date anyone means. */
const EARLIEST_YEAR = 1000;

/**
 * Material calendar in place of <input type="date">. The form value stays a 'yyyy-MM-dd' string,
 * so existing models, validators and API payloads are unchanged.
 *
 * The text box inside is not bound to the form control, so the control validates for it: typed text
 * that is not a date makes the control invalid (`matDatepickerParse`) instead of quietly becoming an
 * empty value that a full-replace save would then store, and a date earlier than `min` is invalid
 * (`matDatepickerMin`) whether it was typed or picked.
 */
@Component({
  selector: 'app-date-input',
  imports: [MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  template: `
    <div class="date-input">
      <input
        #field
        [id]="inputId()"
        [matDatepicker]="picker"
        [value]="value()"
        [min]="minDate()"
        [disabled]="disabled()"
        (dateChange)="onPick($event.value)"
        (blur)="onTouched()"
      />
      <mat-datepicker-toggle class="date-toggle" [for]="picker" />
      <mat-datepicker #picker [startView]="startView()" [startAt]="startAt()" />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .date-input {
      position: relative;
      display: flex;
    }
    .date-input input {
      flex: 1;
      min-inline-size: 0;
      padding-inline-end: 52px;
    }
    .date-toggle {
      position: absolute;
      inset-inline-end: 2px;
      inset-block-start: 50%;
      transform: translateY(-50%);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateInput implements ControlValueAccessor, Validator {
  readonly inputId = input('');
  /** Use 'multi-year' for birth dates so the year is one click away. */
  readonly startView = input<CalendarView>('month');

  /** Where an empty picker opens, in years before today (30 suits birth dates). */
  readonly startYearsAgo = input(0);
  /** Earliest selectable date as 'yyyy-MM-dd'; empty means no limit. */
  readonly min = input('');
  protected readonly minDate = computed(() => parseIso(this.min()));

  protected readonly value = signal<Date | null>(null);
  protected readonly startAt = computed(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - this.startYearsAgo());
    return this.value() ?? d;
  });
  protected readonly disabled = signal(false);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  /** The text box holds something that is not a usable date. */
  private readonly unreadable = signal(false);

  private onChange: (v: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor() {
    // A new minimum (for example today's date rolling over) can make the current value invalid.
    effect(() => {
      this.minDate();
      this.onValidatorChange();
    });
  }

  writeValue(v: string | null): void {
    this.unreadable.set(false);
    this.value.set(parseIso(v));
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }
  validate(control: AbstractControl): ValidationErrors | null {
    if (this.unreadable()) return { matDatepickerParse: true };
    const min = this.minDate();
    const picked = parseIso(control.value);
    return min && picked && picked < min ? { matDatepickerMin: true } : null;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onPick(picked: Date | null): void {
    const d = picked && picked.getFullYear() >= EARLIEST_YEAR ? picked : null;
    const typed = this.field().nativeElement.value.trim();
    // Set before the value is published: publishing re-runs validate().
    this.unreadable.set(d === null && typed !== '');
    this.value.set(d);
    this.onChange(toIso(d));
    this.onTouched();
  }
}
