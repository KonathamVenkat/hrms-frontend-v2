/** Mirrors SectionResponse / SectionRequest of GET|POST|PUT /api/v1/admin/sections. */
export interface Section {
  id: number;
  departmentId: number;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface SectionRequest {
  departmentId: number;
  code: string;
  name: string;
  nameAr: string;
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
