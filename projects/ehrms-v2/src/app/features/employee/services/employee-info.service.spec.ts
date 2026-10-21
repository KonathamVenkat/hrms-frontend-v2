import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { EmployeeInfoService } from './employee-info.service';
import { InfoRecord } from '../models/employee-info.model';

describe('EmployeeInfoService', () => {
  let service: EmployeeInfoService;
  let http: HttpTestingController;
  const base = `${environment.serviceUrl}/api/v1/employees/10`;
  const reply = (data: unknown) => ({ success: true, message: 'ok', statusCode: 200, data });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EmployeeInfoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the records of one section of one employee', () => {
    let result: unknown;
    service.getAll<InfoRecord>(10, 'dependants').subscribe((r) => (result = r));

    const req = http.expectOne(`${base}/dependants`);
    expect(req.request.method).toBe('GET');
    req.flush(reply([{ id: 1 }]));
    expect(result).toEqual(reply([{ id: 1 }]));
  });

  it('adds with POST and updates with PUT, the update carrying the version', () => {
    service.add(10, 'education', { qualification: 'BSc' }).subscribe();
    const add = http.expectOne(`${base}/education`);
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ qualification: 'BSc' });
    add.flush(reply({ id: 4 }));

    service.update(10, 'education', 4, { qualification: 'MSc', version: 2 }).subscribe();
    const update = http.expectOne(`${base}/education/4`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ qualification: 'MSc', version: 2 });
    update.flush(reply({ id: 4 }));
  });

  it('deactivates and activates with PATCH, never deleting', () => {
    service.deactivate(10, 'languages', 7).subscribe();
    const off = http.expectOne(`${base}/languages/7/deactivate`);
    expect(off.request.method).toBe('PATCH');
    off.flush(reply(null));

    service.activate(10, 'languages', 7).subscribe();
    const on = http.expectOne(`${base}/languages/7/activate`);
    expect(on.request.method).toBe('PATCH');
    on.flush(reply(null));
  });

  it('reads a dropdown list from /api/v1/lookups/<kind>', () => {
    service.getLookup('language-levels').subscribe();

    const req = http.expectOne(`${environment.serviceUrl}/api/v1/lookups/language-levels`);
    expect(req.request.method).toBe('GET');
    req.flush(reply([]));
  });
});
