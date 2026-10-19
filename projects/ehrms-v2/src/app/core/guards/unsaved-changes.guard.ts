import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/** A screen with a form that can hold edits not yet saved. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a screen that has unsaved edits. Closing the tab or reloading is covered by the
 * screen's own `beforeunload` handler; this covers in-app navigation.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  const translate = inject(TranslateService);
  if (!component.hasUnsavedChanges()) return true;
  return (
    typeof window === 'undefined' || window.confirm(translate.instant('common.unsavedChanges'))
  );
};
