/** Mirrors DepartmentHeadResponse of GET|PUT /api/v1/employees/{id}/department-head. */
export interface DepartmentHead {
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  /** True when this employee heads the department. */
  head: boolean;
  currentHeadId?: number;
  currentHeadName?: string;
}
