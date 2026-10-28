import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { DepartmentSecretaryService } from './department-secretary.service';

describe('DepartmentSecretaryService', () => {
  let service: DepartmentSecretaryService;
  let http: HttpTestingController;
  const url = `${environment.serviceUrl}/api/v1/employees/5/department-secretary`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DepartmentSecretaryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the employee department secretary with GET', () => {
    service.get(5).subscribe();

    expect(http.expectOne(url).request.method).toBe('GET');
  });

  it('sets the secretary flag with PUT and a { secretary } body', () => {
    service.set(5, true).subscribe();

    const req = http.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ secretary: true });
  });
});
