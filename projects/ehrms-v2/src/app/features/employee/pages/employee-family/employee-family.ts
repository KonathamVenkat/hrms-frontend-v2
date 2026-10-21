import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeInfoSection } from '../../components/employee-info-section/employee-info-section';
import { DEPENDANTS } from '../../components/employee-info-section/employee-info.config';

/** The Family tab of the employee detail page: the employee's dependants. */
@Component({
  selector: 'app-employee-family',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmployeeInfoSection],
  template: `
    <app-employee-info-section
      [config]="dependants"
      [employeeId]="employeeId()"
      [readOnly]="readOnly()"
    />
  `,
})
export class EmployeeFamily {
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);
  protected readonly dependants = DEPENDANTS;
}
