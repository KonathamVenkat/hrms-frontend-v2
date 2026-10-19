import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { Auth } from '../../../../core/auth/auth';
import { Requisition, RequisitionStatus } from '../../models/requisition.model';
import { RequisitionService } from '../../services/requisition.service';
import { RequisitionDetail } from './requisition-detail';

const ME = 10;

function requisition(status: RequisitionStatus, requestedById = ME, version = 3): Requisition {
  return {
    id: 5,
    code: 'REQ-2026-000005',
    jobTitle: 'Data Analyst',
    departmentId: 1,
    departmentName: 'Finance',
    designationId: 2,
    designationTitle: 'Analyst',
    requestedById,
    requestedByName: 'Ayen Deng',
    noOfPositions: 2,
    filledPositions: 0,
    employmentType: 'FULL_TIME',
    requisitionType: 'NEW',
    minExperienceYears: 2,
    currency: 'SSP',
    priority: 'HIGH',
    status,
    version,
    approvals: [],
  };
}

function setup(opts: {
  status: RequisitionStatus;
  roles: string[];
  requestedById?: number;
  svc?: Partial<RequisitionService>;
}) {
  const svc = {
    get: vi.fn(() =>
      of({
        success: true,
        message: '',
        data: requisition(opts.status, opts.requestedById),
        statusCode: 200,
      }),
    ),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
  };
  Object.assign(svc, opts.svc); // a test replaces only the call it cares about; svc keeps its mock types
  const snack = { open: vi.fn() };
  TestBed.configureTestingModule({
    imports: [RequisitionDetail, NoopAnimationsModule],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: RequisitionService, useValue: svc },
      {
        provide: Auth,
        useValue: {
          hasAnyRole: (...r: string[]) => r.some((x) => opts.roles.includes(x)),
          getEmployeeId: () => ME,
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } },
      },
    ],
  });
  TestBed.overrideComponent(RequisitionDetail, {
    set: { providers: [{ provide: MatSnackBar, useValue: snack }] },
  });
  const fixture = TestBed.createComponent(RequisitionDetail);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const buttonLabels = () =>
    Array.from(el.querySelectorAll('.detail-actions button')).map(
      (b) => b.textContent?.trim() ?? '',
    );
  return { fixture, component: fixture.componentInstance, svc, snack, el, buttonLabels };
}

describe('RequisitionDetail', () => {
  it('shows HR the approve and reject buttons on a pending requisition raised by someone else', () => {
    const { buttonLabels } = setup({
      status: 'PENDING_APPROVAL',
      roles: ['HR_MANAGER'],
      requestedById: 99,
    });
    const labels = buttonLabels().join('|');
    expect(labels).toContain('recruitment.detail.actions.approve');
    expect(labels).toContain('recruitment.detail.actions.reject');
  });

  it('never offers approve or reject to the person who raised it', () => {
    const { buttonLabels } = setup({
      status: 'PENDING_APPROVAL',
      roles: ['HR_MANAGER'],
      requestedById: ME,
    });
    const labels = buttonLabels().join('|');
    expect(labels).not.toContain('recruitment.detail.actions.approve');
    expect(labels).not.toContain('recruitment.detail.actions.reject');
    expect(labels).toContain('recruitment.detail.actions.cancel');
  });

  it('offers a department head nothing beyond their own draft actions, and nothing on an approved requisition', () => {
    const draft = setup({ status: 'DRAFT', roles: ['EMPLOYEE'], requestedById: ME });
    expect(draft.buttonLabels().length).toBe(3); // edit, submit, cancel
    TestBed.resetTestingModule();
    const approved = setup({ status: 'APPROVED', roles: ['EMPLOYEE'], requestedById: ME });
    expect(approved.buttonLabels().length).toBe(0);
  });

  it('shows an error with a retry when the requisition cannot be loaded', () => {
    const { el, svc } = setup({
      status: 'DRAFT',
      roles: ['HR_ADMIN'],
      svc: { get: vi.fn(() => throwError(() => ({ status: 404 }))) },
    });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.httpErrors.notFound');
    expect(svc.get).toHaveBeenCalledTimes(1);
  });

  it('sends a confirmed submit once even when the button is pressed twice while it is in flight', () => {
    const inFlight = new Subject<never>();
    const { component, svc } = setup({
      status: 'DRAFT',
      roles: ['HR_ADMIN'],
      requestedById: ME,
      svc: { submit: vi.fn(() => inFlight) },
    });
    component.open('submit');
    component.confirm();
    component.confirm();
    expect(svc.submit).toHaveBeenCalledTimes(1);
    expect(svc.submit).toHaveBeenCalledWith(5, { version: 3 });
    expect(component.acting()).toBe(true);
  });

  it('will not approve until both confirmations are ticked', () => {
    const { component, svc } = setup({
      status: 'PENDING_APPROVAL',
      roles: ['HR_MANAGER'],
      requestedById: 99,
    });
    component.open('approve');
    component.approveForm.patchValue({ budgetConfirmed: true }); // management still unticked
    component.confirm();
    expect(svc.approve).not.toHaveBeenCalled();

    svc.approve.mockReturnValue(
      of({ success: true, message: '', data: requisition('APPROVED', 99, 4), statusCode: 200 }),
    );
    component.approveForm.patchValue({ managementConfirmed: true, comments: ' ok ' });
    component.confirm();
    expect(svc.approve).toHaveBeenCalledWith(5, {
      budgetConfirmed: true,
      managementConfirmed: true,
      comments: 'ok',
      version: 3,
    });
    expect(component.requisition()?.status).toBe('APPROVED');
    expect(component.dialog()).toBeNull();
  });

  it('will not reject without a reason', () => {
    const { component, svc } = setup({
      status: 'PENDING_APPROVAL',
      roles: ['HR_MANAGER'],
      requestedById: 99,
    });
    component.open('reject');
    component.rejectForm.patchValue({ reason: '   ' });
    component.confirm();
    expect(svc.reject).not.toHaveBeenCalled();
    expect(component.rejectForm.controls.reason.touched).toBe(true);
  });

  it('keeps the dialog open with a stale-version message on 409 and reloads the current state', () => {
    const { component, svc } = setup({
      status: 'PENDING_APPROVAL',
      roles: ['HR_MANAGER'],
      requestedById: 99,
      svc: { approve: vi.fn(() => throwError(() => ({ status: 409 }))) },
    });
    component.open('approve');
    component.approveForm.patchValue({ budgetConfirmed: true, managementConfirmed: true });
    component.confirm();
    expect(component.dialog()).toBe('approve');
    expect(component.dialogError()).toBe('recruitment.errors.stale');
    expect(component.acting()).toBe(false);
    expect(svc.get).toHaveBeenCalledTimes(2); // initial load + refresh behind the dialog
  });
});
