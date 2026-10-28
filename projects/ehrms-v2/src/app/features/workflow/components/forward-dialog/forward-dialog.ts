import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { AccessibleDialogDirective } from '../../../../core/directives/accessible-dialog.directive';
import { LanguageService } from '../../../../core/services/language.service';
import { DepartmentLookup } from '../../../employee/models/employee';
import { StepOutcome } from '../../models/workflow.model';

/** What the dialog confirms: a step outcome, cancelling the request, or an HR_ADMIN override. */
export type DialogKind = StepOutcome | 'CANCEL' | 'OVERRIDE';

/** `text` is the comment (or the reason for a rejection or override); null when left blank. */
export interface DialogResult {
  outcome: StepOutcome | null;
  targetDepartmentId: number | null;
  text: string | null;
}

const MAX_TEXT = 500;

/** Confirms one workflow action, naming the employee and the request, and collects what it needs. */
@Component({
  selector: 'app-forward-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CdkTrapFocus,
    AccessibleDialogDirective,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './forward-dialog.html',
  styleUrl: './forward-dialog.css',
})
export class ForwardDialog implements OnInit {
  readonly kind = input.required<DialogKind>();
  readonly requesterName = input<string | null>(null);
  readonly summary = input<string | null>(null);
  /** The step asks for a target department (only used when forwarding). */
  readonly pickDepartment = input(false);
  readonly departments = input<DepartmentLookup[]>([]);
  readonly departmentsError = input<string | null>(null);
  /** The outcomes an override may choose from. */
  readonly outcomes = input<StepOutcome[]>([]);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<DialogResult>();
  readonly closed = output<void>();

  private readonly lang = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = new FormGroup({
    outcome: new FormControl<StepOutcome | null>(null),
    targetDepartmentId: new FormControl<number | null>(null),
    text: new FormControl('', { nonNullable: true }),
  });

  private readonly picked = toSignal(this.form.controls.outcome.valueChanges, {
    initialValue: null,
  });

  readonly outcome = computed<StepOutcome | null>(() => {
    const k = this.kind();
    if (k === 'OVERRIDE') return this.picked();
    return k === 'CANCEL' ? null : k;
  });
  readonly needsDepartment = computed(() => this.pickDepartment() && this.outcome() === 'FORWARD');
  readonly textRequired = computed(() => this.kind() === 'REJECT' || this.kind() === 'OVERRIDE');
  readonly danger = computed(() => ['REJECT', 'CANCEL', 'OVERRIDE'].includes(this.kind()));

  readonly isArabic = computed(() => this.lang.currentLang() === 'ar');

  ngOnInit(): void {
    const { outcome, targetDepartmentId, text } = this.form.controls;
    if (this.kind() === 'OVERRIDE') outcome.setValidators(Validators.required);
    targetDepartmentId.setValidators((c) => this.requiredIf(c, this.needsDepartment()));
    text.setValidators([
      (c) => this.requiredIf(c, this.textRequired()),
      Validators.maxLength(MAX_TEXT),
    ]);
    outcome.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => targetDepartmentId.updateValueAndValidity());
    this.form.updateValueAndValidity();
  }

  private requiredIf(control: AbstractControl, required: boolean): ValidationErrors | null {
    const value: unknown = control.value;
    const blank = value === null || (typeof value === 'string' && value.trim() === '');
    return required && blank ? { required: true } : null;
  }

  submit(): void {
    if (this.busy()) return; // a double click must not send the action twice
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.confirmed.emit({
      outcome: this.outcome(),
      targetDepartmentId: this.needsDepartment() ? v.targetDepartmentId : null,
      text: v.text.trim() || null,
    });
  }

  close(): void {
    if (!this.busy()) this.closed.emit();
  }
}
