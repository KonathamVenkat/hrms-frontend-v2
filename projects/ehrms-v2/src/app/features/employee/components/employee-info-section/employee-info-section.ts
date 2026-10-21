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
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, map, merge } from 'rxjs';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { FieldA11yDirective } from '../../../../core/directives/field-a11y.directive';
import { fieldErrorMessage, isFieldInvalid } from '../../../../core/forms/field-errors';
import { LanguageService } from '../../../../core/services/language.service';
import { formatDisplayDate } from '../../../../core/utils/display-date';
import { getHttpErrorMessage } from '../../../../core/utils/http-error-message';
import { timedMessage } from '../../../../core/utils/timed-message';
import { DateInput } from '../../../../shared/date-input/date-input';
import { InfoLookup, InfoPayload, InfoRecord, LookupKind } from '../../models/employee-info.model';
import { EmployeeInfoService } from '../../services/employee-info.service';
import { CardContext, CardView, FieldConfig, SectionConfig } from './employee-info.config';

type FieldValue = string | number | boolean | null;
type ConfirmAction = 'deactivate' | 'activate';

interface Row<R> {
  record: R;
  view: CardView;
}

interface SelectOption {
  id: number;
  label: string;
}

const PHONE_PATTERN = /^[0-9+() -]*$/;
const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;

/** Today as yyyy-MM-dd in the browser's own (local) time zone, never via UTC. */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const notInFuture: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const v: unknown = control.value;
  return typeof v === 'string' && v > todayIso() ? { future: true } : null;
};

function dateRangeValidator(from: string, to: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const a: unknown = group.get(from)?.value;
    const b: unknown = group.get(to)?.value;
    return typeof a === 'string' && typeof b === 'string' && a && b && b < a
      ? { dateRange: true }
      : null;
  };
}

function validatorsFor(f: FieldConfig): ValidatorFn[] {
  const list: ValidatorFn[] = [];
  if (f.required) list.push(Validators.required);
  if (f.max) list.push(Validators.maxLength(f.max));
  if (f.type === 'email') list.push(Validators.email);
  if (f.type === 'phone') list.push(Validators.pattern(PHONE_PATTERN));
  if (f.noFuture) list.push(notInFuture);
  return list;
}

/** What a field holds before anything is typed: a switch starts on, dropdowns empty, text empty. */
function initialValue(f: FieldConfig): FieldValue {
  if (f.type === 'checkbox') return true;
  return f.type === 'select' || f.type === 'gender' ? null : '';
}

function buildForm(
  cfg: SectionConfig<InfoRecord>,
): FormGroup<Record<string, FormControl<FieldValue>>> {
  const controls: Record<string, FormControl<FieldValue>> = {};
  for (const f of cfg.fields) {
    controls[f.name] = new FormControl<FieldValue>(initialValue(f), {
      nonNullable: true,
      validators: validatorsFor(f),
    });
  }
  return new FormGroup(controls, {
    validators: cfg.dateRange ? [dateRangeValidator(cfg.dateRange.from, cfg.dateRange.to)] : [],
  });
}

/**
 * One list of records of one employee (dependants, education, training, languages, experience or references) with
 * its add and edit dialog. Which section it is comes from `config`; the fields, the validation and the look of a
 * card all come from there. HR_ADMIN adds, edits, deactivates and activates; everyone else gets `readOnly`.
 */
@Component({
  selector: 'app-employee-info-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FieldA11yDirective,
    DateInput,
    TranslatePipe,
    CdkTrapFocus,
    AccessibleDialogDirective,
  ],
  templateUrl: './employee-info-section.html',
  styleUrl: './employee-info-section.css',
})
export class EmployeeInfoSection<R extends InfoRecord> implements OnInit {
  readonly config = input.required<SectionConfig<R>>();
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);

  private svc = inject(EmployeeInfoService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private lang = inject(LanguageService);

  readonly genders = GENDERS;

  records = signal<R[]>([]);
  private lookups = signal<Partial<Record<LookupKind, InfoLookup[]>>>({});
  loading = signal(false);
  loadFailed = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  private readonly showSuccess = timedMessage(this.successMsg, this.destroyRef);
  showModal = signal(false);
  isEditMode = signal(false);
  private editing = signal<R | null>(null);
  confirmItem = signal<Row<R> | null>(null);
  confirmAction = signal<ConfirmAction>('deactivate');
  confirmError = signal<string | null>(null);

  /** Translation prefix of this section's own texts. */
  readonly prefix = computed(() => `employee.info.${this.config().key}`);

  /** Built once from the section's fields; the dialog resets it for each add or edit. */
  readonly form = computed(() => buildForm(this.config() as unknown as SectionConfig<InfoRecord>));

  /**
   * Bumps when a language's texts have actually loaded or changed. The language signal flips the moment the user
   * picks a language, before its texts arrive, so a card built then would keep the previous language's words.
   */
  private readonly textsReady = toSignal(
    merge(this.translate.onLangChange, this.translate.onTranslationChange).pipe(map(() => Date.now())),
    { initialValue: 0 },
  );

  private readonly ctx = computed<CardContext>(() => {
    const lang = this.lang.currentLang();
    this.textsReady();
    return {
      date: (value) => formatDisplayDate(value, lang),
      name: (en, ar) => (lang === 'ar' && ar ? ar : (en ?? ar ?? '')),
      t: (key, params) => this.translate.instant(key, params),
    };
  });

  private readonly rows = computed<Row<R>[]>(() => {
    const cfg = this.config();
    const ctx = this.ctx();
    return this.records().map((record) => ({ record, view: cfg.card(record, ctx) }));
  });
  readonly activeRows = computed(() => this.rows().filter((r) => r.record.isActive));
  readonly inactiveRows = computed(() => this.rows().filter((r) => !r.record.isActive));

  /** Dropdown choices by field name: the active values, plus the one a record already holds if it was switched off since. */
  readonly selectOptions = computed<Record<string, SelectOption[]>>(() => {
    const lang = this.lang.currentLang();
    const current = this.editing();
    const out: Record<string, SelectOption[]> = {};
    for (const f of this.config().fields) {
      if (f.type !== 'select' || !f.lookup) continue;
      const list = (this.lookups()[f.lookup] ?? []).map((m) => ({
        id: m.id,
        label: lang === 'ar' && m.nameAr ? m.nameAr : m.name,
      }));
      const held = current ? current[f.name] : undefined;
      if (typeof held === 'number' && !list.some((o) => o.id === held)) {
        const base = f.name.replace(/Id$/, '');
        const en = current?.[`${base}Name`];
        const ar = current?.[`${base}NameAr`];
        const name = lang === 'ar' && typeof ar === 'string' ? ar : en;
        list.push({ id: held, label: typeof name === 'string' ? name : String(held) });
      }
      out[f.name] = list;
    }
    return out;
  });

  ngOnInit(): void {
    this.load();
    if (this.readOnly()) return;
    const kinds = new Set(this.config().fields.flatMap((f) => (f.lookup ? [f.lookup] : [])));
    for (const kind of kinds) {
      this.svc
        .getLookup(kind)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            if (res.success) this.lookups.update((all) => ({ ...all, [kind]: res.data }));
          },
          error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err)),
        });
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.svc
      .getAll<R>(this.employeeId(), this.config().endpoint)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.records.set(res.data);
        },
        error: () => this.loadFailed.set(true),
      });
  }

  // ── Add / edit ────────────────────────────────────────────
  openAdd(): void {
    this.isEditMode.set(false);
    this.editing.set(null);
    this.form().reset();
    this.error.set(null);
    this.showModal.set(true);
  }

  openEdit(record: R): void {
    this.isEditMode.set(true);
    this.editing.set(record);
    const values: Record<string, FieldValue> = {};
    for (const f of this.config().fields) {
      const held = record[f.name];
      values[f.name] = held === undefined ? initialValue(f) : held;
    }
    this.form().reset(values);
    this.error.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set(null);
  }

  onSubmit(): void {
    if (this.saving()) return;
    const form = this.form();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    const raw = form.getRawValue();
    const payload: InfoPayload = {};
    for (const f of this.config().fields) {
      const v = raw[f.name];
      payload[f.name] = typeof v === 'string' ? v.trim() || null : v;
    }
    const current = this.editing();
    const endpoint = this.config().endpoint;
    const call =
      this.isEditMode() && current
        ? this.svc.update<R>(this.employeeId(), endpoint, current.id, {
            ...payload,
            version: current.version,
          })
        : this.svc.add<R>(this.employeeId(), endpoint, payload);

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
              this.isEditMode() ? 'employee.info.success.updated' : 'employee.info.success.added',
            ),
          );
          this.closeModal();
          this.load();
        },
        error: (err: HttpErrorResponse) => this.error.set(this.messageOf(err, true)),
      });
  }

  // ── Deactivate / activate ─────────────────────────────────
  openConfirm(row: Row<R>, action: ConfirmAction): void {
    this.confirmItem.set(row);
    this.confirmAction.set(action);
    this.confirmError.set(null);
  }

  cancelConfirm(): void {
    this.confirmItem.set(null);
    this.confirmError.set(null);
  }

  confirm(): void {
    const row = this.confirmItem();
    if (!row) return;
    const deactivate = this.confirmAction() === 'deactivate';
    const endpoint = this.config().endpoint;
    const call = deactivate
      ? this.svc.deactivate(this.employeeId(), endpoint, row.record.id)
      : this.svc.activate(this.employeeId(), endpoint, row.record.id);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.showSuccess(
          this.translate.instant(
            deactivate ? 'employee.info.success.deactivated' : 'employee.info.success.activated',
          ),
        );
        this.cancelConfirm();
        this.load();
      },
      // Stay in the dialog: the user is looking here, a page banner is easy to miss.
      error: (err: HttpErrorResponse) => this.confirmError.set(this.messageOf(err, true)),
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  isInvalid(name: string): boolean {
    return isFieldInvalid(this.form().controls[name] ?? null);
  }

  getError(name: string): string {
    const control = this.form().controls[name] ?? null;
    // The shared "invalid format" text names letters and underscores, which is the wrong rule for a phone number.
    const phone = this.config().fields.some((f) => f.name === name && f.type === 'phone');
    if (phone && control?.touched && control.hasError('pattern')) {
      return this.translate.instant('employee.info.errors.phone');
    }
    return fieldErrorMessage(control, this.translate, { future: 'employee.info.errors.future' });
  }

  /** True once the end date is before the start date and the user has touched either field. */
  dateRangeInvalid(): boolean {
    const range = this.config().dateRange;
    const form = this.form();
    return (
      !!range &&
      form.hasError('dateRange') &&
      (!!form.controls[range.from]?.touched || !!form.controls[range.to]?.touched)
    );
  }

  /** A business-rule refusal is shown in the user's language by its ruleCode; anything else by HTTP status. */
  private messageOf(err: HttpErrorResponse, saving = false): string {
    const rule: unknown = err.error?.errors?.ruleCode;
    if (typeof rule === 'string') {
      const key = `employee.info.errors.rules.${rule}`;
      const text = this.translate.instant(key);
      if (text !== key) return text;
    }
    const t = (key: string) => this.translate.instant(key);
    return getHttpErrorMessage(this.translate, err, {
      409: t('employee.info.errors.stale'),
      422: t(saving ? 'common.httpErrors.actionFailed' : 'employee.info.errors.loadFailed'),
    });
  }
}
