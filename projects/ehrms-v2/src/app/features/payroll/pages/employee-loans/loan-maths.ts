/**
 * The figures the server will store for a new loan (EmployeeLoanServiceImpl.create): the instalment is the principal
 * divided by the months, rounded DOWN to the cent; the last instalment takes what is left, so it is never smaller.
 * Worked in whole cents so floating point cannot shift a cent.
 */
export interface LoanFigures {
  instalment: number;
  finalInstalment: number;
  /** yyyy-MM of the last instalment. */
  lastMonth: string;
  remaining: number;
}

export function loanFigures(
  principal: number,
  months: number,
  startMonth: string,
  paid = 0,
): LoanFigures | null {
  if (
    !(principal > 0) ||
    !Number.isInteger(months) ||
    months < 1 ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)
  ) {
    return null;
  }
  const cents = Math.round(principal * 100);
  const instalmentCents = Math.floor(cents / months);
  if (instalmentCents < 1) return null;
  const [y, m] = startMonth.split('-').map(Number);
  const last = new Date(y, m - 1 + months - 1, 1); // local date, no time zone shift
  const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
  return {
    instalment: instalmentCents / 100,
    finalInstalment: (cents - instalmentCents * (months - 1)) / 100,
    lastMonth,
    remaining: paid >= months ? 0 : (cents - instalmentCents * paid) / 100,
  };
}
