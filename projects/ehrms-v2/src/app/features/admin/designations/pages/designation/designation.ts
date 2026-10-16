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
import { DesignationService } from '../../services/designation';
import { Designation, DesignationRequest } from '../../models/designation';
import { DepartmentService } from '../../../departments/services/department';
import { Department } from '../../../departments/models/department';
import { AccessibleDialogDirective } from '../../../../../core/directives/accessible-dialog.directive';

type FormKey = 'code' | 'title' | 'titleAr' | 'gradeLevel';
type ConfirmAction = 'toggle' | 'delete';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-designations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './designation.html',
  styleUrl: './designation.css',
})
export class Designations implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(DesignationService);
  private departmentSvc = inject(DepartmentService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);

  designations = signal<Designation[]>([]);
  departments = signal<Department[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<number | null>(null);
  confirmItem = signal<Designation | null>(null);
  confirmAction = signal<ConfirmAction>('toggle');
  filterText = signal('');
  /** '' = every department, 'none' = designations without a department, otherwise the department id. */
  filterDepartment = signal('');
  filterActive = signal<StatusFilter>('all');

  readonly activeCount = computed(() => this.designations().filter((d) => d.isActive).length);

  readonly filtered = computed(() => {
    const text = this.filterText().toLowerCase();
    const dept = this.filterDepartment();
    const status = this.filterActive();
    return this.designations().filter((d) => {
      const matchText =
        !text ||
        d.title.toLowerCase().includes(text) ||
        d.code.toLowerCase().includes(text) ||
        (d.titleAr ?? '').includes(this.filterText());
      const matchDept =
        !dept || (dept === 'none' ? d.departmentId == null : String(d.departmentId) === dept);
      const matchStatus = status === 'all' ? true : status === 'active' ? d.isActive : !d.isActive;
      return matchText && matchDept && matchStatus;
    });
  });

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern('^[A-Z0-9_]+$')]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    titleAr: ['', Validators.maxLength(200)],
    gradeLevel: ['', Validators.maxLength(10)],
    departmentId: this.fb.control<number | null>(null),
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
          if (res.success) this.designations.set(res.data);
          else this.error.set(res.message);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(this.messageOf(err, 'admin.designations.errors.loadFailed')),
      });
    // The department list only feeds the filter and the form; a failure here must not hide the table.
    this.departmentSvc
      .getAll()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (res) => {
          if (res.success) this.departments.set(res.data);
        },
        error: () => undefined,
      });
  }

  openCreate(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.form.reset();
    this.form.controls.code.enable();
    this.showModal.set(true);
  }

  openEdit(d: Designation): void {
    this.isEditMode.set(true);
    this.editingId.set(d.desigId);
    this.form.reset({
      code: d.code,
      title: d.title,
      titleAr: d.titleAr ?? '',
      gradeLevel: d.gradeLevel ?? '',
      departmentId: d.departmentId ?? null,
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
    const payload: DesignationRequest = {
      code: v.code,
      title: v.title.trim(),
      titleAr: v.titleAr.trim() || undefined,
      gradeLevel: v.gradeLevel.trim() || undefined,
      departmentId: v.departmentId ?? undefined,
      isActive: v.isActive,
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
              ? 'admin.designations.success.updated'
              : 'admin.designations.success.created',
            { name: res.data.title },
          ),
        );
        this.closeModal();
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.error.set(
          this.messageOf(
            err,
            err.status === 409
              ? 'admin.designations.errors.duplicate'
              : 'common.httpErrors.actionFailed',
          ),
        ),
    });
  }

  openConfirm(d: Designation, action: ConfirmAction): void {
    this.confirmItem.set(d);
    this.confirmAction.set(action);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
  }

  confirm(): void {
    const d = this.confirmItem();
    if (!d) return;
    const action = this.confirmAction();
    const call =
      action === 'delete'
        ? this.svc.delete(d.desigId)
        : d.isActive
          ? this.svc.deactivate(d.desigId)
          : this.svc.activate(d.desigId);
    const doneKey =
      action === 'delete'
        ? 'admin.designations.success.deleted'
        : d.isActive
          ? 'admin.designations.success.deactivated'
          : 'admin.designations.success.activated';

    call.subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: d.title }));
        this.cancelConfirm();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.messageOf(err, 'common.httpErrors.actionFailed'));
        this.cancelConfirm();
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

  private messageOf(err: HttpErrorResponse, fallbackKey: string): string {
    return err.error?.message || this.translate.instant(fallbackKey);
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
