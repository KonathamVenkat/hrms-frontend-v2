/** Mirrors EmployeeBankAccountResponse / Request of /api/v1/employees/{id}/bank-accounts. */
export interface EmployeeBankAccount {
  id: number;
  employeeId: number;
  bankId: number;
  bankName?: string;
  bankNameAr?: string;
  bankBranchId?: number;
  bankBranchName?: string;
  bankBranchNameAr?: string;
  /** Last 4 characters only when `masked` is true. */
  accountNumber: string;
  iban?: string;
  accountHolderName?: string;
  isPrimary: boolean;
  isActive: boolean;
  /** True when the numbers are masked by the backend (HR_MANAGER); such a caller cannot edit. */
  masked: boolean;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeBankAccountRequest {
  bankId: number;
  bankBranchId?: number;
  accountNumber: string;
  iban?: string;
  accountHolderName?: string;
  isPrimary?: boolean;
  /** The version the form was opened with; required to update, omitted when adding. */
  version?: number;
}

/** One row of GET /api/v1/banks/lookup and /api/v1/banks/{id}/branches/lookup (MasterLookupResponse). */
export interface MasterLookup {
  id: number;
  code: string;
  name: string;
  nameAr: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
