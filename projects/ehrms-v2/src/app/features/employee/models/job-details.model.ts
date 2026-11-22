export interface JobDetails {
  jobDetailsId: number;
  employeeId: number;

  // Department
  departmentId: number;
  departmentName: string;
  departmentNameAr: string;
  departmentCode: string;

  // Designation
  designationId: number;
  designationTitle: string;
  designationTitleAr: string;
  gradeLevel?: string;

  // Section (absent when the record has none)
  sectionId?: number;
  sectionCode?: string;
  sectionName?: string;
  sectionNameAr?: string;

  // Grade and increment on the pay scale (absent when the record has none)
  gradeId?: number;
  gradeCode?: string;
  gradeName?: string;
  gradeNameAr?: string;
  incrementNo?: number;

  // Profession (absent when the record has none)
  professionId?: number;
  professionName?: string;
  professionNameAr?: string;

  // Specialization and contract (absent when the record has none)
  specializationId?: number;
  specializationName?: string;
  specializationNameAr?: string;
  contractTypeId?: number;
  contractTypeName?: string;
  contractTypeNameAr?: string;
  contractStartDate?: string; // YYYY-MM-DD
  contractEndDate?: string;

  // Appointment references and the current work address
  formRequestNo?: string;
  appointmentRequestNo?: string;
  afe?: string;
  companyIdCardNo?: string;
  currentWorkAddress?: string;
  currentWorkPhone?: string;

  // Position
  jobPositionId?: string;

  // Managers
  reportingManagerId?: number;
  reportingManagerName?: string;
  reportingManagerCode?: string;
  functionalManagerId?: number;
  functionalManagerName?: string;
  functionalManagerCode?: string;

  // Location
  locationId: number;
  locationName: string;
  locationNameAr: string;
  locationCode: string;
  locationCity: string;

  // Branch (null until HR assigns one)
  companyBranchId?: number;
  branchCode?: string;
  branchName?: string;
  branchNameAr?: string;
  branchManagerName?: string;

  // Shift
  shiftId?: number;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;

  // Work
  workMode: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isCurrent: boolean;
  remarks?: string;
  /** Optimistic-lock version: send it back unchanged when updating the current job. */
  version?: number;

  // Audit
  createdBy?: string;
  createdAt?: string;
}

export interface JobDetailsRequest {
  departmentId: number;
  designationId: number;
  /** Optional section of the chosen department; once set it can only change with a new assignment. */
  sectionId?: number | null;
  /** Defaults to the designation's profession; when both are set they must be the same. */
  professionId?: number;
  /**
   * Place on the pay scale: both or neither. Null keeps what the record has; a set pair only changes with a new
   * assignment, and must exist on the pay scale.
   */
  gradeId?: number | null;
  incrementNo?: number | null;
  jobPositionId?: string;
  /** Optional master choices; the backend refuses an inactive one. */
  specializationId?: number | null;
  contractTypeId?: number | null;
  /** The contract end cannot be before its start. */
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  formRequestNo?: string;
  appointmentRequestNo?: string;
  afe?: string;
  companyIdCardNo?: string;
  currentWorkAddress?: string;
  currentWorkPhone?: string;
  reportingManagerId?: number;
  functionalManagerId?: number;
  locationId: number;
  /** The branch must be active and in the chosen location; null when none. */
  companyBranchId?: number | null;
  shiftId?: number;
  workMode: string;
  effectiveFrom: string;
  remarks?: string;
  /** Required when updating the current job; leave out when assigning a new one. */
  version?: number;
}

/** One step of the pay scale in effect today (GET /api/v1/payroll/grade-scale, HR_ADMIN only). */
export interface GradeScaleStep {
  gradeId: number;
  gradeCode: string;
  gradeName: string;
  gradeNameAr: string;
  incrementNo: number;
  /** Starting scale (basic salary), 3 decimals. */
  startingScale: number;
  effectiveFrom: string; // YYYY-MM-DD
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
