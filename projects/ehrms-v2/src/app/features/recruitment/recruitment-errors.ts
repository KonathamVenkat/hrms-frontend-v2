import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { getHttpErrorMessage } from '../../core/utils/http-error-message';

/**
 * A failed recruitment call, in the user's language and never the server's raw text: a business-rule refusal
 * by its rule code (`recruitment.errors.rules.<CODE>`), 409 as "changed by someone else", anything else by
 * HTTP status. `fallbackKey` is shown for statuses the generic table does not cover.
 */
export function recruitmentErrorMessage(
  translate: TranslateService,
  err: unknown,
  fallbackKey = 'common.httpErrors.actionFailed',
): string {
  const rule: unknown = (err as HttpErrorResponse | null)?.error?.errors?.ruleCode;
  if (typeof rule === 'string') {
    const key = `recruitment.errors.rules.${rule}`;
    const text = translate.instant(key);
    if (text !== key) return text;
  }
  const t = (key: string) => translate.instant(key);
  return getHttpErrorMessage(translate, err, {
    400: t('common.httpErrors.badRequest'),
    409: t('recruitment.errors.stale'),
    422: t(fallbackKey),
    500: t('common.httpErrors.unexpected'),
  });
}
