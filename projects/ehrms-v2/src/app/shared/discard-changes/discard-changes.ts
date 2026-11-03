import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The "You have unsaved changes" question, shown over a modal form that was asked to close while it holds edits.
 * Put it inside the form's backdrop, before the form's own box, so it paints above it. "Keep editing" comes first, so
 * it takes the focus: pressing Enter by reflex loses nothing. Escape is handled by the form's own dialog (it means keep).
 * `kind` picks the wording: 'unsaved' (something was typed: keep editing or discard) or 'empty' (a new record with nothing
 * entered yet: a notice with one button, because the details must be filled in and saved, there is no way to skip them).
 */
@Component({
  selector: 'app-discard-changes',
  imports: [CdkTrapFocus, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop">
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        aria-describedby="discard-message"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
      >
        <div class="confirm-icon icon-warn">
          <span class="material-icons" aria-hidden="true">edit_note</span>
        </div>
        <h3 id="discard-title" class="confirm-title">{{ (keyBase() + 'title') | translate }}</h3>
        <p id="discard-message" class="confirm-msg">{{ (keyBase() + 'message') | translate }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-save" (click)="keep.emit()">
            {{ (keyBase() + 'keep') | translate }}
          </button>
          @if (kind() === 'unsaved') {
            <button type="button" class="btn-confirm btn-danger" (click)="discard.emit()">
              {{ (keyBase() + 'discard') | translate }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class DiscardChanges {
  readonly kind = input<'unsaved' | 'empty'>('unsaved');
  protected readonly keyBase = computed(() => (this.kind() === 'empty' ? 'common.discard.empty.' : 'common.discard.'));

  /** The user wants to go on editing. */
  readonly keep = output<void>();
  /** The user accepts losing what was typed. */
  readonly discard = output<void>();
}
