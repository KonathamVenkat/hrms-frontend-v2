import { TranslateService } from '@ngx-translate/core';
import { recruitmentErrorMessage } from './recruitment-errors';

/** Returns the key itself, except for the rule keys listed: those get a readable text, like a loaded language file. */
function translateWith(known: Record<string, string> = {}): TranslateService {
  return { instant: (key: string) => known[key] ?? key } as unknown as TranslateService;
}

describe('recruitmentErrorMessage', () => {
  it('shows a business-rule refusal by its rule code', () => {
    const translate = translateWith({
      'recruitment.errors.rules.SELF_APPROVAL_NOT_ALLOWED': 'Another person must decide.',
    });
    const err = { status: 409, error: { errors: { ruleCode: 'SELF_APPROVAL_NOT_ALLOWED' } } };
    expect(recruitmentErrorMessage(translate, err)).toBe('Another person must decide.');
  });

  it('falls back to the status text when the rule code has no translation', () => {
    const err = {
      status: 409,
      error: { errors: { ruleCode: 'SOMETHING_NEW' }, message: 'raw server text' },
    };
    expect(recruitmentErrorMessage(translateWith(), err)).toBe('recruitment.errors.stale');
  });

  it('treats a plain 409 as "changed by someone else" and never shows the raw server text', () => {
    const err = {
      status: 409,
      error: { message: 'Optimistic lock failed on table JOB_REQUISITIONS' },
    };
    expect(recruitmentErrorMessage(translateWith(), err)).toBe('recruitment.errors.stale');
  });

  it('keeps the generic table for the other statuses, and the screen fallback for 422', () => {
    expect(recruitmentErrorMessage(translateWith(), { status: 403 })).toBe(
      'common.httpErrors.forbidden',
    );
    expect(recruitmentErrorMessage(translateWith(), { status: 0 })).toBe(
      'common.httpErrors.offline',
    );
    expect(
      recruitmentErrorMessage(translateWith(), { status: 400, error: { message: 'bad field x' } }),
    ).toBe('common.httpErrors.badRequest');
    expect(
      recruitmentErrorMessage(translateWith(), { status: 422 }, 'recruitment.form.saveFailed'),
    ).toBe('recruitment.form.saveFailed');
  });
});
