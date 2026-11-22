import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';

import { EmployeeSalary } from './employee-salary';
import { PayrollService } from '../../services/payroll.service';
import { PayScaleBasis } from '../../models/payroll.model';

const graded: PayScaleBasis = {
  graded: true,
  onDate: '2026-11-01',
  gradeId: 5,
  gradeName: 'Grade 5',
  incrementNo: 1,
  structureId: 3,
  structureName: 'Grade 5',
  basicSalary: 460462,
};

function setup() {
  const svc = {
    getAllCurrentSalaries: vi.fn(() => of({ content: [], totalElements: 0 })),
    getStructures: vi.fn(() => of([])),
    getPayScaleBasis: vi.fn(() => of(graded)),
    assignSalary: vi.fn(() => new Subject()),
    getSalaryHistory: vi.fn(() => of([])),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      provideNoopAnimations(),
      { provide: PayrollService, useValue: svc },
    ],
  });
  const fixture = TestBed.createComponent(EmployeeSalary);
  fixture.detectChanges(); // renders the template once and runs ngOnInit (exactly once)
  return { comp: fixture.componentInstance, svc };
}

/** Picks employee 7 and 1 Nov 2026, then lets the 300 ms debounce pass. */
function choose(comp: EmployeeSalary) {
  comp.openAssign();
  comp.form.patchValue({ employeeId: 7, effectiveFrom: new Date(2026, 10, 1) });
  vi.advanceTimersByTime(300);
}

describe('EmployeeSalary pay scale', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks for the basis of the chosen employee on the chosen local date, once the typing settles', () => {
    const { comp, svc } = setup();
    comp.openAssign();
    comp.form.patchValue({ employeeId: 7 });
    comp.form.patchValue({ effectiveFrom: new Date(2026, 10, 1) });
    vi.advanceTimersByTime(299);
    expect(svc.getPayScaleBasis).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(svc.getPayScaleBasis).toHaveBeenCalledTimes(1);
    expect(svc.getPayScaleBasis).toHaveBeenCalledWith(7, '2026-11-01');
  });

  it('fills in and locks the structure and basic of a graded employee, and leaves the basic to the server', () => {
    const { comp, svc } = setup();
    choose(comp);

    expect(comp.fromScale()).toBe(true);
    expect(comp.form.controls.structureId.value).toBe(3);
    expect(comp.form.controls.basicSalary.value).toBe(460462);
    expect(comp.form.controls.structureId.disabled).toBe(true);
    expect(comp.form.controls.basicSalary.disabled).toBe(true);

    comp.onSave();
    expect(svc.assignSalary).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 7,
        structureId: 3,
        basicSalary: undefined,
        effectiveFrom: '2026-11-01',
      }),
    );
  });

  it('a second click while saving sends nothing more', () => {
    const { comp, svc } = setup();
    choose(comp);
    comp.onSave();
    comp.onSave();
    expect(svc.assignSalary).toHaveBeenCalledTimes(1);
  });

  it('an employee without a grade gets the fields back to type in, and the typed basic is sent', () => {
    const { comp, svc } = setup();
    svc.getPayScaleBasis.mockReturnValue(of({ graded: false, onDate: '2026-11-01' }));
    choose(comp);

    expect(comp.fromScale()).toBe(false);
    expect(comp.form.controls.basicSalary.enabled).toBe(true);
    comp.form.patchValue({ structureId: 9, basicSalary: 1408564 });
    comp.onSave();
    expect(svc.assignSalary).toHaveBeenCalledWith(
      expect.objectContaining({ structureId: 9, basicSalary: 1408564 }),
    );
  });

  it('a grade with no linked structure or no scale on the date blocks saving and says why', () => {
    const { comp, svc } = setup();
    svc.getPayScaleBasis.mockReturnValue(of({ ...graded, structureId: undefined }));
    choose(comp);
    expect(comp.scaleProblem()).toBe('payroll.employeeSalary.errors.rules.GRADE_STRUCTURE_MISSING');
    comp.onSave();
    expect(svc.assignSalary).not.toHaveBeenCalled();

    svc.getPayScaleBasis.mockReturnValue(of({ ...graded, basicSalary: undefined }));
    comp.form.patchValue({ effectiveFrom: new Date(2026, 1, 1) });
    vi.advanceTimersByTime(300);
    expect(comp.scaleProblem()).toBe('payroll.employeeSalary.errors.rules.PAY_SCALE_MISSING');
  });

  it('only the answer for the latest employee is applied', () => {
    const { comp, svc } = setup();
    const slow = new Subject<PayScaleBasis>();
    svc.getPayScaleBasis
      .mockReturnValueOnce(slow)
      .mockReturnValue(of({ graded: false, onDate: '2026-11-01' }));
    choose(comp);
    comp.form.patchValue({ employeeId: 8 });
    vi.advanceTimersByTime(300);
    slow.next(graded);

    expect(comp.fromScale()).toBe(false);
    expect(comp.form.controls.basicSalary.enabled).toBe(true);
  });
});
