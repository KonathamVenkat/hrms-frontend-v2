import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LeaveBalanceService } from '../../services/leave-balance.service';
import { LeaveBalancePage } from './leave-balance';

const en = {
  common: { cancel: 'Cancel' },
  leave: {
    balance: {
      initializeAllButton: 'Initialize All Employees',
      applyAdjustmentButton: 'Apply Adjustment',
      confirm: {
        initializeTitle: 'Create {{year}} leave balances?',
        initializeMessage: 'Balances for {{year}} will be created for every active employee.',
        skipExistingOn: 'Existing {{year}} balances are skipped.',
        skipExistingOff: 'Existing {{year}} balances are not skipped.',
        carryOn: 'Unused leave is carried forward.',
        carryOff: 'No leave is carried forward.',
        adjustTitle: 'Adjust this leave balance?',
        adjustGrant: 'Add {{days}} day(s) to {{type}} {{year}} of employee #{{employee}}.',
        adjustDeduct: 'Remove {{days}} day(s) from {{type}} {{year}} of employee #{{employee}}.',
        adjustReset: 'Set {{type}} {{year}} of employee #{{employee}} to {{days}} day(s).',
        adjustReason: 'Reason: {{reason}}',
      },
    },
  },
};

const result = { initializedCount: 3, skippedCount: 1, errorCount: 0, errors: [] };

function setup() {
  const svc = {
    getAllBalancesForYear: vi.fn(() => of({ success: true, message: '', data: [] })),
    bulkInitialize: vi.fn(() => of({ success: true, message: '', data: result })),
    adjustBalance: vi.fn(() =>
      of({ success: true, message: '', data: { leaveTypeName: 'Annual leave' } }),
    ),
  };
  TestBed.configureTestingModule({
    imports: [LeaveBalancePage],
    providers: [provideTranslateService(), { provide: LeaveBalanceService, useValue: svc }],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', en);
  translate.use('en');
  const fixture = TestBed.createComponent(LeaveBalancePage);
  fixture.detectChanges();
  return { page: fixture.componentInstance, svc, fixture };
}

describe('LeaveBalancePage confirmations', () => {
  it('asks before creating balances for everyone, and says the year and the options', () => {
    const { page, svc } = setup();
    const year = page.selectedYear();

    page.onInitialize();

    expect(svc.bulkInitialize).not.toHaveBeenCalled();
    const asked = page.confirming();
    expect(asked?.title).toBe(`Create ${year} leave balances?`);
    expect(asked?.message).toContain(
      `Balances for ${year} will be created for every active employee.`,
    );
    expect(asked?.message).toContain(`Existing ${year} balances are skipped.`);
    expect(asked?.message).toContain('Unused leave is carried forward.');
  });

  it('runs the bulk creation once when confirmed, however often confirm is pressed', () => {
    const { page, svc } = setup();

    page.onInitialize();
    page.confirmPending();
    page.confirmPending();

    expect(svc.bulkInitialize).toHaveBeenCalledTimes(1);
    expect(page.confirming()).toBeNull();
  });

  it('does nothing when the question is cancelled', () => {
    const { page, svc } = setup();

    page.onInitialize();
    page.cancelPending();
    page.confirmPending();

    expect(svc.bulkInitialize).not.toHaveBeenCalled();
    expect(page.confirming()).toBeNull();
  });

  it('names the employee, the leave type, the year and the days before an adjustment, for each kind', () => {
    const { page, svc } = setup();
    const year = page.selectedYear();
    const fill = (adjustmentType: string) =>
      page.adjustForm.patchValue({
        employeeId: '42',
        leaveTypeCode: 'ANNUAL',
        year,
        adjustmentType,
        days: 5,
        reason: 'Merit grant',
      });

    fill('GRANT');
    page.onAdjust();
    expect(page.confirming()?.message).toBe(
      `Add 5 day(s) to ANNUAL ${year} of employee #42. Reason: Merit grant`,
    );

    fill('DEDUCT');
    page.onAdjust();
    expect(page.confirming()?.message).toBe(
      `Remove 5 day(s) from ANNUAL ${year} of employee #42. Reason: Merit grant`,
    );

    fill('RESET');
    page.onAdjust();
    expect(page.confirming()?.message).toBe(
      `Set ANNUAL ${year} of employee #42 to 5 day(s). Reason: Merit grant`,
    );
    expect(svc.adjustBalance).not.toHaveBeenCalled();
  });

  it('adjusts only after confirmation, once', () => {
    const { page, svc } = setup();
    page.adjustForm.patchValue({
      employeeId: '42',
      leaveTypeCode: 'ANNUAL',
      adjustmentType: 'GRANT',
      days: 5,
      reason: 'Merit grant',
    });

    page.onAdjust();
    page.confirmPending();
    page.confirmPending();

    expect(svc.adjustBalance).toHaveBeenCalledTimes(1);
    expect(svc.adjustBalance).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ leaveTypeCode: 'ANNUAL', adjustmentType: 'GRANT', days: 5 }),
    );
  });

  it('does not ask, and does not send, when the form is not valid', () => {
    const { page, svc } = setup();

    page.onAdjust(); // no employee, type or reason yet

    expect(page.confirming()).toBeNull();
    expect(svc.adjustBalance).not.toHaveBeenCalled();
  });

  it('shows the question on the page and runs the action from its confirm button', () => {
    const { page, svc, fixture } = setup();
    const year = page.selectedYear();

    page.onInitialize();
    fixture.detectChanges();
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('app-confirm-action');

    expect(dialog?.textContent).toContain(`Create ${year} leave balances?`);
    (dialog?.querySelector('button.btn-confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(svc.bulkInitialize).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-confirm-action')).toBeNull();
  });
});
