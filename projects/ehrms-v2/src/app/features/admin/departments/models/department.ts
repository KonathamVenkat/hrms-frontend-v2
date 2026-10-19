/** Mirrors DepartmentResponse / DepartmentRequest of GET|POST|PUT /api/v1/admin/departments. */
export interface Department {
  deptId: number;
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  headEmployeeId?: number;
  /** Read-only; the head is set from the employee's job details. */
  headEmployeeName?: string;
  costCenterCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface DepartmentRequest {
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  /** Not editable on this screen (set from the employee's job details), but a PUT replaces the record, so the current value is sent back. */
  headEmployeeId?: number;
  costCenterCode?: string;
  isActive?: boolean;
  /** Version the screen was loaded with; the server answers 409 if the row changed since. */
  version?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
