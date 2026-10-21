import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeInfoSection } from '../../components/employee-info-section/employee-info-section';
import {
  EDUCATION,
  LANGUAGES,
  TRAINING,
} from '../../components/employee-info-section/employee-info.config';

/** The Qualifications tab of the employee detail page: education, training and languages, stacked. */
@Component({
  selector: 'app-employee-qualifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmployeeInfoSection],
  template: `
    <app-employee-info-section
      [config]="education"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
    <app-employee-info-section
      [config]="training"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
    <app-employee-info-section
      [config]="languages"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
  `,
})
export class EmployeeQualifications {
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);
  protected readonly education = EDUCATION;
  protected readonly training = TRAINING;
  protected readonly languages = LANGUAGES;
}
