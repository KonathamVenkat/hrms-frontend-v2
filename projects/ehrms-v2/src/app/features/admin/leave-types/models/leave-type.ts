export interface LeaveType {
  leaveTypeId: number;
  code: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  defaultDays: number;
  isPaid: boolean;
  isCarryForward: boolean;
  maxCarryDays: number;
  requiresDocument: boolean;
  docMaxFileSizeMb?: number;
  docAllowedExtensions?: string;
  minNoticeDays: number;
  maxConsecutiveDays: number;
  applicableGender: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface LeaveTypeRequest {
  code: string;
  nameEn: string;
  nameAr: string;
  description?: string;
  defaultDays: number;
  isPaid: boolean;
  isCarryForward: boolean;
  maxCarryDays: number;
  requiresDocument: boolean;
  docMaxFileSizeMb?: number;
  docAllowedExtensions?: string;
  minNoticeDays: number;
  maxConsecutiveDays: number;
  applicableGender: string;
  sortOrder: number;
  isActive?: boolean;
  /** The version the screen was opened with; the server refuses an edit made from an older one. */
  version?: number;
}
