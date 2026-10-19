import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/utils/http-error-message';
import { DepartmentService } from '../../services/department';
import { Department, DepartmentRequest } from '../../models/department';
import { AccessibleDialogDirective } from '../../../../../core/directives/accessible-dialog.directive';

type FormKey = 'code' | 'name' | 'nameAr' | 'description' | 'costCenterCode';
type ConfirmAction = 'toggle' | 'delete';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-departments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './department.html',
  styleUrl: './department.css',
})
export class Departments implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(DepartmentService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);

  departments = signal<Department[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<number | null>(null);
  /** Kept so a PUT does not wipe the department head, which this screen does not edit. */
  private editingHeadId: number | undefined;
  private editingVersion: number | undefined;
  /** Name of the head of the department being edited; shown read-only. */
  readonly headName = signal('');
  confirmItem = signal<Department | null>(null);
  confirmAction = signal<ConfirmAction>('toggle');
  confirmError = signal<string | null>(null);
  filterText = signal('');
  filterActive = signal<StatusFilter>('all');

  readonly activeCount = computed(() => this.departments().filter((d) => d.isActive).length);

  readonly filtered = computed(() => {
    const text = this.filterText().toLowerCase();
    const status = this.filterActive();
    return this.departments().filter((d) => {
      const matchText =
        !text ||
        d.name.toLowerCase().includes(text) ||
        d.code.toLowerCase().includes(text) ||
        d.nameAr.includes(this.filterText());
      const matchStatus = status === 'all' ? true : status === 'active' ? d.isActive : !d.isActive;
      return matchText && matchStatus;
    });
  });

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern('^[A-Z0-9_]+$')]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    nameAr: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(500)],
    costCenterCode: ['', Validators.maxLength(50)],
    isActive: [true],
  });

  ngOnInit(): void {
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => {
      if (v && v !== v.toUpperCase()) {
        this.form.controls.code.setValue(v.toUpperCase(), { emitEvent: false });
      }
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getAll()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.departments.set(res.data);
          else this.error.set(res.message);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(this.messageOf(err, 'admin.departments.errors.loadFailed')),
      });
  }

  openCreate(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.editingHeadId = undefined;
    this.editingVersion = undefined;
    this.form.reset();
    this.form.controls.code.enable();
    this.showModal.set(true);
  }

  openEdit(d: Department): void {
    this.isEditMode.set(true);
    this.editingId.set(d.deptId);
    this.editingHeadId = d.headEmployeeId;
    this.editingVersion = d.version;
    this.headName.set(d.headEmployeeName ?? '');
    this.form.reset({
      code: d.code,
      name: d.name,
      nameAr: d.nameAr,
      description: d.description ?? '',
      costCenterCode: d.costCenterCode ?? '',
      isActive: d.isActive,
    });
    this.form.controls.code.disable();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set(null);
    this.form.controls.code.enable();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: DepartmentRequest = {
      code: v.code,
      name: v.name.trim(),
      nameAr: v.nameAr.trim(),
      description: v.description.trim() || undefined,
      costCenterCode: v.costCenterCode.trim() || undefined,
      headEmployeeId: this.editingHeadId,
      isActive: v.isActive,
      version: this.editingVersion,
    };
    const id = this.editingId();
    const call =
      this.isEditMode() && id !== null ? this.svc.update(id, payload) : this.svc.create(payload);

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
            this.isEditMode()
              ? 'admin.departments.success.updated'
              : 'admin.departments.success.created',
            { name: res.data.name },
          ),
        );
        this.closeModal();
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.error.set(
          this.messageOf(
            err,
            'common.httpErrors.actionFailed',
            v.code,
            this.isEditMode()
              ? 'admin.departments.errors.stale'
              : 'admin.departments.errors.duplicate',
          ),
        ),
    });
  }

  openConfirm(d: Department, action: ConfirmAction): void {
    this.confirmItem.set(d);
    this.confirmAction.set(action);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const d = this.confirmItem();
    if (!d) return;
    this.confirmError.set(null);
    const action = this.confirmAction();
    const call =
      action === 'delete'
        ? this.svc.delete(d.deptId)
        : d.isActive
          ? this.svc.deactivate(d.deptId)
          : this.svc.activate(d.deptId);
    const doneKey =
      action === 'delete'
        ? 'admin.departments.success.deleted'
        : d.isActive
          ? 'admin.departments.success.deactivated'
          : 'admin.departments.success.activated';

    call.subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: d.name }));
        this.cancelConfirm();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        // Stay in the dialog: the user is looking here, a page banner is easy to miss.
        this.confirmError.set(this.messageOf(err, 'common.httpErrors.actionFailed', d.code));
      },
    });
  }

  isInvalid(name: FormKey): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  getError(name: FormKey): string {
    const c = this.form.controls[name];
    if (!c.errors || !c.touched) return '';
    if (c.errors['required']) return this.translate.instant('common.validation.required');
    if (c.errors['maxlength']) {
      return this.translate.instant('common.validation.maxLength', {
        count: c.errors['maxlength'].requiredLength,
      });
    }
    if (c.errors['pattern']) return this.translate.instant('admin.workShifts.errors.patternCode');
    return this.translate.instant('common.validation.invalid');
  }

  /**
   * Every failure is shown in the user's language: a business-rule refusal by its ruleCode, anything else
   * by HTTP status. The server's own text (English only) is used just for statuses not listed here.
   */
  private messageOf(
    err: HttpErrorResponse,
    fallbackKey: string,
    code = '',
    conflictKey = 'common.httpErrors.conflict',
  ): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `admin.departments.errors.rules.${rule}`;
      const text = this.translate.instant(key, { code });
      if (text !== key) return text;
    }
    const t = (key: string) => this.translate.instant(key);
    return getHttpErrorMessage(this.translate, err, {
      400: t('common.httpErrors.badRequest'),
      409: t(conflictKey),
      422: t(fallbackKey),
      500: t('common.httpErrors.unexpected'),
    });
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
