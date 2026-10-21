import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../employee/models/job-details.model';
import {
  BranchAssignmentItem,
  BranchAssignmentResult,
  BranchLookup,
  BranchPlacement,
  BranchPlacementRequest,
  EmployeeBranchGap,
  OrganisationSummary,
  PagedResponse,
} from '../models/organisation.model';

/** HTTP for /api/v1/organisation: branch placement, the missing-data summary and the branch back-fill. */
@Injectable({ providedIn: 'root' })
export class OrganisationService {
  private http = inject(HttpClient);
  private base = `${environment.serviceUrl}/api/v1/organisation`;

  listBranches(): Observable<BranchPlacement[]> {
    return this.http
      .get<ApiResponse<BranchPlacement[]>>(`${this.base}/branches`)
      .pipe(map((r) => r.data));
  }

  lookupBranches(locationId?: number): Observable<BranchLookup[]> {
    const params =
      locationId === undefined ? new HttpParams() : new HttpParams().set('locationId', locationId);
    return this.http
      .get<ApiResponse<BranchLookup[]>>(`${this.base}/branches/lookup`, { params })
      .pipe(map((r) => r.data));
  }

  setPlacement(id: number, body: BranchPlacementRequest): Observable<BranchPlacement> {
    return this.http
      .put<ApiResponse<BranchPlacement>>(`${this.base}/branches/${id}/placement`, body)
      .pipe(map((r) => r.data));
  }

  summary(): Observable<OrganisationSummary> {
    return this.http
      .get<ApiResponse<OrganisationSummary>>(`${this.base}/summary`)
      .pipe(map((r) => r.data));
  }

  employeesWithoutBranch(
    q: string,
    page: number,
    size: number,
  ): Observable<PagedResponse<EmployeeBranchGap>> {
    let params = new HttpParams().set('page', page).set('size', size);
    const term = q.trim();
    if (term) params = params.set('q', term);
    return this.http
      .get<
        ApiResponse<PagedResponse<EmployeeBranchGap>>
      >(`${this.base}/employees-without-branch`, { params })
      .pipe(map((r) => r.data));
  }

  /** Active employees who could manage a branch; a missing locationId means "anywhere". */
  managerCandidates(
    locationId: number | null,
    q: string,
    page: number,
    size: number,
  ): Observable<PagedResponse<EmployeeBranchGap>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (locationId !== null) params = params.set('locationId', locationId);
    const term = q.trim();
    if (term) params = params.set('q', term);
    return this.http
      .get<
        ApiResponse<PagedResponse<EmployeeBranchGap>>
      >(`${this.base}/manager-candidates`, { params })
      .pipe(map((r) => r.data));
  }

  assignBranches(items: BranchAssignmentItem[]): Observable<BranchAssignmentResult> {
    return this.http
      .put<ApiResponse<BranchAssignmentResult>>(`${this.base}/branch-assignments`, { items })
      .pipe(map((r) => r.data));
  }
}
