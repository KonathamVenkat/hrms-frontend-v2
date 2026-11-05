// src/app/features/employee/pages/employee-detail/employee-detail.ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  signal,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, Observable, of, Subject, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EmployeeService } from '../../services/employee';
import { EmployeeCompleteness, EmployeeDetailData } from '../../models/employee';
import { JobDetailsComponent } from '../job-details/job-details';
import { EmployeeAddressesComponent } from '../employee-addresses/employee-addresses';
import { EmployeeIdentityComponent } from '../employee-identity/employee-identity';
import { EmployeeBankAccountsComponent } from '../employee-bank-accounts/employee-bank-accounts';
import { EmployeePhoto } from '../employee-photo/employee-photo';
import { EmployeeDocumentsComponent } from '../employee-documents/employee-documents';
import { EmployeeFamily } from '../employee-family/employee-family';
import { EmployeeQualifications } from '../employee-qualifications/employee-qualifications';
import { EmployeeExperience } from '../employee-experience/employee-experience';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Auth } from '../../../../core/auth/auth';
import { AuthService } from '../../../../core/auth/auth.service';
import { HR_ROLES } from '../../../../core/guards/role.guard';
import { OwnPhoto } from '../../../../core/services/own-photo.service';
import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import {
  NEW_PASSWORD_VALIDATORS,
  PASSWORD_MIN_LENGTH,
} from '../../../../core/validators/password.validators';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { formatDisplayDate } from '../../../../core/utils/display-date';
import { LanguageService } from '../../../../core/services/language.service';
import { HasUnsavedChanges } from '../../../../core/guards/unsaved-changes.guard';
import { UnsavedChangesTracker } from '../../../../core/forms/discard-prompt';

/** What the lock assumes when the completeness check could not be read: nothing is held back. */
const ALL_MET: EmployeeCompleteness = {
  job: true,
  addresses: true,
  identity: true,
  bank: true,
  documents: true,
  family: true,
  qualifications: true,
  experience: true,
};

type DetailTab =
  | 'profile'
  | 'job'
  | 'addresses'
  | 'identity'
  | 'bank'
  | 'documents'
  | 'family'
  | 'qualifications'
  | 'experience';

@Component({
  selector: 'app-employee-detail',
  imports: [
    JobDetailsComponent,
    EmployeeAddressesComponent,
    EmployeeIdentityComponent,
    EmployeeBankAccountsComponent,
    EmployeeDocumentsComponent,
    EmployeeFamily,
    EmployeeQualifications,
    EmployeeExperience,
    EmployeePhoto,
    TranslatePipe,
    ReactiveFormsModule,
    MatSnackBarModule,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './employee-detail.html',
  styleUrl: './employee-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class EmployeeDetail implements OnInit, HasUnsavedChanges {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private empService = inject(EmployeeService);
  private destroyRef = inject(DestroyRef);
  private auth = inject(Auth);
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private language = inject(LanguageService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private unsaved = inject(UnsavedChangesTracker);
  private injector = inject(Injector);
  private ownPhoto = inject(OwnPhoto);

  // ── State ─────────────────────────────────────────────────
  employee = signal<EmployeeDetailData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  activeDetailTab = signal<DetailTab>('profile');

  readonly tabs: readonly { id: DetailTab; icon: string; labelKey: string }[] = [
    { id: 'profile', icon: 'person', labelKey: 'employee.detail.tabs.profile' },
    { id: 'job', icon: 'work', labelKey: 'employee.detail.tabs.job' },
    { id: 'addresses', icon: 'location_on', labelKey: 'employee.detail.tabs.addresses' },
    { id: 'identity', icon: 'badge', labelKey: 'employee.detail.tabs.identity' },
    { id: 'bank', icon: 'account_balance', labelKey: 'employee.detail.tabs.bank' },
    { id: 'documents', icon: 'folder', labelKey: 'employee.detail.tabs.documents' },
    { id: 'family', icon: 'people', labelKey: 'employee.detail.tabs.family' },
    { id: 'qualifications', icon: 'school', labelKey: 'employee.detail.tabs.qualifications' },
    { id: 'experience', icon: 'history', labelKey: 'employee.detail.tabs.experience' },
  ];

  /** True on "My profile": the viewer's own record, without the HR actions on it. */
  selfMode = signal(false);
  /**
   * Job details, bank accounts and documents stay with HR, so an employee sees only the rest: their own addresses,
   * identity, family, qualifications and experience, which they fill in and edit themself (the backend allows it for
   * their own record only).
   */
  private readonly isHr = this.auth.hasAnyRole(...HR_ROLES);
  private readonly selfTabs: readonly DetailTab[] = [
    'profile',
    'addresses',
    'identity',
    'family',
    'qualifications',
    'experience',
  ];
  readonly visibleTabs = computed(() =>
    this.selfMode() && !this.isHr
      ? this.tabs.filter((tab) => this.selfTabs.includes(tab.id))
      : this.tabs,
  );
  /** The tab after the open one among those this viewer sees; null on the last one (the guided flow ends there). */
  readonly nextTab = computed(() => {
    const tabs = this.visibleTabs();
    const index = tabs.findIndex((tab) => tab.id === this.activeDetailTab());
    return index >= 0 && index < tabs.length - 1 ? tabs[index + 1] : null;
  });
  private readonly job = viewChild(JobDetailsComponent);
  private readonly addresses = viewChild(EmployeeAddressesComponent);
  private readonly identity = viewChild(EmployeeIdentityComponent);
  private readonly bank = viewChild(EmployeeBankAccountsComponent);
  private readonly documents = viewChild(EmployeeDocumentsComponent);
  private readonly family = viewChild(EmployeeFamily);
  private readonly qualifications = viewChild(EmployeeQualifications);
  private readonly experience = viewChild(EmployeeExperience);
  /** What the server says each tab holds, read when the page opens and each time another tab opens. */
  private readonly employeeId = computed(() => this.employee()?.employeeId);
  private readonly completeness = signal<EmployeeCompleteness | null>(null);
  private readonly refreshCompleteness = new Subject<number>();

  /** A viewer who cannot add records to a tab is never held up by it. */
  private isExempt(tab: DetailTab): boolean {
    switch (tab) {
      case 'job':
      case 'bank':
      case 'documents':
        return !this.isHrAdmin(); // only an HR_ADMIN can add these, so nobody else is held up by them
      case 'addresses':
      case 'identity':
      case 'family':
      case 'qualifications':
      case 'experience':
        return !this.canEditRecords();
      default:
        return false;
    }
  }

  /** What the open tab itself says (undefined for every tab that is not open, which has no component). */
  private live(tab: DetailTab): boolean | undefined {
    switch (tab) {
      case 'job':
        return this.job()?.requirementMet();
      case 'addresses':
        return this.addresses()?.requirementMet();
      case 'identity':
        return this.identity()?.requirementMet();
      case 'bank':
        return this.bank()?.requirementMet();
      case 'documents':
        return this.documents()?.requirementMet();
      case 'family':
        return this.family()?.requirementMet();
      case 'qualifications':
        return this.qualifications()?.requirementMet();
      case 'experience':
        return this.experience()?.requirementMet();
      default:
        return undefined;
    }
  }

  /** Tabs this page saw with their records: a late or older server answer must not lock them again. */
  private readonly remembered = new Set<DetailTab>();

  /** Remembers that a tab has its records now, so leaving it does not fall back to an older server answer. */
  private markSaved(tab: DetailTab): void {
    if (tab === 'profile') return;
    this.remembered.add(tab);
    this.completeness.update((c) => (c && !c[tab] ? { ...c, [tab]: true } : c));
  }

  /** The open tab lost its last record (removed or deactivated), so it no longer counts as filled. */
  private markUnsaved(tab: DetailTab): void {
    if (tab === 'profile') return;
    this.remembered.delete(tab);
    this.completeness.update((c) => (c && c[tab] ? { ...c, [tab]: false } : c));
  }

  /** The open tab answers live (so Continue opens the moment a record is saved); the others use the server answer. */
  private readonly requirementMet = computed<Record<DetailTab, boolean>>(() => {
    const server = this.completeness();
    const met = (tab: Exclude<DetailTab, 'profile'>): boolean =>
      this.isExempt(tab) || this.live(tab) === true || (server?.[tab] ?? false);
    return {
      profile: true,
      job: met('job'),
      addresses: met('addresses'),
      identity: met('identity'),
      bank: met('bank'),
      documents: met('documents'),
      family: met('family'),
      qualifications: met('qualifications'),
      experience: met('experience'),
    };
  });
  /** The tabs after the first one whose required data is not saved yet: they open one after the other, in order. */
  readonly lockedTabs = computed(() => {
    const met = this.requirementMet();
    const locked = new Set<DetailTab>();
    if (this.completeness() === null) return locked; // not known yet: do not flash every tab as locked
    let blocked = false;
    for (const tab of this.visibleTabs()) {
      if (blocked) locked.add(tab.id);
      else if (!met[tab.id]) blocked = true;
    }
    return locked;
  });
  /** The first tab whose required data is missing: never locked, and where a locked open tab is sent back to. */
  private readonly firstUnmet = computed<DetailTab>(
    () => this.visibleTabs().find((tab) => !this.requirementMet()[tab.id])?.id ?? 'profile',
  );
  /** Continue opens the next tab once the open one has its required data saved. */
  readonly canContinue = computed(() => this.requirementMet()[this.activeDetailTab()]);
  /** An HR_ADMIN edits anyone's records; everyone else edits only their own (on "My profile"). */
  readonly canEditRecords = computed(() => this.isHrAdmin() || this.selfMode());
  readonly identityReadOnly = computed(() => !this.canEditRecords());

  // ── Deactivate / Reactivate (HR_ADMIN only) ────────────────
  isHrAdmin = signal(false);
  showConfirm = signal(false);
  confirmBusy = signal(false);
  confirmError = signal<string | null>(null);
  /** Optional exit status recorded with a deactivation ('' = leave the status as is). */
  exitStatus = signal('');
  readonly exitStatuses = ['TERMINATED', 'RESIGNED', 'RETIRED'];

  // ── Reset password (HR_ADMIN only) ─────────────────────────
  showReset = signal(false);
  resetBusy = signal(false);
  resetError = signal<string | null>(null);
  resetShowPassword = signal(false);
  readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  readonly resetForm = new FormGroup({
    temporaryPassword: new FormControl('', {
      nonNullable: true,
      validators: NEW_PASSWORD_VALIDATORS,
    }),
  });

  constructor() {
    // One call (not one per tab) tells which tabs already have their records; the newest answer wins.
    this.refreshCompleteness
      .pipe(
        switchMap((id) =>
          this.empService.getCompleteness(id).pipe(
            // A failed check must not lock anyone out: the backend enforces what matters.
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        if (res?.success && res.data) {
          const merged = { ...res.data };
          for (const tab of this.remembered) {
            if (tab !== 'profile') merged[tab] = true;
          }
          this.completeness.set(merged);
        } else if (this.completeness() === null) {
          // Never read: do not lock anyone out. A later failure keeps the last good answer.
          this.completeness.set(ALL_MET);
        }
      });
    // The open tab's own answer is remembered when it has its records, and forgotten if it loses its last one.
    let watching: DetailTab | null = null;
    let wasFilled = false;
    effect(() => {
      const tab = this.activeDetailTab();
      const live = this.live(tab);
      untracked(() => {
        if (tab !== watching) {
          watching = tab;
          wasFilled = false;
        }
        if (live === true) {
          wasFilled = true;
          this.markSaved(tab);
        } else if (live === false && wasFilled) {
          wasFilled = false;
          this.markUnsaved(tab);
        }
      });
    });
    // A tab opened before the first answer arrived may turn out to be locked: go back to where the data is missing.
    effect(() => {
      if (this.lockedTabs().has(this.activeDetailTab())) {
        untracked(() => this.activeDetailTab.set(this.firstUnmet()));
      }
    });
    effect(() => {
      const id = this.employeeId();
      this.activeDetailTab(); // read again each time another tab opens, so saved records unlock the next tabs
      if (id) untracked(() => this.refreshCompleteness.next(id));
    });
  }

  ngOnInit(): void {
    this.isHrAdmin.set(this.auth.getRole() === 'HR_ADMIN');

    // "My profile" (/app/profile) shows the signed-in user's own record.
    if (this.route.snapshot.data['self']) {
      this.selfMode.set(true);
      const ownId = this.auth.getEmployeeId();
      if (ownId) {
        this.loadEmployee(ownId);
      } else {
        this.loading.set(false);
        this.error.set(this.translate.instant('employee.detail.errors.noOwnRecord'));
      }
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigateByUrl('/app/employee/list');
      return;
    }
    this.loadEmployee(+id);
  }

  loadEmployee(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.empService
      .getEmployee(id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.employee.set(res.data);
          } else {
            this.error.set(res.message || this.translate.instant('employee.detail.errors.loadFailed'));
          }
        },
        error: (err) => {
          this.error.set(
            getHttpErrorMessage(this.translate, err, {
              404: this.translate.instant('employee.detail.errors.notFound'),
            }),
          );
        },
      });
  }

  /** Re-reads the record without the loading state, so the open tab keeps its place. */
  refreshEmployee(): void {
    const id = this.employee()?.employeeId;
    if (!id) return;
    this.empService
      .getEmployee(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => {
        if (res.success && res.data) this.employee.set(res.data);
      });
  }

  onPhotoChanged(url: string | undefined): void {
    const emp = this.employee();
    this.employee.update((e) => (e ? { ...e, profilePhotoUrl: url } : e));
    // Changing your own photo updates the toolbar too.
    if (emp && emp.employeeId === this.auth.getEmployeeId()) {
      this.ownPhoto.set(url);
    }
  }

  // ── Navigation ────────────────────────────────────────────
  goBack(): void {
    // The employee list is HR-only, so on "My profile" the way out is the dashboard.
    this.router.navigateByUrl(this.selfMode() ? '/app/dashboard' : '/app/employee/list');
  }

  editEmployee(): void {
    this.router.navigate(['/app/employee/edit', this.employee()?.employeeId]);
  }

  // ── Deactivate / Reactivate ─────────────────────────────────
  openConfirm(): void {
    this.confirmError.set(null);
    this.exitStatus.set('');
    this.showConfirm.set(true);
  }

  cancelConfirm(): void {
    this.showConfirm.set(false);
  }

  confirmToggle(): void {
    const emp = this.employee();
    if (!emp) return;

    this.confirmBusy.set(true);
    this.confirmError.set(null);

    const request$: Observable<{ success: boolean; message: string }> = emp.isActive
      ? this.empService.deactivateEmployee(emp.employeeId, this.exitStatus() || undefined)
      : this.empService.reactivateEmployee(emp.employeeId);

    request$
      .pipe(
        finalize(() => this.confirmBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.showConfirm.set(false);
            this.loadEmployee(emp.employeeId);
          } else {
            this.confirmError.set(res.message || this.translate.instant('common.httpErrors.actionFailed'));
          }
        },
        error: (err) => this.confirmError.set(getHttpErrorMessage(this.translate, err)),
      });
  }

  // ── Reset password ──────────────────────────────────────────
  openReset(): void {
    this.resetForm.reset();
    this.resetError.set(null);
    this.resetShowPassword.set(false);
    this.showReset.set(true);
  }

  cancelReset(): void {
    this.showReset.set(false);
  }

  resetPasswordError(): string {
    const c = this.resetForm.controls.temporaryPassword;
    if (!c.touched || !c.errors) return '';
    if (c.hasError('required')) return this.translate.instant('common.validation.required');
    if (c.hasError('minlength'))
      return this.translate.instant('common.validation.minLength', { count: PASSWORD_MIN_LENGTH });
    if (c.hasError('maxlength'))
      return this.translate.instant('common.validation.passwordBytes');
    return this.translate.instant('auth.changePassword.errors.policy');
  }

  confirmReset(): void {
    const emp = this.employee();
    if (!emp) return;
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.resetBusy.set(true);
    this.resetError.set(null);

    this.authService
      .resetPassword(emp.employeeId, this.resetForm.getRawValue().temporaryPassword)
      .pipe(
        finalize(() => this.resetBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.showReset.set(false);
          this.snackBar.open(
            this.translate.instant('employee.detail.resetPassword.success'),
            this.translate.instant('common.close'),
            { duration: 8000 },
          );
        },
        error: (err) => this.resetError.set(getHttpErrorMessage(this.translate, err)),
      });
  }

  // ── Helpers ───────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'status-active',
      PROBATION: 'status-probation',
      NOTICE_PERIOD: 'status-notice',
      TERMINATED: 'status-terminated',
      RESIGNED: 'status-terminated',
      RETIRED: 'status-inactive',
      ON_HOLD: 'status-inactive',
    };
    return map[status] ?? 'status-inactive';
  }

  /** A form open on one of the tabs holds edits that were not saved (the route guard asks before leaving). */
  hasUnsavedChanges(): boolean {
    return this.unsaved.hasUnsavedChanges();
  }

  /** Closing the browser tab or reloading: the browser shows its own warning. */
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  /**
   * The Continue button: opens the next tab, brings the tab bar into view and focuses the new tab so a screen
   * reader announces where the user is. Nothing is saved or discarded differently from clicking the tab.
   */
  goToNextTab(): void {
    const next = this.nextTab();
    if (!next) return;
    if (!this.canContinue()) {
      this.tell('employee.detail.continueBlocked');
      return;
    }
    this.markSaved(this.activeDetailTab()); // Continue was allowed, so the tab being left is done
    this.activeDetailTab.set(next.id);
    afterNextRender(
      () => {
        const tab = this.host.nativeElement.querySelector<HTMLElement>('#detail-tab-' + next.id);
        tab?.scrollIntoView({ block: 'start' });
        tab?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /** A tab click: a locked tab stays closed (it stays focusable so its reason can be read). */
  openTab(id: DetailTab): void {
    if (this.lockedTabs().has(id)) {
      this.tell('employee.detail.tabLocked');
    } else {
      this.activeDetailTab.set(id);
    }
  }

  /** Says why something is not available; the snackbar is announced to screen readers and shown on touch screens. */
  private tell(messageKey: string): void {
    this.snackBar.open(this.translate.instant(messageKey), this.translate.instant('common.close'), {
      duration: 5000,
    });
  }

  /** Arrow keys, Home and End move between tabs (the arrows follow the reading direction). */
  onTabKeydown(event: KeyboardEvent): void {
    const rtl = this.language.direction() === 'rtl';
    const step: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
    };
    const tabs = this.visibleTabs();
    // Move from the tab that has the focus (a locked tab can hold it without being the open one).
    const focusedId = (event.target as HTMLElement | null)?.closest('[role="tab"]')?.id.replace('detail-tab-', '');
    const focused = tabs.findIndex((tab) => tab.id === focusedId);
    const current = focused >= 0 ? focused : tabs.findIndex((tab) => tab.id === this.activeDetailTab());
    let next: number;
    if (event.key in step) {
      next = (current + step[event.key] + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const tab = tabs[next];
    if (!this.lockedTabs().has(tab.id)) this.activeDetailTab.set(tab.id); // a locked tab only takes focus
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>('#detail-tab-' + tab.id)?.focus();
  }

  formatDate(dateStr?: string): string {
    return formatDisplayDate(dateStr, this.language.currentLang());
  }

  getValue(val?: string | null): string {
    return val && val.trim() ? val.trim() : '—';
  }
}
