export interface Holiday {
  holidayId: number;
  holidayName: string;
  holidayNameAr: string;
  holidayDate: string; // YYYY-MM-DD
  holidayType: string; // PUBLIC | RELIGIOUS | OPTIONAL | RESTRICTED
  description?: string;
  isRecurring: boolean;
  year: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface HolidayRequest {
  holidayName: string;
  holidayNameAr: string;
  holidayDate: string;
  holidayType: string;
  description?: string;
  isRecurring?: boolean;
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
