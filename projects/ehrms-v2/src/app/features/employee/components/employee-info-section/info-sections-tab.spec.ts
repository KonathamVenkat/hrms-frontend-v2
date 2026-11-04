import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EmployeeFamily } from '../../pages/employee-family/employee-family';
import { EmployeeQualifications } from '../../pages/employee-qualifications/employee-qualifications';
import { EmployeeExperience } from '../../pages/employee-experience/employee-experience';
import { EmployeeInfoService } from '../../services/employee-info.service';
import { InfoSectionsTab } from './info-sections-tab';

const ok = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });
const record = (isActive: boolean) => ({ id: 1, employeeId: 10, isActive, version: 0 });

/** The three tabs made of info sections share InfoSectionsTab: the inputs and "every section has its records". */
function setup<T extends InfoSectionsTab>(
  component: Type<T>,
  byEndpoint: Record<string, boolean | null>,
  readOnly = false,
): T {
  const svc = {
    // null = no record at all; true / false = one active / one switched-off record
    getAll: vi.fn((_id: number, endpoint: string) =>
      ok(byEndpoint[endpoint] === null || byEndpoint[endpoint] === undefined ? [] : [record(byEndpoint[endpoint] === true)]),
    ),
    getLookup: vi.fn(() => ok([])),
  };
  TestBed.configureTestingModule({
    imports: [component],
    providers: [provideTranslateService(), { provide: EmployeeInfoService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('employeeId', 10);
  fixture.componentRef.setInput('readOnly', readOnly);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('InfoSectionsTab (Family, Qualifications, Experience)', () => {
  it('Family has its records once there is an active dependant', () => {
    expect(setup(EmployeeFamily, { dependants: null }).requirementMet()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(EmployeeFamily, { dependants: false }).requirementMet()).toBe(false); // only a switched-off one
    TestBed.resetTestingModule();
    expect(setup(EmployeeFamily, { dependants: true }).requirementMet()).toBe(true);
  });

  it('Qualifications needs education, training and languages together', () => {
    expect(setup(EmployeeQualifications, { education: true, training: true, languages: null }).requirementMet()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(EmployeeQualifications, { education: true, training: true, languages: true }).requirementMet()).toBe(true);
  });

  it('Experience needs past employers and references together', () => {
    expect(setup(EmployeeExperience, { experience: true, references: null }).requirementMet()).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(EmployeeExperience, { experience: true, references: true }).requirementMet()).toBe(true);
  });

  it('never holds up a viewer who cannot add records', () => {
    expect(setup(EmployeeQualifications, {}, true).requirementMet()).toBe(true);
  });
});
