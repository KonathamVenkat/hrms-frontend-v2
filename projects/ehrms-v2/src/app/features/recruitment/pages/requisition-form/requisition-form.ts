import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, distinctUntilChanged, finalize, of, startWith, switchMap } from 'rxjs';

import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import {
  ApiResponse,
  DesignationOption,
  EMPLOYMENT_TYPES,
  EmploymentType,
  LookupOption,
  PersonOption,
  REQUISITION_PRIORITIES,
  RaiseOptions,
  Requisition,
  RequisitionPriority,
  RequisitionRequest,
  RequisitionType,
} from '../../models/requisition.model';
import { recruitmentErrorMessage } from '../../recruitment-errors';
import { RequisitionService } from '../../services/requisition.service';
import {
  maxNotBelowMin,
  noControlChars,
  noControlCharsMultiline,
  notPastDate,
  parseLocalIsoDate,
  replacementNeedsEmployee,
  toLocalIsoDate,
} from './requisition-form.validators';

/** Raise a requisition, or edit one that is still a draft (route param `id`). */
@Component({
  selector: 'app-requisition-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './requisition-form.html',
  styleUrl: './requisition-form.css',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class RequisitionForm implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RequisitionService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employmentTypes = EMPLOYMENT_TYPES;
  readonly priorities = REQUISITION_PRIORITIES;

  readonly options = signal<RaiseOptions | null>(null);
  readonly people = signal<PersonOption[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Edit mode only: why the draft cannot be edited (loaded failed, or it is no longer a draft). */
  readonly blocked = signal<string | null>(null);
  readonly editing = signal<Requisition | null>(null);
  private saved = false;

  /** The `id` route parameter; absent when raising a new requisition. */
  private readonly requisitionId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.requisitionId !== null;
  readonly today = new Date();

  readonly form = this.fb.group(
    {
      jobTitle: ['', [Validators.required, Validators.maxLength(200), noControlChars]],
      jobTitleAr: ['', [Validators.maxLength(300), noControlChars]],
      departmentId: [0, [Validators.required, Validators.min(1)]],
      designationId: [0, [Validators.required, Validators.min(1)]],
      locationId: [0],
      reportingManagerId: [0],
      noOfPositions: [1, [Validators.required, Validators.min(1), Validators.max(999)]],
      employmentType: this.fb.control<EmploymentType>('FULL_TIME', Validators.required),
      requisitionType: this.fb.control<RequisitionType>('NEW', Validators.required),
      replacedEmployeeId: [0],
      minExperienceYears: [0, [Validators.required, Validators.min(0), Validators.max(99.9)]],
      maxExperienceYears: this.fb.control<number | null>(null, [
        Validators.min(0),
        Validators.max(99.9),
      ]),
      minSalary: this.fb.control<number | null>(null, [Validators.min(0)]),
      maxSalary: this.fb.control<number | null>(null, [Validators.min(0)]),
      priority: this.fb.control<RequisitionPriority>('MEDIUM', Validators.required),
      targetJoinDate: this.fb.control<Date | null>(null, notPastDate()),
      justification: ['', [Validators.maxLength(1000), noControlCharsMultiline]],
    },
    {
      validators: [
        maxNotBelowMin('minExperienceYears', 'maxExperienceYears', 'experienceRange'),
        maxNotBelowMin('minSalary', 'maxSalary', 'salaryRange'),
        replacementNeedsEmployee,
      ],
    },
  );

  // computed() does not see a FormGroup change, so the values it depends on are bridged through valueChanges.
  private readonly departmentId = toSignal(
    this.form.controls.departmentId.valueChanges.pipe(
      startWith(this.form.controls.departmentId.value),
    ),
    { initialValue: 0 },
  );
  readonly requisitionType = toSignal(
    this.form.controls.requisitionType.valueChanges.pipe(
      startWith(this.form.controls.requisitionType.value),
    ),
    { initialValue: 'NEW' as RequisitionType },
  );

  readonly departments = computed<LookupOption[]>(() => this.options()?.departments ?? []);
  readonly locations = computed<LookupOption[]>(() => this.options()?.locations ?? []);
  /** Designations of the chosen department, plus the ones that fit every department. */
  readonly designations = computed<DesignationOption[]>(() => {
    const dept = this.departmentId();
    return (this.options()?.designations ?? []).filter(
      (d) => d.departmentId == null || d.departmentId === dept,
    );
  });
  readonly cannotRaise = computed(
    () => !this.loading() && !this.isEdit && this.departments().length === 0,
  );

  ngOnInit(): void {
    this.loadOptions();

    // Another department means another set of designations and people: drop choices that no longer apply.
    this.form.controls.departmentId.valueChanges
      .pipe(
        distinctUntilChanged(),
        switchMap((dept): Observable<ApiResponse<PersonOption[]> | null> => {
          const c = this.form.controls;
          if (!this.designations().some((d) => d.id === c.designationId.value))
            c.designationId.setValue(0);
          return dept > 0 ? this.svc.people(dept) : of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.setPeople(res?.success ? res.data : []),
        // Keep what is chosen (an edited draft may already name a manager) when the list cannot be loaded.
        error: () => this.people.set([]),
      });
  }

  private loadOptions(): void {
    this.svc
      .raiseOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.options.set(res.data);
          this.loadExisting();
        },
        error: (err: unknown) => {
          this.blocked.set(
            recruitmentErrorMessage(this.translate, err, 'recruitment.form.loadFailed'),
          );
          this.loading.set(false);
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saved;
  }

  onBeforeUnload(event: Event): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  onSubmit(): void {
    if (this.saving()) return; // a double click must not send the request twice
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.toRequest();
    const current = this.editing();
    const call = current ? this.svc.update(current.id, payload) : this.svc.create(payload);

    this.saving.set(true);
    this.error.set(null);
    call.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (res) => {
        if (!res.success) {
          this.error.set(res.message || this.translate.instant('common.httpErrors.actionFailed'));
          return;
        }
        this.saved = true;
        this.snack.open(
          this.translate.instant(
            current ? 'recruitment.form.updated' : 'recruitment.form.created',
            {
              code: res.data.code,
            },
          ),
          this.translate.instant('common.close'),
          { duration: 4000 },
        );
        void this.router.navigate(['/app/recruitment/requisitions', res.data.id]);
      },
      // The form keeps what the user typed so nothing has to be entered again.
      error: (err: unknown) =>
        this.error.set(recruitmentErrorMessage(this.translate, err, 'recruitment.form.saveFailed')),
    });
  }

  retry(): void {
    this.loading.set(true);
    this.blocked.set(null);
    this.loadOptions();
  }

  private loadExisting(): void {
    if (this.requisitionId === null) {
      this.loading.set(false);
      return;
    }
    this.svc
      .get(Number(this.requisitionId))
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.success) {
            this.blocked.set(res.message);
            return;
          }
          if (res.data.status !== 'DRAFT') {
            this.blocked.set(
              this.translate.instant('recruitment.errors.rules.REQUISITION_NOT_EDITABLE'),
            );
            return;
          }
          this.patch(res.data);
        },
        error: (err: unknown) =>
          this.blocked.set(
            recruitmentErrorMessage(this.translate, err, 'recruitment.form.loadFailed'),
          ),
      });
  }

  private patch(r: Requisition): void {
    this.editing.set(r);
    this.form.reset({
      jobTitle: r.jobTitle,
      jobTitleAr: r.jobTitleAr ?? '',
      departmentId: r.departmentId,
      designationId: r.designationId,
      locationId: r.locationId ?? 0,
      reportingManagerId: r.reportingManagerId ?? 0,
      noOfPositions: r.noOfPositions,
      employmentType: r.employmentType,
      requisitionType: r.requisitionType,
      replacedEmployeeId: r.replacedEmployeeId ?? 0,
      minExperienceYears: r.minExperienceYears,
      maxExperienceYears: r.maxExperienceYears ?? null,
      minSalary: r.minSalary ?? null,
      maxSalary: r.maxSalary ?? null,
      priority: r.priority,
      targetJoinDate: parseLocalIsoDate(r.targetJoinDate),
      justification: r.justification ?? '',
    });
    // reset() emits valueChanges, which loads the people; nothing is dirty yet.
    this.form.markAsPristine();
  }

  /** Keep a chosen manager / replaced employee only if they work in the department now chosen. */
  private setPeople(list: PersonOption[]): void {
    this.people.set(list);
    const c = this.form.controls;
    if (!list.some((p) => p.id === c.reportingManagerId.value)) c.reportingManagerId.setValue(0);
    if (!list.some((p) => p.id === c.replacedEmployeeId.value)) c.replacedEmployeeId.setValue(0);
  }

  private toRequest(): RequisitionRequest {
    const v = this.form.getRawValue();
    const optional = (id: number) => (id > 0 ? id : undefined);
    const text = (s: string) => s.trim() || undefined;
    return {
      jobTitle: v.jobTitle.trim(),
      jobTitleAr: text(v.jobTitleAr),
      departmentId: v.departmentId,
      designationId: v.designationId,
      locationId: optional(v.locationId),
      reportingManagerId: optional(v.reportingManagerId),
      noOfPositions: v.noOfPositions,
      employmentType: v.employmentType,
      requisitionType: v.requisitionType,
      replacedEmployeeId:
        v.requisitionType === 'REPLACEMENT' ? optional(v.replacedEmployeeId) : undefined,
      minExperienceYears: v.minExperienceYears,
      maxExperienceYears: v.maxExperienceYears ?? undefined,
      minSalary: v.minSalary ?? undefined,
      maxSalary: v.maxSalary ?? undefined,
      priority: v.priority,
      targetJoinDate: v.targetJoinDate ? toLocalIsoDate(v.targetJoinDate) : undefined,
      justification: text(v.justification),
      version: this.editing()?.version,
    };
  }
}
