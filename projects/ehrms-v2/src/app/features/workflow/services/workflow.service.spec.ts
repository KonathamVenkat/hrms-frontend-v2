import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { workflowErrorMessage } from '../workflow-errors';
import { WorkflowService } from './workflow.service';

const ok = { success: true, message: '', data: {}, statusCode: 200 };

describe('WorkflowService', () => {
  let service: WorkflowService;
  let http: HttpTestingController;
  const root = `${environment.serviceUrl}/api/v1`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideTranslateService()],
    });
    service = TestBed.inject(WorkflowService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('pages the inbox on the server', () => {
    service.inbox(2, 20).subscribe();
    const req = http.expectOne((r) => r.url === `${root}/inbox`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(ok);
  });

  it('reads status and history of one request', () => {
    service.status('LEAVE', 7).subscribe();
    const s = http.expectOne(`${root}/requests/LEAVE/7/workflow`);
    expect(s.request.method).toBe('GET');
    s.flush(ok);
    service.history('LEAVE', 7).subscribe();
    http.expectOne(`${root}/requests/LEAVE/7/history`).flush(ok);
  });

  it('reads the departments a step holder may forward to', () => {
    service.targetDepartments('LEAVE', 7).subscribe();
    const r = http.expectOne(`${root}/requests/LEAVE/7/workflow/target-departments`);
    expect(r.request.method).toBe('GET');
    r.flush(ok);
  });

  it('posts an action, a cancel and an override with the body as given', () => {
    const act = {
      stepKey: 'BRANCH',
      outcome: 'FORWARD' as const,
      targetDepartmentId: 3,
      comment: null,
    };
    service.act('LEAVE', 7, act).subscribe();
    const a = http.expectOne(`${root}/requests/LEAVE/7/actions`);
    expect(a.request.method).toBe('POST');
    expect(a.request.body).toEqual(act);
    a.flush(ok);

    service.cancel('LEAVE', 7).subscribe();
    const c = http.expectOne(`${root}/requests/LEAVE/7/cancel`);
    expect(c.request.method).toBe('POST');
    c.flush(ok);

    const ov = {
      stepKey: 'HEAD',
      outcome: 'APPROVE' as const,
      targetDepartmentId: null,
      reason: 'Head left',
    };
    service.override('LEAVE', 7, ov).subscribe();
    const o = http.expectOne(`${root}/requests/LEAVE/7/override`);
    expect(o.request.body).toEqual(ov);
    o.flush(ok);
  });
});

describe('workflowErrorMessage', () => {
  it('maps 409 to the stale text, a known rule code to its text, and 403 to forbidden', () => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', {
      common: { httpErrors: { forbidden: 'FORBIDDEN', badRequest: 'BAD', unexpected: 'X' } },
      workflow: { errors: { stale: 'STALE', rules: { TARGET_DEPARTMENT_REQUIRED: 'PICK' } } },
    });
    t.use('en');
    expect(workflowErrorMessage(t, { status: 409 })).toBe('STALE');
    expect(workflowErrorMessage(t, { status: 403 })).toBe('FORBIDDEN');
    expect(
      workflowErrorMessage(t, {
        status: 400,
        error: { errors: { ruleCode: 'TARGET_DEPARTMENT_REQUIRED' } },
      }),
    ).toBe('PICK');
  });

  it('shows a generic action-failed text, never the raw server text, for a 422 without a known rule', () => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', { common: { httpErrors: { actionFailed: 'FAILED' } } });
    t.use('en');
    const raw = { message: 'Workflow invalid: step HEAD has no holder' };
    expect(
      workflowErrorMessage(t, {
        status: 422,
        error: { ...raw, errors: { ruleCode: 'WORKFLOW_INVALID' } },
      }),
    ).toBe('FAILED');
    expect(workflowErrorMessage(t, { status: 422, error: raw })).toBe('FAILED');
  });

  it('shows the generic text, never the server text, for other statuses such as 503', () => {
    TestBed.configureTestingModule({ providers: [provideTranslateService()] });
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', { common: { httpErrors: { unexpected: 'GENERIC' } } });
    t.use('en');
    expect(workflowErrorMessage(t, { status: 503, error: { message: 'upstream down' } })).toBe(
      'GENERIC',
    );
  });
});
