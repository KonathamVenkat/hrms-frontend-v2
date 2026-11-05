import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/**
 * Keeps the `pattern` error (screens that already test for it keep working) and adds `controlChars`, which
 * `fieldErrorMessage` shows as "hidden or control characters" instead of the generic format message.
 */
function refusing(pattern: RegExp): ValidatorFn {
  const check = Validators.pattern(pattern);
  return (control: AbstractControl): ValidationErrors | null => {
    const error = check(control);
    return error ? { ...error, controlChars: true } : null;
  };
}

/** Same rule as the API: no control or invisible characters (a value pasted with a zero-width space is refused). */
export const noControlChars = refusing(/^[^\p{Cc}\p{Cf}]*$/u);

/** Free text: line breaks and tabs are fine, other control and invisible characters are not (same as the API). */
export const noControlCharsMultiline = refusing(
  /^[^\p{Cf}\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]*$/u,
);
