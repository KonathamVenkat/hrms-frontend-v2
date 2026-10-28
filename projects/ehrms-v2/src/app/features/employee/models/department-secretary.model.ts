/** Mirrors DepartmentSecretaryResponse of GET|PUT /api/v1/employees/{id}/department-secretary. */
export interface DepartmentSecretary {
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  /** True when this employee is the secretary of the department. */
  secretary: boolean;
  currentSecretaryId?: number;
  currentSecretaryName?: string;
}
