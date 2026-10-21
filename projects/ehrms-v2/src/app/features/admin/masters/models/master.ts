/** Mirrors the Response and Request of GET|POST|PUT /api/v1/admin/<endpoint> of every master (one shape for all). */
export interface MasterRecord {
  id: number;
  /** Only the masters that hang under another one have a parent id, named after the parent. */
  bankId?: number;
  companyId?: number;
  regionId?: number;
  wilayaId?: number;
  provinceId?: number;
  relationTypeId?: number;
  companyBranchId?: number;
  code: string;
  name: string;
  nameAr: string;
  /** Grades and language levels only. */
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface MasterRequest {
  bankId?: number;
  companyId?: number;
  regionId?: number;
  wilayaId?: number;
  provinceId?: number;
  relationTypeId?: number;
  companyBranchId?: number;
  code: string;
  name: string;
  nameAr: string;
  /** Grades and language levels only; null clears it. */
  sortOrder?: number | null;
  isActive?: boolean;
  /** Version the screen was loaded with; the server answers 409 if the row changed since. */
  version?: number;
}

/** Mirrors PagedResponse<T> of the paged masters (GET /api/v1/admin/<endpoint>/search). */
export interface MasterPage {
  content: MasterRecord[];
  totalPages: number;
  totalElements: number;
  number: number;
}

export interface MasterSearch {
  q: string;
  parentId: number | null;
  active: boolean | null;
  page: number;
  size: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
