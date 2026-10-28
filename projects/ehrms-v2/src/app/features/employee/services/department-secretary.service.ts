import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../models/job-details.model';
import { DepartmentSecretary } from '../models/department-secretary.model';

@Injectable({ providedIn: 'root' })
export class DepartmentSecretaryService {
  private http = inject(HttpClient);

  private url(employeeId: number): string {
    return `${environment.serviceUrl}/api/v1/employees/${employeeId}/department-secretary`;
  }

  get(employeeId: number): Observable<ApiResponse<DepartmentSecretary>> {
    return this.http.get<ApiResponse<DepartmentSecretary>>(this.url(employeeId));
  }

  set(employeeId: number, secretary: boolean): Observable<ApiResponse<DepartmentSecretary>> {
    return this.http.put<ApiResponse<DepartmentSecretary>>(this.url(employeeId), { secretary });
  }
}
