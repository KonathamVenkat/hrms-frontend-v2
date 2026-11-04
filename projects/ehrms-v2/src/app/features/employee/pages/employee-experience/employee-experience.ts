import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmployeeInfoSection } from '../../components/employee-info-section/employee-info-section';
import { InfoSectionsTab } from '../../components/employee-info-section/info-sections-tab';
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
export class EmployeeExperience extends InfoSectionsTab {
  protected readonly experience = EXPERIENCE;
  protected readonly references = REFERENCES;
}
