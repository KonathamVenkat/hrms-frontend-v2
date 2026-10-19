import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ActionRequest,
  ApiResponse,
  ApproveRequest,
  PagedResponse,
  PersonOption,
  RaiseOptions,
  RejectRequest,
  Requisition,
  RequisitionQuery,
  RequisitionRequest,
  RequisitionSummary,
} from '../models/requisition.model';

/** Requisitions: /api/v1/recruitment/requisitions. */
@Injectable({ providedIn: 'root' })
export class RequisitionService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.serviceUrl}/api/v1/recruitment/requisitions`;

  raiseOptions(): Observable<ApiResponse<RaiseOptions>> {
    return this.http.get<ApiResponse<RaiseOptions>>(`${this.baseUrl}/raise-options`);
  }

  people(departmentId: number): Observable<ApiResponse<PersonOption[]>> {
    const params = new HttpParams().set('departmentId', departmentId);
    return this.http.get<ApiResponse<PersonOption[]>>(`${this.baseUrl}/raise-options/people`, {
      params,
    });
  }

  /** Empty filters are left out, so the server sees only what the user chose. */
  search(query: RequisitionQuery): Observable<ApiResponse<PagedResponse<RequisitionSummary>>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('size', query.size)
      .set('sortBy', query.sortBy)
      .set('direction', query.direction);
    if (query.status) params = params.set('status', query.status);
    if (query.departmentId) params = params.set('departmentId', query.departmentId);
    if (query.q?.trim()) params = params.set('q', query.q.trim());
    return this.http.get<ApiResponse<PagedResponse<RequisitionSummary>>>(this.baseUrl, { params });
  }

  get(id: number): Observable<ApiResponse<Requisition>> {
    return this.http.get<ApiResponse<Requisition>>(`${this.baseUrl}/${id}`);
  }

  create(payload: RequisitionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(this.baseUrl, payload);
  }

  update(id: number, payload: RequisitionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.put<ApiResponse<Requisition>>(`${this.baseUrl}/${id}`, payload);
  }

  submit(id: number, body: ActionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/submit`, body);
  }

  cancel(id: number, body: ActionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/cancel`, body);
  }

  approve(id: number, body: ApproveRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/approve`, body);
  }

  reject(id: number, body: RejectRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/reject`, body);
  }

  hold(id: number, body: ActionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/hold`, body);
  }

  resume(id: number, body: ActionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/resume`, body);
  }

  close(id: number, body: ActionRequest): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/${id}/close`, body);
  }
}
