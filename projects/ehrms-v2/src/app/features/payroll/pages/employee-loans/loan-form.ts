import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { ruleMessage } from '../../../../core/utils/http-error-message';
import { EmployeeSearchSelect } from '../../../employee/components/employee-search-select/employee-search-select';
import { EmployeeLoan, LoanType } from '../../models/payroll.model';
import { PayrollService } from '../../services/payroll.service';
import { loanFigures } from './loan-maths';

/** Today's month as yyyy-MM, in local time. */
function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Record an approved loan: employee, type, principal, months, first month and, for a loan already running, the
 * instalments paid before. Shows the instalment the server will store before saving; one save at a time.
 */
@Component({
  selector: 'app-loan-form',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    CdkTrapFocus,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    AccessibleDialogDirective,
    EmployeeSearchSelect,
  ],
  templateUrl: './loan-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoanForm {
  readonly types = input.required<LoanType[]>();
  readonly saved = output<EmployeeLoan>();
  readonly closed = output<void>();

  private readonly svc = inject(PayrollService);
  private readonly translate = inject(TranslateService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    employeeId: new FormControl<number | null>(null, Validators.required),
    componentId: new FormControl<number | null>(null, Validators.required),
    principal: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    instalmentCount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(360),
      Validators.pattern(/^\d+$/),
    ]),
    startMonth: new FormControl(thisMonth(), {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)],
    }),
    instalmentsPaid: new FormControl<number | null>(0, [
      Validators.min(0),
      Validators.pattern(/^\d+$/),
    ]),
    remarks: new FormControl('', { nonNullable: true, validators: Validators.maxLength(500) }),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** What the server will store, or null while the figures are incomplete or impossible. */
  readonly figures = computed(() => {
    const v = this.value();
    return loanFigures(
      Number(v.principal),
      Number(v.instalmentCount),
      v.startMonth ?? '',
      Number(v.instalmentsPaid ?? 0),
    );
  });

  /** Already-paid instalments must be fewer than the months (a repaid loan is not recorded). */
  readonly paidTooMany = computed(() => {
    const v = this.value();
    return v.instalmentCount != null && (v.instalmentsPaid ?? 0) >= v.instalmentCount;
  });

  invalid(name: keyof LoanForm['form']['controls']): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  save(): void {
    if (this.saving()) return;
    if (this.form.invalid || this.paidTooMany() || !this.figures()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.svc
      .createLoan({
        employeeId: v.employeeId!,
        componentId: v.componentId!,
        principal: Number(v.principal),
        instalmentCount: Number(v.instalmentCount),
        startMonth: v.startMonth,
        instalmentsPaid: Number(v.instalmentsPaid ?? 0),
        remarks: v.remarks.trim() || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (loan) => this.saved.emit(loan),
        error: (err: unknown) =>
          this.error.set(
            ruleMessage(this.translate, err, 'payroll.loans.errors.rules') ||
              this.translate.instant('payroll.loans.errors.saveFailed'),
          ),
      });
  }
}
