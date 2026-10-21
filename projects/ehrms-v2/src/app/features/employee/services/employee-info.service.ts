import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../models/job-details.model';
import { InfoLookup, InfoPayload, InfoRecord, LookupKind } from '../models/employee-info.model';

/**
 * HTTP for the six employee-information sections. Every section has the same endpoints under
 * /api/v1/employees/{id}/<endpoint>: list, add, update (with the version), deactivate and activate.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeInfoService {
  private http = inject(HttpClient);

  private url(employeeId: number, endpoint: string): string {
    return `${environment.serviceUrl}/api/v1/employees/${employeeId}/${endpoint}`;
  }

  getAll<R extends InfoRecord>(employeeId: number, endpoint: string): Observable<ApiResponse<R[]>> {
    return this.http.get<ApiResponse<R[]>>(this.url(employeeId, endpoint));
  }

  add<R extends InfoRecord>(
    employeeId: number,
    endpoint: string,
    payload: InfoPayload,
  ): Observable<ApiResponse<R>> {
    return this.http.post<ApiResponse<R>>(this.url(employeeId, endpoint), payload);
  }

  update<R extends InfoRecord>(
    employeeId: number,
    endpoint: string,
    id: number,
    payload: InfoPayload,
  ): Observable<ApiResponse<R>> {
    return this.http.put<ApiResponse<R>>(`${this.url(employeeId, endpoint)}/${id}`, payload);
  }

  /** A record is deactivated, never deleted. */
  deactivate(employeeId: number, endpoint: string, id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.url(employeeId, endpoint)}/${id}/deactivate`,
      {},
    );
  }

  activate(employeeId: number, endpoint: string, id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.url(employeeId, endpoint)}/${id}/activate`,
      {},
    );
  }

  /** Active values of one reference list, for the dropdowns of the add and edit form (HR_ADMIN only). */
  getLookup(kind: LookupKind): Observable<ApiResponse<InfoLookup[]>> {
    return this.http.get<ApiResponse<InfoLookup[]>>(
      `${environment.serviceUrl}/api/v1/lookups/${kind}`,
    );
  }
}
