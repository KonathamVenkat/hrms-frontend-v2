import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  ApiResponse,
  MasterPage,
  MasterRecord,
  MasterRequest,
  MasterSearch,
} from '../models/master';

/** CRUD for the SYSTEM_ADMIN master screens; every master has the same endpoints under /api/v1/admin/<endpoint>. */
@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);
  private url = (endpoint: string) => `${environment.serviceUrl}/api/v1/admin/${endpoint}`;

  getAll(endpoint: string): Observable<ApiResponse<MasterRecord[]>> {
    return this.http.get<ApiResponse<MasterRecord[]>>(this.url(endpoint));
  }
  /** One page of a paged master; the filter on the parent is sent under the parent's own field name. */
  search(
    endpoint: string,
    parentField: string | undefined,
    s: MasterSearch,
  ): Observable<ApiResponse<MasterPage>> {
    let params = new HttpParams().set('page', s.page).set('size', s.size);
    if (s.q) params = params.set('q', s.q);
    if (parentField && s.parentId !== null) params = params.set(parentField, s.parentId);
    if (s.active !== null) params = params.set('active', s.active);
    return this.http.get<ApiResponse<MasterPage>>(`${this.url(endpoint)}/search`, { params });
  }
  create(endpoint: string, payload: MasterRequest): Observable<ApiResponse<MasterRecord>> {
    return this.http.post<ApiResponse<MasterRecord>>(this.url(endpoint), payload);
  }
  update(
    endpoint: string,
    id: number,
    payload: MasterRequest,
  ): Observable<ApiResponse<MasterRecord>> {
    return this.http.put<ApiResponse<MasterRecord>>(`${this.url(endpoint)}/${id}`, payload);
  }
  deactivate(endpoint: string, id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.url(endpoint)}/${id}/deactivate`, {});
  }
  activate(endpoint: string, id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.url(endpoint)}/${id}/activate`, {});
  }
  delete(endpoint: string, id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.url(endpoint)}/${id}`);
  }
}
