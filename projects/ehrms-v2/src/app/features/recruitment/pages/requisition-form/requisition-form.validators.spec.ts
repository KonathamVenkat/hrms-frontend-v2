import { FormControl, FormGroup } from '@angular/forms';
import {
  maxNotBelowMin,
  noControlChars,
  noControlCharsMultiline,
  notPastDate,
  parseLocalIsoDate,
  replacementNeedsEmployee,
  toLocalIsoDate,
} from './requisition-form.validators';

describe('noControlChars', () => {
  it('accepts ordinary and Arabic text and refuses control or invisible characters', () => {
    expect(noControlChars(new FormControl('Data Analyst'))).toBeNull();
    expect(noControlChars(new FormControl('محلل بيانات'))).toBeNull();
    expect(noControlChars(new FormControl('Analyst​x'))).not.toBeNull(); // zero-width space
    expect(noControlChars(new FormControl('line\nbreak'))).not.toBeNull();
  });
});

describe('noControlCharsMultiline', () => {
  it('allows line breaks and tabs but not other control or invisible characters', () => {
    expect(noControlCharsMultiline(new FormControl('first\nsecond\tthird'))).toBeNull();
    expect(noControlCharsMultiline(new FormControl('bad\u0007bell'))).not.toBeNull();
    expect(noControlCharsMultiline(new FormControl('zero​width'))).not.toBeNull();
  });
});

describe('maxNotBelowMin', () => {
  const group = (min: number | null, max: number | null) =>
    new FormGroup(
      { min: new FormControl(min), max: new FormControl(max) },
      maxNotBelowMin('min', 'max', 'range'),
    );

  it('flags a maximum below the minimum, and only then', () => {
    expect(group(5, 2).hasError('range')).toBe(true);
    expect(group(2, 2).hasError('range')).toBe(false);
    expect(group(2, 5).hasError('range')).toBe(false);
  });

  it('ignores a missing side', () => {
    expect(group(5, null).hasError('range')).toBe(false);
    expect(group(null, 2).hasError('range')).toBe(false);
  });
});

describe('replacementNeedsEmployee', () => {
  const group = (type: string, replaced: number) =>
    new FormGroup(
      { requisitionType: new FormControl(type), replacedEmployeeId: new FormControl(replaced) },
      replacementNeedsEmployee,
    );

  it('requires the replaced employee for a replacement only', () => {
    expect(group('REPLACEMENT', 0).hasError('replacedRequired')).toBe(true);
    expect(group('REPLACEMENT', 7).hasError('replacedRequired')).toBe(false);
    expect(group('NEW', 0).hasError('replacedRequired')).toBe(false);
  });
});

describe('notPastDate', () => {
  const today = () => new Date(2026, 9, 19, 15, 30); // 19 Oct 2026, mid-afternoon
  const check = notPastDate(today);

  it('accepts today and later, refuses earlier days, and ignores an empty date', () => {
    expect(check(new FormControl(new Date(2026, 9, 19)))).toBeNull();
    expect(check(new FormControl(new Date(2026, 9, 20)))).toBeNull();
    expect(check(new FormControl(new Date(2026, 9, 18)))).toEqual({ pastDate: true });
    expect(check(new FormControl(null))).toBeNull();
  });
});

describe('local ISO dates', () => {
  it('formats a date in its own time zone, never shifted by the UTC offset', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toLocalIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('parses yyyy-MM-dd as the local day and rejects anything else', () => {
    const d = parseLocalIsoDate('2026-10-19');
    expect(d && [d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 19]);
    expect(parseLocalIsoDate('19/10/2026')).toBeNull();
    expect(parseLocalIsoDate(null)).toBeNull();
    expect(parseLocalIsoDate(undefined)).toBeNull();
  });

  it('round-trips', () => {
    expect(toLocalIsoDate(parseLocalIsoDate('2026-02-28') as Date)).toBe('2026-02-28');
  });
});
