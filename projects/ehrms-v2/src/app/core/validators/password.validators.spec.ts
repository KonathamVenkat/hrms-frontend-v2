import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { NEW_PASSWORD_VALIDATORS, passwordMaxBytes } from './password.validators';

describe('passwordMaxBytes', () => {
  it('accepts up to 72 bytes and refuses more, as the backend does', () => {
    expect(passwordMaxBytes(new FormControl('Aa1' + 'x'.repeat(69)))).toBeNull();
    expect(passwordMaxBytes(new FormControl('Aa1' + 'x'.repeat(70)))).toEqual({
      maxlength: { requiredLength: 72, actualLength: 73 },
    });
  });

  it('counts bytes, so a 43-character Arabic password is too long', () => {
    const arabic = 'كلمة'.repeat(10) + 'Aa1';
    expect(arabic.length).toBe(43);
    expect(passwordMaxBytes(new FormControl(arabic))).not.toBeNull();
  });

  it('is part of the validators for a new password', () => {
    expect(NEW_PASSWORD_VALIDATORS).toContain(passwordMaxBytes);
  });
});
