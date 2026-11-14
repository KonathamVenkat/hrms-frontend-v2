import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Auth } from '../auth/auth';

/** A screen with a form that can hold edits not yet saved. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a screen that has unsaved edits. Closing the tab or reloading is covered by the
 * screen's own `beforeunload` handler; this covers in-app navigation.
 *
 * It never asks once the session has been cleared. Signing out (here, in another tab, or after a failed
 * refresh) clears the session and then navigates to the sign-in page; if a prompt could keep the screen open,
 * the signed-out user's records and the open form would stay readable on the screen.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  const translate = inject(TranslateService);
  const auth = inject(Auth);
  if (!component.hasUnsavedChanges()) return true;
  if (auth.getToken() === null) return true;
  return (
    typeof window === 'undefined' || window.confirm(translate.instant('common.unsavedChanges'))
  );
};
