import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { Designation, DesignationRequest, ApiResponse } from '../models/designation';

@Injectable({ providedIn: 'root' })
export class DesignationService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.serviceUrl}/api/v1/admin/designations`;

  getAll(): Observable<ApiResponse<Designation[]>> {
    return this.http.get<ApiResponse<Designation[]>>(this.baseUrl);
  }
  create(payload: DesignationRequest): Observable<ApiResponse<Designation>> {
    return this.http.post<ApiResponse<Designation>>(this.baseUrl, payload);
  }
  update(id: number, payload: DesignationRequest): Observable<ApiResponse<Designation>> {
    return this.http.put<ApiResponse<Designation>>(`${this.baseUrl}/${id}`, payload);
  }
  deactivate(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${id}/deactivate`, {});
  }
  activate(id: number): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.baseUrl}/${id}/activate`, {});
  }
  delete(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
