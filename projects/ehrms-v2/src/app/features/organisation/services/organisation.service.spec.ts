import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { OrganisationService } from './organisation.service';

describe('OrganisationService', () => {
  let service: OrganisationService;
  let http: HttpTestingController;
  const base = `${environment.serviceUrl}/api/v1/organisation`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrganisationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the branches with GET /branches and unwraps the data', () => {
    let result: unknown;
    service.listBranches().subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/branches`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', statusCode: 200, data: [{ branchId: 1 }] });
    expect(result).toEqual([{ branchId: 1 }]);
  });

  it('looks branches up with an optional locationId query parameter', () => {
    service.lookupBranches(7).subscribe();
    const withLocation = http.expectOne((r) => r.url === `${base}/branches/lookup`);
    expect(withLocation.request.params.get('locationId')).toBe('7');
    withLocation.flush({ success: true, message: 'ok', statusCode: 200, data: [] });

    service.lookupBranches().subscribe();
    const without = http.expectOne((r) => r.url === `${base}/branches/lookup`);
    expect(without.request.params.has('locationId')).toBe(false);
    without.flush({ success: true, message: 'ok', statusCode: 200, data: [] });
  });

  it('asks for manager candidates with the location, the trimmed search and paging', () => {
    service.managerCandidates(7, '  lual ', 0, 50).subscribe();
    const withLocation = http.expectOne((r) => r.url === `${base}/manager-candidates`);
    expect(withLocation.request.method).toBe('GET');
    expect(withLocation.request.params.get('locationId')).toBe('7');
    expect(withLocation.request.params.get('q')).toBe('lual');
    expect(withLocation.request.params.get('page')).toBe('0');
    expect(withLocation.request.params.get('size')).toBe('50');
    withLocation.flush({ success: true, message: 'ok', statusCode: 200, data: { content: [] } });

    service.managerCandidates(null, '', 1, 50).subscribe();
    const anywhere = http.expectOne((r) => r.url === `${base}/manager-candidates`);
    expect(anywhere.request.params.has('locationId')).toBe(false);
    expect(anywhere.request.params.has('q')).toBe(false);
    anywhere.flush({ success: true, message: 'ok', statusCode: 200, data: { content: [] } });
  });

  it('sets a placement with PUT and the version in the body', () => {
    service.setPlacement(4, { locationId: 7, managerEmployeeId: null, version: 3 }).subscribe();

    const req = http.expectOne(`${base}/branches/4/placement`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ locationId: 7, managerEmployeeId: null, version: 3 });
    req.flush({ success: true, message: 'ok', statusCode: 200, data: { branchId: 4 } });
  });

  it('reads the summary with GET /summary', () => {
    service.summary().subscribe();

    const req = http.expectOne(`${base}/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'ok',
      statusCode: 200,
      data: { employeesWithoutBranch: 1, branchesWithoutManager: 2, branchesWithoutLocation: 3 },
    });
  });

  it('pages the employees without a branch with q, page and size parameters', () => {
    service.employeesWithoutBranch('lual', 2, 20).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/employees-without-branch`);
    expect(req.request.params.get('q')).toBe('lual');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({
      success: true,
      message: 'ok',
      statusCode: 200,
      data: {
        content: [],
        totalPages: 0,
        totalElements: 0,
        size: 20,
        number: 2,
        first: false,
        last: true,
      },
    });
  });

  it('leaves q out of the query when the search is blank', () => {
    service.employeesWithoutBranch('  ', 0, 20).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/employees-without-branch`);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({
      success: true,
      message: 'ok',
      statusCode: 200,
      data: {
        content: [],
        totalPages: 0,
        totalElements: 0,
        size: 20,
        number: 0,
        first: true,
        last: true,
      },
    });
  });

  it('sends the back-fill as PUT /branch-assignments with an items array', () => {
    service.assignBranches([{ employeeId: 11, branchId: 1 }]).subscribe();

    const req = http.expectOne(`${base}/branch-assignments`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ items: [{ employeeId: 11, branchId: 1 }] });
    req.flush({
      success: true,
      message: 'ok',
      statusCode: 200,
      data: { assigned: 1, skipped: [] },
    });
  });
});
