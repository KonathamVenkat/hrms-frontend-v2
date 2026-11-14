import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';

let nextId = 0;

/**
 * "Are you sure?" for an action that changes data other people rely on (switching a payroll structure or
 * component on or off, creating or adjusting leave balances). The text is passed in already translated so the
 * dialog can state exactly what changes: the record, the period and the amount.
 *
 * Put it at the end of the page's template, shown with `@if`. "Cancel" comes first and takes the focus, so
 * pressing Enter by reflex changes nothing; Escape cancels; focus returns to the button that opened it. The
 * confirm output fires once however often the button is pressed, and the page closes the dialog and runs the action.
 */
@Component({
  selector: 'app-confirm-action',
  imports: [CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop">
      <div
        class="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="messageId"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
        (keydown.escape)="cancel.emit()"
      >
        <div
          class="confirm-icon"
          [class.icon-warn]="tone() === 'danger'"
          [class.icon-info]="tone() === 'success'"
        >
          <span class="material-icons" aria-hidden="true">{{ icon() }}</span>
        </div>
        <h3 [id]="titleId" class="confirm-title" dir="auto">{{ title() }}</h3>
        <p [id]="messageId" class="confirm-msg" dir="auto">{{ message() }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-cancel" (click)="cancel.emit()">
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            class="btn-confirm"
            [class.btn-danger]="tone() === 'danger'"
            [class.btn-success]="tone() === 'success'"
            (click)="onConfirm()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmAction implements OnDestroy {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  /** 'danger' for an action that switches something off or overrides a number; 'success' for one that switches it on. */
  readonly tone = input<'danger' | 'success'>('danger');
  readonly icon = input('help_outline');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  private readonly id = nextId++;
  protected readonly titleId = `confirm-action-${this.id}-title`;
  protected readonly messageId = `confirm-action-${this.id}-message`;

  private readonly document = inject(DOCUMENT);
  private readonly opener = this.document.activeElement as HTMLElement | null;
  private confirmed = false;

  protected onConfirm(): void {
    if (this.confirmed) return;
    this.confirmed = true;
    this.confirm.emit();
  }

  ngOnDestroy(): void {
    this.opener?.focus?.();
  }
}
