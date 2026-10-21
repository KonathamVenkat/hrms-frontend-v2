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
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { OfficeLocation } from '../../../admin/office-locations/models/office-location';
import { OfficeLocationService } from '../../../admin/office-locations/services/office-location';
import { ManagerPicker, PickedManager } from '../../components/manager-picker/manager-picker';
import { BranchPlacement } from '../../models/organisation.model';
import { OrganisationService } from '../../services/organisation.service';

/** The branches of one office location, shown together; locationId is null for branches HR has not placed yet. */
export interface BranchGroup {
  key: string;
  locationId: number | null;
  name: string;
  branches: BranchPlacement[];
}

/**
 * HR picks a location, then gives each branch in it a manager. A branch keeps the location it was created in; only
 * a branch with no location yet asks for one. Branch code, name and company stay with the system administrator in
 * the admin masters. A person may manage several branches; a branch has exactly one manager.
 */
@Component({
  selector: 'app-branch-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
    ManagerPicker,
  ],
  templateUrl: './branch-setup.html',
  styleUrl: './branch-setup.css',
})
export class BranchSetup implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private svc = inject(OrganisationService);
  private locationSvc = inject(OfficeLocationService);
  private translate = inject(TranslateService);
  private destroy = inject(DestroyRef);

  branches = signal<BranchPlacement[]>([]);
  locations = signal<OfficeLocation[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  filterText = signal('');
  editing = signal<BranchPlacement | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  readonly withoutLocation = computed(
    () => this.branches().filter((b) => b.isActive && b.locationId == null).length,
  );
  readonly withoutManager = computed(
    () => this.branches().filter((b) => b.isActive && b.managerEmployeeId == null).length,
  );

  readonly filtered = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    if (!text) return this.branches();
    return this.branches().filter(
      (b) =>
        b.code.toLowerCase().includes(text) ||
        b.name.toLowerCase().includes(text) ||
        b.nameAr.includes(this.filterText().trim()) ||
        (b.managerName ?? '').toLowerCase().includes(text),
    );
  });

  /** Unplaced branches first (they need attention), then the locations by name. */
  readonly groups = computed<BranchGroup[]>(() => {
    const byKey = new Map<string, BranchGroup>();
    for (const b of this.filtered()) {
      const locationId = b.locationId ?? null;
      const key = locationId === null ? 'none' : String(locationId);
      const group = byKey.get(key) ?? {
        key,
        locationId,
        name: b.locationName ?? '',
        branches: [],
      };
      group.branches.push(b);
      byKey.set(key, group);
    }
    return [...byKey.values()].sort(
      (a, b) =>
        Number(b.locationId === null) - Number(a.locationId === null) ||
        a.name.localeCompare(b.name),
    );
  });

  readonly form = this.fb.group({
    locationId: this.fb.control<number | null>(null, Validators.required),
    managerEmployeeId: this.fb.control<number | null>(null),
  });

  /** Name shown for the chosen manager; the form itself only holds the id. */
  readonly managerLabel = signal('');
  /** Bridges the form control to the picker, which is controlled through inputs. */
  readonly managerId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
    this.locationSvc
      .getActive()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (res) => res.success && this.locations.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.svc
      .listBranches()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (list) => this.branches.set(list),
        error: () => this.loadFailed.set(true),
      });
  }

  openEdit(branch: BranchPlacement): void {
    this.editing.set(branch);
    this.error.set(null);
    this.form.reset({
      locationId: branch.locationId ?? null,
      managerEmployeeId: branch.managerEmployeeId ?? null,
    });
    this.managerId.set(branch.managerEmployeeId ?? null);
    this.managerLabel.set(branch.managerName ?? '');
  }

  onManagerPicked(picked: PickedManager | null): void {
    this.form.controls.managerEmployeeId.setValue(picked?.id ?? null);
    this.managerId.set(picked?.id ?? null);
    this.managerLabel.set(picked?.label ?? '');
  }

  closeEdit(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  onSubmit(): void {
    const branch = this.editing();
    if (!branch || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.svc
      .setPlacement(branch.branchId, {
        locationId: Number(v.locationId),
        managerEmployeeId: v.managerEmployeeId,
        version: branch.version,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.closeEdit();
          this.showSuccess(
            this.translate.instant('organisation.branchSetup.saved', { name: branch.name }),
          );
          this.load();
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err)),
      });
  }

  isInvalid(name: 'locationId'): boolean {
    const c = this.form.controls[name];
    return c.invalid && c.touched;
  }

  /** Business-rule refusals by rule code, a stale edit as "reload", everything else by HTTP status. */
  private messageOf(err: HttpErrorResponse): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `organisation.errors.rules.${rule}`;
      const text = this.translate.instant(key);
      if (text !== key) return text;
    }
    const t = (key: string) => this.translate.instant(key);
    return getHttpErrorMessage(this.translate, err, {
      400: t('common.httpErrors.badRequest'),
      409: t('organisation.errors.stale'),
      422: t('common.httpErrors.actionFailed'),
      500: t('common.httpErrors.unexpected'),
    });
  }

  private showSuccess(msg: string): void {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(null), 3000);
  }
}
