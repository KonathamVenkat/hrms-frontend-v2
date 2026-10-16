/** Mirrors DepartmentResponse / DepartmentRequest of GET|POST|PUT /api/v1/admin/departments. */
export interface Department {
  deptId: number;
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  headEmployeeId?: number;
  costCenterCode?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepartmentRequest {
  code: string;
  name: string;
  nameAr: string;
  description?: string;
  /** Not editable on this screen, but a PUT replaces the record, so the current value is sent back. */
  headEmployeeId?: number;
  costCenterCode?: string;
  isActive?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
