import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { RequisitionService } from './requisition.service';
import { RequisitionRequest } from '../models/requisition.model';

describe('RequisitionService', () => {
  let service: RequisitionService;
  let http: HttpTestingController;
  const base = `${environment.serviceUrl}/api/v1/recruitment/requisitions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RequisitionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends paging and sorting always, and only the filters the user set', () => {
    service
      .search({
        page: 2,
        size: 20,
        sortBy: 'code',
        direction: 'asc',
        q: '  analyst ',
        status: 'DRAFT',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('sortBy')).toBe('code');
    expect(req.request.params.get('direction')).toBe('asc');
    expect(req.request.params.get('q')).toBe('analyst');
    expect(req.request.params.get('status')).toBe('DRAFT');
    expect(req.request.params.has('departmentId')).toBe(false);
    req.flush({ success: true, message: '', data: { content: [] }, statusCode: 200 });
  });

  it('leaves out an empty search text', () => {
    service
      .search({ page: 0, size: 10, sortBy: 'createdAt', direction: 'desc', q: '   ' })
      .subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ success: true, message: '', data: { content: [] }, statusCode: 200 });
  });

  it('creates with POST and updates with PUT, sending the body as given', () => {
    const body = { jobTitle: 'Analyst', version: 3 } as RequisitionRequest;
    service.create(body).subscribe();
    const post = http.expectOne(base);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(body);
    post.flush({ success: true, message: '', data: {}, statusCode: 201 });

    service.update(9, body).subscribe();
    const put = http.expectOne(`${base}/9`);
    expect(put.request.method).toBe('PUT');
    put.flush({ success: true, message: '', data: {}, statusCode: 200 });
  });

  it.each([
    ['submit', 'submit'],
    ['cancel', 'cancel'],
    ['hold', 'hold'],
    ['resume', 'resume'],
    ['close', 'close'],
  ] as const)('%s posts the version to /%s', (method, path) => {
    service[method](4, { version: 7 }).subscribe();
    const req = http.expectOne(`${base}/4/${path}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ version: 7 });
    req.flush({ success: true, message: '', data: {}, statusCode: 200 });
  });

  it('posts the approval confirmations and the rejection reason', () => {
    service
      .approve(4, { budgetConfirmed: true, managementConfirmed: true, comments: 'ok', version: 2 })
      .subscribe();
    const approve = http.expectOne(`${base}/4/approve`);
    expect(approve.request.body).toEqual({
      budgetConfirmed: true,
      managementConfirmed: true,
      comments: 'ok',
      version: 2,
    });
    approve.flush({ success: true, message: '', data: {}, statusCode: 200 });

    service.reject(4, { reason: 'No budget', version: 2 }).subscribe();
    const reject = http.expectOne(`${base}/4/reject`);
    expect(reject.request.body).toEqual({ reason: 'No budget', version: 2 });
    reject.flush({ success: true, message: '', data: {}, statusCode: 200 });
  });

  it('loads the form options and the people of one department', () => {
    service.raiseOptions().subscribe();
    http
      .expectOne(`${base}/raise-options`)
      .flush({ success: true, message: '', data: {}, statusCode: 200 });

    service.people(5).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/raise-options/people`);
    expect(req.request.params.get('departmentId')).toBe('5');
    req.flush({ success: true, message: '', data: [], statusCode: 200 });
  });
});
