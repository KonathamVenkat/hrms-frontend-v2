import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DepartmentLookup } from '../../employee/models/employee';
import { environment } from '../../../../environments/environment';
import {
  ApiResponse,
  InboxItem,
  PagedResponse,
  RequestHistory,
  RequestType,
  WorkflowActionRequest,
  WorkflowOverrideRequest,
  WorkflowStatus,
} from '../models/workflow.model';

/** Approval workflow: /api/v1/requests/{type}/{id}/... and the approver inbox /api/v1/inbox. */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private http = inject(HttpClient);
  private root = `${environment.serviceUrl}/api/v1`;

  private url(type: RequestType, id: number, tail: string): string {
    return `${this.root}/requests/${type}/${id}/${tail}`;
  }

  inbox(page: number, size: number): Observable<ApiResponse<PagedResponse<InboxItem>>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<ApiResponse<PagedResponse<InboxItem>>>(`${this.root}/inbox`, { params });
  }

  status(type: RequestType, id: number): Observable<ApiResponse<WorkflowStatus>> {
    return this.http.get<ApiResponse<WorkflowStatus>>(this.url(type, id, 'workflow'));
  }

  history(type: RequestType, id: number): Observable<ApiResponse<RequestHistory[]>> {
    return this.http.get<ApiResponse<RequestHistory[]>>(this.url(type, id, 'history'));
  }

  /** Departments a step holder may forward to (active only); 403 for anyone who does not hold a picking step. */
  targetDepartments(type: RequestType, id: number): Observable<ApiResponse<DepartmentLookup[]>> {
    return this.http.get<ApiResponse<DepartmentLookup[]>>(
      this.url(type, id, 'workflow/target-departments'),
    );
  }

  act(
    type: RequestType,
    id: number,
    body: WorkflowActionRequest,
  ): Observable<ApiResponse<WorkflowStatus>> {
    return this.http.post<ApiResponse<WorkflowStatus>>(this.url(type, id, 'actions'), body);
  }

  cancel(type: RequestType, id: number): Observable<ApiResponse<WorkflowStatus>> {
    return this.http.post<ApiResponse<WorkflowStatus>>(this.url(type, id, 'cancel'), {});
  }

  override(
    type: RequestType,
    id: number,
    body: WorkflowOverrideRequest,
  ): Observable<ApiResponse<WorkflowStatus>> {
    return this.http.post<ApiResponse<WorkflowStatus>>(this.url(type, id, 'override'), body);
  }
}
