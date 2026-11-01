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

  // Profession (absent when the record has none)
  professionId?: number;
  professionName?: string;
  professionNameAr?: string;

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
  jobPositionId?: string;
  reportingManagerId?: number;
  functionalManagerId?: number;
  locationId: number;
  /** The branch must be active and in the chosen location; null when none. */
  companyBranchId?: number | null;
  shiftId?: number;
  workMode: string;
  effectiveFrom: string;
  remarks?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
