/** Mirrors Bank/BankBranch/Company/CompanyBranch Response and Request of GET|POST|PUT /api/v1/admin/<endpoint>. */
export interface MasterRecord {
  id: number;
  /** Only the branch masters have a parent: bankId (bank branches) or companyId (company branches). */
  bankId?: number;
  companyId?: number;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface MasterRequest {
  bankId?: number;
  companyId?: number;
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
