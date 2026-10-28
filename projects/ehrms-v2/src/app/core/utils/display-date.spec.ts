import { formatDisplayDate, formatDisplayDateTime } from './display-date';

describe('formatDisplayDate', () => {
  it('shows a dash for empty values', () => {
    expect(formatDisplayDate(undefined, 'en')).toBe('—');
    expect(formatDisplayDate('', 'fr')).toBe('—');
  });

  it('returns the input when it is not a date', () => {
    expect(formatDisplayDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('follows the UI language', () => {
    const en = formatDisplayDate('2026-01-05', 'en');
    const fr = formatDisplayDate('2026-01-05', 'fr');
    const ar = formatDisplayDate('2026-01-05', 'ar');
    expect(en).toContain('Jan');
    expect(fr).toContain('janv');
    expect(ar).toMatch(/2026/); // Western digits
    expect(new Set([en, fr, ar]).size).toBe(3);
  });

  it('falls back to English for an unknown language', () => {
    expect(formatDisplayDate('2026-01-05', 'xx')).toBe(formatDisplayDate('2026-01-05', 'en'));
  });
});

describe('formatDisplayDateTime', () => {
  it('adds the time to the date and follows the UI language', () => {
    const en = formatDisplayDateTime('2026-01-05T09:30:00', 'en');
    expect(en).toContain('Jan');
    expect(en).toContain('09:30');
    expect(formatDisplayDateTime('2026-01-05T09:30:00', 'fr')).toContain('janv');
    expect(formatDisplayDateTime(undefined, 'en')).toBe('—');
  });
});
