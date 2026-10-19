import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, merge, of, switchMap, tap } from 'rxjs';

import { recruitmentErrorMessage } from '../../recruitment-errors';
import {
  LookupOption,
  REQUISITION_STATUSES,
  RequisitionQuery,
  RequisitionStatus,
  RequisitionSummary,
} from '../../models/requisition.model';
import { RequisitionService } from '../../services/requisition.service';
import { statusBadgeClass } from '../../requisition-view';

/** Requisitions the signed-in user may see: all of them for HR, their own (or their department's) otherwise. */
@Component({
  selector: 'app-requisition-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    TranslatePipe,
  ],
  templateUrl: './requisition-list.html',
  styleUrl: './requisition-list.css',
})
export class RequisitionList implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RequisitionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly columns = [
    'code',
    'jobTitle',
    'department',
    'requestedBy',
    'positions',
    'priority',
    'targetJoinDate',
    'status',
    'actions',
  ] as const;
  readonly statuses = REQUISITION_STATUSES;
  readonly pageSizes = [10, 20, 50, 100];
  /** Computed once so the template does no work per row. */
  readonly badgeClasses = Object.fromEntries(
    REQUISITION_STATUSES.map((s) => [s, statusBadgeClass(s)]),
  ) as Record<string, string>;

  readonly requisitions = signal<RequisitionSummary[]>([]);
  readonly totalElements = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly departments = signal<LookupOption[]>([]);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly sortBy = signal('createdAt');
  readonly direction = signal<'asc' | 'desc'>('desc');

  readonly filterForm = this.fb.group({
    status: this.fb.control<RequisitionStatus | ''>(''),
    departmentId: this.fb.control(0),
    q: this.fb.control(''),
  });

  /** Only someone who may raise a requisition for at least one department is offered the button. */
  readonly canRaise = computed(() => this.departments().length > 0);

  private readonly filtersChanged = signal(0);
  readonly hasFilters = computed(() => {
    this.filtersChanged();
    const f = this.filterForm.getRawValue();
    return !!f.status || f.departmentId > 0 || !!f.q.trim();
  });

  private readonly reload$ = new Subject<void>();

  ngOnInit(): void {
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        // switchMap drops a response that arrives after a newer request was sent.
        switchMap(() =>
          this.svc.search(this.query()).pipe(
            catchError((err: unknown) => {
              this.error.set(
                recruitmentErrorMessage(this.translate, err, 'recruitment.list.loadFailed'),
              );
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.loading.set(false);
        if (!res) return;
        if (res.success) {
          this.requisitions.set(res.data.content);
          this.totalElements.set(res.data.totalElements);
        } else {
          this.error.set(res.message || this.translate.instant('recruitment.list.loadFailed'));
        }
      });

    const c = this.filterForm.controls;
    merge(
      c.status.valueChanges,
      c.departmentId.valueChanges,
      c.q.valueChanges.pipe(debounceTime(300)),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.filtersChanged.update((n) => n + 1);
        this.page.set(0);
        this.reload$.next();
      });

    // The department filter and the "New requisition" button use what the caller may raise for.
    this.svc
      .raiseOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.departments.set(res.data.departments);
        },
        // Non-critical: the list still works without the department filter.
        error: () => this.departments.set([]),
      });

    this.reload$.next();
  }

  retry(): void {
    this.reload$.next();
  }

  clearFilters(): void {
    this.filterForm.reset({ status: '', departmentId: 0, q: '' });
  }

  onPage(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.size.set(event.pageSize);
    this.reload$.next();
  }

  onSort(sort: Sort): void {
    this.sortBy.set(sort.direction ? sort.active : 'createdAt');
    this.direction.set(sort.direction === 'asc' ? 'asc' : 'desc');
    this.page.set(0);
    this.reload$.next();
  }

  private query(): RequisitionQuery {
    const f = this.filterForm.getRawValue();
    return {
      status: f.status || undefined,
      departmentId: f.departmentId || undefined,
      q: f.q,
      page: this.page(),
      size: this.size(),
      sortBy: this.sortBy(),
      direction: this.direction(),
    };
  }
}
