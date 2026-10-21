import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { EmployeeBranchGap } from '../../models/organisation.model';
import { OrganisationService } from '../../services/organisation.service';

const PAGE_SIZE = 50;

export interface PickedManager {
  id: number;
  label: string;
}

/**
 * Ready list of the employees who could manage a branch: those working at the branch's location, a search box for
 * narrowing it, and a switch to look beyond the location. Controlled by its parent through selectedId.
 */
@Component({
  selector: 'app-manager-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './manager-picker.html',
  styleUrl: './manager-picker.css',
})
export class ManagerPicker {
  private svc = inject(OrganisationService);

  /** The branch's location; null when it has none, which lists everyone. */
  readonly locationId = input<number | null>(null);
  readonly selectedId = input<number | null>(null);
  readonly selectedLabel = input('');
  readonly picked = output<PickedManager | null>();

  protected query = signal('');
  protected showAll = signal(false);
  protected results = signal<EmployeeBranchGap[]>([]);
  protected total = signal(0);
  protected loading = signal(true);
  protected failed = signal(false);
  private retry = signal(0);

  protected readonly canNarrow = computed(() => this.locationId() !== null);
  protected readonly hasMore = computed(() => this.total() > this.results().length);

  private readonly request = computed(() => ({
    locationId: this.showAll() ? null : this.locationId(),
    q: this.query(),
    retry: this.retry(),
  }));

  constructor() {
    toObservable(this.request)
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        debounceTime(250),
        switchMap((r) =>
          this.svc.managerCandidates(r.locationId, r.q, 0, PAGE_SIZE).pipe(
            catchError(() => {
              this.failed.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.results.set(page?.content ?? []);
        this.total.set(page?.totalElements ?? 0);
        this.loading.set(false);
      });
  }

  protected pick(e: EmployeeBranchGap): void {
    this.picked.emit({ id: e.employeeId, label: e.fullName });
  }

  protected clear(): void {
    this.picked.emit(null);
  }

  protected reload(): void {
    this.retry.update((n) => n + 1);
  }
}
