// ── Calendar models ───────────────────────────────────────────

export interface CalendarLeaveEntry {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  status: string;
  startDate: string;
  endDate: string;
}

export interface CalendarHolidayEntry {
  holidayId: number;
  holidayName: string;
  holidayNameAr?: string;
  holidayType: string;
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  dayOfWeek: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
  holidays: CalendarHolidayEntry[];
  leaves: CalendarLeaveEntry[];
  onLeaveCount: number;
  pendingCount: number;
}

export interface CalendarMonth {
  year: number;
  month: number;
  monthName: string;
  days: CalendarDay[];
  totalApproved: number;
  totalPending: number;
  totalHolidays: number;
  onLeaveToday: number;
  todaysLeaves: CalendarLeaveEntry[];
}
