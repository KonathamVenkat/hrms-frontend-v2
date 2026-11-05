import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;
/** BCrypt takes at most 72 BYTES, so Arabic and other non-ASCII passwords can hold fewer than 72 characters. */
export const PASSWORD_MAX_BYTES = 72;

/** Same limit as the backend: the password in UTF-8 is at most 72 bytes. Reported as `maxlength`. */
export function passwordMaxBytes(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  const bytes = new TextEncoder().encode(value).length;
  return bytes > PASSWORD_MAX_BYTES
    ? { maxlength: { requiredLength: PASSWORD_MAX_BYTES, actualLength: bytes } }
    : null;
}

/**
 * Mirrors the backend's PasswordPolicy (which stays authoritative): an uppercase letter,
 * a lowercase letter and a digit. Length is checked separately with minLength/maxLength.
 */
export function passwordPolicy(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null;
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) ? null : { policy: true };
}

/** Validators for any control that holds a NEW password. */
export const NEW_PASSWORD_VALIDATORS: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN_LENGTH),
  passwordMaxBytes,
  passwordPolicy,
];
