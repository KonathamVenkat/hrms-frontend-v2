import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Same rule as the API: no control or invisible characters (a name pasted with a zero-width space is refused). */
export const noControlChars = Validators.pattern(/^[^\p{Cc}\p{Cf}]*$/u);

/** Free text: line breaks and tabs are fine, other control and invisible characters are not (same as the API). */
export const noControlCharsMultiline = Validators.pattern(
  /^[^\p{Cf}\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]*$/u,
);

/** Error `errorKey` on the group when both numbers are present and the maximum is below the minimum. */
export function maxNotBelowMin(minKey: string, maxKey: string, errorKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const min: unknown = group.get(minKey)?.value;
    const max: unknown = group.get(maxKey)?.value;
    return typeof min === 'number' && typeof max === 'number' && max < min
      ? { [errorKey]: true }
      : null;
  };
}

/** A replacement requisition must name the employee being replaced (id 0 means none chosen). */
export const replacementNeedsEmployee: ValidatorFn = (group) => {
  const type: unknown = group.get('requisitionType')?.value;
  const replaced: unknown = group.get('replacedEmployeeId')?.value;
  return type === 'REPLACEMENT' && !(typeof replaced === 'number' && replaced > 0)
    ? { replacedRequired: true }
    : null;
};

/** The target join date cannot be before today. A missing date is fine (the field is optional). */
export function notPastDate(today: () => Date = () => new Date()): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    const t = today();
    const startOfToday = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return value < startOfToday ? { pastDate: true } : null;
  };
}

/** A calendar date as yyyy-MM-dd in the user's own time zone (toISOString would shift it by the UTC offset). */
export function toLocalIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses yyyy-MM-dd as a local date; anything else gives null. */
export function parseLocalIsoDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
