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
  const snack = vi
    .spyOn(fixture.componentRef.injector.get(MatSnackBar), 'open')
    .mockImplementation(() => ({}) as never);
  fixture.detectChanges();
  return {
    comp: fixture.componentInstance,
    snack,
    translate: TestBed.inject(TranslateService),
    fixture,
  };
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
      payroll: {
        salaryComponent: { errors: { rules: { COMPONENT_IN_USE: 'PART OF EMPLOYEE PAY' } } },
      },
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
      payroll: {
        salaryComponent: { errors: { rules: { COMPONENT_IN_USE: 'PART OF EMPLOYEE PAY' } } },
      },
    });
    translate.use('en');

    comp.toggleActive(component);
    comp.confirmToggle();

    expect(snack.mock.calls[0][0]).toContain('PART OF EMPLOYEE PAY');
  });
});

describe('switching a salary component or structure on or off', () => {
  it('asks first for a component and only acts when confirmed, once', () => {
    const toggleComponent = vi.fn(() => of(undefined));
    const { comp } = setup(SalaryComponentComponent, { toggleComponent });

    comp.toggleActive(component);
    expect(toggleComponent).not.toHaveBeenCalled();
    expect(comp.toggleTarget()).toBe(component);

    comp.confirmToggle();
    comp.confirmToggle();
    expect(toggleComponent).toHaveBeenCalledTimes(1);
    expect(toggleComponent).toHaveBeenCalledWith(5, false);
    expect(comp.toggleTarget()).toBeNull();
  });

  it('does nothing when the component question is cancelled', () => {
    const toggleComponent = vi.fn(() => of(undefined));
    const { comp } = setup(SalaryComponentComponent, { toggleComponent });

    comp.toggleActive(component);
    comp.cancelToggle();
    comp.confirmToggle();

    expect(toggleComponent).not.toHaveBeenCalled();
  });

  it('asks first for a structure and only acts when confirmed, once', () => {
    const toggleStructure = vi.fn(() => of(undefined));
    const { comp } = setup(SalaryStructureComponent, { toggleStructure });

    comp.toggleActive(structure);
    expect(toggleStructure).not.toHaveBeenCalled();

    comp.confirmToggle();
    comp.confirmToggle();
    expect(toggleStructure).toHaveBeenCalledTimes(1);
    expect(toggleStructure).toHaveBeenCalledWith(9, false);
  });

  it('shows the question on the component page, saying which component and what changes', () => {
    const toggleComponent = vi.fn(() => of(undefined));
    const { comp, translate, fixture } = setup(SalaryComponentComponent, { toggleComponent });
    translate.setTranslation('en', {
      common: { cancel: 'Cancel' },
      payroll: {
        salaryComponent: {
          deactivate: 'Deactivate',
          toggleConfirm: {
            deactivateTitle: 'Deactivate this component?',
            deactivateMessage: '{{name}} ({{code}}) can no longer be added to structures.',
          },
        },
      },
    });
    translate.use('en');

    comp.toggleActive(component);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('app-confirm-action');

    expect(dialog?.textContent).toContain('Deactivate this component?');
    expect(dialog?.textContent).toContain(
      'Basic salary (BASIC) can no longer be added to structures.',
    );
    (dialog?.querySelector('button.btn-confirm') as HTMLButtonElement).click();
    expect(toggleComponent).toHaveBeenCalledTimes(1);
  });

  it('shows the question on the structure page, saying which structure and what changes', () => {
    const toggleStructure = vi.fn(() => of(undefined));
    const { comp, translate, fixture } = setup(SalaryStructureComponent, { toggleStructure });
    translate.setTranslation('en', {
      common: { cancel: 'Cancel' },
      payroll: {
        salaryStructure: {
          deactivate: 'Deactivate',
          toggleConfirm: {
            deactivateTitle: 'Deactivate this salary structure?',
            deactivateMessage: '{{name}} ({{code}}) will no longer be offered.',
          },
        },
      },
    });
    translate.use('en');

    comp.toggleActive(structure);
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('app-confirm-action');

    expect(dialog?.textContent).toContain('Deactivate this salary structure?');
    expect(dialog?.textContent).toContain('Standard (STD) will no longer be offered.');
    (dialog?.querySelector('button.btn-confirm') as HTMLButtonElement).click();
    expect(toggleStructure).toHaveBeenCalledTimes(1);
  });

  it('refuses to switch off a structure that employees use, without asking', () => {
    const toggleStructure = vi.fn(() => of(undefined));
    const { comp, snack } = setup(SalaryStructureComponent, { toggleStructure });

    comp.toggleActive({ ...structure, employeeCount: 3 });

    expect(snack).toHaveBeenCalled();
    expect(comp.toggleTarget()).toBeNull();
    expect(toggleStructure).not.toHaveBeenCalled();
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
