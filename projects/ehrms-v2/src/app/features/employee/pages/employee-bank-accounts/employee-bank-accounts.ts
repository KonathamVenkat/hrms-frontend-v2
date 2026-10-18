import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { FieldA11yDirective } from '../../../../core/directives/field-a11y.directive';
import { fieldErrorMessage, isFieldInvalid } from '../../../../core/forms/field-errors';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { timedMessage } from '../../../../core/utils/timed-message';
import { BankAccountService } from '../../services/bank-account.service';
import {
  EmployeeBankAccount,
  EmployeeBankAccountRequest,
  MasterLookup,
} from '../../models/bank-account.model';

type ConfirmType = 'primary' | 'deactivate';
type FormKey = 'bankId' | 'accountNumber' | 'iban' | 'accountHolderName';

/**
 * Bank accounts of one employee. HR_ADMIN adds, edits, sets the primary account and deactivates; everyone else
 * (HR_MANAGER, the employee) gets `readOnly`, and the backend masks the numbers for HR_MANAGER.
 */
@Component({
  selector: 'app-employee-bank-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FieldA11yDirective,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './employee-bank-accounts.html',
  styleUrl: './employee-bank-accounts.css',
})
export class EmployeeBankAccountsComponent implements OnInit {
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);

  private fb = inject(NonNullableFormBuilder);
  private svc = inject(BankAccountService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  accounts = signal<EmployeeBankAccount[]>([]);
  banks = signal<MasterLookup[]>([]);
  branches = signal<MasterLookup[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);
  showModal = signal(false);
  isEditMode = signal(false);
  private editing = signal<EmployeeBankAccount | null>(null);
  confirmItem = signal<EmployeeBankAccount | null>(null);
  confirmType = signal<ConfirmType>('primary');
  confirmError = signal<string | null>(null);

  readonly activeAccounts = computed(() => this.accounts().filter((a) => a.isActive));
  readonly inactiveAccounts = computed(() => this.accounts().filter((a) => !a.isActive));

  /** The active banks, plus the account's own bank when it has since been deactivated (so editing still shows it). */
  readonly bankOptions = computed(() => {
    const current = this.editing();
    const list = this.banks();
    if (!current || list.some((b) => b.id === current.bankId)) return list;
    return [
      ...list,
      {
        id: current.bankId,
        code: '',
        name: current.bankName ?? '',
        nameAr: current.bankNameAr ?? '',
      },
    ];
  });

  readonly branchOptions = computed(() => {
    const current = this.editing();
    const list = this.branches();
    if (!current?.bankBranchId || list.some((b) => b.id === current.bankBranchId)) return list;
    return [
      ...list,
      {
        id: current.bankBranchId,
        code: '',
        name: current.bankBranchName ?? '',
        nameAr: current.bankBranchNameAr ?? '',
      },
    ];
  });

  readonly form = this.fb.group({
    bankId: [0, [Validators.required, Validators.min(1)]],
    bankBranchId: [0],
    accountNumber: [
      '',
      [
        Validators.required,
        Validators.maxLength(40),
        Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9 /-]*$/),
      ],
    ],
    iban: ['', [Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9 ]*$/)]],
    accountHolderName: ['', Validators.maxLength(200)],
    isPrimary: [false],
  });

  ngOnInit(): void {
    this.load();
    if (!this.readOnly()) {
      this.svc
        .getBanks()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.success) this.banks.set(res.data);
          },
          error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err)),
        });
    }
    this.form.controls.bankId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((bankId) => this.onBankChosen(bankId));
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getAll(this.employeeId())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.accounts.set(res.data);
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err)),
      });
  }

  /** A new bank means a new branch list; the old branch no longer applies. */
  private onBankChosen(bankId: number): void {
    this.form.controls.bankBranchId.setValue(0, { emitEvent: false });
    this.branches.set([]);
    if (bankId > 0) this.loadBranches(bankId);
  }

  private loadBranches(bankId: number, then?: () => void): void {
    this.svc
      .getBranches(bankId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.success) this.branches.set(res.data);
          then?.();
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err)),
      });
  }

  // ── Add / edit ────────────────────────────────────────────
  openAdd(): void {
    this.isEditMode.set(false);
    this.editing.set(null);
    this.branches.set([]);
    this.form.reset({ isPrimary: this.activeAccounts().length === 0 });
    this.error.set(null);
    this.showModal.set(true);
  }

  openEdit(a: EmployeeBankAccount): void {
    this.isEditMode.set(true);
    this.editing.set(a);
    this.error.set(null);
    this.branches.set([]);
    this.form.reset(
      {
        bankId: a.bankId,
        bankBranchId: 0,
        accountNumber: a.accountNumber,
        iban: a.iban ?? '',
        accountHolderName: a.accountHolderName ?? '',
        isPrimary: a.isPrimary,
      },
      { emitEvent: false },
    );
    this.loadBranches(a.bankId, () =>
      this.form.controls.bankBranchId.setValue(a.bankBranchId ?? 0),
    );
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: EmployeeBankAccountRequest = {
      bankId: v.bankId,
      bankBranchId: v.bankBranchId > 0 ? v.bankBranchId : undefined,
      accountNumber: v.accountNumber.trim(),
      iban: v.iban.trim() || undefined,
      accountHolderName: v.accountHolderName.trim() || undefined,
      isPrimary: v.isPrimary,
      version: this.editing()?.version,
    };
    const current = this.editing();
    const call =
      this.isEditMode() && current
        ? this.svc.update(this.employeeId(), current.id, payload)
        : this.svc.add(this.employeeId(), payload);

    this.saving.set(true);
    this.error.set(null);
    call
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (!res.success) {
            this.error.set(res.message);
            return;
          }
          this.showSuccess(
            this.translate.instant(
              this.isEditMode()
                ? 'employee.bankAccounts.success.updated'
                : 'employee.bankAccounts.success.added',
            ),
          );
          this.closeModal();
          this.load();
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err, true)),
      });
  }

  // ── Set primary / deactivate ──────────────────────────────
  openConfirm(a: EmployeeBankAccount, type: ConfirmType): void {
    this.confirmItem.set(a);
    this.confirmType.set(type);
    this.confirmError.set(null);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirmAction(): void {
    const a = this.confirmItem();
    if (!a) return;
    const primary = this.confirmType() === 'primary';
    const call = primary
      ? this.svc.setPrimary(this.employeeId(), a.id)
      : this.svc.deactivate(this.employeeId(), a.id);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.showSuccess(
          this.translate.instant(
            primary
              ? 'employee.bankAccounts.success.setPrimary'
              : 'employee.bankAccounts.success.deactivated',
          ),
        );
        this.cancelConfirm();
        this.load();
      },
      // Stay in the dialog: the user is looking here, a page banner is easy to miss.
      error: (err: HttpErrorResponse) => this.confirmError.set(this.messageOf(err)),
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  isInvalid(name: FormKey): boolean {
    return isFieldInvalid(this.form.controls[name]);
  }

  getError(name: FormKey): string {
    // The bank select starts at 0 ("Select a bank"); min(1) is how "not chosen" is detected.
    return fieldErrorMessage(this.form.controls[name], this.translate, {
      min: 'common.validation.required',
    });
  }

  /** A business-rule refusal is shown in the user's language by its ruleCode; anything else by HTTP status. */
  private messageOf(err: HttpErrorResponse, saving = false): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `employee.bankAccounts.errors.rules.${rule}`;
      const text = this.translate.instant(key);
      if (text !== key) return text;
    }
    const t = (key: string) => this.translate.instant(key);
    return getHttpErrorMessage(this.translate, err, {
      409: t('employee.bankAccounts.errors.stale'),
      422: t(saving ? 'common.httpErrors.actionFailed' : 'employee.bankAccounts.errors.loadFailed'),
    });
  }
}
