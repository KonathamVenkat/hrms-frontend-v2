import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { getHttpErrorMessage } from '../../../../../core/utils/http-error-message';
import { AccessibleDialogDirective } from '../../../../../core/directives/accessible-dialog.directive';
import { MasterDataService } from '../../services/master-data';
import { MasterRecord, MasterRequest } from '../../models/master';
import { MasterConfig } from '../../masters.config';

type FormKey = 'code' | 'name' | 'nameAr' | 'parentId';
type ConfirmAction = 'toggle' | 'delete';
type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Shared screen for the simple code / English name / Arabic name masters (banks, bank branches,
 * companies, company branches). Which master it shows comes from the route's `master` data.
 */
@Component({
  selector: 'app-master-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './master-data.html',
})
export class MasterData implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(MasterDataService);
  private destroy = inject(DestroyRef);
  private translate = inject(TranslateService);

  readonly cfg: MasterConfig = inject(ActivatedRoute).snapshot.data['master'];
  /** Translation prefix of this master's own texts. */
  readonly t = `admin.masters.${this.cfg.key}`;

  records = signal<MasterRecord[]>([]);
  parents = signal<MasterRecord[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showModal = signal(false);
  isEditMode = signal(false);
  editingId = signal<number | null>(null);
  private editingVersion: number | undefined;
  confirmItem = signal<MasterRecord | null>(null);
  confirmAction = signal<ConfirmAction>('toggle');
  confirmError = signal<string | null>(null);
  filterText = signal('');
  filterActive = signal<StatusFilter>('all');

  readonly activeCount = computed(() => this.records().filter((r) => r.isActive).length);

  /** Parent id -> name, for the badge on each branch card. */
  readonly parentNames = computed(
    () => new Map(this.parents().map((p) => [p.id, p.name] as const)),
  );

  /** Only active parents can be picked for a new branch; the current one stays pickable when editing. */
  readonly parentOptions = computed(() => {
    const current = this.editingId() === null ? undefined : this.parentOf(this.editing());
    return this.parents().filter((p) => p.isActive || p.id === current);
  });

  readonly filtered = computed(() => {
    const text = this.filterText().toLowerCase();
    const status = this.filterActive();
    return this.records().filter((r) => {
      const matchText =
        !text ||
        r.name.toLowerCase().includes(text) ||
        r.code.toLowerCase().includes(text) ||
        r.nameAr.includes(this.filterText());
      const matchStatus = status === 'all' ? true : status === 'active' ? r.isActive : !r.isActive;
      return matchText && matchStatus;
    });
  });

  readonly form = this.fb.group({
    parentId: [0],
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern('^[A-Z0-9_]+$')]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    nameAr: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true],
  });

  ngOnInit(): void {
    if (this.cfg.parent) {
      this.form.controls.parentId.addValidators([Validators.required, Validators.min(1)]);
      this.loadParents(this.cfg.parent.endpoint);
    }
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe((v) => {
      if (v && v !== v.toUpperCase()) {
        this.form.controls.code.setValue(v.toUpperCase(), { emitEvent: false });
      }
    });
    this.load();
  }

  parentOf(r: MasterRecord | null): number | undefined {
    const field = this.cfg.parent?.field;
    return r && field ? r[field] : undefined;
  }

  parentName(r: MasterRecord): string | undefined {
    const id = this.parentOf(r);
    return id === undefined ? undefined : this.parentNames().get(id);
  }

  private editing(): MasterRecord | null {
    return this.records().find((r) => r.id === this.editingId()) ?? null;
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getAll(this.cfg.endpoint)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.records.set(res.data);
          else this.error.set(res.message);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(this.messageOf(err, `${this.t}.loadFailed`)),
      });
  }

  private loadParents(endpoint: string): void {
    this.svc
      .getAll(endpoint)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (res) => {
          if (res.success) this.parents.set(res.data);
        },
        error: (err: HttpErrorResponse) =>
          this.error.set(this.messageOf(err, `${this.t}.loadFailed`)),
      });
  }

  openCreate(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.editingVersion = undefined;
    this.form.reset();
    this.form.controls.code.enable();
    this.showModal.set(true);
  }

  openEdit(r: MasterRecord): void {
    this.isEditMode.set(true);
    this.editingId.set(r.id);
    this.editingVersion = r.version;
    this.form.reset({
      parentId: this.parentOf(r) ?? 0,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
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
    const payload: MasterRequest = {
      code: v.code,
      name: v.name.trim(),
      nameAr: v.nameAr.trim(),
      isActive: v.isActive,
      version: this.editingVersion,
    };
    const field = this.cfg.parent?.field;
    if (field) payload[field] = v.parentId;
    const id = this.editingId();
    const call =
      this.isEditMode() && id !== null
        ? this.svc.update(this.cfg.endpoint, id, payload)
        : this.svc.create(this.cfg.endpoint, payload);

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
            this.isEditMode() ? 'admin.masters.success.updated' : 'admin.masters.success.created',
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
            this.isEditMode() ? 'admin.masters.errors.stale' : 'admin.masters.errors.duplicate',
          ),
        ),
    });
  }

  openConfirm(r: MasterRecord, action: ConfirmAction): void {
    this.confirmItem.set(r);
    this.confirmAction.set(action);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const r = this.confirmItem();
    if (!r) return;
    this.confirmError.set(null);
    const action = this.confirmAction();
    const ep = this.cfg.endpoint;
    const call =
      action === 'delete'
        ? this.svc.delete(ep, r.id)
        : r.isActive
          ? this.svc.deactivate(ep, r.id)
          : this.svc.activate(ep, r.id);
    const doneKey =
      action === 'delete'
        ? 'admin.masters.success.deleted'
        : r.isActive
          ? 'admin.masters.success.deactivated'
          : 'admin.masters.success.activated';

    call.subscribe({
      next: () => {
        this.showSuccess(this.translate.instant(doneKey, { name: r.name }));
        this.cancelConfirm();
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        // Stay in the dialog: the user is looking here, a page banner is easy to miss.
        this.confirmError.set(this.messageOf(err, 'common.httpErrors.actionFailed', r.code));
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
      const key = `admin.masters.errors.rules.${rule}`;
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
