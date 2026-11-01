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
import { AccessibleDialogDirective } from '../../../../../core/directives/accessible-dialog.directive';
import { SectionService } from '../../services/section';
import { Section, SectionRequest } from '../../models/section';
import { DepartmentService } from '../../../departments/services/department';
import { Department } from '../../../departments/models/department';
import { MasterDataService } from '../../../masters/services/master-data';
import { MasterRecord } from '../../../masters/models/master';

type FormKey = 'departmentId' | 'code' | 'name' | 'nameAr';
type ConfirmAction = 'toggle' | 'delete';
type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-sections',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './section.html',
  styleUrl: './section.css',
})
export class Sections implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(SectionService);
  private departmentSvc = inject(DepartmentService);
  private masters = inject(MasterDataService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);

  sections = signal<Section[]>([]);
  departments = signal<Department[]>([]);
  directorates = signal<MasterRecord[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<number | null>(null);
  private editingVersion: number | undefined;
  confirmItem = signal<Section | null>(null);
  confirmAction = signal<ConfirmAction>('toggle');
  confirmError = signal<string | null>(null);
  filterText = signal('');
  filterActive = signal<StatusFilter>('all');
  filterDirectorate = signal<number | null>(null);
  filterDepartment = signal<number | null>(null);

  /** Any search, status or list filter is on, so there is something to clear. */
  readonly hasFilters = computed(
    () => this.filterText() !== '' || this.filterActive() !== 'all' || this.filterDirectorate() !== null || this.filterDepartment() !== null,
  );

  clearFilters(): void {
    this.filterText.set('');
    this.filterActive.set('all');
    this.filterDirectorate.set(null);
    this.filterDepartment.set(null);
  }

  readonly activeCount = computed(() => this.sections().filter((s) => s.isActive).length);

  /** Department id -> department, for the name on each card. */
  readonly departmentById = computed(
    () => new Map(this.departments().map((d) => [d.deptId, d] as const)),
  );

  /** The department filter lists only the departments of the chosen directorate. */
  readonly filterDepartments = computed(() => {
    const directorate = this.filterDirectorate();
    return this.departments().filter((d) => directorate === null || d.directorateId === directorate);
  });

  /** Only active departments can receive a section; the current one stays pickable when editing. */
  readonly departmentOptions = computed(() => {
    const id = this.editingId();
    const current = id === null ? undefined : this.sections().find((s) => s.id === id)?.departmentId;
    return this.departments().filter((d) => d.isActive || d.deptId === current);
  });

  readonly filtered = computed(() => {
    const raw = this.filterText();
    const text = raw.toLowerCase();
    const status = this.filterActive();
    const department = this.filterDepartment();
    const directorate = this.filterDirectorate();
    const byId = this.departmentById();
    return this.sections().filter((s) => {
      const matchText =
        !text ||
        s.name.toLowerCase().includes(text) ||
        s.code.toLowerCase().includes(text) ||
        s.nameAr.includes(raw);
      const matchStatus = status === 'all' ? true : status === 'active' ? s.isActive : !s.isActive;
      const matchDepartment = department === null || s.departmentId === department;
      const matchDirectorate =
        directorate === null || byId.get(s.departmentId)?.directorateId === directorate;
      return matchText && matchStatus && matchDepartment && matchDirectorate;
    });
  });

  readonly form = this.fb.group({
    departmentId: [0, [Validators.required, Validators.min(1)]],
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern('^[A-Z0-9_-]+$')]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    nameAr: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => {
      if (v && v !== v.toUpperCase()) {
        this.form.controls.code.setValue(v.toUpperCase(), { emitEvent: false });
      }
    });
    this.loadLookups();
    this.load();
  }

  /** The filter lists are a convenience: if one cannot be loaded it stays empty and the screen still works. */
  private loadLookups(): void {
    this.masters
      .getAll('directorates')
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (res) => this.directorates.set(res.success ? res.data : []),
        error: () => this.directorates.set([]),
      });
    this.departmentSvc
      .getAll()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (res) => this.departments.set(res.success ? res.data : []),
        error: () => this.departments.set([]),
      });
  }

  setDirectorateFilter(value: string): void {
    this.filterDirectorate.set(value ? Number(value) : null);
    this.filterDepartment.set(null); // the old department may not belong to the new directorate
  }

  setDepartmentFilter(value: string): void {
    this.filterDepartment.set(value ? Number(value) : null);
  }

  departmentName(s: Section): string {
    return this.departmentById().get(s.departmentId)?.name ?? '';
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
          if (res.success) this.sections.set(res.data);
          else this.error.set(res.message);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(this.messageOf(err, 'admin.sections.errors.loadFailed')),
      });
  }

  openCreate(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.editingVersion = undefined;
    this.form.reset({ departmentId: this.filterDepartment() ?? 0 });
    this.form.controls.code.enable();
    this.showModal.set(true);
  }

  openEdit(s: Section): void {
    this.isEditMode.set(true);
    this.editingId.set(s.id);
    this.editingVersion = s.version;
    this.form.reset({
      departmentId: s.departmentId,
      code: s.code,
      name: s.name,
      nameAr: s.nameAr,
      isActive: s.isActive,
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
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: SectionRequest = {
      departmentId: Number(v.departmentId),
      code: v.code,
      name: v.name.trim(),
      nameAr: v.nameAr.trim(),
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
            this.isEditMode() ? 'admin.sections.success.updated' : 'admin.sections.success.created',
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
            this.isEditMode() ? 'admin.sections.errors.stale' : 'admin.sections.errors.duplicate',
          ),
        ),
    });
  }

  openConfirm(s: Section, action: ConfirmAction): void {
    this.confirmItem.set(s);
    this.confirmAction.set(action);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const s = this.confirmItem();
    if (!s) return;
    this.confirmError.set(null);
    const action = this.confirmAction();
    const call =
      action === 'delete'
        ? this.svc.delete(s.id)
        : s.isActive
          ? this.svc.deactivate(s.id)
          : this.svc.activate(s.id);
    const doneKey =
      action === 'delete'
        ? 'admin.sections.success.deleted'
        : s.isActive
          ? 'admin.sections.success.deactivated'
          : 'admin.sections.success.activated';

    call.subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: s.name }));
        this.cancelConfirm();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        // Stay in the dialog: the user is looking here, a page banner is easy to miss.
        this.confirmError.set(this.messageOf(err, 'common.httpErrors.actionFailed', s.code));
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
    if (c.errors['required'] || c.errors['min']) {
      return this.translate.instant('common.validation.required');
    }
    if (c.errors['maxlength']) {
      return this.translate.instant('common.validation.maxLength', {
        count: c.errors['maxlength'].requiredLength,
      });
    }
    if (c.errors['pattern']) return this.translate.instant('admin.sections.errors.patternCode');
    return this.translate.instant('common.validation.invalid');
  }

  /** Every failure is shown in the user's language: a business-rule refusal by its ruleCode, anything else by HTTP status. */
  private messageOf(
    err: HttpErrorResponse,
    fallbackKey: string,
    code = '',
    conflictKey = 'common.httpErrors.conflict',
  ): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `admin.sections.errors.rules.${rule}`;
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
