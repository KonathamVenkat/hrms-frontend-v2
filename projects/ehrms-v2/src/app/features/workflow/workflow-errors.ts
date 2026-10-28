import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { getHttpErrorMessage } from '../../core/utils/http-error-message';

const HANDLED = new Set([0, 400, 401, 403, 404, 409, 422, 500]);

/**
 * A failed workflow call in the user's language, never the server's raw text: a business-rule refusal by
 * its rule code (`workflow.errors.rules.<CODE>`), 409 as "already handled", a 422 with no translated rule as a
 * generic "action failed", anything else by HTTP status.
 */
export function workflowErrorMessage(translate: TranslateService, err: unknown): string {
  const rule: unknown = (err as HttpErrorResponse | null)?.error?.errors?.ruleCode;
  if (typeof rule === 'string') {
    const key = `workflow.errors.rules.${rule}`;
    const text = translate.instant(key);
    if (text !== key) return text;
  }
  // Statuses the shared helper words itself; every other status gets the generic text, not server text.
  const status = (err as { status?: number } | null)?.status;
  const unexpected = translate.instant('common.httpErrors.unexpected');
  const generic = status != null && !HANDLED.has(status) ? { [status]: unexpected } : {};
  return getHttpErrorMessage(translate, err, {
    ...generic,
    400: translate.instant('common.httpErrors.badRequest'),
    409: translate.instant('workflow.errors.stale'),
    422: translate.instant('common.httpErrors.actionFailed'),
    500: unexpected,
  });
}
