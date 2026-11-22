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
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { map } from 'rxjs';
import { JobDetailsService } from '../../services/job-details.service';

/** The grade and increment the job record already has, shown even when the pay scale is not loaded or lacks it. */
export interface GradePlace {
  gradeId: number;
  gradeName: string;
  incrementNo: number;
}

interface GradeOption {
  gradeId: number;
  gradeName: string;
}

interface IncrementOption {
  incrementNo: number;
  /** Null when only the saved value is known (scale not loaded or the step is no longer on it). */
  startingScale: number | null;
}

/**
 * Grade and increment pickers for the job-details form. The increments follow the chosen grade and show their
 * starting scale. Locked (a set grade only changes with a new assignment) it shows the saved values and loads nothing.
 */
@Component({
  selector: 'app-grade-increment-fields',
  imports: [ReactiveFormsModule, TranslatePipe, DecimalPipe],
  template: `
    <div class="field-row">
      <div class="field">
        <label for="jd-grade-id">{{ 'employee.jobDetails.fields.grade' | translate }}</label>
        <select
          id="jd-grade-id"
          [formControl]="gradeControl()"
          [attr.aria-required]="gradeRequired() ? 'true' : null"
          [attr.aria-invalid]="gradeError() ? 'true' : null"
          [attr.aria-describedby]="gradeDescribedBy()"
        >
          <option [ngValue]="null">
            {{ 'employee.jobDetails.formFields.selectGrade' | translate }}
          </option>
          @for (g of grades(); track g.gradeId) {
            <option [ngValue]="g.gradeId">{{ g.gradeName }}</option>
          }
        </select>
        @if (gradeError()) {
          <span class="field-error" id="fe-gradeId">{{ gradeError() }}</span>
        }
      </div>
      <div class="field">
        <label for="jd-increment-no">{{
          'employee.jobDetails.fields.increment' | translate
        }}</label>
        <select
          id="jd-increment-no"
          [formControl]="incrementControl()"
          [attr.aria-required]="selectedGrade() !== null ? 'true' : null"
          [attr.aria-invalid]="incrementError() ? 'true' : null"
          [attr.aria-describedby]="incrementError() ? 'fe-incrementNo' : null"
        >
          <option [ngValue]="null">
            {{
              (selectedGrade() === null
                ? 'employee.jobDetails.formFields.selectGradeFirst'
                : 'employee.jobDetails.formFields.selectIncrement'
              ) | translate
            }}
          </option>
          @for (i of increments(); track i.incrementNo) {
            <option [ngValue]="i.incrementNo">
              @if (i.startingScale !== null) {
                {{
                  'employee.jobDetails.formFields.incrementOption'
                    | translate: { no: i.incrementNo, amount: (i.startingScale | number: '1.0-3') }
                }}
              } @else {
                {{
                  'employee.jobDetails.formFields.incrementOnly' | translate: { no: i.incrementNo }
                }}
              }
            </option>
          }
        </select>
        @if (incrementError()) {
          <span class="field-error" id="fe-incrementNo">{{ incrementError() }}</span>
        }
      </div>
    </div>
    <!-- Below both pickers, full width, so it fits on one line. -->
    @if (locked()) {
      <p class="grade-hint" id="jd-grade-hint">
        {{ 'employee.jobDetails.formFields.gradeLockedHint' | translate }}
      </p>
    } @else if (scale.error()) {
      <p class="grade-hint" id="jd-grade-hint">
        {{ 'employee.jobDetails.formFields.gradeScaleFailed' | translate }}
      </p>
    }
  `,
  styles: `
    .grade-hint {
      margin: 6px 0 0;
      font-size: 17px;
      color: var(--status-rejected-fg);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GradeIncrementFields implements OnInit {
  readonly gradeControl = input.required<FormControl<number | null>>();
  readonly incrementControl = input.required<FormControl<number | null>>();
  /** True while editing a record whose grade is set: the pickers are disabled and the scale is not fetched. */
  readonly locked = input(false);
  readonly current = input<GradePlace | null>(null);
  readonly gradeRequired = input(false);
  /** Translated messages, empty when the field has no error to show. */
  readonly gradeError = input('');
  readonly incrementError = input('');

  private readonly svc = inject(JobDetailsService);
  private readonly destroyRef = inject(DestroyRef);

  /** The pay scale (HR_ADMIN only); not requested while locked. */
  readonly scale = rxResource({
    params: () => (this.locked() ? undefined : true),
    stream: () => this.svc.getGradeScale().pipe(map((res) => res.data)),
  });

  readonly selectedGrade = signal<number | null>(null);

  readonly grades = computed<GradeOption[]>(() => {
    const options: GradeOption[] = [];
    for (const step of this.steps()) {
      if (!options.some((g) => g.gradeId === step.gradeId)) {
        options.push({ gradeId: step.gradeId, gradeName: step.gradeName });
      }
    }
    const saved = this.current();
    if (saved && !options.some((g) => g.gradeId === saved.gradeId)) {
      options.push({ gradeId: saved.gradeId, gradeName: saved.gradeName });
    }
    return options;
  });

  readonly increments = computed<IncrementOption[]>(() => {
    const gradeId = this.selectedGrade();
    const options: IncrementOption[] = this.steps()
      .filter((s) => s.gradeId === gradeId)
      .map((s) => ({ incrementNo: s.incrementNo, startingScale: s.startingScale }));
    const saved = this.current();
    if (
      saved &&
      saved.gradeId === gradeId &&
      !options.some((i) => i.incrementNo === saved.incrementNo)
    ) {
      options.push({ incrementNo: saved.incrementNo, startingScale: null });
    }
    return options;
  });

  readonly gradeDescribedBy = computed(() => {
    const ids = [
      this.gradeError() ? 'fe-gradeId' : null,
      this.locked() || this.scale.error() ? 'jd-grade-hint' : null,
    ];
    return ids.filter((id) => id !== null).join(' ') || null;
  });

  private readonly steps = computed(() => (this.scale.hasValue() ? this.scale.value() : []));

  ngOnInit(): void {
    this.selectedGrade.set(this.gradeControl().value);
    // Another grade has other increments: the old choice no longer applies.
    this.gradeControl()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((gradeId) => {
        this.selectedGrade.set(gradeId);
        this.incrementControl().setValue(null);
      });
  }
}
