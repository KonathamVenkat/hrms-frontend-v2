import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';
import { getHttpErrorMessage, ruleMessage, serverMessage } from './http-error-message';

const translate = { instant: (key: string) => key } as unknown as TranslateService;

describe('serverMessage', () => {
  it('reads the backend message', () => {
    expect(serverMessage({ error: { message: 'Duplicate email' } })).toBe('Duplicate email');
  });

  it('ignores anything that is not a non-empty string message', () => {
    expect(serverMessage(null)).toBeUndefined();
    expect(serverMessage('boom')).toBeUndefined();
    expect(serverMessage({ error: { message: 42 } })).toBeUndefined();
    expect(serverMessage({ error: { message: '' } })).toBeUndefined();
  });
});

describe('getHttpErrorMessage', () => {
  it('prefers a per-screen override', () => {
    expect(getHttpErrorMessage(translate, { status: 404 }, { 404: 'Gone' })).toBe('Gone');
  });

  it('maps known statuses to translation keys', () => {
    expect(getHttpErrorMessage(translate, { status: 403 })).toBe('common.httpErrors.forbidden');
    expect(getHttpErrorMessage(translate, { status: 0 })).toBe('common.httpErrors.offline');
  });

  it('uses the backend message for conflicts and unknown errors', () => {
    expect(getHttpErrorMessage(translate, { status: 409, error: { message: 'In use' } })).toBe('In use');
    expect(getHttpErrorMessage(translate, { status: 500 })).toBe('common.httpErrors.unexpected');
  });

  it('copes with a value that is not an HTTP error', () => {
    expect(getHttpErrorMessage(translate, undefined)).toBe('common.httpErrors.unexpected');
  });
});

describe('ruleMessage', () => {
  const known = new Set(['p.RULE_A', 'p.conflict']);
  const t = { instant: (key: string) => (known.has(key) ? `text:${key}` : key) } as unknown as TranslateService;

  it('uses the screen text for the business rule the backend named', () => {
    expect(ruleMessage(t, { status: 409, error: { errors: { ruleCode: 'RULE_A' } } }, 'p')).toBe('text:p.RULE_A');
  });

  it('falls back to the conflict text for a 409 with no known rule', () => {
    expect(ruleMessage(t, { status: 409, error: { errors: { ruleCode: 'OTHER' } } }, 'p')).toBe('text:p.conflict');
    expect(ruleMessage(t, { status: 409 }, 'p')).toBe('text:p.conflict');
  });

  it('is undefined when the screen has no text, so the caller falls back to the status message', () => {
    expect(ruleMessage(t, { status: 400, error: { errors: { ruleCode: 'OTHER' } } }, 'p')).toBeUndefined();
    expect(ruleMessage(t, null, 'p')).toBeUndefined();
  });
});
