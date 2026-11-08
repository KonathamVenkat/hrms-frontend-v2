export interface WorkShift {
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  shiftNameAr: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  workingHours: number;
  gracePeriod: number;
  workingDays: string; // "SUN,MON,TUE,WED,THU"
  isOvernight: boolean;
  isFlexible: boolean;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface WorkShiftRequest {
  shiftCode: string;
  shiftName: string;
  shiftNameAr: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  workingHours: number;
  gracePeriod: number;
  workingDays: string;
  isOvernight: boolean;
  isFlexible: boolean;
  description?: string;
  sortOrder: number;
  isActive?: boolean;
  /** The version the screen was opened with; the server refuses an edit made from an older one. */
  version?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}
