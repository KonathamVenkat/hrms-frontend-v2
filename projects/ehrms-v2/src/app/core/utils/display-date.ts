/**
 * Locale used to format dates for each UI language. English keeps day-month-year order and Arabic
 * uses Western digits, as elsewhere in the app.
 */
const DATE_LOCALES: Record<string, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  ar: 'ar-u-nu-latn',
};

const DATE_PARTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };

function format(
  value: string | null | undefined,
  lang: string,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(DATE_LOCALES[lang] ?? DATE_LOCALES['en'], options);
}

/** Formats an ISO date (yyyy-MM-dd or a full timestamp) as "05 Jan 2026" in the given UI language. */
export function formatDisplayDate(value: string | null | undefined, lang: string): string {
  return format(value, lang, DATE_PARTS);
}

/** Formats an ISO timestamp as "05 Jan 2026, 09:30" in the given UI language. */
export function formatDisplayDateTime(value: string | null | undefined, lang: string): string {
  return format(value, lang, { ...DATE_PARTS, hour: '2-digit', minute: '2-digit' });
}
