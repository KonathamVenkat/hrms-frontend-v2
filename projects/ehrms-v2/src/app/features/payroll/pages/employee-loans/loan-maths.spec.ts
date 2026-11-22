import { loanFigures } from './loan-maths';

describe('loanFigures', () => {
  it("matches the server for the sheet's 12,122,140 over 36 months", () => {
    expect(loanFigures(12122140, 36, '2026-12')).toEqual({
      instalment: 336726.11,
      finalInstalment: 336726.15,
      lastMonth: '2029-11',
      remaining: 12122140,
    });
  });

  it('starts a running loan from the instalments already paid', () => {
    expect(loanFigures(12122140, 36, '2026-12', 10)?.remaining).toBe(8754878.9);
    expect(loanFigures(1000, 10, '2026-12', 10)?.remaining).toBe(0);
  });

  it('rolls the last month over the year end', () => {
    expect(loanFigures(1200, 2, '2026-12')?.lastMonth).toBe('2027-01');
    expect(loanFigures(1200, 1, '2026-12')?.lastMonth).toBe('2026-12');
  });

  it('gives nothing for figures the server would refuse', () => {
    expect(loanFigures(0, 12, '2026-12')).toBeNull();
    expect(loanFigures(0.5, 60, '2026-12')).toBeNull(); // under a cent a month
    expect(loanFigures(1000, 0, '2026-12')).toBeNull();
    expect(loanFigures(1000, 12, '2026-13')).toBeNull();
  });
});
