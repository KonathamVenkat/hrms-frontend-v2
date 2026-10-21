import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeInfoSection } from '../../components/employee-info-section/employee-info-section';
import {
  EXPERIENCE,
  REFERENCES,
} from '../../components/employee-info-section/employee-info.config';

/** The Experience tab of the employee detail page: past employers, then references. */
@Component({
  selector: 'app-employee-experience',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmployeeInfoSection],
  template: `
    <app-employee-info-section
      [config]="experience"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
    <app-employee-info-section
      [config]="references"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
  `,
})
export class EmployeeExperience {
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);
  protected readonly experience = EXPERIENCE;
  protected readonly references = REFERENCES;
}
