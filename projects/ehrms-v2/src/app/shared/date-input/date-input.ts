import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
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
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Material calendar in place of <input type="date">. The form value stays a 'yyyy-MM-dd' string,
 * so existing models, validators and API payloads are unchanged.
 */
@Component({
  selector: 'app-date-input',
  imports: [MatDatepickerModule],
  providers: [
    provideNativeDateAdapter(),
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInput), multi: true },
  ],
  template: `
    <div class="date-input">
      <input
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
export class DateInput implements ControlValueAccessor {
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

  private onChange: (v: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(v: string | null): void {
    this.value.set(parseIso(v));
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onPick(d: Date | null): void {
    this.value.set(d);
    this.onChange(toIso(d));
    this.onTouched();
  }
}
