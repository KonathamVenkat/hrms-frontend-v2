import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../models/job-details.model';
import { DepartmentHead } from '../models/department-head.model';

@Injectable({ providedIn: 'root' })
export class DepartmentHeadService {
  private http = inject(HttpClient);

  private url(employeeId: number): string {
    return `${environment.serviceUrl}/api/v1/employees/${employeeId}/department-head`;
  }

  get(employeeId: number): Observable<ApiResponse<DepartmentHead>> {
    return this.http.get<ApiResponse<DepartmentHead>>(this.url(employeeId));
  }

  set(employeeId: number, head: boolean): Observable<ApiResponse<DepartmentHead>> {
    return this.http.put<ApiResponse<DepartmentHead>>(this.url(employeeId), { head });
  }
}
