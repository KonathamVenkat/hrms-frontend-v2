import { formatDisplayDate } from '../../core/utils/display-date';
import { RequestType, SummaryDetails } from './models/workflow.model';

/**
 * A request's one-line summary, ready for the template: a translation key with its parameters (rendered with the
 * translate pipe, so it follows a language switch), or the server's plain line when there is nothing to word.
 */
export interface SummaryLine {
  key?: string;
  params?: Record<string, string>;
  text: string;
}

function text(details: SummaryDetails, key: string): string | undefined {
  const v = details[key];
  return v === undefined || v === null || v === '' ? undefined : String(v);
}

/** 3 -> "3", 0.5 -> "0.5", 1.25 -> "1.25": a day count without a trailing ".0". */
function dayCount(value: string | number | null | undefined): string {
  const n = Number(value);
  return value === null || value === undefined || !Number.isFinite(n) ? '' : String(Math.round(n * 100) / 100);
}

/**
 * Words a request in the user's language from the language-neutral facts the server sends (leave: type names, ISO
 * dates, day count). Falls back to the server's English line when the facts are missing or the type has no wording.
 */
export function requestSummary(
  type: RequestType,
  details: SummaryDetails | undefined,
  fallback: string | undefined,
  lang: string,
): SummaryLine {
  const plain: SummaryLine = { text: fallback ?? '' };
  if (!details || type !== 'LEAVE' || !text(details, 'startDate')) {
    return plain;
  }
  const name =
    (lang === 'ar' ? text(details, 'leaveTypeNameAr') : undefined) ??
    text(details, 'leaveTypeNameEn') ??
    text(details, 'leaveTypeCode') ??
    '';
  const days = dayCount(details['totalDays']);
  return {
    key: days === '1' ? 'workflow.summary.leaveOneDay' : 'workflow.summary.leave',
    params: {
      type: name,
      start: formatDisplayDate(text(details, 'startDate'), lang),
      end: formatDisplayDate(text(details, 'endDate'), lang),
      days,
    },
    text: fallback ?? '',
  };
}
