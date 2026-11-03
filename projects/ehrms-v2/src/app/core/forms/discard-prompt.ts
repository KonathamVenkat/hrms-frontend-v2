import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Knows which open forms hold edits that were not saved, so the page can warn before the browser tab is closed or the
 * user navigates away. Each form registers itself through a DiscardPrompt and is forgotten when its component goes.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesTracker {
  private readonly checks = new Set<() => boolean>();

  /** Returns the function that removes the check again. */
  register(check: () => boolean): () => void {
    this.checks.add(check);
    return () => this.checks.delete(check);
  }

  hasUnsavedChanges(): boolean {
    return [...this.checks].some((check) => check());
  }
}

/**
 * The "You have unsaved changes" question of one modal form. Create it as a field of the component that owns the form:
 *
 *   readonly discard = new DiscardPrompt(() => this.showModal() && this.form.dirty);
 *
 * Cancel, the X and Escape call `request(close)`:
 * - the form adds the FIRST record its tab needs (`isAdding`): it cannot be closed, a notice says to fill it in and save
 *   (`kind` is 'empty'); the template also hides the Close buttons (`mustFill()`), so only Escape reaches this;
 * - otherwise, something was typed: ask "You have unsaved changes" (`kind` is 'unsaved');
 * - otherwise nothing would be lost: close at once.
 * Once the tab has a saved record, `isAdding` turns false and the form closes like any other.
 * Escape while a question or notice is open means "keep editing".
 */
export class DiscardPrompt {
  readonly asking = signal(false);
  /** Which question is open; read it when `asking()` is true. */
  readonly kind = signal<'unsaved' | 'empty'>('unsaved');
  private readonly isDirty: () => boolean;
  private readonly isAdding: () => boolean;

  constructor(isDirty: () => boolean, isAdding: () => boolean = () => false) {
    this.isDirty = isDirty;
    this.isAdding = isAdding;
    const tracker = inject(UnsavedChangesTracker);
    inject(DestroyRef).onDestroy(tracker.register(isDirty));
  }

  request(close: () => void): void {
    if (this.asking()) {
      this.asking.set(false);
    } else if (this.isAdding()) {
      this.kind.set('empty');
      this.asking.set(true);
    } else if (this.isDirty()) {
      this.kind.set('unsaved');
      this.asking.set(true);
    } else {
      close();
    }
  }

  /** True while the form cannot be closed: it adds the first required record of its tab. Hide the Close buttons then. */
  mustFill(): boolean {
    return this.isAdding();
  }

  /** "Keep editing", and the state a form starts from after it was closed. */
  keep(): void {
    this.asking.set(false);
  }
}
