import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import { TypedCellDefDirective } from '../../../../core/directives/typed-cell-def.directive';
import { LanguageService } from '../../../../core/services/language.service';
import { formatDisplayDateTime } from '../../../../core/utils/display-date';
import { InboxItem } from '../../models/workflow.model';
import { WorkflowService } from '../../services/workflow.service';
import { workflowErrorMessage } from '../../workflow-errors';

const PAGE_SIZES = [10, 20, 50];

/** One table row, worked out once so the template calls no methods. */
interface InboxRow extends InboxItem {
  stepLabel: string;
  submitted: string;
}

/** Requests waiting for the signed-in user to act, oldest first from the API, paged on the server. */
@Component({
  selector: 'app-approvals-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TypedCellDefDirective,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    TranslatePipe,
  ],
  templateUrl: './approvals-inbox.html',
})
export class ApprovalsInbox implements OnInit {
  private readonly svc = inject(WorkflowService);
  private readonly translate = inject(TranslateService);
  private readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly columns = ['requester', 'request', 'step', 'submitted'];
  readonly pageSizes = PAGE_SIZES;

  readonly items = signal<InboxItem[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(PAGE_SIZES[0]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Rows are rebuilt when the language changes; keep the same row element per request. */
  readonly trackRow = (_: number, r: InboxRow): string => `${r.type}/${r.requestId}`;

  readonly rows = computed<InboxRow[]>(() => {
    const lang = this.lang.currentLang();
    return this.items().map((i) => ({
      ...i,
      stepLabel: lang === 'ar' ? i.stepLabelAr : i.stepLabelEn,
      submitted: formatDisplayDateTime(i.submittedAt, lang),
    }));
  });

  private readonly requests = new Subject<{ page: number; size: number }>();

  constructor() {
    // switchMap drops a slower earlier response, so an old page never overwrites a newer one.
    this.requests
      .pipe(
        tap(({ page, size }) => {
          this.pageIndex.set(page);
          this.pageSize.set(size);
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(({ page, size }) =>
          this.svc.inbox(page, size).pipe(
            catchError((err: unknown) => {
              this.items.set([]);
              this.total.set(0);
              this.error.set(workflowErrorMessage(this.translate, err));
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.items.set(res.data.content);
        this.total.set(res.data.totalElements);
        this.loading.set(false);
      });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.requests.next({ page: this.pageIndex(), size: this.pageSize() });
  }

  onPage(e: Pick<PageEvent, 'pageIndex' | 'pageSize' | 'length'>): void {
    this.requests.next({ page: e.pageIndex, size: e.pageSize });
  }
}
