import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';

import { EmployeeLoans } from './employee-loans';
import { LoanForm } from './loan-form';
import { LoanEnd } from './loan-end';
import { PayrollService } from '../../services/payroll.service';
import { EmployeeService } from '../../../employee/services/employee';
import { EmployeeLoan } from '../../models/payroll.model';

const loan: EmployeeLoan = {
  loanId: 700,
  employeeId: 5,
  employeeCode: 'EMP-5',
  employeeName: 'Nyibol Akec',
  componentId: 21,
  componentCode: 'ADV_EMERGENCY',
  loanTypeName: 'Emergency Advance',
  loanTypeNameAr: 'x',
  principal: 12122140,
  instalmentCount: 36,
  monthlyInstalment: 336726.11,
  finalInstalment: 336726.15,
  instalmentsPaid: 0,
  remainingBalance: 12122140,
  startMonth: '2026-12-01',
  lastMonth: '2029-11-01',
  status: 'ACTIVE',
  version: 2,
};

function setup() {
  const svc = {
    getLoanTypes: vi.fn(() =>
      of([{ id: 21, code: 'ADV_EMERGENCY', name: 'Emergency Advance', nameAr: 'x' }]),
    ),
    searchLoans: vi.fn(() =>
      of({ content: [loan], totalElements: 1, totalPages: 1, number: 0, size: 20 }),
    ),
    createLoan: vi.fn((): Observable<EmployeeLoan> => new Subject<EmployeeLoan>()),
    endLoan: vi.fn((): Observable<EmployeeLoan> => new Subject<EmployeeLoan>()),
  };
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService(),
      provideNoopAnimations(),
      { provide: PayrollService, useValue: svc },
      { provide: EmployeeService, useValue: { getEmployees: vi.fn(() => of({ content: [] })) } },
    ],
  });
  return svc;
}

describe('EmployeeLoans register', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens on running loans, and a filter change goes back to the first page', () => {
    const svc = setup();
    const fixture = TestBed.createComponent(EmployeeLoans);
    fixture.detectChanges();
    expect(svc.searchLoans).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'ACTIVE', page: 0 }),
    );
    expect(fixture.componentInstance.rows()).toEqual([loan]);

    const comp = fixture.componentInstance;
    comp.onPage({ pageIndex: 2, pageSize: 20, length: 100 });
    expect(svc.searchLoans).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    comp.type.setValue(21);
    expect(svc.searchLoans).toHaveBeenLastCalledWith(
      expect.objectContaining({ componentId: 21, page: 0 }),
    );
  });

  it('searches once the typing settles (300 ms)', () => {
    const svc = setup();
    const fixture = TestBed.createComponent(EmployeeLoans);
    fixture.detectChanges();
    const calls = svc.searchLoans.mock.calls.length;
    fixture.componentInstance.search.setValue('nyi');
    vi.advanceTimersByTime(299);
    expect(svc.searchLoans.mock.calls.length).toBe(calls);
    vi.advanceTimersByTime(1);
    expect(svc.searchLoans).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'nyi' }));
  });

  it('says so when the list cannot be loaded', () => {
    const svc = setup();
    svc.searchLoans.mockReturnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(EmployeeLoans);
    fixture.detectChanges();
    expect(fixture.componentInstance.loadFailed()).toBe(true);
  });
});

describe('LoanForm', () => {
  function form() {
    const svc = setup();
    const fixture = TestBed.createComponent(LoanForm);
    fixture.componentRef.setInput('types', []);
    fixture.detectChanges();
    return { svc, comp: fixture.componentInstance };
  }

  it('shows what the server will store and sends the loan once', () => {
    const { svc, comp } = form();
    comp.form.patchValue({
      employeeId: 5,
      componentId: 21,
      principal: 12122140,
      instalmentCount: 36,
      startMonth: '2026-12',
    });
    expect(comp.figures()).toEqual(
      expect.objectContaining({
        instalment: 336726.11,
        finalInstalment: 336726.15,
        lastMonth: '2029-11',
      }),
    );
    comp.save();
    comp.save();
    expect(svc.createLoan).toHaveBeenCalledTimes(1);
    expect(svc.createLoan).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 5,
        componentId: 21,
        principal: 12122140,
        instalmentCount: 36,
        startMonth: '2026-12',
        instalmentsPaid: 0,
      }),
    );
  });

  it('refuses a loan whose instalments are already all paid, or missing fields', () => {
    const { svc, comp } = form();
    comp.form.patchValue({
      employeeId: 5,
      componentId: 21,
      principal: 1000,
      instalmentCount: 10,
      instalmentsPaid: 10,
    });
    expect(comp.paidTooMany()).toBe(true);
    comp.save();
    comp.form.patchValue({ instalmentsPaid: 0, componentId: null });
    comp.save();
    expect(svc.createLoan).not.toHaveBeenCalled();
    expect(comp.invalid('componentId')).toBe(true);
  });

  it('turns a refusal into its translated rule message', () => {
    const { svc, comp } = form();
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      payroll: { loans: { errors: { rules: { LOAN_TYPE_ALREADY_RUNNING: 'Already running' } } } },
    });
    translate.use('en');
    svc.createLoan.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { errors: { ruleCode: 'LOAN_TYPE_ALREADY_RUNNING' } },
          }),
      ),
    );
    comp.form.patchValue({ employeeId: 5, componentId: 21, principal: 1000, instalmentCount: 10 });
    comp.save();
    expect(comp.error()).toBe('Already running');
    expect(comp.saving()).toBe(false);
  });
});

describe('LoanEnd', () => {
  it('needs a reason, then sends the version the loan was shown with, once', () => {
    const svc = setup();
    const fixture = TestBed.createComponent(LoanEnd);
    fixture.componentRef.setInput('loan', loan);
    fixture.componentRef.setInput('action', 'close');
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    comp.reason.setValue('   ');
    comp.confirm();
    expect(svc.endLoan).not.toHaveBeenCalled();

    comp.reason.setValue(' repaid in cash ');
    comp.confirm();
    comp.confirm();
    expect(svc.endLoan).toHaveBeenCalledTimes(1);
    expect(svc.endLoan).toHaveBeenCalledWith(700, 'close', 2, 'repaid in cash');
  });
});
