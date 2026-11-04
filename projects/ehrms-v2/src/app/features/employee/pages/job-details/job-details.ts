import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  signal,
  inject,
  computed,
  DestroyRef,
} from '@angular/core';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { DiscardPrompt } from '../../../../core/forms/discard-prompt';
import { DiscardChanges } from '../../../../shared/discard-changes/discard-changes';
import { FieldA11yDirective } from '../../../../core/directives/field-a11y.directive';
import { JobDetailsService } from '../../services/job-details.service';
import { EmployeeService } from '../../services/employee';
import { JobDetails } from '../../models/job-details.model';
import { DepartmentLookup, DesignationLookup, ManagerLookup, SectionLookup } from '../../models/employee';
import { InfoLookup } from '../../models/employee-info.model';
import { timedMessage } from '../../../../core/utils/timed-message';

// Import Phase 1 admin lookups
import { WorkShiftService } from '../../../admin/work-shifts/services/work-shift';
import { OfficeLocationService } from '../../../admin/office-locations/services/office-location';
import { WorkShift } from '../../../admin/work-shifts/models/work-shift';
import { OfficeLocation } from '../../../admin/office-locations/models/office-location';
import { fieldErrorMessage, isFieldInvalid } from '../../../../core/forms/field-errors';
import { BranchSelect } from '../../../organisation/components/branch-select/branch-select';
import { DateInput } from '../../../../shared/date-input/date-input';
import { DepartmentHeadCard } from '../../components/department-head/department-head';
import { DepartmentSecretaryCard } from '../../components/department-secretary/department-secretary';

@Component({
  selector: 'app-job-details',
  imports: [DiscardChanges, BranchSelect, DateInput, DepartmentHeadCard, DepartmentSecretaryCard,
    ReactiveFormsModule,
    FieldA11yDirective,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './job-details.html',
  styleUrl: './job-details.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailsComponent implements OnInit {
  /** Passed from employee-detail. */
  readonly employeeId = input.required<number>();
  /** Shown in confirmations (e.g. department secretary). */
  readonly employeeName = input<string | null>(null);
  /** Emitted after the current job is assigned/updated so the page header can refresh. */
  readonly jobSaved = output<void>();

  private fb = inject(FormBuilder);
  private jobSvc = inject(JobDetailsService);
  private empSvc = inject(EmployeeService);
  private shiftSvc = inject(WorkShiftService);
  private locationSvc = inject(OfficeLocationService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  // ── State ─────────────────────────────────────────────────
  currentJob = signal<JobDetails | null>(null);
  history = signal<JobDetails[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);

  // ── View mode ─────────────────────────────────────────────
  activeTab = signal<'current' | 'history'>('current');
  showModal = signal(false);
  /** True once the employee has a current job record: the page's Continue button waits for it. */
  readonly requirementMet = computed(() => !this.loading() && !!this.currentJob());
  /** The "unsaved changes" question: asked when this form is closed after something was typed. */
  readonly discard = new DiscardPrompt(() => this.showModal() && (this.form.dirty), () => this.isNewAssignment() && !this.loading() && !this.currentJob());
  isNewAssignment = signal(true); // true = new SCD record, false = minor update

  // ── Lookup data (from Phase 1 admin config) ───────────────
  departments = signal<DepartmentLookup[]>([]);
  designations = signal<DesignationLookup[]>([]);
  filteredDesignations = signal<DesignationLookup[]>([]);
  /** Active sections of the department chosen in the form (from the database). */
  sections = signal<SectionLookup[]>([]);
  professions = signal<InfoLookup[]>([]);
  specializations = signal<InfoLookup[]>([]);
  contractTypes = signal<InfoLookup[]>([]);
  locations = signal<OfficeLocation[]>([]);
  shifts = signal<WorkShift[]>([]);
  /** Manager/executive-grade people of the department chosen in the form (from the database). */
  managers = signal<ManagerLookup[]>([]);
  private departmentChosen = signal(false);

  readonly managerPlaceholderKey = computed(() => {
    if (!this.departmentChosen()) return 'employee.jobDetails.formFields.managerSelectDepartmentFirst';
    return this.managers().length
      ? 'employee.jobDetails.formFields.managerSelect'
      : 'employee.jobDetails.formFields.managerNone';
  });
  /** Everyone offered except the employee being edited. */
  private readonly managerChoices = computed(() =>
    this.managers().filter((m) => m.employeeId !== this.employeeId()),
  );
  readonly reportingOptions = computed(() =>
    this.withCurrentManager(
      this.managerChoices(),
      this.currentJob()?.reportingManagerId,
      this.currentJob()?.reportingManagerName,
      this.currentJob()?.reportingManagerCode,
    ),
  );
  readonly functionalOptions = computed(() =>
    this.withCurrentManager(
      this.managerChoices(),
      this.currentJob()?.functionalManagerId,
      this.currentJob()?.functionalManagerName,
      this.currentJob()?.functionalManagerCode,
    ),
  );

  readonly workModes = ['ON_SITE', 'REMOTE', 'HYBRID'];

  // ── Computed history stats ────────────────────────────────
  readonly historyCount = computed(() => this.history().length);

  // ── Form ──────────────────────────────────────────────────
  readonly form = this.fb.group({
    departmentId: this.fb.control<number | null>(null, Validators.required),
    designationId: this.fb.control<number | null>(null, Validators.required),
    sectionId: this.fb.control<number | null>(null),
    professionId: this.fb.control<number | null>(null, (c) => this.professionMismatch(c)),
    jobPositionId: this.fb.nonNullable.control('', Validators.maxLength(20)),
    specializationId: this.fb.control<number | null>(null),
    contractTypeId: this.fb.control<number | null>(null),
    contractStartDate: this.fb.nonNullable.control(''),
    contractEndDate: this.fb.nonNullable.control('', (c) => this.contractEndBeforeStart(c)),
    formRequestNo: this.fb.nonNullable.control('', Validators.maxLength(30)),
    appointmentRequestNo: this.fb.nonNullable.control('', Validators.maxLength(30)),
    afe: this.fb.nonNullable.control('', Validators.maxLength(30)),
    companyIdCardNo: this.fb.nonNullable.control('', Validators.maxLength(30)),
    currentWorkAddress: this.fb.nonNullable.control('', Validators.maxLength(300)),
    currentWorkPhone: this.fb.nonNullable.control('', [Validators.maxLength(30), Validators.pattern(/^[0-9+() -]*$/)]),
    reportingManagerId: this.fb.control<number | null>(null),
    functionalManagerId: this.fb.control<number | null>(null),
    locationId: this.fb.control<number | null>(null, Validators.required),
    companyBranchId: this.fb.control<number | null>(null),
    shiftId: this.fb.control<number | null>(null),
    workMode: this.fb.nonNullable.control('ON_SITE', Validators.required),
    effectiveFrom: this.fb.nonNullable.control('', Validators.required),
    remarks: this.fb.nonNullable.control('', Validators.maxLength(500)),
  });

  ngOnInit(): void {
    this.watchContractStart();
    this.watchDepartment();
    this.watchDesignation();
    this.loadCurrentJob();
    this.loadLookups();
  }

  /** The contract end is checked against the start, so a changed start re-checks the end. */
  private watchContractStart(): void {
    this.form.controls.contractStartDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.controls.contractEndDate.updateValueAndValidity());
  }

  private contractEndBeforeStart(control: AbstractControl): ValidationErrors | null {
    const start = control.parent?.get('contractStartDate')?.value;
    return start && control.value && control.value < start ? { contractEndBeforeStart: true } : null;
  }

  /** A designation that has a profession fixes it: the profession field follows the designation. */
  private watchDesignation(): void {
    this.form.controls.designationId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        const designation = this.designations().find((d) => d.id === Number(id));
        this.form.controls.professionId.setValue(designation?.professionId ?? null);
      });
  }

  /** The chosen profession must be the designation's own when the designation has one. */
  private professionMismatch(control: AbstractControl): ValidationErrors | null {
    const designationId = control.parent?.get('designationId')?.value;
    const designation = this.designations().find((d) => d.id === Number(designationId));
    const expected = designation?.professionId;
    return expected && control.value && Number(control.value) !== expected
      ? { professionMismatch: true }
      : null;
  }

  /** Cascades the designation list from the chosen department. */
  private watchDepartment(): void {
    this.form.controls.departmentId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deptId) => {
        this.form.controls.designationId.setValue(null);
        if (deptId) {
          this.filteredDesignations.set(
            this.designations().filter((d) => d.departmentId === +deptId),
          );
        } else {
          this.filteredDesignations.set(this.designations());
        }
      });

    // The manager lists follow the department; the old choice no longer applies.
    this.form.controls.departmentId.valueChanges
      .pipe(
        tap((deptId) => {
          this.form.controls.reportingManagerId.setValue(null);
          this.form.controls.functionalManagerId.setValue(null);
          this.departmentChosen.set(!!deptId);
          this.managers.set([]);
        }),
        switchMap((deptId) =>
          deptId
            ? this.empSvc.getDepartmentManagers(+deptId).pipe(catchError(() => of(null)))
            : of(null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.managers.set(res?.success ? res.data : []));

    // The sections are those of the chosen department; the old choice no longer applies.
    this.form.controls.departmentId.valueChanges
      .pipe(
        tap(() => {
          this.form.controls.sectionId.setValue(null);
          this.sections.set([]);
        }),
        switchMap((deptId) =>
          deptId
            ? this.empSvc.getSectionsByDepartment(+deptId).pipe(catchError(() => of(null)))
            : of(null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.sections.set(res?.success ? res.data : []));
  }

  /**
   * While editing the current record the managers are shown read-only: keep the saved ones in the list
   * even when they are not manager-grade of this department any more, so the select can display them.
   */
  private withCurrentManager(
    list: ManagerLookup[],
    id: number | undefined,
    name: string | undefined,
    code: string | undefined,
  ): ManagerLookup[] {
    if (this.isNewAssignment() || !id || !name || list.some((m) => m.employeeId === id)) return list;
    return [
      ...list,
      { employeeId: id, employeeCode: code ?? '', fullNameEn: name, designationTitle: '', gradeLevel: '' },
    ];
  }

  // ── Load current job ──────────────────────────────────────
  loadCurrentJob(): void {
    this.loading.set(true);
    this.error.set(null);

    this.jobSvc
      .getCurrentJob(this.employeeId())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.currentJob.set(res.data);
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          // 404 = no job assigned yet — not an error to show
          if (err.status !== 404) {
            this.error.set(
              err?.error?.message || this.translate.instant('employee.jobDetails.errors.loadFailed'),
            );
          }
        },
      });
  }

  // ── Load job history ──────────────────────────────────────
  loadHistory(): void {
    this.jobSvc
      .getJobHistory(this.employeeId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.history.set(res.data);
        },
      });
  }

  onTabChange(tab: 'current' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'history' && this.history().length === 0) {
      this.loadHistory();
    }
  }

  // ── Load all admin config lookups ─────────────────────────
  private loadLookups(): void {
    // Departments
    this.empSvc
      .getDepartments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.departments.set(res.data);
        },
      });

    // Designations
    this.empSvc
      .getDesignations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.designations.set(res.data);
            this.filteredDesignations.set(res.data);
          }
        },
      });

    // Professions
    this.empSvc
      .getProfessions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.professions.set(res.data);
        },
      });

    // Specializations and contract types
    this.empSvc
      .getSpecializations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.specializations.set(res.data);
        },
      });
    this.empSvc
      .getContractTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.contractTypes.set(res.data);
        },
      });

    // Office locations
    this.locationSvc
      .getActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.locations.set(res.data);
        },
      });

    // Work shifts
    this.shiftSvc
      .getActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.shifts.set(res.data);
        },
      });
  }

  // ── Open modal ────────────────────────────────────────────
  openNewAssignment(): void {
    this.isNewAssignment.set(true);
    this.form.controls.effectiveFrom.setValidators([Validators.required]);
    this.form.controls.effectiveFrom.updateValueAndValidity();
    this.setManagersEditable(true);
    this.form.controls.professionId.enable();
    this.form.controls.sectionId.enable();
    this.form.reset({
      departmentId: null,
      designationId: null,
      sectionId: null,
      professionId: null,
      jobPositionId: '',
      specializationId: null,
      contractTypeId: null,
      contractStartDate: '',
      contractEndDate: '',
      formRequestNo: '',
      appointmentRequestNo: '',
      afe: '',
      companyIdCardNo: '',
      currentWorkAddress: '',
      currentWorkPhone: '',
      reportingManagerId: null,
      functionalManagerId: null,
      locationId: null,
      companyBranchId: null,
      shiftId: null,
      workMode: 'ON_SITE',
      effectiveFrom: '',
      remarks: '',
    });
    this.showModal.set(true);
  }

  openEditCurrent(): void {
    const job = this.currentJob();
    if (!job) return;

    this.isNewAssignment.set(false);
    this.form.controls.effectiveFrom.clearValidators();
    this.form.controls.effectiveFrom.updateValueAndValidity();
    // Managers are history-bearing like department/designation/location: the backend only
    // lets this update change shift, work mode and remarks, so don't offer them here.
    this.setManagersEditable(false);

    this.form.patchValue({
      departmentId: job.departmentId,
      designationId: job.designationId,
      jobPositionId: job.jobPositionId ?? '',
      specializationId: job.specializationId ?? null,
      contractTypeId: job.contractTypeId ?? null,
      contractStartDate: job.contractStartDate ?? '',
      contractEndDate: job.contractEndDate ?? '',
      formRequestNo: job.formRequestNo ?? '',
      appointmentRequestNo: job.appointmentRequestNo ?? '',
      afe: job.afe ?? '',
      companyIdCardNo: job.companyIdCardNo ?? '',
      currentWorkAddress: job.currentWorkAddress ?? '',
      currentWorkPhone: job.currentWorkPhone ?? '',
      reportingManagerId: job.reportingManagerId ?? null,
      functionalManagerId: job.functionalManagerId ?? null,
      locationId: job.locationId,
      companyBranchId: job.companyBranchId ?? null,
      shiftId: job.shiftId ?? null,
      workMode: job.workMode,
      effectiveFrom: job.effectiveFrom,
      remarks: job.remarks ?? '',
    });
    // Same for the section: a set one is locked, an empty one can be filled in. The options load for the department.
    this.form.controls.sectionId.setValue(job.sectionId ?? null);
    if (job.sectionId != null) {
      this.form.controls.sectionId.disable();
    } else {
      this.form.controls.sectionId.enable();
    }
    // A profession that is set only changes with a new assignment, like the designation. An empty one can be
    // filled in here; the designation's own profession (set above by the designation change) is the default.
    if (job.professionId != null) {
      this.form.controls.professionId.setValue(job.professionId);
      this.form.controls.professionId.disable();
    } else {
      this.form.controls.professionId.enable();
    }

    this.showModal.set(true);
  }

  /** Cancel, the X and Escape: ask first when something was typed. */
  requestClose(): void {
    this.discard.request(() => this.closeModal());
  }

  /** "Discard changes" in the unsaved-changes question. */
  discardChanges(): void {
    this.closeModal();
  }

  closeModal(): void {
    this.showModal.set(false);
    this.discard.keep();
    this.form.markAsPristine();
    this.error.set(null);
  }

  private setManagersEditable(editable: boolean): void {
    for (const control of [this.form.controls.reportingManagerId, this.form.controls.functionalManagerId]) {
      if (editable) {
        control.enable();
      } else {
        control.disable();
      }
    }
  }

  // ── Submit ────────────────────────────────────────────────
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    // getRawValue: the manager pickers are disabled while editing the current record, and the
    // backend compares them against the stored values, so they must still be sent as they are.
    const v = this.form.getRawValue();
    const payload = {
      departmentId: Number(v.departmentId),
      designationId: Number(v.designationId),
      sectionId: v.sectionId ? +v.sectionId : null,
      professionId: v.professionId ?? undefined,
      jobPositionId: v.jobPositionId || undefined,
      specializationId: v.specializationId ?? null,
      contractTypeId: v.contractTypeId ?? null,
      contractStartDate: v.contractStartDate || null,
      contractEndDate: v.contractEndDate || null,
      formRequestNo: v.formRequestNo.trim(),
      appointmentRequestNo: v.appointmentRequestNo.trim(),
      afe: v.afe.trim(),
      companyIdCardNo: v.companyIdCardNo.trim(),
      currentWorkAddress: v.currentWorkAddress.trim(),
      currentWorkPhone: v.currentWorkPhone.trim(),
      reportingManagerId: v.reportingManagerId ? +v.reportingManagerId : undefined,
      functionalManagerId: v.functionalManagerId ? +v.functionalManagerId : undefined,
      locationId: Number(v.locationId),
      companyBranchId: v.companyBranchId ?? null,
      shiftId: v.shiftId ? +v.shiftId : undefined,
      workMode: v.workMode,
      effectiveFrom: v.effectiveFrom,
      remarks: v.remarks || undefined,
    };

    const call = this.isNewAssignment()
      ? this.jobSvc.assignJob(this.employeeId(), payload)
      : this.jobSvc.updateCurrentJob(this.employeeId(), payload);

    call
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
      next: (res) => {
        if (res.success) {
          this.currentJob.set(res.data);
          this.history.set([]); // reset history cache
          this.jobSaved.emit();
          this.closeModal();
          this.showSuccess(
            this.translate.instant(
              this.isNewAssignment()
                ? 'employee.jobDetails.success.assigned'
                : 'employee.jobDetails.success.updated',
            ),
          );
        } else {
          this.error.set(res.message);
        }
      },
      error: (err: { error?: { message?: string } }) =>
        this.error.set(
          err?.error?.message || this.translate.instant('employee.jobDetails.errors.saveFailed'),
        ),
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  ctrl(name: string): AbstractControl {
    return this.form.get(name)!;
  }

  isInvalid(name: string): boolean {
    return isFieldInvalid(this.form.get(name));
  }

  getError(name: string): string {
    return fieldErrorMessage(this.form.get(name), this.translate, {
      professionMismatch: 'employee.jobDetails.errors.professionMismatch',
      contractEndBeforeStart: 'employee.jobDetails.errors.contractEndBeforeStart',
    });
  }

  getWorkModeBadge(mode: string): string {
    const map: Record<string, string> = {
      ON_SITE: 'wm-onsite',
      REMOTE: 'wm-remote',
      HYBRID: 'wm-hybrid',
    };
    return map[mode] ?? 'wm-onsite';
  }

  formatDateRange(from: string, to?: string): string {
    return to ? `${from} → ${to}` : `${from} → ${this.translate.instant('employee.jobDetails.present')}`;
  }
}
