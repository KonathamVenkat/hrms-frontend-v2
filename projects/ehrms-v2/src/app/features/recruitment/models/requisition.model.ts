/** Mirrors the recruitment DTOs of the employee service (com.hrms.recruitment.dto), field for field. */

export type RequisitionStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'FILLED'
  | 'CLOSED'
  | 'CANCELLED';

export type RequisitionType = 'NEW' | 'REPLACEMENT';
export type RequisitionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'CONSULTANT';
export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export const REQUISITION_STATUSES: readonly RequisitionStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ON_HOLD',
  'FILLED',
  'CLOSED',
  'CANCELLED',
];
export const REQUISITION_PRIORITIES: readonly RequisitionPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];
export const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
  'CONSULTANT',
];

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

/** One row of GET /requisitions. */
export interface RequisitionSummary {
  id: number;
  code: string;
  jobTitle: string;
  departmentId: number;
  departmentName?: string;
  requestedByName?: string;
  noOfPositions: number;
  filledPositions: number;
  priority: RequisitionPriority;
  targetJoinDate?: string;
  status: RequisitionStatus;
  createdAt?: string;
}

export interface Approval {
  levelNo: number;
  approverId: number;
  approverName?: string;
  decision: ApprovalDecision;
  budgetConfirmed: boolean;
  managementConfirmed: boolean;
  comments?: string;
  actionAt: string;
}

/** GET /requisitions/{id}. */
export interface Requisition {
  id: number;
  code: string;
  jobTitle: string;
  jobTitleAr?: string;
  departmentId: number;
  departmentName?: string;
  designationId: number;
  designationTitle?: string;
  locationId?: number;
  reportingManagerId?: number;
  reportingManagerName?: string;
  requestedById: number;
  requestedByName?: string;
  noOfPositions: number;
  filledPositions: number;
  employmentType: EmploymentType;
  requisitionType: RequisitionType;
  replacedEmployeeId?: number;
  minExperienceYears: number;
  maxExperienceYears?: number;
  minSalary?: number;
  maxSalary?: number;
  currency: string;
  priority: RequisitionPriority;
  targetJoinDate?: string;
  justification?: string;
  status: RequisitionStatus;
  closedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  version: number;
  approvals?: Approval[];
}

/** Body of POST and PUT /requisitions. The server owns the status, code, requester and currency. */
export interface RequisitionRequest {
  jobTitle: string;
  jobTitleAr?: string;
  departmentId: number;
  designationId: number;
  locationId?: number;
  reportingManagerId?: number;
  noOfPositions: number;
  employmentType: EmploymentType;
  requisitionType: RequisitionType;
  replacedEmployeeId?: number;
  minExperienceYears: number;
  maxExperienceYears?: number;
  minSalary?: number;
  maxSalary?: number;
  priority: RequisitionPriority;
  targetJoinDate?: string;
  justification?: string;
  /** Required to update: the version the screen was loaded with. */
  version?: number;
}

export interface ApproveRequest {
  budgetConfirmed: boolean;
  managementConfirmed: boolean;
  comments?: string;
  version: number;
}

export interface RejectRequest {
  reason: string;
  version: number;
}

/** Body of submit, hold, resume, close and cancel. */
export interface ActionRequest {
  version: number;
}

export interface RequisitionQuery {
  status?: RequisitionStatus;
  departmentId?: number;
  q?: string;
  page: number;
  size: number;
  sortBy: string;
  direction: 'asc' | 'desc';
}

/** GET /requisitions/raise-options: what the caller may pick on the form. */
export interface RaiseOptions {
  departments: LookupOption[];
  designations: DesignationOption[];
  locations: LookupOption[];
}

export interface LookupOption {
  id: number;
  name: string;
  nameAr?: string;
}

export interface DesignationOption {
  id: number;
  title: string;
  titleAr?: string;
  /** Absent for a designation that fits every department. */
  departmentId?: number;
}

export interface PersonOption {
  id: number;
  code: string;
  name: string;
  nameAr?: string;
}
