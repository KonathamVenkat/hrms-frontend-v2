import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, map } from 'rxjs';
import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { timedMessage } from '../../../../core/utils/timed-message';
import { DepartmentSecretaryService } from '../../services/department-secretary.service';

/** Shows who is secretary of the employee's department and lets HR make or remove this employee as secretary. */
@Component({
  selector: 'app-department-secretary',
  imports: [TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './department-secretary.html',
  styleUrl: './department-secretary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentSecretaryCard {
  readonly employeeId = input.required<number>();
  /** Only used to reload when the employee moves to another department. */
  readonly departmentId = input.required<number>();
  /** Named in the confirmation so HR sees exactly who changes; optional. */
  readonly employeeName = input<string | null>(null);

  private svc = inject(DepartmentSecretaryService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly info = rxResource({
    params: () => ({ id: this.employeeId(), department: this.departmentId() }),
    stream: ({ params }) => this.svc.get(params.id).pipe(map((res) => res.data)),
  });

  readonly confirming = signal(false);
  readonly saving = signal(false);
  readonly confirmError = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);

  /** The secretary being replaced, shown in the confirmation; null when removing or when there is none. */
  readonly replacedName = computed(() => {
    const i = this.info.value();
    return i && !i.secretary ? (i.currentSecretaryName ?? null) : null;
  });

  openConfirm(): void {
    this.confirmError.set(null);
    this.confirming.set(true);
  }

  closeConfirm(): void {
    if (this.saving()) return;
    this.confirming.set(false);
  }

  confirm(): void {
    const current = this.info.value();
    if (!current || this.saving()) return;
    this.saving.set(true);
    this.confirmError.set(null);
    this.svc
      .set(this.employeeId(), !current.secretary)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.info.set(res.data);
          this.confirming.set(false);
          this.showSuccess(
            this.translate.instant(
              res.data.secretary
                ? 'employee.departmentSecretary.success.made'
                : 'employee.departmentSecretary.success.removed',
            ),
          );
        },
        error: (err: HttpErrorResponse) => this.confirmError.set(this.messageOf(err)),
      });
  }

  /** A business-rule refusal is shown by its ruleCode, anything else by HTTP status. */
  private messageOf(err: HttpErrorResponse): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `employee.departmentSecretary.errors.rules.${rule}`;
      const text = this.translate.instant(key);
      if (text !== key) return text;
    }
    return getHttpErrorMessage(this.translate, err, {
      409: this.translate.instant('employee.departmentSecretary.errors.stale'),
      500: this.translate.instant('common.httpErrors.unexpected'),
    });
  }
}
