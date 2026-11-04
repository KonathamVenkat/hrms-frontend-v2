import { computed, Directive, input, viewChildren } from '@angular/core';
import { EmployeeInfoSection } from './employee-info-section';

/**
 * What the Family, Qualifications and Experience tabs share: the employee, the read-only flag and whether every
 * section on the tab already has its required records (the page's Continue button and tab lock read this).
 */
@Directive()
export abstract class InfoSectionsTab {
  readonly employeeId = input.required<number>();
  readonly readOnly = input(false);
  private readonly sections = viewChildren(EmployeeInfoSection);
  readonly requirementMet = computed(
    () => this.sections().length > 0 && this.sections().every((s) => s.requirementMet()),
  );
}
