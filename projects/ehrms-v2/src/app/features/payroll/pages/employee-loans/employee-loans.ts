import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { EmployeeLoan, LoanStatus, LoanType } from '../../models/payroll.model';
import { PayrollService } from '../../services/payroll.service';
import { LoanEnd } from './loan-end';
import { LoanForm } from './loan-form';

/** Payroll > Employee Loans: the loan register (HR_ADMIN). Paged, searched and filtered on the server. */
@Component({
  selector: 'app-employee-loans',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    MatTableModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslatePipe,
    LoanForm,
    LoanEnd,
  ],
  templateUrl: './employee-loans.html',
  styleUrl: './employee-loans.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeLoans implements OnInit {
  private readonly svc = inject(PayrollService);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<EmployeeLoan[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly types = signal<LoanType[]>([]);

  readonly showForm = signal(false);
  readonly ending = signal<{ loan: EmployeeLoan; action: 'close' | 'cancel' } | null>(null);

  readonly search = new FormControl('', { nonNullable: true });
  readonly type = new FormControl<number | null>(null);
  readonly status = new FormControl<LoanStatus | null>('ACTIVE');
  readonly statuses: LoanStatus[] = ['ACTIVE', 'CLOSED', 'CANCELLED'];

  readonly columns = [
    'employee',
    'type',
    'principal',
    'instalment',
    'progress',
    'remaining',
    'period',
    'status',
    'actions',
  ];
  page = 0;
  pageSize = 20;

  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    this.svc
      .getLoanTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (t) => this.types.set(t) });

    // Typing waits 300 ms; any filter change goes back to page 1; only the latest answer is shown.
    merge(
      this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
      this.type.valueChanges,
      this.status.valueChanges,
    )
      .pipe(
        tap(() => (this.page = 0)),
        startWith(null),
        switchMap(() => merge(of(null), this.reload$)),
        switchMap(() => {
          this.loading.set(true);
          this.loadFailed.set(false);
          return this.svc
            .searchLoans({
              q: this.search.value,
              componentId: this.type.value,
              status: this.status.value,
              page: this.page,
              size: this.pageSize,
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (!page) {
          this.loadFailed.set(true);
          return;
        }
        this.rows.set(page.content);
        this.total.set(page.totalElements);
      });
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex;
    this.pageSize = e.pageSize;
    this.reload$.next();
  }

  onSaved(): void {
    this.showForm.set(false);
    this.notify('payroll.loans.success.created');
    this.reload$.next();
  }

  onEnded(action: 'close' | 'cancel'): void {
    this.ending.set(null);
    this.notify(
      action === 'close' ? 'payroll.loans.success.closed' : 'payroll.loans.success.cancelled',
    );
    this.reload$.next();
  }

  private notify(key: string): void {
    this.snack.open(this.translate.instant(key), this.translate.instant('common.close'), {
      duration: 3000,
      panelClass: 'snack-success',
    });
  }
}
