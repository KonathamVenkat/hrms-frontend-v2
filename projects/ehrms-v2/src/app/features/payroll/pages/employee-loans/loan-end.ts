import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { ruleMessage } from '../../../../core/utils/http-error-message';
import { EmployeeLoan } from '../../models/payroll.model';
import { PayrollService } from '../../services/payroll.service';

/**
 * Close (repaid early) or cancel (entered by mistake) a running loan. States exactly which loan of whom and what is
 * left, asks why, and sends once. A loan someone else changed meanwhile is refused (409) with a reload hint.
 */
@Component({
  selector: 'app-loan-end',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    CdkTrapFocus,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    AccessibleDialogDirective,
  ],
  template: `
    <div class="modal-backdrop">
      <div
        class="modal"
        [appAccessibleDialog]="'le-title'"
        (dialogClosed)="closed.emit()"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
      >
        <div class="modal-header">
          <h2 id="le-title" class="modal-title">
            {{ 'payroll.loans.end.' + action() + 'Title' | translate }}
          </h2>
        </div>
        @if (error()) {
          <div class="modal-alert" role="alert">{{ error() }}</div>
        }
        <div class="modal-body">
          <p>
            {{
              'payroll.loans.end.' + action() + 'Message'
                | translate
                  : {
                      type: loan().loanTypeName,
                      employee: loan().employeeName,
                      code: loan().employeeCode,
                      remaining: (loan().remainingBalance | number: '1.2-2'),
                    }
            }}
          </p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'payroll.loans.end.reason' | translate }}</mat-label>
            <textarea matInput rows="3" maxlength="500" [formControl]="reason" required></textarea>
            @if (reason.invalid && reason.touched) {
              <mat-error>{{ 'common.validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-cancel" (click)="closed.emit()" [disabled]="saving()">
            {{ 'common.cancel' | translate }}
          </button>
          <button type="button" class="btn-deactivate" (click)="confirm()" [disabled]="saving()">
            @if (saving()) {
              <mat-spinner diameter="18" />
            }
            {{ 'payroll.loans.end.' + action() + 'Confirm' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanEnd {
  readonly loan = input.required<EmployeeLoan>();
  readonly action = input.required<'close' | 'cancel'>();
  readonly done = output<EmployeeLoan>();
  readonly closed = output<void>();

  private readonly svc = inject(PayrollService);
  private readonly translate = inject(TranslateService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)],
  });

  confirm(): void {
    if (this.saving()) return;
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.svc
      .endLoan(this.loan().loanId, this.action(), this.loan().version, this.reason.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (loan) => this.done.emit(loan),
        error: (err: unknown) =>
          this.error.set(
            ruleMessage(this.translate, err, 'payroll.loans.errors.rules') ||
              this.translate.instant('payroll.loans.errors.saveFailed'),
          ),
      });
  }
}
