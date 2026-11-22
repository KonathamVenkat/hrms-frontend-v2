// src/app/features/payroll/pages/employee-salary/employee-salary.component.ts

import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PayrollService } from '../../services/payroll.service';
import { ruleMessage } from '../../../../core/utils/http-error-message';
import {
  EmployeeSalaryResponse,
  PayScaleBasis,
  SalaryStructureResponse,
  COMPONENT_TYPE_CONFIG,
} from '../../models/payroll.model';

@Component({
  selector: 'app-employee-salary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './employee-salary.html',
  styleUrls: ['./employee-salary.css'],
})
export class EmployeeSalary implements OnInit {
  private readonly svc = inject(PayrollService);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  // ── State ──────────────────────────────────────────────
  readonly salaries = signal<EmployeeSalaryResponse[]>([]);
  readonly structures = signal<SalaryStructureResponse[]>([]);
  readonly history = signal<EmployeeSalaryResponse[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly showHistory = signal(false);
  readonly totalElements = signal(0);
  readonly typeConfig = COMPONENT_TYPE_CONFIG;

  /** What the pay scale decides for the employee and date in the form; null until both are filled in. */
  readonly payBasis = signal<PayScaleBasis | null>(null);
  /** A graded employee's structure and basic come from the pay scale: the two fields are locked. */
  readonly fromScale = computed(() => this.payBasis()?.graded === true);
  /** Graded, but the grade has no linked structure or the scale no amount on the date: the server would refuse. */
  readonly scaleProblem = computed<string | null>(() => {
    const b = this.payBasis();
    if (!b?.graded) return null;
    if (b.structureId == null) return 'payroll.employeeSalary.errors.rules.GRADE_STRUCTURE_MISSING';
    if (b.basicSalary == null) return 'payroll.employeeSalary.errors.rules.PAY_SCALE_MISSING';
    return null;
  });

  // Computed preview from form values
  readonly previewBasic = signal<number>(0);
  readonly selectedStructure = signal<SalaryStructureResponse | null>(null);

  readonly displayedColumns = [
    'employeeCode',
    'employeeName',
    'structureName',
    'basicSalary',
    'grossSalary',
    'netSalary',
    'currency',
    'effectiveFrom',
    'actions',
  ];

  readonly breakdownColumns = ['componentName', 'componentType', 'calcBasis', 'amount'];

  readonly maxDate = new Date();

  // ── Form ───────────────────────────────────────────────
  readonly form = new FormGroup({
    employeeId: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    structureId: new FormControl<number | null>(null, [Validators.required]),
    basicSalary: new FormControl<number>(0, [Validators.required, Validators.min(0.001)]),
    effectiveFrom: new FormControl<Date | null>(new Date(), [Validators.required]),
    remarks: new FormControl(''),
  });

  page = 0;
  pageSize = 20;

  ngOnInit(): void {
    this.loadSalaries();
    this.loadStructures();

    // Watch basicSalary and structureId for preview
    this.form.get('basicSalary')!.valueChanges.subscribe((val) => {
      this.previewBasic.set(val ?? 0);
    });
    this.form.get('structureId')!.valueChanges.subscribe((id) => {
      const found = this.structures().find((s) => s.structureId === id);
      this.selectedStructure.set(found ?? null);
    });
    this.watchPayScale();
  }

  /** Employee and date decide the pay-scale basis; only the latest answer is applied. */
  private watchPayScale(): void {
    const { employeeId, effectiveFrom } = this.form.controls;
    combineLatest([
      employeeId.valueChanges.pipe(startWith(employeeId.value)),
      effectiveFrom.valueChanges.pipe(startWith(effectiveFrom.value)),
    ])
      .pipe(
        debounceTime(300),
        distinctUntilChanged(([a, d], [b, e]) => a === b && toIsoDate(d) === toIsoDate(e)),
        switchMap(([id, date]) =>
          id && id > 0 && date
            ? this.svc.getPayScaleBasis(id, toIsoDate(date)).pipe(catchError(() => of(null)))
            : of(null),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((basis) => this.applyBasis(basis));
  }

  private applyBasis(basis: PayScaleBasis | null): void {
    this.payBasis.set(basis);
    const { structureId, basicSalary } = this.form.controls;
    if (basis?.graded) {
      structureId.setValue(basis.structureId ?? null);
      basicSalary.setValue(basis.basicSalary ?? 0);
      structureId.disable();
      basicSalary.disable();
    } else {
      structureId.enable();
      basicSalary.enable();
    }
  }

  loadSalaries(): void {
    this.loading.set(true);
    this.svc.getAllCurrentSalaries(undefined, this.page, this.pageSize).subscribe({
      next: (paged) => {
        this.salaries.set(paged.content);
        this.totalElements.set(paged.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadStructures(): void {
    this.svc.getStructures(true).subscribe({
      next: (list) => this.structures.set(list),
    });
  }

  openAssign(): void {
    this.applyBasis(null);
    this.form.reset({ effectiveFrom: new Date() });
    this.selectedStructure.set(null);
    this.previewBasic.set(0);
    this.showForm.set(true);
    this.showHistory.set(false);
  }

  openRevise(salary: EmployeeSalaryResponse): void {
    this.applyBasis(null);
    this.form.patchValue({
      employeeId: salary.employeeId,
      structureId: salary.structureId,
      basicSalary: salary.basicSalary,
      effectiveFrom: new Date(),
      remarks: '',
    });
    const found = this.structures().find((s) => s.structureId === salary.structureId);
    this.selectedStructure.set(found ?? null);
    this.previewBasic.set(salary.basicSalary);
    this.showForm.set(true);
    this.showHistory.set(false);
  }

  openHistory(salary: EmployeeSalaryResponse): void {
    this.showHistory.set(true);
    this.showForm.set(false);
    this.svc.getSalaryHistory(salary.employeeId).subscribe({
      next: (list) => this.history.set(list),
    });
  }

  onSave(): void {
    if (this.saving()) return;
    if (this.form.invalid || this.scaleProblem()) {
      this.form.markAllAsTouched();
      return;
    }

    // Raw value: a graded employee's structure is locked (disabled) but still sent.
    const { employeeId, structureId, basicSalary, effectiveFrom: date } = this.form.getRawValue();
    if (employeeId == null || structureId == null || basicSalary == null || !date) {
      return;
    }
    this.saving.set(true);
    const dateStr = toIsoDate(date);

    this.svc
      .assignSalary({
        employeeId,
        structureId,
        // A graded employee's basic is set by the server from the pay scale.
        basicSalary: this.fromScale() ? undefined : basicSalary,
        effectiveFrom: dateStr,
        remarks: this.form.value.remarks ?? '',
      })
      .subscribe({
        next: () => {
          this.snack.open(
            `✅ ${this.translate.instant('payroll.employeeSalary.success.assigned')}`,
            this.translate.instant('payroll.employeeSalary.close'),
            { duration: 3000, panelClass: 'snack-success' },
          );
          this.showForm.set(false);
          this.saving.set(false);
          this.loadSalaries();
        },
        error: (err) => {
          this.snack.open(
            '❌ ' +
              (ruleMessage(this.translate, err, 'payroll.employeeSalary.errors.rules') ||
                err.error?.message ||
                this.translate.instant('payroll.employeeSalary.errors.saveFailed')),
            this.translate.instant('payroll.employeeSalary.close'),
            { duration: 4000 },
          );
          this.saving.set(false);
        },
      });
  }

  onPageChange(e: PageEvent): void {
    this.page = e.pageIndex;
    this.pageSize = e.pageSize;
    this.loadSalaries();
  }

  formatCurrency(val: number): string {
    return (
      val?.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' SSP'
    );
  }

  getTypeStyle(type: string) {
    return (
      this.typeConfig[type as keyof typeof this.typeConfig] ?? {
        label: type,
        color: '#374151',
        bg: '#f3f4f6',
      }
    );
  }

  closeForm(): void {
    this.showForm.set(false);
  }
  closeHistory(): void {
    this.showHistory.set(false);
  }
}

/** A date-only value as yyyy-MM-dd in local time (never through UTC). */
function toIsoDate(date: Date | null): string {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
