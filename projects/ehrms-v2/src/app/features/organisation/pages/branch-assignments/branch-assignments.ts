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
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  switchMap,
} from 'rxjs';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import {
  BranchLookup,
  EmployeeBranchGap,
  OrganisationSummary,
  PagedResponse,
} from '../../models/organisation.model';
import { OrganisationService } from '../../services/organisation.service';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface SkippedRow {
  employeeId: number;
  name: string;
  reason: string;
}

/**
 * Back-fill: HR gives every employee who has no branch yet their branch. The list is paged and searched on the
 * server; a branch can only be chosen from the employee's own location. Rows are applied independently, so a
 * refused row never blocks the others and is listed with its reason.
 */
@Component({
  selector: 'app-branch-assignments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, CdkTrapFocus, AccessibleDialogDirective],
  templateUrl: './branch-assignments.html',
})
export class BranchAssignments implements OnInit {
  private svc = inject(OrganisationService);
  private translate = inject(TranslateService);
  private destroy = inject(DestroyRef);

  private term$ = new Subject<string>();
  private load$ = new Subject<{ q: string; page: number }>();
  private query = '';

  summary = signal<OrganisationSummary | null>(null);
  page = signal<PagedResponse<EmployeeBranchGap> | null>(null);
  branches = signal<BranchLookup[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  selection = signal<Record<number, number>>({});
  confirmOpen = signal(false);
  assigning = signal(false);
  confirmError = signal<string | null>(null);
  assignedCount = signal<number | null>(null);
  skipped = signal<SkippedRow[]>([]);

  readonly rows = computed(() => this.page()?.content ?? []);
  readonly selectedCount = computed(() => Object.keys(this.selection()).length);
  readonly branchesByLocation = computed(() => {
    const map = new Map<number, BranchLookup[]>();
    for (const b of this.branches()) {
      if (b.locationId == null) continue;
      map.set(b.locationId, [...(map.get(b.locationId) ?? []), b]);
    }
    return map;
  });

  ngOnInit(): void {
    this.term$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((q) => this.requestPage(q, 0));

    // switchMap drops an older response that arrives after a newer request.
    this.load$
      .pipe(
        switchMap(({ q, page }) => {
          this.loading.set(true);
          this.loadFailed.set(false);
          return this.svc.employeesWithoutBranch(q, page, PAGE_SIZE).pipe(
            catchError(() => {
              this.loadFailed.set(true);
              return EMPTY;
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((p) => this.page.set(p));

    this.svc
      .lookupBranches()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (list) => this.branches.set(list) });
    this.loadSummary();
    this.requestPage('', 0);
  }

  search(q: string): void {
    this.term$.next(q.trim());
  }

  goTo(page: number): void {
    this.requestPage(this.query, page);
  }

  retry(): void {
    this.requestPage(this.query, this.page()?.number ?? 0);
  }

  choose(employeeId: number, value: string): void {
    this.selection.update((s) => {
      const next = { ...s };
      if (value === '') delete next[employeeId];
      else next[employeeId] = Number(value);
      return next;
    });
  }

  openConfirm(): void {
    if (this.selectedCount() === 0) return;
    this.confirmError.set(null);
    this.confirmOpen.set(true);
  }

  cancelConfirm(): void {
    this.confirmOpen.set(false);
    this.confirmError.set(null);
  }

  confirmAssign(): void {
    if (this.assigning() || this.selectedCount() === 0) return;
    const items = Object.entries(this.selection()).map(([id, branchId]) => ({
      employeeId: Number(id),
      branchId,
    }));
    const names = new Map(this.rows().map((r) => [r.employeeId, r.fullName] as const));
    this.assigning.set(true);
    this.confirmError.set(null);
    this.svc
      .assignBranches(items)
      .pipe(finalize(() => this.assigning.set(false)))
      .subscribe({
        next: (res) => {
          const refused = new Set(res.skipped.map((s) => s.employeeId));
          this.assignedCount.set(res.assigned);
          this.skipped.set(
            res.skipped.map((s) => ({
              ...s,
              name: names.get(s.employeeId) ?? String(s.employeeId),
            })),
          );
          this.selection.update((s) =>
            Object.fromEntries(Object.entries(s).filter(([id]) => refused.has(Number(id)))),
          );
          this.confirmOpen.set(false);
          this.loadSummary();
          this.requestPage(this.query, this.page()?.number ?? 0);
        },
        error: (err: HttpErrorResponse) => this.confirmError.set(this.messageOf(err)),
      });
  }

  private requestPage(q: string, page: number): void {
    this.query = q;
    this.load$.next({ q, page });
  }

  private loadSummary(): void {
    this.svc
      .summary()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ next: (s) => this.summary.set(s) });
  }

  private messageOf(err: HttpErrorResponse): string {
    const t = (key: string) => this.translate.instant(key);
    return getHttpErrorMessage(this.translate, err, {
      400: t('organisation.branchAssignments.errors.badRequest'),
      422: t('common.httpErrors.actionFailed'),
      500: t('common.httpErrors.unexpected'),
    });
  }
}
