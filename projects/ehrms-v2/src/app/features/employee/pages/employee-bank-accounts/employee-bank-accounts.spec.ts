import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { EmployeeBankAccountsComponent } from './employee-bank-accounts';
import { BankAccountService } from '../../services/bank-account.service';
import { EmployeeBankAccount } from '../../models/bank-account.model';

const ok = <T>(data: T) => of({ success: true, message: '', statusCode: 200, data });

const account: EmployeeBankAccount = {
  id: 1,
  employeeId: 10,
  bankId: 1,
  bankName: 'Bank of Juba',
  bankBranchId: 5,
  bankBranchName: 'Main branch',
  accountNumber: '123456789',
  isPrimary: true,
  isActive: true,
  masked: false,
  version: 0,
};

function setup(account1: EmployeeBankAccount) {
  const svc = {
    getAll: vi.fn(() => ok([account1])),
    getBanks: vi.fn(() => ok([])),
    getBranches: vi.fn(() => ok([])),
  };
  TestBed.configureTestingModule({
    imports: [EmployeeBankAccountsComponent],
    providers: [provideTranslateService(), { provide: BankAccountService, useValue: svc }],
  });
  const fixture = TestBed.createComponent(EmployeeBankAccountsComponent);
  fixture.componentRef.setInput('employeeId', 10);
  fixture.componentRef.setInput('readOnly', true);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('EmployeeBankAccountsComponent branch contact', () => {
  it('shows the branch address, a phone link and an e-mail link when the bank master has them', () => {
    const el = setup({
      ...account,
      bankBranchAddress: 'Plot 4, Airport Road, Juba',
      bankBranchPhone: '+211 912 000 111',
      bankBranchEmail: 'juba.main@bank.example',
    });

    const text = el.textContent ?? '';
    expect(text).toContain('Plot 4, Airport Road, Juba');
    expect(el.querySelector('a[href="tel:+211 912 000 111"]')?.textContent).toContain('+211 912 000 111');
    expect(el.querySelector('a[href="mailto:juba.main@bank.example"]')?.textContent).toContain('juba.main@bank.example');
  });

  it('shows no contact rows when the branch has none', () => {
    const el = setup(account);

    expect(el.textContent).toContain('Main branch');
    expect(el.textContent).not.toContain('employee.bankAccounts.fields.branchAddress');
    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.querySelector('a[href^="mailto:"]')).toBeNull();
  });
});
