import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { Auth } from '../../../../core/auth/auth';
import { LanguageService } from '../../../../core/services/language.service';
import { EmployeeService } from '../../../employee/services/employee';
import {
  ApiResponse,
  RequestHistory,
  StepOutcome,
  WorkflowStatus,
} from '../../models/workflow.model';
import { WorkflowService } from '../../services/workflow.service';
import { DepartmentLookup } from '../../../employee/models/employee';
import { ForwardDialog } from '../../components/forward-dialog/forward-dialog';
import { RequestDetail } from './request-detail';

const ME = 10;
const wrap = <T>(data: T): ApiResponse<T> => ({
  success: true,
  message: '',
  data,
  statusCode: 200,
});

function status(over: Partial<WorkflowStatus> = {}): WorkflowStatus {
  return {
    type: 'LEAVE',
    requestId: 7,
    stage: 'PENDING_HEAD',
    stepKey: 'HEAD',
    stepLabelEn: 'Department head',
    stepLabelAr: 'رئيس القسم',
    allowedOutcomes: ['APPROVE', 'REJECT'],
    pickTargetDepartment: false,
    requesterEmployeeId: 99,
    mayOverride: false,
    overridePicksTargetDepartment: false,
    ...over,
  };
}

interface Opts {
  status?: Observable<ApiResponse<WorkflowStatus>>;
  roles?: string[];
  act?: ReturnType<typeof vi.fn>;
  /** Fields of the default status response (requester, summary, ...). */
  statusOver?: Partial<WorkflowStatus>;
  history?: () => Observable<ApiResponse<RequestHistory[]>>;
  /** Route parameters; default LEAVE #7. */
  params?: Record<string, string>;
}

function setup(opts: Opts = {}) {
  const history: RequestHistory[] = [];
  const svc = {
    status: vi.fn(() => opts.status ?? of(wrap(status(opts.statusOver)))),
    history: vi.fn(opts.history ?? (() => of(wrap(history)))),
    act: opts.act ?? vi.fn(() => of(wrap(status({ stage: 'PENDING_GM', stepKey: 'GM' })))),
    cancel: vi.fn(() => of(wrap(status({ stage: 'CANCELLED', allowedOutcomes: [] })))),
    override: vi.fn(() => of(wrap(status({ stage: 'PENDING_GM', stepKey: 'GM' })))),
    targetDepartments: vi.fn(() => of(wrap([{ id: 5, code: 'T', name: 'Target', nameAr: 'ه' }]))),
  };
  const depts = {
    getDepartments: vi.fn(() => of(wrap([{ id: 3, code: 'F', name: 'Finance', nameAr: 'م' }]))),
  };
  const snack = { open: vi.fn() };
  TestBed.configureTestingModule({
    imports: [RequestDetail, NoopAnimationsModule],
    providers: [
      provideTranslateService(),
      provideRouter([]),
      { provide: WorkflowService, useValue: svc },
      { provide: EmployeeService, useValue: depts },
      { provide: LanguageService, useValue: { currentLang: () => 'en' } },
      {
        provide: Auth,
        useValue: {
          hasAnyRole: (...r: string[]) => r.some((x) => (opts.roles ?? ['EMPLOYEE']).includes(x)),
          getEmployeeId: () => ME,
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap(opts.params ?? { type: 'LEAVE', id: '7' }) },
        },
      },
    ],
  });
  TestBed.overrideComponent(RequestDetail, {
    set: { providers: [{ provide: MatSnackBar, useValue: snack }] },
  });
  const fixture = TestBed.createComponent(RequestDetail);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const labels = () =>
    Array.from(el.querySelectorAll('.detail-actions button')).map((b) => b.textContent?.trim());
  const click = (text: string) => {
    const b = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((x) =>
      x.textContent?.includes(text),
    );
    b?.click();
    fixture.detectChanges();
  };
  const confirmBtn = () => el.querySelector<HTMLButtonElement>('button.confirm-btn');
  return { fixture, el, svc, depts, snack, labels, click, confirmBtn };
}

/** The open dialog's form, to fill fields a mat-select would set. */
function dialogForm(fixture: ComponentFixture<RequestDetail>) {
  const dlg = fixture.debugElement.query(By.directive(ForwardDialog));
  return (dlg.componentInstance as ForwardDialog).form.controls;
}

describe('RequestDetail', () => {
  it('offers only the actions in allowedOutcomes', () => {
    const { labels } = setup({ status: of(wrap(status({ allowedOutcomes: ['FORWARD'] }))) });
    const text = labels().join('|');
    expect(text).toContain('workflow.outcomes.FORWARD');
    expect(text).not.toContain('workflow.outcomes.APPROVE');
    expect(text).not.toContain('workflow.outcomes.REJECT');
  });

  it('offers nothing on a closed request', () => {
    const { labels } = setup({
      status: of(wrap(status({ stage: 'APPROVED', stepKey: undefined, allowedOutcomes: [] }))),
    });
    expect(labels().length).toBe(0);
  });

  it('shows a loading state, then an error with retry when the status cannot be loaded', () => {
    const { el, svc, fixture } = setup({ status: throwError(() => ({ status: 500 })) });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    fixture.detectChanges();
    expect(svc.status).toHaveBeenCalledTimes(2);
  });

  it('shows a 403 state when the API denies access', () => {
    const { el } = setup({ status: throwError(() => ({ status: 403 })) });
    expect(el.textContent).toContain('workflow.detail.forbidden');
  });

  it('opens a confirm dialog naming the employee and the leave before approving', () => {
    const { el, click, svc } = setup({
      statusOver: {
        requesterName: 'Ayen Deng',
        summary: 'Annual 2026-11-01 to 2026-11-05 (5 days)',
      },
    });
    click('workflow.outcomes.APPROVE');
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('Ayen Deng');
    expect(el.textContent).toContain('2026-11-01 to 2026-11-05 (5 days)');
    expect(svc.act).not.toHaveBeenCalled();
  });

  it('sends the step key and outcome when the dialog is confirmed, then shows the new state', () => {
    const { fixture, el, click, confirmBtn, svc, snack } = setup();
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(svc.act).toHaveBeenCalledWith('LEAVE', 7, {
      stepKey: 'HEAD',
      outcome: 'APPROVE' satisfies StepOutcome,
      targetDepartmentId: null,
      comment: null,
    });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(snack.open).toHaveBeenCalled();
  });

  it('requires a reason to reject', () => {
    const { fixture, el, click, confirmBtn, svc } = setup();
    click('workflow.outcomes.REJECT');
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(svc.act).not.toHaveBeenCalled();
    expect(el.querySelector('mat-error')).not.toBeNull();
  });

  it('shows the department picker only when pickTargetDepartment is true', () => {
    const plain = setup({ status: of(wrap(status({ allowedOutcomes: ['FORWARD'] }))) });
    plain.click('workflow.outcomes.FORWARD');
    expect(plain.el.querySelector('mat-select')).toBeNull();
    TestBed.resetTestingModule();

    const pick = setup({
      status: of(
        wrap(
          status({
            stepKey: 'BRANCH',
            allowedOutcomes: ['FORWARD', 'REJECT'],
            pickTargetDepartment: true,
          }),
        ),
      ),
    });
    pick.click('workflow.outcomes.FORWARD');
    expect(pick.el.querySelector('mat-select')).not.toBeNull();
    expect(pick.svc.targetDepartments).toHaveBeenCalledWith('LEAVE', 7);
    expect(pick.depts.getDepartments).not.toHaveBeenCalled();
  });

  it('ignores a second click while the call is in flight', () => {
    const pending = new Subject<ApiResponse<WorkflowStatus>>();
    const { fixture, click, confirmBtn, svc } = setup({ act: vi.fn(() => pending) });
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.detectChanges();
    confirmBtn()?.click();
    fixture.componentInstance.submit({ outcome: 'APPROVE', targetDepartmentId: null, text: null });
    expect(svc.act).toHaveBeenCalledTimes(1);
    expect(confirmBtn()?.disabled).toBe(true);
  });

  it('on 409 says it was already handled and reloads the status', () => {
    const { fixture, el, click, confirmBtn, svc } = setup({
      act: vi.fn(() => throwError(() => ({ status: 409 }))),
    });
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('workflow.errors.stale');
    expect(svc.status).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('offers override only when the API says the caller may override now', () => {
    expect(
      setup({ roles: ['HR_ADMIN'], statusOver: { mayOverride: true } })
        .labels()
        .join('|'),
    ).toContain('workflow.detail.override');
    TestBed.resetTestingModule();
    expect(
      setup({ roles: ['HR_ADMIN'], statusOver: { mayOverride: false } })
        .labels()
        .join('|'),
    ).not.toContain('workflow.detail.override');
  });

  it('shows the requester name from the status response on a direct visit', () => {
    const { el } = setup({ statusOver: { requesterName: 'Ayen Deng' } });
    expect(el.querySelector('.subtitle')?.textContent).toContain('Ayen Deng');
  });

  it('an override on a step that picks no department shows no department field and sends null', () => {
    const { fixture, el, click, depts, svc, confirmBtn } = setup({
      roles: ['HR_ADMIN'],
      statusOver: { allowedOutcomes: [], mayOverride: true },
    });
    click('workflow.detail.override');
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(depts.getDepartments).not.toHaveBeenCalled();
    const form = dialogForm(fixture);
    form.outcome.setValue('FORWARD');
    form.text.setValue('Head left');
    fixture.detectChanges();
    expect(el.querySelectorAll('mat-select').length).toBe(1); // outcome only
    confirmBtn()?.click();
    expect(svc.override).toHaveBeenCalledWith('LEAVE', 7, {
      stepKey: 'HEAD',
      outcome: 'FORWARD',
      targetDepartmentId: null,
      reason: 'Head left',
    });
  });

  it('an override on a department-picking step loads the HR lookup and requires a department', () => {
    const { fixture, el, click, depts, svc, confirmBtn } = setup({
      roles: ['HR_ADMIN'],
      statusOver: {
        stepKey: 'BRANCH',
        allowedOutcomes: [],
        mayOverride: true,
        overridePicksTargetDepartment: true,
      },
    });
    click('workflow.detail.override');
    expect(depts.getDepartments).toHaveBeenCalledTimes(1);
    expect(svc.targetDepartments).not.toHaveBeenCalled();
    const form = dialogForm(fixture);
    form.outcome.setValue('FORWARD');
    form.text.setValue('Branch manager left');
    fixture.detectChanges();
    expect(el.querySelectorAll('mat-select').length).toBe(2);
    confirmBtn()?.click();
    expect(svc.override).not.toHaveBeenCalled();
    form.targetDepartmentId.setValue(3);
    confirmBtn()?.click();
    expect(svc.override).toHaveBeenCalledWith('LEAVE', 7, {
      stepKey: 'BRANCH',
      outcome: 'FORWARD',
      targetDepartmentId: 3,
      reason: 'Branch manager left',
    });
  });

  it('announces the 409 notice politely', () => {
    const { fixture, el, click, confirmBtn } = setup({
      act: vi.fn(() => throwError(() => ({ status: 409 }))),
    });
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.detectChanges();
    const notice = el.querySelector('.alert-info');
    expect(notice?.getAttribute('aria-live')).toBe('polite');
    expect(notice?.textContent).toContain('workflow.errors.stale');
  });

  it('hides the actions while the status reloads', () => {
    const reload = new Subject<ApiResponse<WorkflowStatus>>();
    const { fixture, labels, svc } = setup();
    expect(labels().length).toBeGreaterThan(0);
    svc.status.mockReturnValue(reload);
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(labels().length).toBe(0);
    reload.next(wrap(status()));
    reload.complete();
    fixture.detectChanges();
    expect(labels().length).toBeGreaterThan(0);
  });

  it('keeps only the newest history answer when an older one arrives late', () => {
    const first = new Subject<ApiResponse<RequestHistory[]>>();
    const second = new Subject<ApiResponse<RequestHistory[]>>();
    const calls = [first, second];
    const { fixture } = setup({ history: () => calls.shift() ?? second });
    fixture.componentInstance.load();
    const row = (comment: string): RequestHistory => ({
      action: 'SUBMITTED',
      actedAt: '2026-10-25T09:00:00',
      comment,
    });
    second.next(wrap([row('new')]));
    first.next(wrap([row('old')]));
    expect(fixture.componentInstance.history().map((h) => h.comment)).toEqual(['new']);
  });

  it('never shows the HR department list in the forward picker', () => {
    const pendingHr = new Subject<ApiResponse<DepartmentLookup[]>>();
    const { fixture, click, depts } = setup({
      roles: ['HR_ADMIN'],
      statusOver: {
        stepKey: 'BRANCH',
        allowedOutcomes: ['FORWARD'],
        pickTargetDepartment: true,
        mayOverride: true,
        overridePicksTargetDepartment: true,
      },
    });
    depts.getDepartments.mockReturnValue(pendingHr);
    click('workflow.detail.override');
    fixture.componentInstance.closeDialog();
    fixture.detectChanges();
    click('workflow.outcomes.FORWARD');
    pendingHr.next(wrap([{ id: 3, code: 'F', name: 'Finance', nameAr: 'م' }]));
    expect(fixture.componentInstance.departments().map((d) => d.id)).toEqual([5]);
  });

  it('rejects an unknown request type without calling the API or showing a raw key', () => {
    const { el, svc } = setup({ params: { type: 'FOO', id: '7' } });
    expect(svc.status).not.toHaveBeenCalled();
    expect(svc.history).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('common.httpErrors.notFound');
    expect(el.textContent).not.toContain('workflow.types.FOO');
    expect(el.querySelector('[role="alert"] button')).toBeNull();
  });

  it('shows a closed unknown stage without a raw key', () => {
    const { el } = setup({
      status: of(wrap(status({ stage: 'WEIRD', stepKey: undefined, allowedOutcomes: [] }))),
    });
    expect(el.textContent).not.toContain('workflow.stages.WEIRD');
  });

  it('offers cancel only to the person who raised the request', () => {
    expect(
      setup({ statusOver: { requesterEmployeeId: ME } })
        .labels()
        .join('|'),
    ).toContain('workflow.detail.cancel');
    TestBed.resetTestingModule();
    expect(
      setup({ statusOver: { requesterEmployeeId: 99 } })
        .labels()
        .join('|'),
    ).not.toContain('workflow.detail.cancel');
  });

  it('shows no actions when the reload after a 409 fails', () => {
    const { fixture, el, click, confirmBtn, svc, labels } = setup({
      act: vi.fn(() => throwError(() => ({ status: 409 }))),
    });
    svc.status.mockReturnValue(throwError(() => ({ status: 500 })));
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.detectChanges();
    expect(el.querySelector('.alert-error')).not.toBeNull();
    expect(labels().length).toBe(0);
  });

  it('makes no follow-up calls when destroyed with an action in flight', () => {
    const pending = new Subject<ApiResponse<WorkflowStatus>>();
    const { fixture, click, confirmBtn, svc } = setup({ act: vi.fn(() => pending) });
    click('workflow.outcomes.APPROVE');
    confirmBtn()?.click();
    fixture.destroy();
    pending.error({ status: 409 });
    expect(svc.status).toHaveBeenCalledTimes(1);
  });
});
