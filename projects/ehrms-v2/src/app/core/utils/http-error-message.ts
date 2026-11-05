import { TranslateService } from '@ngx-translate/core';

/**
 * Maps a failed HttpClient response to a user-facing message, with per-screen overrides.
 * `overrides` values must already be resolved (e.g. via `translate.instant('...')` at the
 * call site) — this function only translates its own generic per-status-code fallbacks.
 */
export function getHttpErrorMessage(
  translate: TranslateService,
  err: unknown,
  overrides: Partial<Record<number, string>> = {},
): string {
  const status = (err as { status?: number } | null)?.status;
  const override = status != null ? overrides[status] : undefined;
  if (override) {
    return override;
  }

  switch (status) {
    case 401:
      return translate.instant('common.httpErrors.unauthorized');
    case 403:
      return translate.instant('common.httpErrors.forbidden');
    case 404:
      return translate.instant('common.httpErrors.notFound');
    case 409:
      return serverMessage(err) || translate.instant('common.httpErrors.conflict');
    case 400:
      return serverMessage(err) || translate.instant('common.httpErrors.badRequest');
    case 0:
      return translate.instant('common.httpErrors.offline');
    default:
      return serverMessage(err) || translate.instant('common.httpErrors.unexpected');
  }
}

/**
 * The screen's own text for a refusal: by the business rule the backend named (`<prefix>.<RULE_CODE>`), else for a 409 by
 * `<prefix>.conflict`. Undefined when the screen has no text for it, so the caller falls back to the HTTP status message.
 */
export function ruleMessage(translate: TranslateService, err: unknown, prefix: string): string | undefined {
  const rule: unknown = (err as { error?: { errors?: { ruleCode?: unknown } } } | null)?.error?.errors?.ruleCode;
  const keys = [typeof rule === 'string' ? `${prefix}.${rule}` : '', (err as { status?: number } | null)?.status === 409 ? `${prefix}.conflict` : ''];
  for (const key of keys) {
    if (!key) continue;
    const text = translate.instant(key);
    if (text !== key) return text;
  }
  return undefined;
}

/** The `message` the backend put in an error response, if there is one. */
export function serverMessage(err: unknown): string | undefined {
  const message = (err as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' && message ? message : undefined;
}
