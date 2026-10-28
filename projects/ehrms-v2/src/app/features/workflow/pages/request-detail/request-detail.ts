import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, Subscription, finalize } from 'rxjs';

import { Auth } from '../../../../core/auth/auth';
import { LanguageService } from '../../../../core/services/language.service';
import { DepartmentLookup } from '../../../employee/models/employee';
import { EmployeeService } from '../../../employee/services/employee';
import {
  DialogKind,
  DialogResult,
  ForwardDialog,
} from '../../components/forward-dialog/forward-dialog';
import { HistoryTimeline } from '../../components/history-timeline/history-timeline';
import {
  ApiResponse,
  isRequestType,
  StepOutcome,
  RequestHistory,
  RequestType,
  stageKey,
  WorkflowStatus,
} from '../../models/workflow.model';
import { WorkflowService } from '../../services/workflow.service';
import { workflowErrorMessage } from '../../workflow-errors';

interface RequestRef {
  type: RequestType;
  id: number;
}

function requestRef(type: string | null, id: string | null): RequestRef | null {
  const n = Number(id);
  return isRequestType(type) && Number.isInteger(n) && n > 0 ? { type, id: n } : null;
}

/** One request: where it stands, who did what, and the actions the signed-in user can take on it. */
@Component({
  selector: 'app-request-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ForwardDialog,
    HistoryTimeline,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.css',
})
export class RequestDetail implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(WorkflowService);
  private readonly employees = inject(EmployeeService);
  private readonly auth = inject(Auth);
  private readonly lang = inject(LanguageService);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  /** The request from the URL; null when the type or id is not one this app knows (no API call then). */
  readonly ref = requestRef(
    this.route.snapshot.paramMap.get('type'),
    this.route.snapshot.paramMap.get('id'),
  );

  private readonly pageTitle = viewChild<ElementRef<HTMLElement>>('pageTitle');
  // One live call of each kind: a newer load cancels the older one, so a slow old answer never wins.
  private statusSub?: Subscription;
  private historySub?: Subscription;
  private departmentsSub?: Subscription;
  private actionSub?: Subscription;

  readonly status = signal<WorkflowStatus | null>(null);
  readonly history = signal<RequestHistory[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly historyError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly dialog = signal<DialogKind | null>(null);
  readonly dialogError = signal<string | null>(null);
  readonly acting = signal(false);
  readonly departments = signal<DepartmentLookup[]>([]);
  private departmentsSource: 'step' | 'hr' | null = null;
  readonly departmentsError = signal<string | null>(null);

  /** An override may choose any outcome; the API checks it against the flow. */
  readonly overrideOutcomes: StepOutcome[] = ['FORWARD', 'APPROVE', 'REJECT'];
  readonly stageKey = stageKey;
  readonly isArabic = computed(() => this.lang.currentLang() === 'ar');
  readonly isOpen = computed(() => !!this.status()?.stage.startsWith('PENDING'));
  readonly stepLabel = computed(() => {
    const s = this.status();
    return (this.isArabic() ? s?.stepLabelAr : s?.stepLabelEn) ?? '';
  });
  /** UI convenience only: the API re-checks who may act on every call. */
  readonly canCancel = computed(
    () => this.isOpen() && this.status()?.requesterEmployeeId === this.auth.getEmployeeId(),
  );
  readonly canOverride = computed(() => this.isOpen() && !!this.status()?.mayOverride);
  /** Forward asks for a department when the step does; an override only when the open step picks one. */
  readonly pickDepartment = computed(() => {
    const s = this.status();
    return this.dialog() === 'OVERRIDE'
      ? !!s?.overridePicksTargetDepartment
      : !!s?.pickTargetDepartment;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const ref = this.ref;
    if (!ref) {
      this.loading.set(false);
      this.loadError.set(this.translate.instant('common.httpErrors.notFound'));
      return;
    }
    this.statusSub?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.forbidden.set(false);
    this.statusSub = this.svc
      .status(ref.type, ref.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.applyStatus(res.data),
        error: (err: unknown) => {
          if ((err as { status?: number } | null)?.status === 403) this.forbidden.set(true);
          else this.loadError.set(workflowErrorMessage(this.translate, err));
        },
      });
    this.loadHistory(ref);
  }

  ngOnDestroy(): void {
    this.statusSub?.unsubscribe();
    this.historySub?.unsubscribe();
    this.departmentsSub?.unsubscribe();
    this.actionSub?.unsubscribe();
  }

  open(kind: DialogKind): void {
    const s = this.status();
    this.dialogError.set(null);
    if (kind === 'OVERRIDE' && s?.overridePicksTargetDepartment) this.loadDepartments('hr');
    else if (kind === 'FORWARD' && s?.pickTargetDepartment) this.loadDepartments('step');
    this.dialog.set(kind);
  }

  closeDialog(): void {
    if (this.acting()) return;
    this.dialog.set(null);
  }

  submit(result: DialogResult): void {
    const kind = this.dialog();
    const stepKey = this.status()?.stepKey;
    const ref = this.ref;
    if (!kind || !stepKey || !ref || this.acting()) return; // a double click must not act twice
    const call = this.callFor(ref, kind, stepKey, result);
    this.acting.set(true);
    this.dialogError.set(null);
    this.actionSub = call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (res) => {
        this.dialog.set(null);
        this.notice.set(null);
        this.applyStatus(res.data);
        this.loadHistory(ref);
        this.snack.open(
          this.translate.instant(`workflow.success.${kind}`),
          this.translate.instant('common.close'),
          { duration: 4000 },
        );
        // The button that opened the dialog may be gone now, so park focus on the title.
        queueMicrotask(() => this.pageTitle()?.nativeElement.focus());
      },
      error: (err: unknown) => {
        if ((err as { status?: number } | null)?.status === 409) {
          // Someone else got there first: show what happened and refresh the real state.
          this.dialog.set(null);
          this.notice.set(workflowErrorMessage(this.translate, err));
          this.load();
        } else {
          this.dialogError.set(workflowErrorMessage(this.translate, err));
        }
      },
    });
  }

  private callFor(
    { type, id }: RequestRef,
    kind: DialogKind,
    stepKey: string,
    r: DialogResult,
  ): Observable<ApiResponse<WorkflowStatus>> {
    if (kind === 'CANCEL') return this.svc.cancel(type, id);
    // The dialog guarantees an outcome and, for an override, a reason before it emits.
    const outcome = r.outcome ?? 'REJECT';
    if (kind === 'OVERRIDE') {
      return this.svc.override(type, id, {
        stepKey,
        outcome,
        targetDepartmentId: r.targetDepartmentId,
        reason: r.text ?? '',
      });
    }
    return this.svc.act(type, id, {
      stepKey,
      outcome,
      targetDepartmentId: r.targetDepartmentId,
      comment: r.text,
    });
  }

  private applyStatus(s: WorkflowStatus): void {
    this.status.set(s);
  }

  private loadHistory({ type, id }: RequestRef): void {
    this.historySub?.unsubscribe();
    this.historyError.set(null);
    this.historySub = this.svc.history(type, id).subscribe({
      next: (res) => this.history.set(res.data),
      error: (err: unknown) => this.historyError.set(workflowErrorMessage(this.translate, err)),
    });
  }

  /**
   * 'step': the departments the step holder may forward to (open to the holder). 'hr': the full lookup,
   * HR roles only, used by an HR_ADMIN override. Reloaded only when the source changes or the last try failed.
   */
  private loadDepartments(source: 'step' | 'hr'): void {
    const ref = this.ref;
    if (!ref || (this.departmentsSource === source && this.departments().length > 0)) return;
    this.departmentsSub?.unsubscribe();
    if (this.departmentsSource !== source) this.departments.set([]); // never show the other list
    this.departmentsSource = source;
    this.departmentsError.set(null);
    const list =
      source === 'hr'
        ? this.employees.getDepartments()
        : this.svc.targetDepartments(ref.type, ref.id);
    this.departmentsSub = list.subscribe({
      next: (res) => this.departments.set(res.data),
      error: (err: unknown) => this.departmentsError.set(workflowErrorMessage(this.translate, err)),
    });
  }
}
