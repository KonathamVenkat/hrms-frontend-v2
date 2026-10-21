/** Mirrors the records behind /api/v1/organisation (BranchPlacementResponse and friends), field for field. */

export interface BranchPlacement {
  branchId: number;
  code: string;
  name: string;
  nameAr: string;
  companyId: number;
  /** Null until HR sets where the branch sits. */
  locationId?: number;
  locationName?: string;
  locationNameAr?: string;
  /** Null until HR names a manager. */
  managerEmployeeId?: number;
  managerName?: string;
  managerCode?: string;
  isActive: boolean;
  version: number;
}

/** A null manager clears the manager; the server answers 409 when the version is stale. */
export interface BranchPlacementRequest {
  locationId: number;
  managerEmployeeId: number | null;
  version: number;
}

export interface BranchLookup {
  id: number;
  nameEn: string;
  nameAr: string;
  locationId?: number;
}

export interface OrganisationSummary {
  employeesWithoutBranch: number;
  branchesWithoutManager: number;
  branchesWithoutLocation: number;
}

export interface EmployeeBranchGap {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  fullNameAr: string;
  departmentName?: string;
  locationId?: number;
  locationName?: string;
}

export interface BranchAssignmentItem {
  employeeId: number;
  branchId: number;
}

export interface BranchAssignmentSkipped {
  employeeId: number;
  /** BRANCH_INACTIVE, EMPLOYEE_NOT_FOUND, NO_CURRENT_JOB, BRANCH_LOCATION_MISMATCH, ALREADY_ASSIGNED, ... */
  reason: string;
}

export interface BranchAssignmentResult {
  assigned: number;
  skipped: BranchAssignmentSkipped[];
}

/** Mirrors com.hrms.common.dto.PagedResponse. */
export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}
