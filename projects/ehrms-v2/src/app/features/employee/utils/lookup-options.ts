import { InfoLookup } from '../models/employee-info.model';

export interface LookupOption {
  value: string;
  label: string;
}

/**
 * Dropdown options for a master whose English name is what the API stores as text. A saved value
 * that is no longer in the master stays selectable, so editing never silently drops it.
 */
export function lookupOptions(list: InfoLookup[], saved: string, arabic: boolean): LookupOption[] {
  const options = list.map((n) => ({
    value: n.name,
    label: arabic && n.nameAr ? n.nameAr : n.name,
  }));
  return saved && !options.some((o) => o.value === saved)
    ? [{ value: saved, label: saved }, ...options]
    : options;
}
