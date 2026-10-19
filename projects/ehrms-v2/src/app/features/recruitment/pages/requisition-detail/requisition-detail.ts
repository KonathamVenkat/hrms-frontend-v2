import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, finalize } from 'rxjs';

import { Auth } from '../../../../core/auth/auth';
import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { HR_ROLES } from '../../../../core/guards/role.guard';
import { ApiResponse, Requisition } from '../../models/requisition.model';
import { recruitmentErrorMessage } from '../../recruitment-errors';
import { RequisitionAction, availableActions, statusBadgeClass } from '../../requisition-view';
import { RequisitionService } from '../../services/requisition.service';

/** The actions that need a confirmation dialog (edit just navigates). */
type DialogAction = Exclude<RequisitionAction, 'edit'>;

const SUCCESS_KEYS: Record<DialogAction, string> = {
  submit: 'recruitment.detail.success.submitted',
  cancel: 'recruitment.detail.success.cancelled',
  approve: 'recruitment.detail.success.approved',
  reject: 'recruitment.detail.success.rejected',
  hold: 'recruitment.detail.success.held',
  resume: 'recruitment.detail.success.resumed',
  close: 'recruitment.detail.success.closed',
};

/** One requisition, its approval history and the actions the signed-in user may take on it. */
@Component({
  selector: 'app-requisition-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    CdkTrapFocus,
    AccessibleDialogDirective,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    TranslatePipe,
  ],
  templateUrl: './requisition-detail.html',
  styleUrl: './requisition-detail.css',
})
export class RequisitionDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly svc = inject(RequisitionService);
  private readonly auth = inject(Auth);
  private readonly snack = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  private readonly pageTitle = viewChild<ElementRef<HTMLElement>>('pageTitle');

  readonly requisition = signal<Requisition | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly dialog = signal<DialogAction | null>(null);
  readonly dialogError = signal<string | null>(null);
  readonly acting = signal(false);

  readonly badgeClass = computed(() => {
    const r = this.requisition();
    return r ? statusBadgeClass(r.status) : '';
  });

  /** UI convenience only: the API re-checks role, requester, state and version on every call. */
  readonly actions = computed<RequisitionAction[]>(() => {
    const r = this.requisition();
    if (!r) return [];
    return availableActions(r.status, {
      isHr: this.auth.hasAnyRole(...HR_ROLES),
      isRequester: r.requestedById === this.auth.getEmployeeId(),
    });
  });
  readonly can = computed(() => new Set(this.actions()));

  readonly approveForm = this.fb.group({
    budgetConfirmed: [false, Validators.requiredTrue],
    managementConfirmed: [false, Validators.requiredTrue],
    comments: ['', Validators.maxLength(500)],
  });
  readonly rejectForm = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc
      .get(this.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.requisition.set(res.data);
          else this.loadError.set(res.message);
        },
        error: (err: unknown) =>
          this.loadError.set(
            recruitmentErrorMessage(this.translate, err, 'recruitment.detail.loadFailed'),
          ),
      });
  }

  edit(): void {
    void this.router.navigate(['/app/recruitment/requisitions', this.id, 'edit']);
  }

  open(action: DialogAction): void {
    this.dialogError.set(null);
    this.approveForm.reset();
    this.rejectForm.reset();
    this.dialog.set(action);
  }

  closeDialog(): void {
    if (this.acting()) return;
    this.dialog.set(null);
    this.dialogError.set(null);
  }

  confirm(): void {
    const action = this.dialog();
    const r = this.requisition();
    if (!action || !r || this.acting()) return; // a double click must not send the request twice

    const call = this.callFor(action, r);
    if (!call) return;
    this.acting.set(true);
    this.dialogError.set(null);
    call.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (res) => {
        if (!res.success) {
          this.dialogError.set(
            res.message || this.translate.instant('common.httpErrors.actionFailed'),
          );
          return;
        }
        this.requisition.set(res.data);
        this.dialog.set(null);
        this.snack.open(
          this.translate.instant(SUCCESS_KEYS[action], { code: res.data.code }),
          this.translate.instant('common.close'),
          { duration: 4000 },
        );
        // The button that opened the dialog may be gone now (the status changed), so park focus on the title.
        queueMicrotask(() => this.pageTitle()?.nativeElement.focus());
      },
      error: (err: unknown) => {
        this.dialogError.set(recruitmentErrorMessage(this.translate, err));
        // Someone else changed it: show the current state behind the dialog so the buttons are right.
        if ((err as { status?: number } | null)?.status === 409) this.refresh();
      },
    });
  }

  /** Builds the API call for the action, or null when the form of that dialog is not valid yet. */
  private callFor(
    action: DialogAction,
    r: Requisition,
  ): Observable<ApiResponse<Requisition>> | null {
    const version = r.version;
    switch (action) {
      case 'approve': {
        if (this.approveForm.invalid) {
          this.approveForm.markAllAsTouched();
          return null;
        }
        const v = this.approveForm.getRawValue();
        return this.svc.approve(r.id, {
          budgetConfirmed: v.budgetConfirmed,
          managementConfirmed: v.managementConfirmed,
          comments: v.comments.trim() || undefined,
          version,
        });
      }
      case 'reject': {
        if (this.rejectForm.invalid) {
          this.rejectForm.markAllAsTouched();
          return null;
        }
        return this.svc.reject(r.id, {
          reason: this.rejectForm.getRawValue().reason.trim(),
          version,
        });
      }
      case 'submit':
        return this.svc.submit(r.id, { version });
      case 'cancel':
        return this.svc.cancel(r.id, { version });
      case 'hold':
        return this.svc.hold(r.id, { version });
      case 'resume':
        return this.svc.resume(r.id, { version });
      case 'close':
        return this.svc.close(r.id, { version });
    }
  }

  private refresh(): void {
    this.svc
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => res.success && this.requisition.set(res.data) });
  }
}
