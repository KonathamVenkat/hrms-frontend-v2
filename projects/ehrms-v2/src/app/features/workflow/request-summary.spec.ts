import { describe, expect, it } from 'vitest';

import { requestSummary } from './request-summary';

const leave = {
  leaveTypeCode: 'ANNUAL',
  leaveTypeNameEn: 'Annual Leave',
  leaveTypeNameAr: 'إجازة سنوية',
  startDate: '2026-12-07',
  endDate: '2026-12-09',
  totalDays: 3,
};

describe('requestSummary', () => {
  it('words a leave request from its facts, with the English type name', () => {
    const line = requestSummary('LEAVE', leave, 'ANNUAL 2026-12-07 to 2026-12-09 (3.0 days)', 'en');
    expect(line.key).toBe('workflow.summary.leave');
    expect(line.params).toEqual({ type: 'Annual Leave', start: '07 Dec 2026', end: '09 Dec 2026', days: '3' });
  });

  it('uses the Arabic type name in Arabic, and falls back to English then the code', () => {
    expect(requestSummary('LEAVE', leave, undefined, 'ar').params?.['type']).toBe('إجازة سنوية');
    expect(requestSummary('LEAVE', { ...leave, leaveTypeNameAr: null }, undefined, 'ar').params?.['type']).toBe(
      'Annual Leave',
    );
    expect(
      requestSummary('LEAVE', { ...leave, leaveTypeNameEn: null, leaveTypeNameAr: null }, undefined, 'fr').params?.[
        'type'
      ],
    ).toBe('ANNUAL');
  });

  it('says one day in the singular and keeps half days', () => {
    expect(requestSummary('LEAVE', { ...leave, totalDays: 1 }, undefined, 'en').key).toBe(
      'workflow.summary.leaveOneDay',
    );
    expect(requestSummary('LEAVE', { ...leave, totalDays: 0.5 }, undefined, 'en').params?.['days']).toBe('0.5');
  });

  it('falls back to the server line without facts or for a type with no wording', () => {
    expect(requestSummary('LEAVE', undefined, 'plain line', 'en')).toEqual({ text: 'plain line' });
    expect(requestSummary('LEAVE', { leaveTypeCode: 'ANNUAL' }, 'plain line', 'en')).toEqual({ text: 'plain line' });
    expect(requestSummary('LEAVE', undefined, undefined, 'en')).toEqual({ text: '' });
  });
});
