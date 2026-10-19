import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { FieldA11yDirective } from '../../../../core/directives/field-a11y.directive';
import { fieldErrorMessage, isFieldInvalid } from '../../../../core/forms/field-errors';
import { timedMessage } from '../../../../core/utils/timed-message';
import { recruitmentErrorMessage } from '../../recruitment-errors';
import {
  REASON_SCOPES,
  ReasonScope,
  RejectionReason,
  RejectionReasonRequest,
} from '../../models/setup.model';
import { RecruitmentSetupService } from '../../services/recruitment-setup.service';

type ConfirmAction = 'toggle' | 'delete';
type FormKey = 'code' | 'name' | 'nameAr' | 'appliesTo' | 'sortOrder';

/** Reasons offered when an application or an offer is turned down (SYSTEM_ADMIN). */
@Component({
  selector: 'app-rejection-reasons',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FieldA11yDirective,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './rejection-reasons.html',
  styleUrl: './rejection-reasons.css',
})
export class RejectionReasons implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RecruitmentSetupService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly scopes = REASON_SCOPES;
  readonly reasons = signal<RejectionReason[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);
  readonly showModal = signal(false);
  readonly editing = signal<RejectionReason | null>(null);
  readonly confirmItem = signal<RejectionReason | null>(null);
  readonly confirmAction = signal<ConfirmAction>('toggle');
  readonly confirmError = signal<string | null>(null);
  private readonly acting = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: [
      '',
      [Validators.required, Validators.maxLength(150), Validators.pattern(/^[^\p{Cc}\p{Cf}]*$/u)],
    ],
    nameAr: [
      '',
      [Validators.required, Validators.maxLength(300), Validators.pattern(/^[^\p{Cc}\p{Cf}]*$/u)],
    ],
    appliesTo: this.fb.control<ReasonScope>('APPLICATION', Validators.required),
    sortOrder: [10, [Validators.required, Validators.min(0), Validators.max(999)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.form.controls.code.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v !== v.toUpperCase())
          this.form.controls.code.setValue(v.toUpperCase(), { emitEvent: false });
      });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc
      .getReasons()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => (res.success ? this.reasons.set(res.data) : this.error.set(res.message)),
        error: (err: unknown) =>
          this.error.set(
            recruitmentErrorMessage(this.translate, err, 'recruitment.setup.reasons.loadFailed'),
          ),
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.reset({
      code: '',
      name: '',
      nameAr: '',
      appliesTo: 'APPLICATION',
      sortOrder: 10,
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEdit(r: RejectionReason): void {
    this.editing.set(r);
    this.error.set(null);
    this.form.reset({
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      appliesTo: r.appliesTo,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    if (this.saving()) return;
    this.showModal.set(false);
    this.error.set(null);
  }

  onSubmit(): void {
    if (this.saving()) return; // a double click must not send the request twice
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const current = this.editing();
    const payload: RejectionReasonRequest = {
      code: v.code,
      name: v.name.trim(),
      nameAr: v.nameAr.trim(),
      appliesTo: v.appliesTo,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
      version: current?.version,
    };
    const call = current
      ? this.svc.updateReason(current.id, payload)
      : this.svc.createReason(payload);
    this.saving.set(true);
    this.error.set(null);
    call.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set(res.message);
          return;
        }
        this.showSuccess(
          this.translate.instant(
            current
              ? 'recruitment.setup.reasons.success.updated'
              : 'recruitment.setup.reasons.success.created',
            { name: res.data.name },
          ),
        );
        this.showModal.set(false);
        this.load();
      },
      error: (err: unknown) => this.error.set(recruitmentErrorMessage(this.translate, err)),
    });
  }

  openConfirm(r: RejectionReason, action: ConfirmAction): void {
    this.confirmError.set(null);
    this.confirmAction.set(action);
    this.confirmItem.set(r);
  }

  cancelConfirm(): void {
    if (this.acting()) return;
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const r = this.confirmItem();
    if (!r || this.acting()) return;
    const action = this.confirmAction();
    const call =
      action === 'delete'
        ? this.svc.deleteReason(r.id)
        : this.svc.setReasonActive(r.id, !r.isActive);
    const doneKey =
      action === 'delete'
        ? 'recruitment.setup.reasons.success.deleted'
        : r.isActive
          ? 'recruitment.setup.reasons.success.deactivated'
          : 'recruitment.setup.reasons.success.activated';
    this.acting.set(true);
    call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: r.name }));
        this.confirmItem.set(null);
        this.load();
      },
      // Stay in the dialog: the user is looking here, a page banner is easy to miss.
      error: (err: unknown) => this.confirmError.set(recruitmentErrorMessage(this.translate, err)),
    });
  }

  isInvalid(key: FormKey): boolean {
    return isFieldInvalid(this.form.controls[key]);
  }

  getError(key: FormKey): string {
    const control = this.form.controls[key];
    // For the names the only pattern is "no control or invisible characters"; the generic text talks about codes.
    if ((key === 'name' || key === 'nameAr') && control.touched && control.hasError('pattern')) {
      return this.translate.instant('recruitment.form.errors.invisibleCharacters');
    }
    return fieldErrorMessage(control, this.translate, {
      min: 'recruitment.setup.errors.sortOrder',
      max: 'recruitment.setup.errors.sortOrder',
    });
  }
}
