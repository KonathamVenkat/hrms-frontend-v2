import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { SalaryComponentComponent } from './salary-component/salary-component';
import { SalaryStructureComponent } from './salary-structure/salary-structure';
import { PayrollService } from '../services/payroll.service';
import { SalaryComponentResponse, SalaryStructureResponse } from '../models/payroll.model';

const component: SalaryComponentResponse = {
  componentId: 5,
  componentCode: 'BASIC',
  componentName: 'Basic salary',
  componentNameAr: 'الراتب الأساسي',
  componentType: 'EARNING',
  componentTypeLabel: 'Earning',
  calcType: 'FIXED',
  calcTypeLabel: 'Fixed Amount',
  defaultValue: 0,
  isTaxable: false,
  isNssfApplicable: true,
  description: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
  version: 4,
};

const structure: SalaryStructureResponse = {
  structureId: 9,
  structureCode: 'STD',
  structureName: 'Standard',
  description: null,
  isActive: true,
  items: [
    {
      itemId: 1,
      componentId: 5,
      componentCode: 'BASIC',
      componentName: 'Basic salary',
      componentNameAr: 'الراتب الأساسي',
      componentType: 'EARNING',
      effectiveCalcType: 'FIXED',
      amount: 100,
      percentage: 0,
      sortOrder: 1,
    },
  ],
  employeeCount: 0,
  createdAt: '2026-01-01T00:00:00',
  updatedAt: '2026-01-01T00:00:00',
  version: 4,
};

const refusal = (status: number, ruleCode?: string) =>
  throwError(
    () =>
      new HttpErrorResponse({
        status,
        error: { message: 'server text', errors: ruleCode ? { ruleCode } : {} },
      }),
  );

function setup<T>(token: Type<T>, svc: Record<string, unknown>) {
  const base = { getComponents: vi.fn(() => of([component])), getStructures: vi.fn(() => of([])) };
  TestBed.configureTestingModule({
    imports: [token],
    providers: [
      provideTranslateService(),
      { provide: PayrollService, useValue: { ...base, ...svc } },
    ],
  });
  const fixture = TestBed.createComponent(token);
  // the screens import MatSnackBarModule, so they use their own instance: spy on that one
  const snack = vi.spyOn(fixture.componentRef.injector.get(MatSnackBar), 'open').mockImplementation(() => ({}) as never);
  fixture.detectChanges();
  return { comp: fixture.componentInstance, snack, translate: TestBed.inject(TranslateService) };
}

describe('salary component screen', () => {
  it('sends the version the component was opened with when it is saved', () => {
    const updateComponent = vi.fn(() => of(component));
    const { comp } = setup(SalaryComponentComponent, { updateComponent });

    comp.openEdit(component);
    comp.onSave();

    expect(updateComponent).toHaveBeenCalledWith(5, expect.objectContaining({ version: 4 }));
  });

  it('says in its own words that a component in use cannot be changed', () => {
    const updateComponent = vi.fn(() => refusal(422, 'COMPONENT_IN_USE'));
    const { comp, snack, translate } = setup(SalaryComponentComponent, { updateComponent });
    translate.setTranslation('en', {
      payroll: { salaryComponent: { errors: { rules: { COMPONENT_IN_USE: 'PART OF EMPLOYEE PAY' } } } },
    });
    translate.use('en');

    comp.openEdit(component);
    comp.onSave();

    expect(snack.mock.calls[0][0]).toContain('PART OF EMPLOYEE PAY');
  });

  it('says the same when switching a component in use off is refused', () => {
    const toggleComponent = vi.fn(() => refusal(422, 'COMPONENT_IN_USE'));
    const { comp, snack, translate } = setup(SalaryComponentComponent, { toggleComponent });
    translate.setTranslation('en', {
      payroll: { salaryComponent: { errors: { rules: { COMPONENT_IN_USE: 'PART OF EMPLOYEE PAY' } } } },
    });
    translate.use('en');

    comp.toggleActive(component);

    expect(snack.mock.calls[0][0]).toContain('PART OF EMPLOYEE PAY');
  });
});

describe('salary structure screen', () => {
  it('sends the version the structure was opened with when it is saved', () => {
    const updateStructure = vi.fn(() => of(structure));
    const { comp } = setup(SalaryStructureComponent, { updateStructure });

    comp.openEdit(structure);
    comp.onSave();

    expect(updateStructure).toHaveBeenCalledWith(9, expect.objectContaining({ version: 4 }));
  });

  it('shows its own text for a conflict instead of the English server message', () => {
    const updateStructure = vi.fn(() => refusal(409));
    const { comp, snack, translate } = setup(SalaryStructureComponent, { updateStructure });
    translate.setTranslation('en', {
      payroll: { salaryStructure: { errors: { rules: { conflict: 'CHANGED BY SOMEONE ELSE' } } } },
    });
    translate.use('en');

    comp.openEdit(structure);
    comp.onSave();

    expect(snack.mock.calls[0][0]).toContain('CHANGED BY SOMEONE ELSE');
  });
});
