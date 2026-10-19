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
import { STAGE_TYPES, Stage, StageRequest, StageType } from '../../models/setup.model';
import { RecruitmentSetupService } from '../../services/recruitment-setup.service';

type ConfirmAction = 'toggle' | 'delete';
type FormKey = 'code' | 'name' | 'nameAr' | 'stageType' | 'sortOrder';

/** Pipeline stages (SYSTEM_ADMIN). System stages are the ones the hiring flow relies on and are locked. */
@Component({
  selector: 'app-recruitment-stages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FieldA11yDirective,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './stages.html',
  styleUrl: './stages.css',
})
export class RecruitmentStages implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RecruitmentSetupService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly stageTypes = STAGE_TYPES;
  readonly stages = signal<Stage[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);
  readonly showModal = signal(false);
  readonly editing = signal<Stage | null>(null);
  readonly confirmItem = signal<Stage | null>(null);
  readonly confirmAction = signal<ConfirmAction>('toggle');
  readonly confirmError = signal<string | null>(null);
  private readonly acting = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Z0-9_]+$/)]],
    name: [
      '',
      [Validators.required, Validators.maxLength(100), Validators.pattern(/^[^\p{Cc}\p{Cf}]*$/u)],
    ],
    nameAr: [
      '',
      [Validators.required, Validators.maxLength(200), Validators.pattern(/^[^\p{Cc}\p{Cf}]*$/u)],
    ],
    stageType: this.fb.control<StageType>('OPEN', Validators.required),
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
      .getStages()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => (res.success ? this.stages.set(res.data) : this.error.set(res.message)),
        error: (err: unknown) =>
          this.error.set(
            recruitmentErrorMessage(this.translate, err, 'recruitment.setup.stages.loadFailed'),
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
      stageType: 'OPEN',
      sortOrder: 10,
      isActive: true,
    });
    this.form.controls.code.enable();
    this.form.controls.stageType.enable();
    this.showModal.set(true);
  }

  openEdit(s: Stage): void {
    this.editing.set(s);
    this.error.set(null);
    this.form.reset({
      code: s.code,
      name: s.name,
      nameAr: s.nameAr,
      stageType: s.stageType,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
    });
    // A stage keeps its type for life, and a system stage keeps its code: the hiring flow depends on both.
    this.form.controls.stageType.disable();
    if (s.isSystem) this.form.controls.code.disable();
    else this.form.controls.code.enable();
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
    const payload: StageRequest = {
      code: v.code,
      name: v.name.trim(),
      nameAr: v.nameAr.trim(),
      stageType: v.stageType,
      sortOrder: v.sortOrder,
      isActive: v.isActive,
      version: current?.version,
    };
    const call = current
      ? this.svc.updateStage(current.id, payload)
      : this.svc.createStage(payload);
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
              ? 'recruitment.setup.stages.success.updated'
              : 'recruitment.setup.stages.success.created',
            { name: res.data.name },
          ),
        );
        this.showModal.set(false);
        this.load();
      },
      error: (err: unknown) => this.error.set(recruitmentErrorMessage(this.translate, err)),
    });
  }

  openConfirm(s: Stage, action: ConfirmAction): void {
    this.confirmError.set(null);
    this.confirmAction.set(action);
    this.confirmItem.set(s);
  }

  cancelConfirm(): void {
    if (this.acting()) return;
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const s = this.confirmItem();
    if (!s || this.acting()) return;
    const action = this.confirmAction();
    const call =
      action === 'delete' ? this.svc.deleteStage(s.id) : this.svc.setStageActive(s.id, !s.isActive);
    const doneKey =
      action === 'delete'
        ? 'recruitment.setup.stages.success.deleted'
        : s.isActive
          ? 'recruitment.setup.stages.success.deactivated'
          : 'recruitment.setup.stages.success.activated';
    this.acting.set(true);
    call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: s.name }));
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
    return fieldErrorMessage(this.form.controls[key], this.translate, {
      min: 'recruitment.setup.errors.sortOrder',
      max: 'recruitment.setup.errors.sortOrder',
    });
  }
}
