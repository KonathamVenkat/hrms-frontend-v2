/** Mirrors DesignationResponse / DesignationRequest of GET|POST|PUT /api/v1/admin/designations. */
export interface Designation {
  desigId: number;
  code: string;
  title: string;
  titleAr?: string;
  gradeLevel?: string;
  departmentId?: number;
  departmentName?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DesignationRequest {
  code: string;
  title: string;
  titleAr?: string;
  gradeLevel?: string;
  departmentId?: number;
  isActive?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
