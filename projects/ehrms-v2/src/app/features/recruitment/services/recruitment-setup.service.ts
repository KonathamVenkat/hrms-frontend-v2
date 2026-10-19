import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../models/requisition.model';
import {
  RejectionReason,
  RejectionReasonRequest,
  Stage,
  StageRequest,
} from '../models/setup.model';

/** SYSTEM_ADMIN maintenance of the pipeline stages and rejection reasons: /api/v1/admin/recruitment/*. */
@Injectable({ providedIn: 'root' })
export class RecruitmentSetupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.serviceUrl}/api/v1/admin/recruitment`;

  // ── Stages ────────────────────────────────────────────────
  getStages(): Observable<ApiResponse<Stage[]>> {
    return this.http.get<ApiResponse<Stage[]>>(`${this.baseUrl}/stages`);
  }
  createStage(payload: StageRequest): Observable<ApiResponse<Stage>> {
    return this.http.post<ApiResponse<Stage>>(`${this.baseUrl}/stages`, payload);
  }
  updateStage(id: number, payload: StageRequest): Observable<ApiResponse<Stage>> {
    return this.http.put<ApiResponse<Stage>>(`${this.baseUrl}/stages/${id}`, payload);
  }
  setStageActive(id: number, active: boolean): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/stages/${id}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }
  deleteStage(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/stages/${id}`);
  }

  // ── Rejection reasons ─────────────────────────────────────
  getReasons(): Observable<ApiResponse<RejectionReason[]>> {
    return this.http.get<ApiResponse<RejectionReason[]>>(`${this.baseUrl}/rejection-reasons`);
  }
  createReason(payload: RejectionReasonRequest): Observable<ApiResponse<RejectionReason>> {
    return this.http.post<ApiResponse<RejectionReason>>(
      `${this.baseUrl}/rejection-reasons`,
      payload,
    );
  }
  updateReason(
    id: number,
    payload: RejectionReasonRequest,
  ): Observable<ApiResponse<RejectionReason>> {
    return this.http.put<ApiResponse<RejectionReason>>(
      `${this.baseUrl}/rejection-reasons/${id}`,
      payload,
    );
  }
  setReasonActive(id: number, active: boolean): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(
      `${this.baseUrl}/rejection-reasons/${id}/${active ? 'activate' : 'deactivate'}`,
      {},
    );
  }
  deleteReason(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/rejection-reasons/${id}`);
  }
}
